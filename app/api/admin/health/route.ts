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
 return NextResponse.json(out);
}
