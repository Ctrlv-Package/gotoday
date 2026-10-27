import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../lib/db";
export const dynamic="force-dynamic";
const authed=(req:NextRequest)=>{const s=process.env.INGESTION_SECRET;return!!s&&req.headers.get("authorization")===`Bearer ${s}`};
// Visitor reports waiting for a person: open ones only, newest first, with the event's title and a link
// to its page. Dismissing a report keeps the row (status='resolved') but takes it off this list.
export async function GET(req:NextRequest){
 if(!authed(req))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const rows=(await db.query(`select r.id,r.kind,r.event_id,r.reason,r.note,r.created_at,e.title as ltitle,c.title as ctitle,c.share_token
  from event_reports r left join events e on r.kind='listing' and e.id=r.event_id
  left join community_events c on r.kind='community' and c.id=r.event_id
  where r.status='open' order by r.created_at desc limit 200`)).rows;
 return NextResponse.json({ok:true,reports:rows.map(r=>({id:r.id,kind:r.kind,eventId:r.event_id,
  title:r.ltitle||r.ctitle||"Unknown event",link:r.kind==="listing"?`/events/db-${r.event_id}`:r.share_token?`/e/${r.share_token}`:null,
  reason:r.reason,note:r.note,createdAt:r.created_at}))});
}
export async function POST(req:NextRequest){
 if(!authed(req))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const b=await req.json().catch(()=>({}));
 const id=Number(b.id);if(!id)return NextResponse.json({ok:false},{status:400});
 if(b.resolve===true)await db.query(`update event_reports set status='resolved' where id=$1`,[id]);
 return NextResponse.json({ok:true});
}
