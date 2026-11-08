import {decodeEntities} from "./html";
import {settingFor} from "./facets";
import {db} from "./db";
import {ensureSchema} from "./schema";

import {DEFAULT_TZ} from "./time";
import {googleCalendarLink,icsText,type CalEvent} from "./calendar";
import {fillFromCopies} from "./copies";
import {placeScore} from "./places";
export const TZ=DEFAULT_TZ;
export function decodeHtml(s:string){return decodeEntities(s)}

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
  e.registration_url,e.registration_text,e.recurrence,e.timezone,e.source_id,s.name as source,(select c.url from source_configs c where c.name=s.name limit 1) as source_page,v.id as venue_id,v.name as venue,v.address,v.latitude,v.longitude
  from events e join sources s on s.id=e.source_id left join venues v on v.id=e.venue_id where e.id=$1 limit 1`,[n]);
 const r=rows[0];if(!r)return null;
 // Same rule as the cards: a photo shared by 3+ differently named events is a cover or placeholder, not this event's.
 if(r.image_url&&/ticketm\.net\/dam\/c\//.test(r.image_url))r.image_url=null;
 if(r.image_url&&!/static\.libnet\.info|ticketm\.net/.test(r.image_url)){
  const sh=await db.query("select count(distinct lower(title))::int as n from events where image_url=$1",[r.image_url]).catch(()=>({rows:[{n:0}]}));
  if(Number(sh.rows[0]?.n)>=3)r.image_url=null;
 }
 const ev:EventDetail={id:r.id,title:decodeHtml(r.title),description:decodeHtml(r.description||""),start:new Date(r.start_at),end:r.end_at?new Date(r.end_at):null,city:r.city||"",
  image:r.image_url,officialUrl:/\.ics(\?|$)|calendar-manager\/events\.ics|\/feed\/ical/i.test(String(r.official_url||""))?(r.source_page||String(r.official_url).replace(/\/(fs\/calendar-manager\/events\.ics|feed\/ical|events\.ics|calendar\.ics)[^]*$/i,"")):r.official_url,priceText:r.price_text?decodeHtml(r.price_text):null,isFree:!!r.is_free,category:r.category,tags:(()=>{const t:string[]=Array.isArray(r.tags)?r.tags.filter((x:string)=>x!=="Indoor"&&x!=="Outdoor"):[];const st=settingFor({title:r.title,venue:r.venue,source:r.source,desc:r.description});return st?[...t,st]:t})(),
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
// An address typed in all caps ("COCONUT CREEK PKWY ...") reads as shouting: show it in title case.
// Mixed-case text is left alone; known abbreviations (FL, NE, US, every state code) stay uppercase, and
// ordinals keep their shape ("26th", not "26Th").
const KEEP_UPPER=new Set(["FL","NE","NW","SE","SW","N","S","E","W","US","USA","PO","DC","II","III","IV","AL","AK","AZ","AR","CA","CO","CT","DE","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]);
export function displayCase(s:string){
 // A digit-led ordinal shouts whatever the case around it ("136TH" → "136th"); fix it first, so the
 // word logic below never sees it — and never re-capitalises its tail ("136th" → "136tH").
 s=s.replace(/\b(\d+)([A-Z]{1,2})\b/g,(_,d,l)=>d+l.toLowerCase());
 const letters=s.replace(/[^A-Za-z]/g,"");
 if(!letters.length)return s;
 const upper=[...letters].filter(c=>c>="A"&&c<="Z").length;
 if(upper/letters.length>=0.8){
  return s.replace(/(?<![A-Za-z\d])[A-Za-z]+(?:'[A-Za-z]+)?/g,w=>{
   if(KEEP_UPPER.has(w.toUpperCase()))return w.toUpperCase();
   return w.toLowerCase().replace(/(^|')([a-z])/g,(_,p,c)=>p+c.toUpperCase());
  });
 }
 // Mixed case: only fix an all-caps street suffix ("ST" → "St"). Real names, acronyms and state codes
 // are left alone.
 return s.replace(/\b(AVE|ST|PKWY|BLVD|RD|DR|LN|HWY)\b/g,w=>w[0]+w.slice(1).toLowerCase());
}
// Some venues were saved as "Name, Street address" — the address then shows up twice, once inside the
// venue name and once on the line below. Show just the place name; the address line carries the address.
const STREET_SUFFIX:{[k:string]:string}={avenue:"ave",ave:"ave",street:"st",st:"st",boulevard:"blvd",blvd:"blvd",road:"rd",rd:"rd",drive:"dr",dr:"dr",court:"ct",ct:"ct",lane:"ln",ln:"ln",parkway:"pkwy",pkwy:"pkwy",highway:"hwy",hwy:"hwy"};
export function venueName(venue:string|null|undefined,address:string|null|undefined){
 if(!venue)return "";
 if(!address)return venue;
 const seg=(address.split(",")[0]||"").trim();
 if(!seg)return venue;
 // The address segment with each street-suffix word in all its forms ("Ave" and "Avenue", "St" and
 // "Street"), so "1301 SW 136th Avenue" matches an address that says "1301 SW 136TH Ave".
 const variants=[seg];
 const m=seg.match(/\b(avenue|ave|street|st|boulevard|blvd|road|rd|drive|dr|court|ct|lane|ln|parkway|pkwy|highway|hwy)\b/i);
 if(m){const group=Object.keys(STREET_SUFFIX).filter(k=>STREET_SUFFIX[k]===STREET_SUFFIX[m[1].toLowerCase()]);for(const g of group){if(g.toLowerCase()!==m[1].toLowerCase())variants.push(seg.replace(m[1],g));}}
 const low=venue.toLowerCase();
 for(const v of variants){
  const i=low.indexOf(v.toLowerCase());
  if(i>0){const name=venue.slice(0,i).replace(/[,\s]+$/,"");if(name)return name;}
 }
 return venue;
}
/** The Where line under the venue name: when the venue name IS the street address, the address only repeats
 *  it — show the rest (town, state, ZIP) instead. An all-caps address is de-shouted. */
export function addressLine(venue:string|null,address:string|null,city:string){
 const a=(address||"").trim();
 if(!a)return city;
 const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g," ").trim().split(" ").map(w=>STREET_SUFFIX[w]||w).join(" ");
 const v=norm(venue||"");
 if(v){
  const first=a.split(",")[0]||"";
  if(norm(first)===v||norm(a).startsWith(v+" ")){
   const rest=a.split(",").slice(1).join(",").trim();
   return displayCase(rest||city);
  }
 }
 return displayCase(a);
}
export function whereText(e:EventDetail){const v=venueName(e.venue,e.address);const a=e.address&&v&&e.address.toLowerCase().includes(v.toLowerCase())?e.address:null;return (a?[a,e.city]:[v,e.address||e.city]).filter((p):p is string=>!!p).map(p=>displayCase(p)).join(", ")}
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
