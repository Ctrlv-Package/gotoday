import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../lib/db";
import {buildLibrary,libraryPlan,libraryPut,TOPICS} from "../../../../lib/stockPhotos";
export const dynamic="force-dynamic";
export const maxDuration=300;
// GET: how many library photos each event type has. POST: fill the library from Pixabay (a batch of types per call).
const auth=(req:NextRequest)=>{const s=process.env.INGESTION_SECRET;return!!s&&req.headers.get("authorization")===`Bearer ${s}`};
export async function GET(req:NextRequest){
 if(!auth(req))return NextResponse.json({ok:false},{status:401});
 if(req.nextUrl.searchParams.get("plan")){const q=req.nextUrl.searchParams;return NextResponse.json(await libraryPlan(60,6,Number(q.get("part"))||0,Number(q.get("of"))||1))}
 // ?sheet=<page>: a contact sheet (JPEG) of the library, 15 event types per page, to look over every photo at once.
 if(req.nextUrl.searchParams.get("sheet")!=null){
  const page=Number(req.nextUrl.searchParams.get("sheet"))||0,keys=TOPICS.map(t=>t.key).slice(page*15,page*15+15);
  const {rows}=await db.query("select p.topic,i.data from stock_photos p join images i on '/img/'||i.key=p.image where p.topic=any($1) order by p.topic,p.photo_id",[keys]);
  const sharp=(await import("sharp")).default,W=150,H=100,L=110,cols=6;
  const comps:any[]=[];
  for(const [r,k] of keys.entries()){
   comps.push({input:Buffer.from(`<svg width="${L}" height="${H}"><text x="4" y="55" font-size="15" font-family="sans-serif" font-weight="bold">${k}</text></svg>`),left:0,top:r*H});
   const mine=rows.filter((x:any)=>x.topic===k).slice(0,cols);
   for(const [c,x] of mine.entries())comps.push({input:await sharp(x.data).resize(W-4,H-4,{fit:"cover"}).toBuffer(),left:L+c*W,top:r*H+2});
  }
  const img=await sharp({create:{width:L+cols*W,height:keys.length*H,channels:3,background:"#ffffff"}}).composite(comps).jpeg({quality:62}).toBuffer();
  return new NextResponse(new Uint8Array(img),{headers:{"content-type":"image/jpeg"}});
 }
 const rows=(await db.query("select topic,count(*)::int as n from stock_photos group by topic").catch(()=>({rows:[]}))).rows;
 const m=new Map(rows.map((r:any)=>[r.topic,r.n]));
 return NextResponse.json({ok:true,topics:TOPICS.length,filled:rows.length,missing:TOPICS.filter(t=>!m.get(t.key)).map(t=>t.key),counts:Object.fromEntries(m)});
}
export async function POST(req:NextRequest){
 if(!auth(req))return NextResponse.json({ok:false},{status:401});
 const p=req.nextUrl.searchParams;
 // ?drop=topic:2,4;topic2:1 — reject photos by their position on the contact sheet (1 = first); never fetched again.
 if(p.get("drop")){
  await db.query("create table if not exists stock_rejected(photo_id bigint primary key)");
  const out:string[]=[];
  for(const part of p.get("drop")!.split(";")){const [topic,pos]=part.split(":");if(!topic||!pos)continue;
   const ids=(await db.query("select photo_id from stock_photos where topic=$1 order by photo_id",[topic])).rows.map((r:any)=>r.photo_id);
   for(const n of pos.split(",").map(Number)){const id=ids[n-1];if(id==null)continue;
    await db.query("insert into stock_rejected values($1) on conflict do nothing",[id]);await db.query("delete from stock_photos where topic=$1 and photo_id=$2",[topic,id]);out.push(`${topic}#${n}`)}}
  return NextResponse.json({ok:true,dropped:out});
 }
 if(p.get("reset")){await db.query("delete from stock_photos");return NextResponse.json({ok:true,reset:true})}
 // ?put=<topic>&id=<pixabay id> with the image bytes as the body (sent by the GitHub job).
 if(p.get("put"))return NextResponse.json(await libraryPut(p.get("put")!,Number(p.get("id")),Buffer.from(await req.arrayBuffer())));
 return NextResponse.json(await buildLibrary(Number(p.get("max"))||30));
}
