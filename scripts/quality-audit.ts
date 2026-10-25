// Quality audit: the "new-state check" as code. Samples live listings through the same public
// /api/events endpoint a visitor uses, runs the checks in lib/quality/checks.ts over them, and
// reports per-source counts plus example findings. Run it any time, or let the daily quality
// workflow run it and keep the JSON report for drift-checking:
//   npx tsx scripts/quality-audit.ts [--out quality.json]
// Reads GOTODAY_URL (default https://www.mygotoday.com). No secrets, no database access.
import {auditFindings,type ApiEvent,type AuditFinding} from "../lib/quality/checks";
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
 let total=0;
 for(const [area,zip] of Object.entries(AREAS))for(const date of dates){
  const r=await fetch(`${BASE}/api/events?postalCode=${zip}&range=${date}&today=${today}`,{headers:{"user-agent":"gotoday-quality-audit"}});
  if(!r.ok)throw new Error(`${r.status} for ${zip} ${date}`);
  const d:any=await r.json();
  for(const e of (d.events||[]) as ApiEvent[]){
   if(!e.id||seen.has(e.id))continue;seen.add(e.id);total++;
   const src=e.source||"(unknown)",agg=perSource[src]||(perSource[src]={stats:{events:0,familyNoSignal:0,stock:0,missingImage:0,missingTime:0,failsValidation:0},examples:{}});
   agg.stats.events++;if(e.stockImage)agg.stats.stock++;
   for(const f of auditFindings(e)){
    byType[f.type]=(byType[f.type]||0)+1;
    if(f.type==="family-no-signal")agg.stats.familyNoSignal++;
    if(f.type==="missing-image")agg.stats.missingImage++;
    if(f.type==="missing-time")agg.stats.missingTime++;
    if(f.type==="fails-validation")agg.stats.failsValidation++;
    const ex=agg.examples[f.type]||(agg.examples[f.type]=[]);
    if(ex.length<3&&!ex.some(x=>x.title===f.title))ex.push(f);
   }
  }
 }
 const perSourceStats:Record<string,SourceStats>={};for(const [k,v] of Object.entries(perSource))perSourceStats[k]=v.stats;
 const examples:Record<string,Record<string,AuditFinding[]>>={};for(const [k,v] of Object.entries(perSource))examples[k]=v.examples;
 const report={generatedAt:new Date().toISOString(),totals:{events:total},perSource:perSourceStats,findingsByType:byType,examples};
 console.log(`Quality audit: ${total} live listings, ${Object.keys(perSource).length} sources`);
 for(const [t,n] of Object.entries(byType).sort((a,b)=>b[1]-a[1]))console.log(`  ${t}: ${n}`);
 for(const [s,st] of Object.entries(perSourceStats).sort((a,b)=>b[1].events-a[1].events).slice(0,12))
  console.log(`  ${s}: ${st.events} events, ${st.familyNoSignal} family-no-signal, ${st.stock} stock, ${st.missingImage} no image`);
 if(outFile){const {writeFileSync}=await import("node:fs");writeFileSync(outFile,JSON.stringify(report,null,2));console.log(`Report written to ${outFile}`)}
}
main().catch(e=>{console.error(e);process.exit(1)});
