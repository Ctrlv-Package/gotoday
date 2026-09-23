import {NextRequest,NextResponse} from "next/server";
import {persistIngestion} from "../../../lib/ingestion/persist";
export const dynamic="force-dynamic";
function ymd(d:Date){return d.toISOString().slice(0,10)}
export async function POST(req:NextRequest){
 const secret=process.env.INGESTION_SECRET;
 if(!secret||req.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const now=new Date(),end=new Date(now);end.setUTCDate(end.getUTCDate()+30);
 try{return NextResponse.json({ok:true,startDate:ymd(now),endDate:ymd(end),sources:await persistIngestion(ymd(now),ymd(end))})}
 catch(e){console.error("Ingestion failed",e);return NextResponse.json({ok:false,error:"Ingestion failed"},{status:500})}
}
