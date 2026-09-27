// Fetches the city calendars that block Vercel's servers (see `remote: true` in the registry)
// from wherever this script runs (a scheduled GitHub Action), then pushes the records to
// GoToday's /api/ingest/push endpoint, which validates and stores them like any other source.
//
//   GOTODAY_URL=https://gotoday-six.vercel.app INGESTION_SECRET=... npx tsx scripts/remote-ingest.ts
import {remoteSources} from "../lib/ingestion/registry";

const base=(process.env.GOTODAY_URL||"").replace(/\/$/,""),secret=process.env.INGESTION_SECRET||"";
if(!base||!secret){console.error("Set GOTODAY_URL and INGESTION_SECRET");process.exit(1)}
const ymd=(d:Date)=>d.toISOString().slice(0,10);
const now=new Date(),end=new Date(now);end.setUTCDate(end.getUTCDate()+30);

async function main(){
let failures=0;
for(const s of remoteSources()){
 let payload:any;
 try{const events=await s.fetch(ymd(now),ymd(end));payload={source:s.name,events};console.log(`${s.name}: fetched ${events.length}`)}
 catch(e:any){payload={source:s.name,error:e?.message||String(e)};console.log(`${s.name}: fetch failed — ${payload.error}`)}
 const r=await fetch(`${base}/api/ingest/push`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${secret}`},body:JSON.stringify(payload)});
 const out=await r.json().catch(()=>({}));
 console.log(`  -> ${r.status} ${JSON.stringify(out.summary||out)}`);
 if(!r.ok||out.summary?.status!=="success")failures++;
}
console.log(failures?`${failures} source(s) did not succeed`:"All remote sources succeeded");
}
main().catch(e=>{console.error(e);process.exit(1)});
