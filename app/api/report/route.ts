import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../lib/db";
import {ensureSchema} from "../../../lib/schema";
import {validateReport} from "../../../lib/reports";
export const dynamic="force-dynamic";
// POST /api/report (kind: "listing"|"community", id, reason, note?) — a visitor flagging a problem with
// an event page. Anonymous, and never changes the listing: it waits for an admin in /admin. A repeat
// of the same open report within a day is silently dropped, so one person can't flood the list.
export async function POST(req:NextRequest){
 const b=await req.json().catch(()=>({}));
 const v=validateReport(b.kind,b.id,b.reason,b.note);
 if("error" in v)return NextResponse.json({ok:false,error:v.error},{status:400});
 try{
  await ensureSchema();
  const table=v.kind==="listing"?"events":"community_events";
  const ex=await db.query(`select id from ${table} where id=$1${v.kind==="community"?" and status<>'deleted'":""}`,[v.id]);
  if(!ex.rowCount)return NextResponse.json({ok:false,error:"Unknown event."},{status:404});
  const dup=await db.query(`select id from event_reports where kind=$1 and event_id=$2 and reason=$3 and status='open' and created_at>now()-interval '1 day' limit 1`,[v.kind,v.id,v.reason]);
  if(!dup.rowCount)await db.query(`insert into event_reports(kind,event_id,reason,note) values($1,$2,$3,$4)`,[v.kind,v.id,v.reason,v.note||null]);
  return NextResponse.json({ok:true});
 }catch{
  return NextResponse.json({ok:false,error:"Couldn't send the report. Please try again."},{status:500});
 }
}
