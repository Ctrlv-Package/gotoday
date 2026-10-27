import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../lib/db";
export const dynamic="force-dynamic";
export const maxDuration=300;
// POST /api/admin/cleanup (Bearer INGESTION_SECRET): shrink the database right away — the same trimming the daily update
// does, then VACUUM FULL so the freed space is given back (Neon bills the database's size).
export async function POST(req:NextRequest){
 const s=process.env.INGESTION_SECRET;
 if(!s||req.headers.get("authorization")!==`Bearer ${s}`)return NextResponse.json({ok:false},{status:401});
 const size=async()=>(await db.query("select pg_size_pretty(pg_database_size(current_database())) as s")).rows[0].s;
 const before=await size(),out:any={before};
 out.rejected=(await db.query("delete from rejected_events where ingestion_run_id in (select id from ingestion_runs where started_at<now()-interval '2 days')")).rowCount;
 out.rejectedSlim=(await db.query("update rejected_events set raw_data=jsonb_build_object('date',raw_data->>'date','url',raw_data->>'url') where raw_data ? 'desc'").catch((e:any)=>({rowCount:String(e?.message||e)}))).rowCount;
 out.oldEvents=(await db.query("delete from events e where e.local_date<current_date-30 and e.series_id is null and not exists (select 1 from saved_events x where x.event_id=e.id)")).rowCount;
 // Plain VACUUM daily (no table lock, space reused); ?full=1 gives the space back to Neon (locks the tables briefly).
 const full=req.nextUrl.searchParams.get("full")==="1";
 for(const t of ["rejected_events","events"]){try{await db.query(`vacuum ${full?"full ":""}${t}`);out[`vacuum_${t}`]="ok"}catch(e:any){out[`vacuum_${t}`]=String(e?.message||e)}}
 out.after=await size();
 return NextResponse.json({ok:true,...out});
}
