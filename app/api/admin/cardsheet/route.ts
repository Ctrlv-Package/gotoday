import {NextRequest,NextResponse} from "next/server";
import {getImage} from "../../../../lib/images";
export const dynamic="force-dynamic";
export const maxDuration=120;
// GET /api/admin/cardsheet?postalCode=33326&radius=25&range=2026-10-20[&format=json] (Bearer INGESTION_SECRET):
// the cards people see for that search, as one picture sheet (8 across, in order) or as the matching list, to review
// pictures and listings together.
export async function GET(req:NextRequest){
 const s=process.env.INGESTION_SECRET;
 if(!s||req.headers.get("authorization")!==`Bearer ${s}`)return NextResponse.json({ok:false},{status:401});
 const p=req.nextUrl.searchParams,q=new URLSearchParams({postalCode:p.get("postalCode")||"33326",radius:p.get("radius")||"25",range:p.get("range")||"today",today:p.get("today")||""});
 const d:any=await fetch(`${req.nextUrl.origin}/api/events?${q}`,{cache:"no-store"}).then(r=>r.json()).catch(()=>({events:[]}));
 const off=Number(p.get("offset"))||0,evs=(d.events||[]).slice(off,off+64);
 if(p.get("format")==="json")return NextResponse.json({ok:true,total:(d.events||[]).length,cards:evs.map((e:any,i:number)=>({n:off+i+1,title:e.title,source:e.source,venue:e.venue,time:e.time,stock:!!e.stockImage,image:e.image,labels:e.labels,facets:e.facets}))});
 const sharp=(await import("sharp")).default,W=160,H=100,cols=8;
 const comps:any[]=[];
 for(const [i,e] of evs.entries()){
  let buf:Buffer|null=null;
  try{
   if(String(e.image||"").startsWith("/img/"))buf=(await getImage(e.image.slice(5)))?.data||null;
   else if(e.image){const r=await fetch(e.image,{signal:AbortSignal.timeout(8000)});if(r.ok)buf=Buffer.from(await r.arrayBuffer())}
  }catch{}
  const tile=buf?await sharp(buf,{failOn:"none"}).resize(W-4,H-4,{fit:"cover"}).toBuffer().catch(()=>null):null;
  const box=tile||await sharp({create:{width:W-4,height:H-4,channels:3,background:"#dddddd"}}).png().toBuffer();
  comps.push({input:box,left:(i%cols)*W+2,top:Math.floor(i/cols)*H+2});
  if(e.stockImage)comps.push({input:await sharp({create:{width:10,height:10,channels:3,background:"#7c3aed"}}).png().toBuffer(),left:(i%cols)*W+4,top:Math.floor(i/cols)*H+4});
 }
 const rows=Math.max(1,Math.ceil(evs.length/cols));
 const img=await sharp({create:{width:cols*W,height:rows*H,channels:3,background:"#ffffff"}}).composite(comps).jpeg({quality:60}).toBuffer();
 return new NextResponse(new Uint8Array(img),{headers:{"content-type":"image/jpeg"}});
}
