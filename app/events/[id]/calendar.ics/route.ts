import {trackAction} from "../../../../lib/track";
import {NextRequest} from "next/server";
import {loadEvent,toCalEvent} from "../../../../lib/event-detail";
import {icsResponse} from "../../../../lib/calendar";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const e=await loadEvent(id);
 if(!e)return new Response("Not found",{status:404});
 trackAction(id,"calendar").catch(()=>{});
 return icsResponse(toCalEvent(e,new URL(`/events/${encodeURIComponent(id)}`,req.nextUrl.origin).toString()));
}
