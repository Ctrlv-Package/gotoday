import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../lib/db";
import {buildLibrary,libraryPlan,libraryPut,TOPICS} from "../../../../lib/stockPhotos";
export const dynamic="force-dynamic";
export const maxDuration=300;
// GET: how many library photos each event type has. POST: fill the library from Pixabay (a batch of types per call).
const auth=(req:NextRequest)=>{const s=process.env.INGESTION_SECRET;return!!s&&req.headers.get("authorization")===`Bearer ${s}`};
export async function GET(req:NextRequest){
 if(!auth(req))return NextResponse.json({ok:false},{status:401});
 if(req.nextUrl.searchParams.get("plan"))return NextResponse.json(await libraryPlan());
 const rows=(await db.query("select topic,count(*)::int as n from stock_photos group by topic").catch(()=>({rows:[]}))).rows;
 const m=new Map(rows.map((r:any)=>[r.topic,r.n]));
 return NextResponse.json({ok:true,topics:TOPICS.length,filled:rows.length,missing:TOPICS.filter(t=>!m.get(t.key)).map(t=>t.key),counts:Object.fromEntries(m)});
}
export async function POST(req:NextRequest){
 if(!auth(req))return NextResponse.json({ok:false},{status:401});
 const p=req.nextUrl.searchParams;
 // ?put=<topic>&id=<pixabay id> with the image bytes as the body (sent by the GitHub job).
 if(p.get("put"))return NextResponse.json(await libraryPut(p.get("put")!,Number(p.get("id")),Buffer.from(await req.arrayBuffer())));
 return NextResponse.json(await buildLibrary(Number(p.get("max"))||30));
}
