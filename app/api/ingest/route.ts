import {NextRequest,NextResponse} from "next/server";
import {persistIngestion} from "../../../lib/ingestion/persist";
import {activeSources} from "../../../lib/ingestion/registry";
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
  if(req.nextUrl.searchParams.get("list")==="instagram")return NextResponse.json({ok:true,sources:(await activeSources()).filter(s=>s.platform==="instagram").map(s=>s.name)});
  const names=(await activeSources()).filter(s=>s.platform!=="instagram").map(s=>s.name),origin=req.nextUrl.origin,results:any[]=new Array(names.length);
  let next=0;
  const worker=async()=>{while(next<names.length){const i=next++,name=names[i];
   try{
    const r=await fetch(`${origin}/api/ingest?source=${encodeURIComponent(name)}`,{method:"POST",headers:{authorization:auth},signal:AbortSignal.timeout(295000)});
    const d=await r.json().catch(()=>({}));
    results[i]=d?.sources?.[0]||{source:name,found:0,accepted:0,rejected:0,status:"error",error:d?.error||`HTTP ${r.status}`};
   }catch(e:any){results[i]={source:name,found:0,accepted:0,rejected:0,status:"error",error:e?.name==="TimeoutError"?"Timed out":String(e?.message||e)}}
  }};
  await Promise.all(Array.from({length:Math.min(4,names.length)},worker));
  return NextResponse.json({ok:true,startDate:ymd(now),endDate:ymd(end),sources:results});
 }catch(e:any){console.error("Ingestion failed",e);return NextResponse.json({ok:false,error:e?.message||"Ingestion failed"},{status:500})}
}
export const GET=run;
export const POST=run;
