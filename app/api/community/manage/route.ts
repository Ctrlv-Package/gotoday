import {NextRequest,NextResponse} from "next/server";
import {eventByManage,validate,updateEvent,deleteEvent,rsvpsFor,rsvpCounts} from "../../../../lib/community";
export const dynamic="force-dynamic";
export const maxDuration=60;
// The manage token travels in the Authorization header, never in a URL the server logs.
const tokenOf=(req:NextRequest)=>(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
const nf=()=>NextResponse.json({ok:false,errors:["This manage link isn't valid (or the event was deleted)."]},{status:404});

export async function GET(req:NextRequest){
 const t=tokenOf(req);const e=t?await eventByManage(t):null;if(!e)return nf();
 const [rsvps,counts]=await Promise.all([rsvpsFor(e.id),rsvpCounts(e.id)]);
 const {id:_,eventId:__,...pub}=e;
 return NextResponse.json({ok:true,event:pub,rsvps,counts,shareUrl:`${req.nextUrl.origin}/e/${e.shareToken}`});
}
export async function PUT(req:NextRequest){
 const t=tokenOf(req);if(!t)return nf();
 const body=await req.json().catch(()=>null);const r=validate(body||{});
 if(!r.ok)return NextResponse.json({ok:false,errors:r.errors},{status:422});
 const out=await updateEvent(t,r.v,req.nextUrl.origin);
 if("error" in out)return NextResponse.json({ok:false,errors:[out.error]},{status:422});
 return NextResponse.json({ok:true,status:out.event!.status,visibility:out.event!.visibility,reviewReason:out.event!.reviewReason});
}
export async function DELETE(req:NextRequest){
 const t=tokenOf(req);if(!t||!(await deleteEvent(t)))return nf();
 return NextResponse.json({ok:true});
}
