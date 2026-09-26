import {NextRequest,NextResponse} from "next/server";
import {persistIngestion} from "../../../lib/ingestion/persist";
export const dynamic="force-dynamic";
export const maxDuration=300;
function ymd(d:Date){return d.toISOString().slice(0,10)}
// Manual runs use INGESTION_SECRET; Vercel Cron sends "Bearer $CRON_SECRET" automatically.
function authorized(req:NextRequest){
 const auth=req.headers.get("authorization");
 return [process.env.INGESTION_SECRET,process.env.CRON_SECRET].some(s=>s&&auth===`Bearer ${s}`);
}
async function run(req:NextRequest){
 if(!authorized(req))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const now=new Date(),end=new Date(now);end.setUTCDate(end.getUTCDate()+30);
 try{return NextResponse.json({ok:true,startDate:ymd(now),endDate:ymd(end),sources:await persistIngestion(ymd(now),ymd(end),req.nextUrl.searchParams.get("source")||undefined)})}
 catch(e){console.error("Ingestion failed",e);return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Ingestion failed"},{status:500})}
}
export const GET=run;
export const POST=run;
