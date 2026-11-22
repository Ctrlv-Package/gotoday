// Quality audit: the "new-state check" as code. Samples live listings through the same public
// /api/events endpoint a visitor uses, runs the checks in lib/quality/checks.ts over them, and
// reports per-source counts plus example findings. Run it any time, or let the daily quality
// workflow run it and keep the JSON report for drift-checking:
//   npx tsx scripts/quality-audit.ts [--out quality.json]
// Reads GOTODAY_URL (default https://www.mygotoday.com). No secrets, no database access.
// Photo checks (the classes that make cards look broken): every distinct /img/ URL the sample
// returns is fetched — a 404 is a dead picture whose card falls back to the emoji tile — and
// each day's list is checked for two different events sharing one stored photo. Both are
// countable in the report (which events, which URLs), and the drift check fails the daily run
// while any of them are present.
import {auditFindings,duplicateImageFindings,brokenImageFindings,type ApiEvent,type AuditFinding} from "../lib/quality/checks";
import type {SourceStats} from "../lib/quality/drift";

const BASE=(process.env.GOTODAY_URL||"https://www.mygotoday.com").replace(/\/$/,"");
const args=process.argv.slice(2);
const outFile=args[args.indexOf("--out")+1];
// One representative ZIP per area (the site searches a 25-mile radius from it).
const AREAS:Record<string,string>={"Sunrise, FL":"33326","Fort Lauderdale, FL":"33301","Miami, FL":"33101",
 "Tampa, FL":"33602","Orlando, FL":"32801","Jacksonville, FL":"32202","Atlanta, GA":"30301",
 "Charlotte, NC":"28202","Washington, DC":"20001","Boston, MA":"02108"};
const DAYS=7;
const ymd=(d:Date)=>d.toISOString().slice(0,10);
type Agg={stats:SourceStats;examples:Record<string,AuditFinding[]>};
async function main(){
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York"}).format(new Date());
 const dates=Array.from({length:DAYS},(_,i)=>{const d=new Date(today+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+i);return ymd(d)});
 const seen=new Set<string>(),perSource:Record<string,Agg>={},byType:Record<string,number>={};
 const allEvents:ApiEvent[]=[];
 const aggFor=(src:string)=>perSource[src]||(perSource[src]={stats:{events:0,familyNoSignal:0,stock:0,missingImage:0,missingTime:0,failsValidation:0,brokenImage:0,duplicateImage:0},examples:{}});
 const record=(f:AuditFinding)=>{
  byType[f.type]=(byType[f.type]||0)+1;
  const agg=aggFor(f.source||"(unknown)");
  if(f.type==="family-no-signal")agg.stats.familyNoSignal++;
  if(f.type==="missing-image")agg.stats.missingImage++;
  if(f.type==="missing-time")agg.stats.missingTime++;
  if(f.type==="fails-validation")agg.stats.failsValidation++;
  if(f.type==="broken-image")agg.stats.brokenImage=(agg.stats.brokenImage||0)+1;
  if(f.type==="duplicate-image")agg.stats.duplicateImage=(agg.stats.duplicateImage||0)+1;
  const ex=agg.examples[f.type]||(agg.examples[f.type]=[]);
  if(ex.length<3&&!ex.some(x=>x.title===f.title))ex.push(f);
 };
 let total=0;
 const dupeSeen=new Set<string>();
 for(const [area,zip] of Object.entries(AREAS))for(const date of dates){
  const r=await fetch(`${BASE}/api/events?postalCode=${zip}&range=${date}&today=${today}`,{headers:{"user-agent":"gotoday-quality-audit"}});
  if(!r.ok)throw new Error(`${r.status} for ${zip} ${date}`);
  const d:any=await r.json();
  const list=(d.events||[]) as ApiEvent[];
  // Duplicates live in one day's list, so they are checked on the raw list (before the
  // cross-area dedupe below); the same pair showing in two overlapping areas counts once.
  for(const f of duplicateImageFindings(list)){
   if(f.eventId&&dupeSeen.has(f.eventId))continue;
   if(f.eventId)dupeSeen.add(f.eventId);
   record(f);
  }
  for(const e of list){
   if(!e.id||seen.has(e.id))continue;seen.add(e.id);total++;allEvents.push(e);
   const agg=aggFor(e.source||"(unknown)");
   agg.stats.events++;if(e.stockImage)agg.stats.stock++;
   for(const f of auditFindings(e))record(f);
  }
 }
 // Dead pictures: fetch every distinct stored URL the sample returned (a 404 means the card
 // shows the emoji tile). One retry on a failed fetch, so a blip doesn't fail the run.
 const imgUrls=[...new Set(allEvents.map(e=>e.image||"").filter(u=>u.startsWith("/img/")))];
 const broken=new Map<string,string>();
 {
  let next=0;
  const checkOne=async(url:string)=>{
   for(let attempt=0;attempt<2;attempt++){
    try{
     const r=await fetch(`${BASE}${url}`,{method:"HEAD",signal:AbortSignal.timeout(15000),headers:{"user-agent":"gotoday-quality-audit"}});
     if(r.ok)return;
     if(r.status>=500&&attempt===0)continue;
     broken.set(url,`HTTP ${r.status}`);return;
    }catch{/* retry once, then it counts as broken: the picture doesn't load */}
   }
   broken.set(url,"fetch failed");
  };
  await Promise.all(Array.from({length:10},async()=>{while(next<imgUrls.length){const u=imgUrls[next++];await checkOne(u)}}));
 }
 for(const f of brokenImageFindings(allEvents,new Set(broken.keys())))record(f);
 const perSourceStats:Record<string,SourceStats>={};for(const [k,v] of Object.entries(perSource))perSourceStats[k]=v.stats;
 const examples:Record<string,Record<string,AuditFinding[]>>={};for(const [k,v] of Object.entries(perSource))examples[k]=v.examples;
 const report={generatedAt:new Date().toISOString(),totals:{events:total},perSource:perSourceStats,findingsByType:byType,examples};
 console.log(`Quality audit: ${total} live listings, ${Object.keys(perSource).length} sources`);
 for(const [t,n] of Object.entries(byType).sort((a,b)=>b[1]-a[1]))console.log(`  ${t}: ${n}`);
 for(const [s,st] of Object.entries(perSourceStats).sort((a,b)=>b[1].events-a[1].events).slice(0,12))
  console.log(`  ${s}: ${st.events} events, ${st.familyNoSignal} family-no-signal, ${st.stock} stock, ${st.missingImage} no image`);
 // Photos, concretely: which pictures are dead and which are shared, so the fix starts from names, not counts.
 console.log(`Photos: checked ${imgUrls.length} stored image(s), ${broken.size} broken, ${byType["duplicate-image"]||0} duplicate`);
 for(const [url,status] of [...broken.entries()].sort()){
  const who=allEvents.filter(e=>e.image===url).map(e=>`"${e.title}" (${e.id||"?"})`).join(", ");
  console.log(`  BROKEN ${url} (${status}) — ${who}`);
 }
 for(const [src,agg] of Object.entries(examples))
  for(const f of agg["duplicate-image"]||[])console.log(`  DUPLICATE ${f.detail} — "${f.title}" (${f.eventId||"?"}, ${src})`);
 if(outFile){const {writeFileSync}=await import("node:fs");writeFileSync(outFile,JSON.stringify(report,null,2));console.log(`Report written to ${outFile}`)}
}
main().catch(e=>{console.error(e);process.exit(1)});
