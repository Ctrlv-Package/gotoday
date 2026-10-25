import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../lib/db";
export const dynamic="force-dynamic";
// GET /api/admin/images (Bearer INGESTION_SECRET): how many event pictures we keep, their size, and the database size
// (Neon's free plan allows 0.5 GB), plus how many upcoming events still point at an Instagram link.
export async function GET(req:NextRequest){
 const s=process.env.INGESTION_SECRET;
 if(!s||req.headers.get("authorization")!==`Bearer ${s}`)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const r=(await db.query(`select (select count(*)::int from images) as images,(select coalesce(sum(bytes),0)::bigint from images) as image_bytes,pg_database_size(current_database())::bigint as db_bytes,
  (select count(*)::int from events where local_date>=current_date and status='active' and image_url like '/img/%') as upcoming_own,
  (select count(*)::int from events where local_date>=current_date and status='active' and image_url ~ 'cdninstagram|fbcdn') as upcoming_instagram_links`).catch((e:any)=>({rows:[{error:String(e?.message||e)}]}))).rows[0];
 return NextResponse.json({ok:true,...r});
}

// POST /api/admin/images {id:"db-305561"} (Bearer INGESTION_SECRET): take a wrong picture off one event right away
// (the card falls back to a matching library photo). The next reading of its source picks the picture again with the
// current rules.
export async function POST(req:NextRequest){
 const s=process.env.INGESTION_SECRET;
 if(!s||req.headers.get("authorization")!==`Bearer ${s}`)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const b:any=await req.json().catch(()=>({}));const id=Number(String(b?.id||"").replace(/^db-/,""));
 const img=typeof b?.image==="string"&&b.image.startsWith("/img/")?b.image:"";
 if(img){const r=await db.query("update events set image_url=null,updated_at=now() where image_url=$1 returning id,title",[img]);return NextResponse.json({ok:true,cleared:r.rows})}
 if(!id)return NextResponse.json({ok:false,error:"id or image required"},{status:400});
 // The same picture is often on other copies of the event (another day, an earlier reading); cards borrow pictures from
 // copies, so the picture comes off every event that carries it.
 const r=await db.query("update events set image_url=null,updated_at=now() where image_url=(select image_url from events where id=$1 and image_url is not null) or id=$1 returning id,title",[id]);
 return NextResponse.json({ok:true,cleared:r.rows});
}
