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
