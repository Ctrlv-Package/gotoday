import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../lib/db";
export const dynamic="force-dynamic";
// GET /api/admin/calendars (Bearer INGESTION_SECRET): which calendar apps read each person's GoToday calendar, and when.
export async function GET(req:NextRequest){
 const s=process.env.INGESTION_SECRET;
 if(!s||req.headers.get("authorization")!==`Bearer ${s}`)return NextResponse.json({ok:false},{status:401});
 const users=(await db.query("select id,cal_clicked,cal_clicked_at,cal_client,cal_fetched_at,left(cal_ua,120) as ua from users where cal_clicked is not null or cal_fetched_at is not null order by id").catch(()=>({rows:[]}))).rows;
 const apps=(await db.query("select user_id,client,first_seen,last_seen,left(ua,120) as ua from calendar_clients order by user_id,first_seen").catch(()=>({rows:[]}))).rows;
 return NextResponse.json({ok:true,users,apps});
}
