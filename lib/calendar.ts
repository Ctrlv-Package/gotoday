// "Add to calendar" for every calendar app: Apple/Outlook desktop via an .ics file, Google and Outlook.com
// via their "new event" web links. One shape in, every format out.
export type CalEvent={uid:string;title:string;description:string;location:string;start:Date;end:Date|null;allDay:boolean;tz:string;url:string};

const stamp=(d:Date)=>d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
const localDay=(d:Date,tz:string)=>new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(d);

/** Timed events default to 1 hour when no (sensible) end is known; all-day events use their local date. */
export function calendarSpan(e:CalEvent){
 if(e.allDay){const s=localDay(e.start,e.tz),n=localDay(new Date(e.start.getTime()+36*3600e3),e.tz);return{allDay:true as const,startDay:s,endDay:n}}
 const end=e.end&&e.end>e.start&&e.end.getTime()-e.start.getTime()<16*3600e3?e.end:new Date(e.start.getTime()+3600e3);
 return{allDay:false as const,start:e.start,end};
}

const details=(e:CalEvent)=>`${e.description.slice(0,700)}${e.description?"\n\n":""}More info: ${e.url}`;

export function googleCalendarLink(e:CalEvent){
 const s=calendarSpan(e),u=new URL("https://calendar.google.com/calendar/render");
 u.searchParams.set("action","TEMPLATE");u.searchParams.set("text",e.title);
 u.searchParams.set("dates",s.allDay?`${s.startDay.replace(/-/g,"")}/${s.endDay.replace(/-/g,"")}`:`${stamp(s.start)}/${stamp(s.end)}`);
 u.searchParams.set("details",details(e));u.searchParams.set("location",e.location);
 if(!s.allDay)u.searchParams.set("ctz",e.tz);
 return u.toString();
}

/** Outlook.com (personal) or Office 365 (work/school) compose link. */
export function outlookCalendarLink(e:CalEvent,kind:"live"|"office"="live"){
 const s=calendarSpan(e),u=new URL(`https://outlook.${kind==="office"?"office":"live"}.com/calendar/0/deeplink/compose`);
 u.searchParams.set("path","/calendar/action/compose");u.searchParams.set("rru","addevent");u.searchParams.set("subject",e.title);
 u.searchParams.set("startdt",s.allDay?s.startDay:s.start.toISOString());u.searchParams.set("enddt",s.allDay?s.endDay:s.end.toISOString());
 if(s.allDay)u.searchParams.set("allday","true");
 u.searchParams.set("body",details(e));u.searchParams.set("location",e.location);
 return u.toString();
}

const esc=(x:string)=>x.replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/([,;])/g,"\\$1");
const fold=(l:string)=>{const out:string[]=[];let x=l;while(x.length>73){out.push(x.slice(0,73));x=" "+x.slice(73)}out.push(x);return out.join("\r\n")};
/** One event's lines. `cancelled` marks it cancelled in subscribed calendars (they show it struck through or drop it). */
function vevent(e:CalEvent,opts:{cancelled?:boolean;alarm?:boolean}={}){
 const s=calendarSpan(e);
 return["BEGIN:VEVENT",`UID:${e.uid}@mygotoday.com`,`DTSTAMP:${stamp(new Date())}`,
  s.allDay?`DTSTART;VALUE=DATE:${s.startDay.replace(/-/g,"")}`:`DTSTART:${stamp(s.start)}`,
  s.allDay?`DTEND;VALUE=DATE:${s.endDay.replace(/-/g,"")}`:`DTEND:${stamp(s.end)}`,
  `SUMMARY:${esc((opts.cancelled?"CANCELLED: ":"")+e.title)}`,`LOCATION:${esc(e.location)}`,`DESCRIPTION:${esc(details(e))}`,`URL:${e.url}`,
  ...(opts.cancelled?["STATUS:CANCELLED"]:[]),
  // Reminder: 1 hour before timed events; 9am the day of for all-day events.
  ...(opts.alarm!==false&&!opts.cancelled?["BEGIN:VALARM","ACTION:DISPLAY",`DESCRIPTION:${esc(e.title)}`,s.allDay?"TRIGGER:PT9H":"TRIGGER:-PT1H","END:VALARM"]:[]),
  "END:VEVENT"];
}

/** iCalendar file (Apple Calendar on iPhone/Mac, Outlook desktop, anything else). Includes a reminder. */
export function icsText(e:CalEvent){
 const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//GoToday//mygotoday.com//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH",...vevent(e),"END:VCALENDAR"];
 return lines.map(fold).join("\r\n")+"\r\n";
}

/** A subscribed calendar (someone's "My GoToday" calendar): many events; calendars re-check it now and then. */
const EASTERN=["BEGIN:VTIMEZONE","TZID:America/New_York",
 "BEGIN:DAYLIGHT","TZOFFSETFROM:-0500","TZOFFSETTO:-0400","TZNAME:EDT","DTSTART:19700308T020000","RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU","END:DAYLIGHT",
 "BEGIN:STANDARD","TZOFFSETFROM:-0400","TZOFFSETTO:-0500","TZNAME:EST","DTSTART:19701101T020000","RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU","END:STANDARD",
 "END:VTIMEZONE"];
export function icsFeed(name:string,events:{e:CalEvent;cancelled?:boolean}[]){
 const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//GoToday//mygotoday.com//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH",
  `X-WR-CALNAME:${esc(name)}`,"X-WR-CALDESC:Events you saved or follow on GoToday (mygotoday.com)","X-WR-TIMEZONE:America/New_York",
  "REFRESH-INTERVAL;VALUE=DURATION:PT4H","X-PUBLISHED-TTL:PT4H",
  // A calendar must contain at least one component: with nothing saved yet, Apple Calendar refuses the subscription
  // ("Add" stays grey). The time zone definition is always there, so the feed is valid even when it has no events.
  ...EASTERN,
  ...events.flatMap(x=>vevent(x.e,{cancelled:x.cancelled})),"END:VCALENDAR"];
 return lines.map(fold).join("\r\n")+"\r\n";
}

export function icsResponse(e:CalEvent){
 const name=e.title.replace(/[^A-Za-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"event";
 return new Response(icsText(e),{headers:{"content-type":"text/calendar; charset=utf-8","content-disposition":`inline; filename="${name}.ics"`,"cache-control":"no-store"}});
}

/** Shared handler for …/add?to=google|outlook|office|apple */
export function calendarRedirect(e:CalEvent,to:string|null){
 if(to==="google")return Response.redirect(googleCalendarLink(e),302);
 if(to==="outlook")return Response.redirect(outlookCalendarLink(e,"live"),302);
 if(to==="office")return Response.redirect(outlookCalendarLink(e,"office"),302);
 return icsResponse(e);
}
