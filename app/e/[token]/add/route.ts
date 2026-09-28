import {NextRequest} from "next/server";
import {communityCal} from "../cal";
import {calendarRedirect} from "../../../../lib/calendar";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest,{params}:{params:Promise<{token:string}>}){
 const c=await communityCal((await params).token,req.nextUrl.origin);
 return c?calendarRedirect(c,req.nextUrl.searchParams.get("to")):new Response("Not found",{status:404});
}
