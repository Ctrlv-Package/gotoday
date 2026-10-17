import {NextRequest} from "next/server";
import {db} from "../../../lib/db";
import {ensureSchema} from "../../../lib/schema";
import {calendarEvents} from "../../../lib/me";
import {icsFeed} from "../../../lib/calendar";
export const dynamic="force-dynamic";
// GET /cal/<private token>.ics — someone's personal GoToday calendar, which Google/Apple Calendar subscribe to.
// The token is the only key (calendar apps can't sign in), so it's long and random and can be reset from My GoToday.
export async function GET(_req:NextRequest,{params}:{params:Promise<{token:string}>}){
 const token=(await params).token.replace(/\.ics$/,"");
 if(!/^[A-Za-z0-9_-]{24,}$/.test(token))return new Response("Not found",{status:404});
 await ensureSchema();
 const u=(await db.query("select id,name from users where calendar_token=$1",[token])).rows[0];
 if(!u)return new Response("This calendar link was reset or removed. Get the new one from My GoToday at mygotoday.com/me.",{status:404});
 const body=icsFeed("GoToday",await calendarEvents(u.id));
 return new Response(body,{headers:{"content-type":"text/calendar; charset=utf-8","content-disposition":'inline; filename="gotoday.ics"',"cache-control":"no-store"}});
}
