import {db} from "./db";
import {ensureSchema} from "./schema";

export const TZ="America/New_York";
export function decodeHtml(s:string){return String(s||"").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16))).replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'")}

export type EventDetail={
 id:number;title:string;description:string;start:Date;end:Date|null;city:string;image:string|null;officialUrl:string;priceText:string|null;isFree:boolean;
 category:string|null;tags:string[];ageMin:number|null;ageMax:number|null;registrationUrl:string|null;registrationText:string|null;recurrence:string|null;
 source:string;sourceId:number;venue:string|null;venueId:number|null;address:string|null;lat:number|null;lng:number|null;
};

export function parseId(id:string){const raw=decodeURIComponent(id);if(!raw.startsWith("db-"))return null;const n=Number(raw.slice(3));return Number.isInteger(n)&&n>0?n:null}

export async function loadEvent(id:string):Promise<EventDetail|null>{
 const n=parseId(id);if(!n)return null;
 await ensureSchema();
 const {rows}=await db.query(`select e.id,e.title,e.description,e.start_at,e.end_at,e.city,e.image_url,e.official_url,e.price_text,e.is_free,e.category,e.tags,e.age_min,e.age_max,
  e.registration_url,e.registration_text,e.recurrence,e.source_id,s.name as source,v.id as venue_id,v.name as venue,v.address,v.latitude,v.longitude
  from events e join sources s on s.id=e.source_id left join venues v on v.id=e.venue_id where e.id=$1 limit 1`,[n]);
 const r=rows[0];if(!r)return null;
 return{id:r.id,title:decodeHtml(r.title),description:decodeHtml(r.description||""),start:new Date(r.start_at),end:r.end_at?new Date(r.end_at):null,city:r.city||"",
  image:r.image_url,officialUrl:r.official_url,priceText:r.price_text?decodeHtml(r.price_text):null,isFree:!!r.is_free,category:r.category,tags:Array.isArray(r.tags)?r.tags:[],
  ageMin:r.age_min,ageMax:r.age_max,registrationUrl:r.registration_url,registrationText:r.registration_text,recurrence:r.recurrence,source:r.source,sourceId:r.source_id,
  venue:r.venue?decodeHtml(r.venue):null,venueId:r.venue_id,address:r.address,lat:r.latitude==null?null:Number(r.latitude),lng:r.longitude==null?null:Number(r.longitude)};
}

export type Related={id:number;title:string;start:Date;venue:string|null;city:string};
/** Other upcoming dates/locations of the same program, and other events at the same venue. */
export async function loadRelated(e:EventDetail){
 const [same,venue]=await Promise.all([
  db.query(`select e.id,e.title,e.start_at,e.city,v.name as venue from events e left join venues v on v.id=e.venue_id
   where e.status='active' and e.source_id=$1 and lower(e.title)=lower($2) and e.id<>$3 and e.start_at>=now()-interval '3 hours' order by e.start_at limit 12`,[e.sourceId,e.title,e.id]),
  e.venueId?db.query(`select e.id,e.title,e.start_at,e.city,v.name as venue from events e left join venues v on v.id=e.venue_id
   where e.status='active' and e.venue_id=$1 and lower(e.title)<>lower($2) and e.start_at>=now()-interval '3 hours' and e.start_at<now()+interval '21 days'
   and e.event_type not in ('meeting','class','program','attraction') order by e.start_at limit 6`,[e.venueId,e.title]):Promise.resolve({rows:[]})
 ]);
 const map=(rows:any[]):Related[]=>rows.map(r=>({id:r.id,title:decodeHtml(r.title),start:new Date(r.start_at),venue:r.venue?decodeHtml(r.venue):null,city:r.city||""}));
 return{otherDates:map(same.rows),atVenue:map(venue.rows)};
}

export function isAllDay(d:Date){const t=new Intl.DateTimeFormat("en-US",{timeZone:TZ,hour:"2-digit",minute:"2-digit",hour12:false}).format(d);return t==="00:00"||t==="24:00"}
export function fmtDate(d:Date,opts:Intl.DateTimeFormatOptions={weekday:"long",month:"long",day:"numeric"}){return new Intl.DateTimeFormat("en-US",{timeZone:TZ,...opts}).format(d)}
export function fmtTime(d:Date){return new Intl.DateTimeFormat("en-US",{timeZone:TZ,hour:"numeric",minute:"2-digit"}).format(d)}
/** "3:00 PM – 4:30 PM"; drops an end time that isn't after the start (overnight/check-out style data). */
export function timeRange(e:EventDetail){if(isAllDay(e.start))return"All day";const end=e.end&&e.end>e.start&&e.end.getTime()-e.start.getTime()<16*3600e3?e.end:null;return fmtTime(e.start)+(end?` – ${fmtTime(end)}`:"")}

const ics=(d:Date)=>d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
function localDay(d:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(d).replace(/-/g,"")}
/** Start/end for calendars: all-day uses dates; otherwise UTC timestamps (default length 1 hour). */
export function calendarTimes(e:EventDetail){
 if(isAllDay(e.start)){const s=localDay(e.start),n=new Date(e.start.getTime()+36*3600e3);return{allDay:true,start:s,end:localDay(n)}}
 const end=e.end&&e.end>e.start?e.end:new Date(e.start.getTime()+3600e3);
 return{allDay:false,start:ics(e.start),end:ics(end)};
}
export function whereText(e:EventDetail){return[e.venue,e.address||e.city].filter(Boolean).join(", ")}
export function googleCalendarUrl(e:EventDetail,pageUrl:string){
 const t=calendarTimes(e);const u=new URL("https://calendar.google.com/calendar/render");
 u.searchParams.set("action","TEMPLATE");u.searchParams.set("text",e.title);u.searchParams.set("dates",`${t.start}/${t.end}`);
 u.searchParams.set("details",`${e.description.slice(0,600)}\n\nDetails: ${e.officialUrl}\nFound on GoToday: ${pageUrl}`);u.searchParams.set("location",whereText(e));
 if(!t.allDay)u.searchParams.set("ctz",TZ);
 return u.toString();
}
export function directionsUrl(e:EventDetail){
 const q=e.lat!=null&&e.lng!=null&&!e.address?`${e.lat},${e.lng}`:whereText(e);
 return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}
/** Keyless Google Maps embed; uses coordinates when known, otherwise the venue + address/city text. */
export function mapEmbedUrl(e:EventDetail){
 const q=e.lat!=null&&e.lng!=null?`${e.lat},${e.lng}`:whereText(e);
 return q?`https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`:null;
}
export function icsFile(e:EventDetail,pageUrl:string){
 const t=calendarTimes(e),esc=(x:string)=>x.replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/([,;])/g,"\\$1");
 const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//GoToday//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VEVENT",
  `UID:gotoday-${e.id}@gotoday`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"")}`,
  t.allDay?`DTSTART;VALUE=DATE:${t.start}`:`DTSTART:${t.start}`,t.allDay?`DTEND;VALUE=DATE:${t.end}`:`DTEND:${t.end}`,
  `SUMMARY:${esc(e.title)}`,`LOCATION:${esc(whereText(e))}`,`DESCRIPTION:${esc(`${e.description.slice(0,800)}\n\nDetails: ${e.officialUrl}`)}`,`URL:${pageUrl}`,
  "END:VEVENT","END:VCALENDAR"];
 return lines.join("\r\n")+"\r\n";
}
