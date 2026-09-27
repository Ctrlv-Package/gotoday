// Fetches the city calendars that block Vercel's servers (see `remote: true` in the registry)
// from wherever this script runs (a scheduled GitHub Action), then pushes the records to
// GoToday's /api/ingest/push endpoint, which validates and stores them like any other source.
//
//   GOTODAY_URL=https://gotoday-six.vercel.app INGESTION_SECRET=... npx tsx scripts/remote-ingest.ts
import {remoteSources} from "../lib/ingestion/registry";
import {appendFileSync} from "node:fs";
import {installBrowserFetch,closeBrowserFetch} from "./browser-fetch";

const base=(process.env.GOTODAY_URL||"").replace(/\/$/,""),secret=process.env.INGESTION_SECRET||"";
if(!base||!secret){console.error("Set GOTODAY_URL and INGESTION_SECRET");process.exit(1)}
const ymd=(d:Date)=>d.toISOString().slice(0,10);
const now=new Date(),end=new Date(now);end.setUTCDate(end.getUTCDate()+30);

async function main(){
if(process.env.USE_BROWSER!=="0"){await installBrowserFetch();console.log("Fetching city pages with headless Chrome")}
let failures=0;const rows:string[]=[];
for(const s of remoteSources()){
 await new Promise(r=>setTimeout(r,3000));
 let payload:any;
 try{const events=await s.fetch(ymd(now),ymd(end));payload={source:s.name,events};console.log(`${s.name}: fetched ${events.length}`)}
 catch(e:any){payload={source:s.name,error:e?.message||String(e)};console.log(`${s.name}: fetch failed — ${payload.error}`)}
 const r=await fetch(`${base}/api/ingest/push`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${secret}`},body:JSON.stringify(payload)});
 const out=await r.json().catch(()=>({}));
 console.log(`  -> ${r.status} ${JSON.stringify(out.summary||out)}`);
 const ok=r.ok&&out.summary?.status==="success";if(!ok)failures++;
 const sm=out.summary||{};rows.push(`| ${s.name} | ${ok?"✅":"❌"} | ${sm.found??0} | ${sm.accepted??0} | ${sm.rejected??0} | ${String(sm.error||out.error||"").replace(/\|/g,"/").slice(0,160)} |`);
}
console.log(failures?`${failures} source(s) did not succeed`:"All remote sources succeeded");
 // Show a results table on the GitHub Actions run page, and mark the run failed if any city failed.
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,["### Remote ingest results","","| Source | OK | Found | Accepted | Rejected | Error |","|---|---|---|---|---|---|",...rows,""].join("\n"));
 if(failures)process.exitCode=1;
 await closeBrowserFetch();
}
main().catch(e=>{console.error(e);process.exit(1)});
