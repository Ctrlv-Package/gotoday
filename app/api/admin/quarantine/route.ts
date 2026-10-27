import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../lib/db";
import {QUARANTINE_LABELS} from "../../../../lib/ingestion/quarantine";
export const dynamic="force-dynamic";
const authed=(req:NextRequest)=>{const s=process.env.INGESTION_SECRET;return!!s&&req.headers.get("authorization")===`Bearer ${s}`};
// Listings the quality gate held (status='quarantine'), plus live listings carrying a flag.
// Approving a held row publishes it; rejecting deletes it (the next ingest re-quarantines it
// if the flag is still there, so a rejection can never silently re-publish).
const shape=(r:any)=>({id:r.id,title:r.title,city:r.city,venue:r.venue,date:r.local_date,source:r.source,
 reasons:String(r.quarantine_reason||"").split(",").filter(Boolean).map(c=>QUARANTINE_LABELS[c]||c)});
export async function GET(req:NextRequest){
 if(!authed(req))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const held=await db.query(`select e.id,e.title,e.city,e.venue,e.local_date,e.quarantine_reason,s.name as source from events e left join sources s on s.id=e.source_id where e.status='quarantine' order by e.local_date asc limit 200`);
 const flagged=await db.query(`select e.id,e.title,e.city,e.venue,e.local_date,e.quarantine_reason,s.name as source from events e left join sources s on s.id=e.source_id where e.status='active' and e.quarantine_reason is not null order by e.local_date asc limit 200`);
 return NextResponse.json({ok:true,held:held.rows.map(shape),flagged:flagged.rows.map(shape)});
}
export async function POST(req:NextRequest){
 if(!authed(req))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const b=await req.json().catch(()=>({}));
 if(b.approveAll){await db.query(`update events set status='active',quarantine_reason=null where status='quarantine'`);return NextResponse.json({ok:true})}
 // Live rows only: a flag on a published listing is a note, not a hold, and clearing it in bulk
 // is the only sane way through a flood. Held rows still need Approve/Reject one by one.
 if(b.clearAllFlags){await db.query(`update events set quarantine_reason=null where status='active' and quarantine_reason is not null`);return NextResponse.json({ok:true})}
 const id=Number(b.id);if(!id)return NextResponse.json({ok:false},{status:400});
 if(b.approve===true)await db.query(`update events set status='active',quarantine_reason=null where id=$1`,[id]);
 else await db.query(`delete from events where id=$1`,[id]);
 return NextResponse.json({ok:true});
}
