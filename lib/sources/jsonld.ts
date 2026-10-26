// schema.org Event data (<script type="application/ld+json">) — what Google reads to show events in search, so most
// theaters, venues and ticketing pages publish it: community theaters (OnTheStage, Ludus, ThunderTix, ShowTix4U pages),
// Wix / Squarespace / WordPress event pages, museums, clubs. One adapter covers every site that has it.
// The listing page is read first; when it has no Event data of its own, up to `maxPages` linked show/event pages are.
import type {EventRecord} from "../ingestion/types";
import {fetchRetry} from "../http";
import {stripHtml,richText} from "../ingestion/utils";

export type JsonLdConfig={url:string;source:string;idPrefix:string;city:string;venue:string;tz?:string;maxPages?:number;linkPattern?:string};
const UA={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36","Accept":"text/html,application/xhtml+xml,*/*;q=0.8","Accept-Language":"en-US,en;q=0.9"};
const clean=(s:unknown)=>stripHtml(String(s??"")).replace(/\s+/g," ").trim();
const STATES:Record<string,string>={florida:"FL",georgia:"GA","south carolina":"SC","north carolina":"NC",virginia:"VA",maryland:"MD",delaware:"DE","district of columbia":"DC",pennsylvania:"PA","new jersey":"NJ","new york":"NY",connecticut:"CT","rhode island":"RI",massachusetts:"MA","new hampshire":"NH",vermont:"VT",maine:"ME"};

/** Every Event-like object in a page's JSON-LD (inside @graph, ItemList, arrays, subEvent). */
export function eventsInJsonLd(html:string):any[]{
 const out:any[]=[];
 const visit=(o:any,depth=0)=>{
  if(!o||depth>6)return;
  if(Array.isArray(o)){for(const x of o)visit(x,depth+1);return}
  if(typeof o!=="object")return;
  const t=[].concat(o["@type"]||[]).map(String);
  if(t.some(x=>/Event$/.test(x))&&o.startDate)out.push(o);
  for(const k of ["@graph","itemListElement","item","subEvent","events","event"])if(o[k])visit(o[k],depth+1);
 };
 for(const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  const raw=m[1].trim().replace(/^<!--|-->$/g,"");
  try{visit(JSON.parse(raw))}catch{try{visit(JSON.parse(raw.replace(/[\u0000-\u001f]+/g," ")))}catch{}}
 }
 return out;
}

/** "2026-11-07T19:30:00-05:00" / "2026-11-07T19:30" / "2026-11-07" → local date and time in tz. */
function when(v:unknown,tz:string):{date:string;time:string}|null{
 const s=String(v||"").trim();const m=s.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?/);if(!m)return null;
 if(!m[2])return{date:m[1],time:""};
 if(m[4]){const d=new Date(s);if(isNaN(+d))return null;
  const p=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d);
  const g=(k:string)=>p.find(x=>x.type===k)?.value||"";return{date:`${g("year")}-${g("month")}-${g("day")}`,time:`${g("hour")}:${g("minute")}:00`}}
 return{date:m[1],time:`${m[2]}:${m[3]}:00`};
}
const first=(v:any)=>Array.isArray(v)?v[0]:v;

export function recordFromJsonLd(o:any,cfg:JsonLdConfig,pageUrl:string):EventRecord|null{
 const tz=cfg.tz||"America/New_York";
 const st=when(o.startDate,tz);if(!st)return null;
 const en=o.endDate?when(o.endDate,tz):null;
 const title=clean(o.name);if(title.length<3)return null;
 if(/OnlineEventAttendanceMode/i.test(String(o.eventAttendanceMode||""))&&!/Mixed/i.test(String(o.eventAttendanceMode)))return null;
 if(/EventCancelled|EventPostponed/i.test(String(o.eventStatus||"")))return null;
 const loc=first(o.location)||{},addr=typeof loc.address==="string"?{streetAddress:loc.address}:(first(loc.address)||{});
 const region=clean(addr.addressRegion),st2=/^[A-Za-z]{2}$/.test(region)?region.toUpperCase():STATES[region.toLowerCase()]||cfg.city.split(",")[1]?.trim()||"";
 const town=clean(addr.addressLocality);
 const offer=first(o.offers)||{};
 const price=offer.price??offer.lowPrice;const n=Number(String(price??"").replace(/[^0-9.]/g,""));
 const priceText=price!=null&&String(price)!==""?(n===0?"Free":`$${n%1?n.toFixed(2):n}${offer.highPrice&&Number(offer.highPrice)>n?`–$${Number(offer.highPrice)}`:""}`):undefined;
 const img=first(o.image);const image=typeof img==="string"?img:img?.url;
 const desc=richText(String(o.description||"")).slice(0,3000);
 const t=`${title} ${desc.slice(0,300)}`.toLowerCase();
 const kids=/\b(kids?|children|family|families|youth|jr\.?|junior|young audiences)\b/.test(t);
 const music=/\b(concert|band|music|jazz|symphony|orchestra|choir|singer)\b/.test(t)&&!/\bmusical\b/.test(t);
 const url=String(o.url||offer.url||pageUrl);
 const geo=loc.geo||{};const lat=Number(geo.latitude),lng=Number(geo.longitude);
 const lat_ok=Number.isFinite(lat)&&Number.isFinite(lng)&&lat!==0;
 let link=url;try{link=new URL(url,pageUrl).toString()}catch{}
 return{id:`${cfg.idPrefix}-${(link.replace(/^https?:\/\/[^/]+/,"").replace(/[^a-z0-9]+/gi,"-").slice(-60))||title.slice(0,40)}-${st.date}${st.time?"-"+st.time.slice(0,5):""}`,
  title,city:town&&st2?`${town}, ${st2}`:cfg.city,venue:clean(loc.name)||cfg.venue,
  address:[clean(addr.streetAddress),town,st2].filter(Boolean).join(", ")||undefined,date:st.date,time:st.time,
  endTime:en&&en.date===st.date&&en.time?en.time:undefined,url:link,sourceUrl:cfg.url,
  image:image&&/^https?:/.test(String(image))?String(image):undefined,
  category:kids?"Family":music?"Music":"Arts & Theatre",genre:music?"Concert":"Theatre",desc:desc||`${title} at ${clean(loc.name)||cfg.venue}.`,
  tags:[...(kids?["Family"]:[]),...(music?["Music"]:["Arts & Theatre"]),...(priceText==="Free"?["Free"]:priceText?["Paid"]:[])],
  emoji:music?"🎵":"🎭",source:cfg.source,priceText,isFree:priceText==="Free"?true:priceText?false:undefined,
  ...(lat_ok?{latitude:lat,longitude:lng}:{}),eventType:"event"};
}

export async function fetchJsonLd(cfg:JsonLdConfig,startDate:string,endDate:string):Promise<EventRecord[]>{
 const get=async(u:string)=>{const r=await fetchRetry(u,{headers:UA,cache:"no-store"});if(!r.ok)throw new Error(`HTTP ${r.status} from ${new URL(u).host}`);return r.text()};
 const html=await get(cfg.url);
 let found=eventsInJsonLd(html).map(o=>({o,page:cfg.url}));
 if(!found.length){
  // A season / shows page that only links each production: read the linked pages (same site), soonest first in page order.
  const origin=new URL(cfg.url).origin,rx=new RegExp(cfg.linkPattern||"/(events?|shows?|productions?|performances?|calendar|tickets?|season)/[^\"'#?]+","i");
  const links=[...new Set([...html.matchAll(/href=["']([^"'#]+)["']/gi)].map(m=>{try{return new URL(m[1].replace(/&amp;/g,"&"),cfg.url).toString()}catch{return""}})
   .filter(u=>u&&u.startsWith(origin)&&u!==cfg.url&&rx.test(new URL(u).pathname)&&!/\.(pdf|jpg|png|css|js)$/i.test(u)))].slice(0,cfg.maxPages||25);
  let next=0;
  await Promise.all(Array.from({length:4},async()=>{while(next<links.length){const u=links[next++];try{found.push(...eventsInJsonLd(await get(u)).map(o=>({o,page:u})))}catch{}}}));
 }
 const out:EventRecord[]=[],seen=new Set<string>();
 for(const {o,page} of found){
  const e=recordFromJsonLd(o,cfg,page);if(!e||e.date<startDate||e.date>endDate||seen.has(e.id))continue;seen.add(e.id);out.push(e);
 }
 if(!found.length)throw new Error(`No schema.org Event data on ${new URL(cfg.url).host}`);
 return out;
}
