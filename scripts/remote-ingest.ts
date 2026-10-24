// Fetches the city calendars that block Vercel's servers (see `remote: true` in the registry)
// from wherever this script runs (a scheduled GitHub Action), then pushes the records to
// GoToday's /api/ingest/push endpoint, which validates and stores them like any other source.
//
//   GOTODAY_URL=https://mygotoday.com INGESTION_SECRET=... npx tsx scripts/remote-ingest.ts
import {sourceFromConfig,type SourceConfig} from "../lib/ingestion/registry";
import {appendFileSync} from "node:fs";
import {installBrowserFetch,closeBrowserFetch,resetBrowserContext} from "./browser-fetch";

let base=(process.env.GOTODAY_URL||"").replace(/\/$/,"");const secret=process.env.INGESTION_SECRET||"";
if(!base||!secret){console.error("Set GOTODAY_URL and INGESTION_SECRET");process.exit(1)}
const ymd=(d:Date)=>d.toISOString().slice(0,10);
const now=new Date(),end=new Date(now);end.setUTCDate(end.getUTCDate()+30);

/** Follow redirects (mygotoday.com -> www.mygotoday.com) up front: the password header is dropped when a
 *  request is redirected to another host, so every call must go straight to the final address. */
async function resolveBase(u:string){try{const r=await fetch(u,{method:"GET",redirect:"follow"});return new URL(r.url).origin}catch{return u}}

async function main(){
base=await resolveBase(base);console.log(`GoToday site: ${base}`);
if(process.env.USE_BROWSER!=="0"){await installBrowserFetch();console.log("Fetching city pages with headless Chrome")}
let failures=0;const rows:string[]=[],problems:string[]=[];const startedAt=new Date().toISOString();
// Send results to the site; if the site hiccups (deploy in progress, timeout), wait and try once more.
async function push(payload:any){
 for(let i=0;i<2;i++){
  try{const r=await fetch(`${base}/api/ingest/push`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${secret}`},body:JSON.stringify(payload),signal:AbortSignal.timeout(300000)});
   const out=await r.json().catch(()=>({}));if(r.ok&&out.summary)return{r,out};if(i)return{r,out:{...out,error:out.error||`site answered HTTP ${r.status}`}};}
  catch(e:any){if(i)return{r:{ok:false,status:0} as any,out:{error:`could not reach the site: ${e?.message||e}`}}}
  await new Promise(r=>setTimeout(r,8000));
 }
 return{r:{ok:false,status:0} as any,out:{}};
}
// The source list lives in GoToday's database; ask the site which sources to fetch from here.
// Retried: right after a deploy (or when the database is waking up) the first request can be slow or fail once.
let cfgRes!:Response;
for(let t=0;t<4;t++){
 try{cfgRes=await fetch(`${base}/api/admin/sources?remote=1`,{headers:{authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(60000)});if(cfgRes.ok||cfgRes.status===401)break;console.log(`Source list: HTTP ${cfgRes.status}, retrying…`)}
 catch(e:any){console.log(`Source list: ${e?.message||e}, retrying…`);if(t===3)throw e}
 await new Promise(r=>setTimeout(r,15000*(t+1)));
}
if(!cfgRes.ok){
 const msg=cfgRes.status===401?"HTTP 401 (unauthorized) — check that the INGESTION_SECRET GitHub secret matches INGESTION_SECRET in Vercel":`HTTP ${cfgRes.status}`;
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`### Remote ingest could not start\n\nCould not load the source list from ${base}: ${msg}\n`);
 throw new Error(`Could not load remote sources from ${base}: ${msg}`);
}
const configs:SourceConfig[]=(await cfgRes.json()).sources||[];
console.log(`Remote sources: ${configs.map(c=>c.name).join(", ")||"(none)"}`);
// City firewalls sometimes refuse one request (HTTP 403/429) and accept the next. Those sources aren't marked
// failed right away: they're retried at the end, after a pause, with a fresh browser profile.
const isBlock=(m:string)=>/HTTP (403|429)\b/.test(m);
const deferred:{s:ReturnType<typeof sourceFromConfig>;error:string}[]=[];
const queue:{s:ReturnType<typeof sourceFromConfig>;retry:boolean}[]=configs.map(c=>({s:sourceFromConfig(c),retry:false}));
// Instagram's hourly Meta budget: once accounts start being rate-limit skipped, stop feeding the full
// bucket — the remaining accounts keep their place at the front of the next run (stalest first).
let igSkips=0,igStopped=false;
for(let i=0;i<queue.length;i++){
 const {s,retry}=queue[i];
 if(igStopped&&s.platform==="instagram"){console.log(`${s.name}: deferred to the next run (Instagram rate limit hit earlier in this run)`);continue}
 if(retry&&!queue[i-1]?.retry){console.log(`Retrying ${deferred.length} blocked source(s) after a pause…`);await new Promise(r=>setTimeout(r,90000));await resetBrowserContext()}
 await new Promise(r=>setTimeout(r,retry?10000:3000));
 let payload:any;
 try{const events=await s.fetch(ymd(now),ymd(end));payload={source:s.name,events};console.log(`${s.name}: fetched ${events.length}${retry?" (retry)":""}`)}
 catch(e:any){
  const msg=e?.message||String(e);
  if(!retry&&isBlock(msg)){console.log(`${s.name}: blocked (${msg.slice(0,120)}) — will retry at the end`);deferred.push({s,error:msg});queue.push({s,retry:true});continue}
  payload={source:s.name,error:msg};console.log(`${s.name}: fetch failed — ${msg}`)}
 const {r,out}=await push(payload);
 console.log(`  -> ${r.status} ${JSON.stringify(out.summary||out)}`);
 const ok=r.ok&&out.summary?.status==="success";if(!ok){failures++;problems.push(`${s.name}: ${String(out.summary?.error||out.error||"failed").slice(0,140)}`)}
 if(s.platform==="instagram"){
  if(out.summary?.status==="skipped"&&/Instagram rate limit/i.test(String(out.summary?.error||""))){igSkips++;if(igSkips>=3&&!igStopped){igStopped=true;console.log("Instagram rate limit: 3 accounts skipped in a row — stopping Instagram fetches for this run; the rest go first next run")}}
  else if(ok)igSkips=0;
 }
 const sm=out.summary||{};rows.push(`| ${s.name} | ${ok?"✅":"❌"} | ${sm.found??0} | ${sm.accepted??0} | ${sm.rejected??0} | ${String(sm.error||out.error||"").replace(/\|/g,"/").slice(0,160)} |`);
}
console.log(failures?`${failures} source(s) did not succeed`:"All remote sources succeeded");
 // Website sources Vercel couldn't reach on their last try (city firewalls): fetch them from here and push.
 const fbRows:string[]=[];let fbTried=0,fbFailed=0;
 try{
  const lr=await fetch(`${base}/api/ingest?list=fallback`,{headers:{authorization:`Bearer ${secret}`}});
  const fbNames:string[]=((await lr.json().catch(()=>({}))).sources)||[];
  if(fbNames.length){
   const cr=await fetch(`${base}/api/admin/sources?names=${encodeURIComponent(fbNames.join("|"))}`,{headers:{authorization:`Bearer ${secret}`}});
   const cfgs:SourceConfig[]=((await cr.json().catch(()=>({}))).sources)||[];
   console.log(`Retrying ${cfgs.length} blocked website source(s) from GitHub: ${cfgs.map(c=>c.name).join(", ")}`);
   for(const s of cfgs.map(sourceFromConfig)){
    await new Promise(r=>setTimeout(r,2000));
    let payload:any;
    try{payload={source:s.name,fallback:true,events:await s.fetch(ymd(now),ymd(end))}}catch(e:any){payload={source:s.name,fallback:true,error:e?.message||String(e)}}
    const {r,out}=await push(payload);const sm=out.summary||{},ok=r.ok&&sm.status==="success";fbTried++;if(!ok)fbFailed++;if(!ok)problems.push(`${s.name}: ${String(sm.error||out.error||"failed").slice(0,140)}`);
    console.log(`${s.name} (retry): ${ok?`${sm.accepted} events`:`failed — ${sm.error||out.error}`}`);
    fbRows.push(`| ${s.name} | ${ok?"✅":"❌"} | ${sm.accepted??0} | ${String(sm.error||out.error||"").replace(/\|/g,"/").slice(0,160)} |`);
   }
   if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,["",`### Retried from GitHub (Vercel was blocked)`,"","| Source | OK | Events | Error |","|---|---|---|---|",...fbRows,""].join("\n"));
  }
 }catch(e:any){console.log(`Retry step failed: ${e?.message||e}`)}

 // Instagram accounts: the site does the work (Instagram API + flyer reading); we just call each one, 3 at a time.
 const igRows:string[]=[];let igEvents=0,igFailed=0,igTotal=0;
 try{
  const lr=await fetch(`${base}/api/ingest?list=instagram`,{headers:{authorization:`Bearer ${secret}`}});
  const names:string[]=((await lr.json().catch(()=>({}))).sources)||[];
  console.log(`Instagram accounts: ${names.length}`);igTotal=names.length;if(!names.length)problems.push(`Instagram list came back empty (HTTP ${lr.status})`);
  let next=0;
  await Promise.all(Array.from({length:3},async()=>{while(next<names.length){const name=names[next++];
   try{const r=await fetch(`${base}/api/ingest?source=${encodeURIComponent(name)}`,{method:"POST",headers:{authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(310000)});
    const d:any=await r.json().catch(()=>({}));const sm=d?.sources?.[0]||{status:"error",error:d?.error||`HTTP ${r.status}`};
    // Instagram's hourly limit: stop here; the rest are read on the next run (nothing is lost).
    if(sm.status==="skipped"||/rate limit/i.test(String(sm.error||""))){if(next<names.length){problems.push(`Instagram hourly limit reached — ${names.length-next} accounts wait for the next run`);next=names.length}continue}
    const ok=sm.status==="success";if(ok)igEvents+=sm.accepted||0;else{igFailed++;problems.push(`${name}: ${String(sm.error||"failed").slice(0,140)}`)}
    console.log(`${name}: ${ok?`${sm.accepted} events`:`failed — ${sm.error}`}`);
    if(!ok||sm.accepted)igRows.push(`| ${name.replace(/ · Instagram$/,"")} | ${ok?"✅":"❌"} | ${sm.accepted??0} | ${String(sm.error||"").replace(/\|/g,"/").slice(0,160)} |`);
   }catch(e:any){igFailed++;problems.push(`${name}: ${String(e?.message||e).slice(0,140)}`);igRows.push(`| ${name} | ❌ | 0 | ${String(e?.message||e).slice(0,120)} |`)}
  }}));
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,["",`### Instagram accounts: ${names.length} checked, ${igEvents} events, ${igFailed} problems`,"","Accounts with no upcoming events aren't listed.","","| Account | OK | Events | Note |","|---|---|---|---|",...igRows,""].join("\n"));
 }catch(e:any){console.log(`Instagram step failed: ${e?.message||e}`)}
 // Show a results table on the GitHub Actions run page, and mark the run failed if any city failed.
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,["### Remote ingest results","","| Source | OK | Found | Accepted | Rejected | Error |","|---|---|---|---|---|---|",...rows,""].join("\n"));
 // Check what visitors now see in every area (duplicates, borrowed photos, wrong labels) and save it for the status page.
 // Photo types for new event titles (AI reads them; free tier, paced on the site).
 try{const pr=await fetch(`${base}/api/admin/phototopics?run=12`,{method:"POST",headers:{authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(290000)});console.log("photo types:",JSON.stringify(await pr.json().catch(()=>({}))).slice(0,300))}catch(e:any){console.log(`photo types: ${e?.message||e}`)}
 try{const qr=await fetch(`${base}/api/admin/audit?save=1`,{headers:{authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(280000)});const q:any=await qr.json().catch(()=>({}));
  if(q.ok){console.log(`Quality check: ${q.problems} to look at across ${q.cards} cards ${JSON.stringify(q.summary)}`);if(q.problems>25)problems.push(`Quality check: ${q.problems} display problems (see status page)`)}
  else console.log(`Quality check failed: HTTP ${qr.status}`)}catch(e:any){console.log(`Quality check failed: ${e?.message||e}`)}
 // Tell the site how this run went (shown on the status page).
 const total=configs.length+igTotal+fbTried,bad=failures+igFailed+fbFailed;
 await fetch(`${base}/api/ingest/report`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${secret}`},
  body:JSON.stringify({sources:total,succeeded:total-bad,failed:bad,startedAt,notes:problems.slice(0,25).join("\n")})}).catch(e=>console.log(`Could not send the run report: ${e?.message||e}`));
 if(failures)process.exitCode=1;
 await closeBrowserFetch();
}
main().catch(e=>{console.error(e);process.exit(1)});
