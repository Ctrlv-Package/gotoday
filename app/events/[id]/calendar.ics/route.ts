import {NextRequest} from "next/server";
import {loadEvent,icsFile} from "../../../../lib/event-detail";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const e=await loadEvent(id);
 if(!e)return new Response("Not found",{status:404});
 const page=new URL(`/events/${encodeURIComponent(id)}`,req.nextUrl.origin).toString();
 const name=e.title.replace(/[^A-Za-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"event";
 return new Response(icsFile(e,page),{headers:{"content-type":"text/calendar; charset=utf-8","content-disposition":`attachment; filename="${name}.ics"`}});
}
