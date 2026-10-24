// Generic calendar products used by thousands of cities, museums, downtown groups and parks departments:
//  - iCal feeds (.ics: Trumba, Google Calendar, many CMSs export one)
//  - WordPress "The Events Calendar" (Tribe) REST API: /wp-json/tribe/events/v1/events
//  - Localist: /api/2/events
// One adapter each covers every site that uses that product, so adding a place is a config row, not code.
import type {EventRecord} from "../ingestion/types";
import {fetchRetry} from "../http";
import {stripHtml,richText} from "../ingestion/utils";
import {zonedToUtc} from "../time";

export type GenericCfg={url:string;source:string;idPrefix:string;city:string;venue:string;tz?:string};
const UA={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"};
const clean=(s:unknown)=>stripHtml(String(s??"")).replace(/\s+/g," ").trim();
const words=(t:string)=>t.toLowerCase();
function tagsFor(title:string,desc:string,extra:string[]=[]){
 const t=words(`${title} ${extra.join(" ")} ${desc.slice(0,400)}`);
 const kids=/\b(kids?|children|preschool|toddlers?|story ?time|tweens?|family|families)\b/.test(t);
 const arts=/\b(art|arts|music|concert|theat(er|re)|dance|film|exhibit\w*|gallery)\b/.test(t);
 const sports=/\b(5k|run|race|tournament|game|sports?|golf|tennis|pickleball|soccer)\b/.test(t);
 return{kids,arts,sports,tags:[...extra.filter(Boolean),...(kids?["Family"]:[]),...(arts?["Arts & Theatre"]:[]),...(sports?["Sports"]:[])]};
}
const localDay=(d:Date,tz:string)=>new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
const localTime=(d:Date,tz:string)=>new Intl.DateTimeFormat("en-GB",{timeZone:tz,hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(d);

// ---------- iCal ----------
function unfold(ics:string){return ics.replace(/\r?\n[ \t]/g,"")}
function icsValue(v:string){return v.replace(/\\n/gi,"\n").replace(/\\,/g,",").replace(/\\;/g,";").replace(/\\\\/g,"\\")}
/** "20261024T170000" with TZID / "…Z" / VALUE=DATE "20261024" → local date + time in the event's zone. */
function icsWhen(prop:string,value:string,defaultTz:string):{date:string;time:string}|null{
 const tz=(prop.match(/TZID=([^;:]+)/)?.[1]||defaultTz).replace(/"/g,"");
 const m=value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);if(!m)return null;
 const date=`${m[1]}-${m[2]}-${m[3]}`;
 if(!m[4])return{date,time:""};
 if(m[7]){const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0)));return{date:localDay(d,defaultTz),time:localTime(d,defaultTz)}}
 if(tz!==defaultTz){try{const d=zonedToUtc(date,`${m[4]}:${m[5]}:00`,tz);return{date:localDay(d,defaultTz),time:localTime(d,defaultTz)}}catch{}}
 return{date,time:`${m[4]}:${m[5]}:00`};
}
export async function fetchIcal(cfg:GenericCfg,startDate:string,endDate:string):Promise<EventRecord[]>{
 const tz=cfg.tz||"America/New_York";
 const r=await fetchRetry(cfg.url.replace(/^webcal:/i,"https:"),{headers:{...UA,Accept:"text/calendar,*/*"},cache:"no-store"});
 if(!r.ok)throw new Error(`HTTP ${r.status} from ${new URL(cfg.url.replace(/^webcal:/i,"https:")).host}`);
 const text=unfold(await r.text());if(!/BEGIN:VCALENDAR/.test(text))throw new Error("Not an iCal feed");
 const out:EventRecord[]=[];
 for(const block of text.split("BEGIN:VEVENT").slice(1)){
  const body=block.split("END:VEVENT")[0];const props:Record<string,{p:string;v:string}>={};
  for(const line of body.split(/\r?\n/)){const i=line.indexOf(":");if(i<1)continue;const head=line.slice(0,i),name=head.split(";")[0].toUpperCase();if(!props[name])props[name]={p:head,v:line.slice(i+1)}}
  if(!props.DTSTART||!props.SUMMARY)continue;
  if(props.RRULE)continue;   // repeating rules: the feed's own expanded dates are used when present; open-ended rules are skipped
  if(/CANCELLED/i.test(props.STATUS?.v||""))continue;
  const s=icsWhen(props.DTSTART.p,props.DTSTART.v,tz),e=props.DTEND?icsWhen(props.DTEND.p,props.DTEND.v,tz):null;
  if(!s||s.date<startDate||s.date>endDate)continue;
  const title=clean(icsValue(props.SUMMARY.v));if(title.length<3)continue;
  const desc=richText(icsValue(props.DESCRIPTION?.v||"")).slice(0,3000);
  const loc=clean(icsValue(props.LOCATION?.v||""));
  const venue=loc.split(",")[0].trim().slice(0,120)||cfg.venue,address=/\d/.test(loc)?loc.slice(0,200):undefined;
  const link=(props.URL?.v||"").trim();const {kids,arts,tags}=tagsFor(title,desc,(props.CATEGORIES?.v||"").split(",").map(x=>clean(icsValue(x))));
  const uid=(props.UID?.v||title).replace(/[^A-Za-z0-9]+/g,"").slice(-40);
  out.push({id:`${cfg.idPrefix}-${uid}-${s.date}`,title,city:cfg.city,venue,address,date:s.date,time:s.time,endTime:e&&e.date===s.date&&e.time>s.time?e.time:undefined,
   url:/^https?:/i.test(link)?link:cfg.url,sourceUrl:cfg.url,category:kids?"Family":arts?"Arts & Theatre":"Local",genre:"Community Event",
   desc:desc||`${cfg.source} event.`,tags:[...tags,"Local"],emoji:kids?"🎉":arts?"🎨":"📍",source:cfg.source,eventType:"event"});
 }
 return out;
}

// ---------- WordPress "The Events Calendar" ----------
export async function fetchTribe(cfg:GenericCfg,startDate:string,endDate:string):Promise<EventRecord[]>{
 const origin=new URL(cfg.url).origin,out:EventRecord[]=[];
 for(let page=1;page<=10;page++){
  const u=`${origin}/wp-json/tribe/events/v1/events?start_date=${startDate}&end_date=${endDate}%2023:59:59&per_page=50&page=${page}`;
  const r=await fetchRetry(u,{headers:{...UA,Accept:"application/json"},cache:"no-store"});
  if(!r.ok){if(page===1)throw new Error(`HTTP ${r.status} from ${new URL(origin).host} events API`);break}
  const d:any=await r.json().catch(()=>({}));const rows:any[]=d?.events||[];
  for(const e of rows){
   const date=String(e.start_date||"").slice(0,10);if(!date||date<startDate||date>endDate)continue;
   const title=clean(e.title);if(title.length<3)continue;
   const all=!!e.all_day,v=e.venue&&!Array.isArray(e.venue)?e.venue:null;
   const desc=richText(String(e.description||e.excerpt||"")).slice(0,3000);
   const cats=(e.categories||[]).map((c:any)=>clean(c.name));
   const {kids,arts,tags}=tagsFor(title,desc,cats);
   const cost=clean(e.cost);const free=!cost||/^(free|\$?0(\.00)?)$/i.test(cost);
   const city=v?.city?`${clean(v.city)}, ${clean(v.stateprovince||v.state||"").slice(0,2)||cfg.city.split(",")[1]?.trim()||"FL"}`:cfg.city;
   out.push({id:`${cfg.idPrefix}-${e.id}-${date}`,title,city,venue:clean(v?.venue)||cfg.venue,address:v?.address?[clean(v.address),clean(v.city)].filter(Boolean).join(", "):undefined,
    date,time:all?"":String(e.start_date).slice(11,19),endTime:!all&&String(e.end_date||"").slice(0,10)===date?String(e.end_date).slice(11,19):undefined,
    url:e.url||cfg.url,sourceUrl:cfg.url,image:e.image?.url||undefined,category:kids?"Family":arts?"Arts & Theatre":"Local",genre:"Community Event",
    desc:desc||`${cfg.source} event.`,tags:[...tags,...(free&&cost?["Free"]:[]),"Local"],emoji:kids?"🎉":arts?"🎨":"📍",source:cfg.source,
    priceText:cost||undefined,isFree:free&&!!cost?true:undefined,eventType:"event"});
  }
  if(!d?.next_rest_url||!rows.length)break;
 }
 return out;
}

// ---------- Localist ----------
const PUBLIC_CAMPUS=/\b(arts?\/entertainment|music|concerts?|recitals?|performances?|theat(er|re)|opera|dance|ballet|film|screening|movie|exhibit\w*|gallery|museum|lectures?|speakers?|readings?|author|festival|fest\b|fair\b|athletics|football|basketball|baseball|softball|soccer|volleyball|game day|tailgate|planetarium|observatory|garden|tour|market|homecoming|community|public|family|kids|gala)\b/i;
export async function fetchLocalist(cfg:GenericCfg,startDate:string,endDate:string):Promise<EventRecord[]>{
 const campus=/universit|college|\.edu\b/i.test(`${cfg.source} ${cfg.url}`);
 const origin=new URL(cfg.url).origin,tz=cfg.tz||"America/New_York",out:EventRecord[]=[];
 const days=Math.min(370,Math.max(1,Math.round((Date.parse(endDate)-Date.parse(startDate))/864e5)+1));
 for(let page=1;page<=10;page++){
  const u=`${origin}/api/2/events?start=${startDate}&days=${days}&pp=100&page=${page}`;
  const r=await fetchRetry(u,{headers:{...UA,Accept:"application/json"},cache:"no-store"});
  if(!r.ok){if(page===1)throw new Error(`HTTP ${r.status} from ${new URL(origin).host} Localist API`);break}
  const d:any=await r.json().catch(()=>({}));const rows:any[]=d?.events||[];
  for(const w of rows){const e=w.event||w;
   // Universities mark who an event is for: when that's only students/faculty/staff, it isn't a public event.
   const aud=(e.filters?.event_target_audience||[]).map((x:any)=>clean(x.name).toLowerCase());
   if(aud.length&&!aud.some((a:string)=>/public|community|everyone|general|all|visitor|famil|alumni|guest|open/.test(a)))continue;
   for(const inst of (e.event_instances||[]).map((x:any)=>x.event_instance||x)){
    const st=new Date(inst.start);if(isNaN(+st))continue;const date=localDay(st,tz);if(date<startDate||date>endDate)continue;
    const title=clean(e.title);if(title.length<3)continue;
    const desc=richText(String(e.description_text||e.description||"")).slice(0,3000);
    const types=[...(e.filters?.event_types||[]),...(e.filters?.event_target_audience||[])].map((x:any)=>clean(x.name));
    // A campus calendar is mostly student life; keep what the public goes to (performances, exhibits, talks,
    // films, games, festivals).
    if(campus&&!PUBLIC_CAMPUS.test(`${title} | ${types.join(" | ")}`))continue;
    const {kids,arts,tags}=tagsFor(title,desc,types);
    const en=inst.end?new Date(inst.end):null;
    out.push({id:`${cfg.idPrefix}-${e.id}-${date}`,title,city:e.geo?.city?`${clean(e.geo.city)}, ${clean(e.geo.state||"").slice(0,2)||"FL"}`:cfg.city,
     venue:clean(e.location_name)||cfg.venue,address:clean(e.address)||undefined,date,time:inst.all_day?"":localTime(st,tz),
     endTime:en&&!inst.all_day&&localDay(en,tz)===date?localTime(en,tz):undefined,url:e.localist_url||e.url||cfg.url,sourceUrl:cfg.url,
     image:e.photo_url||undefined,category:kids?"Family":arts?"Arts & Theatre":"Local",genre:"Community Event",desc:desc||`${cfg.source} event.`,
     tags:[...tags,...(e.free?["Free"]:[]),"Local"],emoji:kids?"🎉":arts?"🎨":"📍",source:cfg.source,isFree:e.free?true:undefined,
     priceText:e.ticket_cost?clean(e.ticket_cost):undefined,eventType:"event"});
   }
  }
  if(!d?.page||d.page.current>=d.page.total)break;
 }
 return out;
}
