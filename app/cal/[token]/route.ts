import {NextRequest} from "next/server";
import {db} from "../../../lib/db";
import {ensureSchema} from "../../../lib/schema";
import {calendarEvents} from "../../../lib/me";
import {icsFeed} from "../../../lib/calendar";
export const dynamic="force-dynamic";
// GET /cal/<private token>.ics — someone's personal GoToday calendar, which Google/Apple Calendar subscribe to.
// The token is the only key (calendar apps can't sign in), so it's long and random and can be reset from My GoToday.
export async function GET(req:NextRequest,{params}:{params:Promise<{token:string}>}){
 const token=(await params).token.replace(/\.ics$/,"");
 if(!/^[A-Za-z0-9_-]{24,}$/.test(token))return new Response("Not found",{status:404});
 await ensureSchema();
 const u=(await db.query("select id,name from users where calendar_token=$1",[token])).rows[0];
 if(!u)return new Response("This calendar link was reset or removed. Get the new one from My GoToday at mygotoday.com/me.",{status:404});
 // Note which calendar app is reading it, so My GoToday can say "Connected to Google Calendar". A person opening
 // the link in their browser doesn't count.
 const ua=req.headers.get("user-agent")||"";
 const client=/Google-Calendar-Importer|Google\b.*Calendar/i.test(ua)?"Google Calendar":/dataaccessd|CalendarAgent|iOS|Mac ?OS.*Calendar|remindd/i.test(ua)&&!/Chrome|Safari\/\d/i.test(ua)?"Apple Calendar"
  :/Microsoft|Outlook|Exchange/i.test(ua)?"Outlook":/Mozilla|Chrome|Safari/i.test(ua)?null:"your calendar app";
 if(client)await db.query("update users set cal_fetched_at=now(),cal_client=$1 where id=$2",[client,u.id]).catch(()=>{});
 const body=icsFeed("GoToday",await calendarEvents(u.id));
 return new Response(body,{headers:{"content-type":"text/calendar; charset=utf-8","content-disposition":'inline; filename="gotoday.ics"',"cache-control":"no-store"}});
}
