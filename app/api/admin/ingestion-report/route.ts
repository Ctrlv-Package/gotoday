import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../lib/db";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
 const secret=process.env.INGESTION_SECRET;
 if(!secret||req.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const [counts,runs,rejected,sample]=await Promise.all([
  db.query(`select s.name,count(e.id) filter (where e.status='active')::int active,count(e.id) filter (where e.status='stale')::int stale from sources s left join events e on e.source_id=s.id group by s.id,s.name order by s.priority desc,s.name`),
  db.query(`select s.name,r.status,r.records_found,r.records_accepted,r.records_rejected,r.error_message,r.finished_at from ingestion_runs r join sources s on s.id=r.source_id order by r.id desc limit 12`),
  db.query(`select s.name source,r.raw_title,r.rejection_reason from rejected_events r join sources s on s.id=r.source_id order by r.id desc limit 25`),
  db.query(`select e.id,s.name source,e.title,e.start_at,e.city,e.category,e.event_type,e.status,e.official_url from events e left join sources s on s.id=e.source_id where e.status='active' order by e.start_at asc limit 120`)
 ]);
 return NextResponse.json({ok:true,counts:counts.rows,runs:runs.rows,rejected:rejected.rows,events:sample.rows});
}
