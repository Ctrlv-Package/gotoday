import {trackAction} from "../../../../lib/track";
import {NextRequest} from "next/server";
import {loadEvent,toCalEvent} from "../../../../lib/event-detail";
import {calendarRedirect} from "../../../../lib/calendar";
export const dynamic="force-dynamic";
// /events/db-123/add?to=google|outlook|office|apple — opens the event in that calendar app.
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const e=await loadEvent(id);
 if(!e)return new Response("Not found",{status:404});
 trackAction(id,"calendar").catch(()=>{});
 const page=new URL(`/events/${encodeURIComponent(id)}`,req.nextUrl.origin).toString();
 return calendarRedirect(toCalEvent(e,page),req.nextUrl.searchParams.get("to"));
}
