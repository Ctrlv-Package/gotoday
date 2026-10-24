import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../lib/db";
import {decidePending,decidedTopics} from "../../../../lib/photoTopic";
export const dynamic="force-dynamic";
export const maxDuration=300;
const auth=(req:NextRequest)=>!!process.env.INGESTION_SECRET&&req.headers.get("authorization")===`Bearer ${process.env.INGESTION_SECRET}`;
// GET: how many titles have a photo type decided, counts per type, and a sample to review. ?q= filters the sample.
export async function GET(req:NextRequest){
 if(!auth(req))return NextResponse.json({ok:false},{status:401});
 const m=await decidedTopics();const counts:Record<string,number>={};for(const v of m.values())counts[v]=(counts[v]||0)+1;
 const q=(req.nextUrl.searchParams.get("q")||"").toLowerCase();
 const sample=(await db.query("select key,topic from photo_topics where ($1='' or key like '%'||$1||'%' or topic=$1) order by at desc limit 400",[q])).rows;
 return NextResponse.json({ok:true,decided:m.size,counts,sample});
}
// POST ?run=N: read up to N batches (40 titles each) of upcoming events not decided yet.
export async function POST(req:NextRequest){
 if(!auth(req))return NextResponse.json({ok:false},{status:401});
 const n=Math.min(40,Math.max(1,Number(req.nextUrl.searchParams.get("run"))||10));
 return NextResponse.json({ok:true,...await decidePending(n,req.nextUrl.searchParams.get("model")||undefined)});
}
