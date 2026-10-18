import {NextRequest} from "next/server";
import {db} from "../../../lib/db";
import {ensureSchema} from "../../../lib/schema";
import {calendarEvents} from "../../../lib/me";
import {icsFeed} from "../../../lib/calendar";
export const dynamic="force-dynamic";
// GET /cal/<private token>.ics — someone's personal GoToday calendar, which Google/Apple Calendar subscribe to.
// The token is the only key (calendar apps can't sign in), so it's long and random and can be reset from My GoToday.
async function feed(req:NextRequest,{params}:{params:Promise<{token:string}>},head=false){
 const token=(await params).token.replace(/\.ics$/,"");
 if(!/^[A-Za-z0-9_-]{24,}$/.test(token))return new Response("Not found",{status:404});
 await ensureSchema();
 const u=(await db.query("select id,name from users where calendar_token=$1",[token])).rows[0];
 if(!u)return new Response("This calendar link was reset or removed. Get the new one from My GoToday at mygotoday.com/me.",{status:404});
 // Note which calendar app is reading it, so My GoToday can say "Connected to Google Calendar". A person opening
 // the link in their browser doesn't count.
 const ua=req.headers.get("user-agent")||"";
 // Calendar apps identify themselves: Google ("Google-Calendar-Importer"/Google fetchers), Apple (dataaccessd,
 // CalendarAgent), Outlook/Microsoft. Ordinary browsers (someone opening the link) don't count.
 const browser=/Chrome\/|Firefox\/|Safari\/\d|Edg\//.test(ua)&&!/Google-Calendar|FeedFetcher|Googlebot|dataaccessd|CalendarAgent/i.test(ua);
 const client=browser?null:/Google/i.test(ua)?"Google Calendar":/dataaccessd|CalendarAgent|iCal|Apple|iOS|Darwin|macOS/i.test(ua)?"Apple Calendar"
  :/Microsoft|Outlook|Exchange|MSOffice/i.test(ua)?"Outlook":"your calendar app";
 if(client){
  await db.query("update users set cal_fetched_at=now(),cal_client=$1,cal_ua=$2 where id=$3",[client,ua.slice(0,200),u.id]).catch(()=>{});
  await db.query(`insert into calendar_clients(user_id,client,ua) values($1,$2,$3) on conflict(user_id,client) do update set last_seen=now(),ua=excluded.ua`,[u.id,client,ua.slice(0,200)]).catch(()=>{});
 }
 const headers={"content-type":"text/calendar; charset=utf-8","content-disposition":'inline; filename="gotoday.ics"',"cache-control":"no-store"};
 // Apple Calendar checks the link before subscribing; answer that check like the real thing.
 if(head)return new Response(null,{headers});
 const body=icsFeed("GoToday",await calendarEvents(u.id));
 return new Response(body,{headers});
}
export function GET(req:NextRequest,ctx:{params:Promise<{token:string}>}){return feed(req,ctx)}
export function HEAD(req:NextRequest,ctx:{params:Promise<{token:string}>}){return feed(req,ctx,true)}
