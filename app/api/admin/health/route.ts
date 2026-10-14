import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../lib/db";
export const dynamic="force-dynamic";

// GET /api/admin/health (Bearer INGESTION_SECRET): database size, biggest tables, and whether a write works.
export async function GET(req:NextRequest){
 const s=process.env.INGESTION_SECRET;
 if(!s||req.headers.get("authorization")!==`Bearer ${s}`)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const out:any={ok:true};
 try{out.dbSize=(await db.query("select pg_size_pretty(pg_database_size(current_database())) as s")).rows[0].s}catch(e:any){out.dbSizeError=e.message}
 try{out.tables=(await db.query(`select relname as table,pg_size_pretty(pg_total_relation_size(relid)) as size,n_live_tup as rows from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 10`)).rows}catch(e:any){out.tablesError=e.message}
 try{await db.query("create table if not exists health_check(id int primary key,at timestamptz)");await db.query("insert into health_check values(1,now()) on conflict(id) do update set at=now()");out.write="ok"}catch(e:any){out.write=`FAILED: ${e.message}`}
 try{out.lastRuns=(await db.query(`select s.name,r.status,r.error_message,r.started_at from ingestion_runs r join sources s on s.id=r.source_id order by r.id desc limit 8`)).rows}catch(e:any){out.runsError=e.message}
 try{out.sources=(await db.query(`select count(*)::int as total,max(last_success_at) as newest_success,count(*) filter (where last_success_at>now()-interval '24 hours')::int as ok_24h,max(last_error_at) as newest_error from sources`)).rows[0]}catch(e:any){out.sourcesError=e.message}
 try{out.ingestLog=(await db.query("select trigger,sources,succeeded,failed,started_at,finished_at,left(notes,1500) as notes from ingest_log order by id desc limit 5")).rows}catch(e:any){out.logError=e.message}
 try{out.recentErrors=(await db.query(`select s.name,r.error_message,r.started_at from ingestion_runs r join sources s on s.id=r.source_id where r.status<>'success' and r.started_at>now()-interval '30 hours' order by r.id desc limit 15`)).rows}catch(e:any){out.errError=e.message}
 try{out.aiPostsByDay=(await db.query(`select to_char(created_at at time zone 'America/New_York','MM-DD') as day,count(*)::int as posts from social_posts where created_at>now()-interval '14 days' group by 1 order by 1`)).rows}catch(e:any){out.aiError=e.message}
 try{out.webLookups=(await db.query(`select to_char(created_at at time zone 'America/New_York','MM-DD') as day,count(*)::int as n from event_details where key not like 'free|%' and key<>'__error' group by 1 order by 1`)).rows}catch{}
 return NextResponse.json(out);
}
