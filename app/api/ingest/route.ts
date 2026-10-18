import {NextRequest,NextResponse} from "next/server";
import {persistIngestion} from "../../../lib/ingestion/persist";
import {activeSources} from "../../../lib/ingestion/registry";
import {db} from "../../../lib/db";
import {cityCoords} from "../../../lib/ingestion/geocode";
import {assignSeries} from "../../../lib/series";
import {purgeImages} from "../../../lib/images";
import {ensureSchema} from "../../../lib/schema";
// Call the site by its public address: a scheduled run may arrive on an internal Vercel URL that
// deployment protection blocks for the per-source calls below.
const SITE=(process.env.NEXT_PUBLIC_SITE_URL||"https://www.mygotoday.com").replace(/\/$/,"");
export const dynamic="force-dynamic";
export const maxDuration=300;

function ymd(d:Date){return d.toISOString().slice(0,10)}
// Manual runs use INGESTION_SECRET; Vercel Cron sends "Bearer $CRON_SECRET" automatically.
function authHeader(req:NextRequest){
 const auth=req.headers.get("authorization");
 return [process.env.INGESTION_SECRET,process.env.CRON_SECRET].some(s=>s&&auth===`Bearer ${s}`)?auth:null;
}

// With ?source=<name>: ingest that one source in this invocation.
// Without: fan out — call this endpoint once per source (each its own function with its own time
// limit), 4 at a time, and return every source's summary.
async function run(req:NextRequest){
 const auth=authHeader(req);
 if(!auth)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const now=new Date(),end=new Date(now);end.setUTCDate(end.getUTCDate()+30);
 const only=req.nextUrl.searchParams.get("source");
 try{
  if(only)return NextResponse.json({ok:true,startDate:ymd(now),endDate:ymd(end),sources:await persistIngestion(ymd(now),ymd(end),only)});
  // Instagram accounts (100+) are run one by one by the GitHub job (scripts/remote-ingest.ts), which asks for the list here.
  // Website sources whose last try failed with a network block: the GitHub job retries them from its own computers.
  if(req.nextUrl.searchParams.get("list")==="fallback"){
   const {rows}=await db.query(`select name from sources where last_error_at is not null and (last_success_at is null or last_error_at>last_success_at)
     and last_error ~* '(network error|timeout|http 403|http 429|econnreset|fetch failed)'`);
   const failing=new Set(rows.map((r:any)=>r.name));
   return NextResponse.json({ok:true,sources:(await activeSources()).filter(s=>failing.has(s.name)&&s.platform!=="instagram"&&s.platform!=="ticketmaster").map(s=>s.name)});
  }
  if(req.nextUrl.searchParams.get("list")==="instagram")return NextResponse.json({ok:true,sources:(await activeSources()).filter(s=>s.platform==="instagram").map(s=>s.name)});
  const names=(await activeSources()).filter(s=>s.platform!=="instagram").map(s=>s.name),origin=/localhost|127\.0\.0\.1/.test(req.nextUrl.host)?req.nextUrl.origin:SITE,results:any[]=new Array(names.length);
  await ensureSchema();
  const trigger=req.headers.get("user-agent")?.includes("vercel-cron")?"schedule":"manual";
  const log=await db.query("insert into ingest_log(trigger,sources) values($1,$2) returning id",[trigger,names.length]).catch(()=>null);
  // Keep the database small (it's billed by size and memory): the log of filtered-out events only needs a week,
  // and run history a month.
  await db.query("delete from rejected_events where ingestion_run_id in (select id from ingestion_runs where started_at<now()-interval '7 days')").catch(()=>{});
  await db.query("delete from ingestion_runs where started_at<now()-interval '30 days'").catch(()=>{});
  await purgeImages().catch(()=>{});   // saved pictures of events that are over
  await assignSeries().catch(()=>{});   // annual-event families for listings added since the last run
  // Upcoming events saved without a map position get their town's center, so searches can find them.
  try{const {rows}=await db.query("select distinct city from events where latitude is null and status='active' and local_date>=current_date and city is not null limit 40");
   for(const {city} of rows){const p=await cityCoords(city);if(p)await db.query("update events set latitude=$1,longitude=$2 where latitude is null and city=$3",[p.latitude,p.longitude,city])}}catch{}
  let next=0;
  const worker=async()=>{while(next<names.length){const i=next++,name=names[i];
   try{
    const r=await fetch(`${origin}/api/ingest?source=${encodeURIComponent(name)}`,{method:"POST",headers:{authorization:auth},signal:AbortSignal.timeout(295000)});
    const d=await r.json().catch(()=>({}));
    results[i]=d?.sources?.[0]||{source:name,found:0,accepted:0,rejected:0,status:"error",error:d?.error||`HTTP ${r.status}`};
   }catch(e:any){results[i]={source:name,found:0,accepted:0,rejected:0,status:"error",error:e?.name==="TimeoutError"?"Timed out":String(e?.message||e)}}
  }};
  await Promise.all(Array.from({length:Math.min(4,names.length)},worker));
  const ok=results.filter(r=>r?.status==="success").length;
  if(log?.rows?.[0])await db.query("update ingest_log set finished_at=now(),succeeded=$2,failed=$3 where id=$1",[log.rows[0].id,ok,results.length-ok]).catch(()=>{});
  return NextResponse.json({ok:true,startDate:ymd(now),endDate:ymd(end),sources:results});
 }catch(e:any){console.error("Ingestion failed",e);return NextResponse.json({ok:false,error:e?.message||"Ingestion failed"},{status:500})}
}
export const GET=run;
export const POST=run;
