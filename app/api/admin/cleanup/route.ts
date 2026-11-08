import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../lib/db";
import {recheckLibrary} from "../../../../lib/stockPhotos";
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
 // A card never links to a calendar file (.ics feed): point it at the source's calendar page instead.
 // The page lives in source_configs (sources has no url column) — the same place the event page reads it from.
 // Each step records its failure instead of throwing, so one bad step no longer skips the rest of the cleanup.
 out.feedLinks=(await db.query(`update events e set official_url=sc.url from sources s join source_configs sc on sc.name=s.name where s.id=e.source_id and coalesce(sc.url,'')<>''
  and sc.url !~* '(\\.ics(\\?|$)|calendar-manager/events\\.ics|/feed/ical)' and e.official_url ~* '(\\.ics(\\?|$)|calendar-manager/events\\.ics|/feed/ical)'`).catch((e:any)=>({rowCount:String(e?.message||e)}))).rowCount;
 out.oldEvents=(await db.query("delete from events e where e.local_date<current_date-30 and e.series_id is null and not exists (select 1 from saved_events x where x.event_id=e.id)").catch((e:any)=>({rowCount:String(e?.message||e)}))).rowCount;
 // Stock photos: re-check a batch of library photos against Pixabay's current tags and drop the ones the filter
 // now refuses (a tightened filter also clears photos already in use). Stalest first, so the library converges
 // over a few daily runs; a failure here never blocks the rest of the cleanup.
 try{out.stockRecheck=await recheckLibrary({limit:40,maxMs:120e3})}catch(e:any){out.stockRecheck={ok:false,error:String(e?.message||e)}}
 // Plain VACUUM daily (no table lock, space reused); ?full=1 gives the space back to Neon (locks the tables briefly).
 const full=req.nextUrl.searchParams.get("full")==="1";
 for(const t of ["rejected_events","events"]){try{await db.query(`vacuum ${full?"full ":""}${t}`);out[`vacuum_${t}`]="ok"}catch(e:any){out[`vacuum_${t}`]=String(e?.message||e)}}
 out.after=await size();
 return NextResponse.json({ok:true,...out});
}
