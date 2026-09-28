import {NextRequest} from "next/server";
import {communityCal} from "../cal";
import {icsResponse} from "../../../../lib/calendar";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest,{params}:{params:Promise<{token:string}>}){
 const c=await communityCal((await params).token,req.nextUrl.origin);
 return c?icsResponse(c):new Response("Not found",{status:404});
}
