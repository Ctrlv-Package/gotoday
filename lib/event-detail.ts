import {settingFor} from "./facets";
import {db} from "./db";
import {ensureSchema} from "./schema";

import {DEFAULT_TZ} from "./time";
import {googleCalendarLink,icsText,type CalEvent} from "./calendar";
import {fillFromCopies} from "./copies";
import {placeScore} from "./places";
export const TZ=DEFAULT_TZ;
export function decodeHtml(s:string){return String(s||"").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16))).replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'")}

export type EventDetail={
 id:number;title:string;description:string;start:Date;end:Date|null;city:string;image:string|null;officialUrl:string;priceText:string|null;isFree:boolean;
 category:string|null;tags:string[];ageMin:number|null;ageMax:number|null;registrationUrl:string|null;registrationText:string|null;recurrence:string|null;
 source:string;sourceId:number;tz:string;stockImage?:boolean;backupImage?:string;venue:string|null;venueId:number|null;address:string|null;lat:number|null;lng:number|null;
};

export function parseId(id:string){const raw=decodeURIComponent(id);if(!raw.startsWith("db-"))return null;const n=Number(raw.slice(3));return Number.isInteger(n)&&n>0?n:null}

export async function loadEvent(id:string):Promise<EventDetail|null>{
 const n=parseId(id);if(!n)return null;
 await ensureSchema();
 const {rows}=await db.query(`select e.id,e.title,e.description,e.start_at,e.end_at,e.city,e.image_url,e.official_url,e.price_text,e.is_free,e.category,e.tags,e.age_min,e.age_max,
  e.registration_url,e.registration_text,e.recurrence,e.timezone,e.source_id,s.name as source,v.id as venue_id,v.name as venue,v.address,v.latitude,v.longitude
  from events e join sources s on s.id=e.source_id left join venues v on v.id=e.venue_id where e.id=$1 limit 1`,[n]);
 const r=rows[0];if(!r)return null;
 // Same rule as the cards: a photo shared by 3+ differently named events is a cover or placeholder, not this event's.
 if(r.image_url&&/ticketm\.net\/dam\/c\//.test(r.image_url))r.image_url=null;
 if(r.image_url&&!/static\.libnet\.info|ticketm\.net/.test(r.image_url)){
  const sh=await db.query("select count(distinct lower(title))::int as n from events where image_url=$1",[r.image_url]).catch(()=>({rows:[{n:0}]}));
  if(Number(sh.rows[0]?.n)>=3)r.image_url=null;
 }
 const ev:EventDetail={id:r.id,title:decodeHtml(r.title),description:decodeHtml(r.description||""),start:new Date(r.start_at),end:r.end_at?new Date(r.end_at):null,city:r.city||"",
  image:r.image_url,officialUrl:r.official_url,priceText:r.price_text?decodeHtml(r.price_text):null,isFree:!!r.is_free,category:r.category,tags:(()=>{const t:string[]=Array.isArray(r.tags)?r.tags.filter((x:string)=>x!=="Indoor"&&x!=="Outdoor"):[];const st=settingFor({title:r.title,venue:r.venue,source:r.source,desc:r.description});return st?[...t,st]:t})(),
  ageMin:r.age_min,ageMax:r.age_max,registrationUrl:r.registration_url,registrationText:r.registration_text,recurrence:r.recurrence,source:/^Ticketmaster/.test(r.source)?"Ticketmaster":r.source,sourceId:r.source_id,tz:r.timezone||DEFAULT_TZ,
  venue:r.venue?decodeHtml(r.venue):null,venueId:r.venue_id,address:r.address,lat:r.latitude==null?null:Number(r.latitude),lng:r.longitude==null?null:Number(r.longitude)};
 // Fill what this listing lacks (photo, description, ages) from the other copies of the same event, like the cards do.
 return fillFromCopies(ev).catch(()=>ev);
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

export function isAllDay(d:Date,tz:string=TZ){const t=new Intl.DateTimeFormat("en-US",{timeZone:tz,hour:"2-digit",minute:"2-digit",hour12:false}).format(d);return t==="00:00"||t==="24:00"}
export function fmtDate(d:Date,opts:Intl.DateTimeFormatOptions={weekday:"long",month:"long",day:"numeric"},tz:string=TZ,loc="en-US"){const s=new Intl.DateTimeFormat(loc,{timeZone:tz,...opts}).format(d);return s.charAt(0).toUpperCase()+s.slice(1)}
export function fmtTime(d:Date,tz:string=TZ,loc="en-US"){return new Intl.DateTimeFormat(loc,{timeZone:tz,hour:"numeric",minute:"2-digit"}).format(d)}
/** "3:00 PM – 4:30 PM"; drops an end time that isn't after the start (overnight/check-out style data). */
export function timeRange(e:EventDetail,loc="en-US",allDay="All day"){if(isAllDay(e.start,e.tz))return allDay;const end=e.end&&e.end>e.start&&e.end.getTime()-e.start.getTime()<16*3600e3?e.end:null;return fmtTime(e.start,e.tz,loc)+(end?` – ${fmtTime(end,e.tz,loc)}`:"")}

const ics=(d:Date)=>d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
function localDay(d:Date,tz:string=TZ){return new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(d).replace(/-/g,"")}
/** Start/end for calendars: all-day uses dates; otherwise UTC timestamps (default length 1 hour). */
export function calendarTimes(e:EventDetail){
 if(isAllDay(e.start,e.tz)){const s=localDay(e.start,e.tz),n=new Date(e.start.getTime()+36*3600e3);return{allDay:true,start:s,end:localDay(n,e.tz)}}
 const end=e.end&&e.end>e.start?e.end:new Date(e.start.getTime()+3600e3);
 return{allDay:false,start:ics(e.start),end:ics(end)};
}
export function whereText(e:EventDetail){const a=e.address&&e.venue&&e.address.toLowerCase().includes(e.venue.toLowerCase())?e.address:null;return(a?[a,e.city]:[e.venue,e.address||e.city]).filter(Boolean).join(", ")}
/** Calendar-ready shape of an event (see lib/calendar.ts for the Google/Outlook/Apple formats). */
export function toCalEvent(e:EventDetail,pageUrl:string):CalEvent{
 return{uid:`gotoday-${e.id}`,title:e.title,description:e.description,location:whereText(e),start:e.start,end:e.end,allDay:isAllDay(e.start,e.tz),tz:e.tz,url:pageUrl};
}
export function googleCalendarUrl(e:EventDetail,pageUrl:string){return googleCalendarLink(toCalEvent(e,pageUrl))}
// Directions and the map go by the place's name and address (Google finds "Sanctuary Park, Southwest Ranches"
// exactly); map points are used only when the listing names no place, since many are just the town's center.
function placeQuery(e:EventDetail){
 if(placeScore({venue:e.venue,address:e.address,city:e.city,source:e.source})>0)return whereText(e);
 return e.lat!=null&&e.lng!=null?`${e.lat},${e.lng}`:whereText(e);
}
export function directionsUrl(e:EventDetail){
 const q=placeQuery(e);
 return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}
/** Keyless Google Maps embed; uses coordinates when known, otherwise the venue + address/city text. */
export function mapEmbedUrl(e:EventDetail){
 const q=placeQuery(e);
 return q?`https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`:null;
}
export function icsFile(e:EventDetail,pageUrl:string){return icsText(toCalEvent(e,pageUrl))}
