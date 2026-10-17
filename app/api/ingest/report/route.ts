import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../lib/db";
import {ensureSchema} from "../../../../lib/schema";
import {assignSeries} from "../../../../lib/series";
export const dynamic="force-dynamic";

// The GitHub job (scripts/remote-ingest.ts) reports how its run went, so the status page can show it.
// Body: {sources, succeeded, failed, notes}
export async function POST(req:NextRequest){
 const secret=process.env.INGESTION_SECRET;
 if(!secret||req.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const b=await req.json().catch(()=>({}));
 await ensureSchema();
 const n=(x:any)=>Number.isFinite(+x)?Math.round(+x):0;
 await db.query("insert into ingest_log(trigger,sources,succeeded,failed,notes,started_at,finished_at) values('github',$1,$2,$3,$4,coalesce($5::timestamptz,now()),now())",
  [n(b.sources),n(b.succeeded),n(b.failed),String(b.notes||"").slice(0,4000),b.startedAt||null]);
 // New listings join their annual-event family (so followers find next year's date).
 const linked=await assignSeries().catch(()=>0);
 return NextResponse.json({ok:true,linked});
}
