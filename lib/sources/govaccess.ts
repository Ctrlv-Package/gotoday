import type {EventRecord} from "../ingestion/types";
import {fetchRetry} from "../http";
import {slug,stripHtml} from "../ingestion/utils";
import {parseTime} from "./opencities";

// Granicus govAccess city sites (e.g. westonfl.org). No feed, but the markup is stable:
//  - Event tile lists: <li class="vi-events-tiles-item"> with schema.org microdata
//    (<time itemprop="startDate" datetime="2026-10-10T14:00+00:00">, itemprop="summary").
//  - Month calendar grid: <td aria-label="Scheduled events, Thursday, September 3, 2026"> containing
//    <span class="calendar_eventtime">2:30 PM</span><a class="calendar_eventlink" href="...">Title</a>.
// Month pages: <calendar path>/-curm-<month>/-cury-<year>.

export type GovAccessConfig={site:string;source:string;idPrefix:string;city:string;venue:string;tilePages?:string[];calendarPaths?:string[]};

import {BROWSER_HEADERS} from "./opencities";
// Some govAccess sites (Weston) return 403 to crawler user agents; send ordinary browser headers.
const HEADERS={...BROWSER_HEADERS,"Cache-Control":"no-cache"};
const MONTHS=["january","february","march","april","may","june","july","august","september","october","november","december"];
const decode=(s:string)=>s.replace(/&amp;/g,"&").replace(/&#39;|&#x27;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&rsquo;/g,"’").replace(/&nbsp;/g," ");

/** ISO instant ("2026-10-10T14:00+00:00") -> local Eastern date/time. */
function eastern(iso:string):{date:string;time:string}|null{
 const d=new Date(iso.replace(/(T\d{2}:\d{2})([+-])/,"$1:00$2"));
 if(isNaN(+d))return null;
 const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(d);
 const g=(t:string)=>p.find(x=>x.type===t)?.value||"";
 return{date:`${g("year")}-${g("month")}-${g("day")}`,time:`${g("hour").replace(/^24$/,"00")}:${g("minute")}:00`};
}

export function parseGovAccessTiles(html:string,origin:string){
 const out:{href:string;title:string;date:string;time:string;endTime:string;desc:string;image?:string}[]=[];
 for(const m of html.matchAll(/<li[^>]*class="[^"]*vi-events-tiles-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi)){
  const li=m[1];
  const href=li.match(/href="([^"]+Components\/Calendar\/Event[^"]*)"/i)?.[1];
  const title=decode(stripHtml(li.match(/itemprop="summary"[^>]*>([\s\S]*?)<\/span>/i)?.[1]||li.match(/aria-label="([^"]+)"/i)?.[1]||""));
  const s=li.match(/itemprop="startDate"[^>]*datetime="([^"]+)"/i)?.[1],e=li.match(/itemprop="endDate"[^>]*datetime="([^"]+)"/i)?.[1];
  const st=s?eastern(s):null;if(!href||!title||!st)continue;
  const desc=decode(stripHtml(li.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]||""));
  const img=li.match(/background-image:\s*url\(([^)]+)\)/i)?.[1]?.replace(/['"]/g,"");
  out.push({href:new URL(decode(href),origin).toString(),title,date:st.date,time:st.time,endTime:e?eastern(e)?.time||"":"",desc,image:img?new URL(img,origin).toString():undefined});
 }
 return out;
}

export function parseGovAccessGrid(html:string,origin:string){
 const out:{href:string;title:string;date:string;time:string}[]=[];
 for(const td of html.matchAll(/<td[^>]*aria-label="Scheduled events,\s*\w+,\s*(\w+)\s+(\d{1,2}),\s*(\d{4})"[^>]*>([\s\S]*?)<\/td>/gi)){
  const mo=MONTHS.indexOf(td[1].toLowerCase());if(mo<0)continue;
  const date=`${td[3]}-${String(mo+1).padStart(2,"0")}-${td[2].padStart(2,"0")}`;
  for(const it of td[4].matchAll(/<div[^>]*class="calendar_item"[^>]*>([\s\S]*?)<\/div>/gi)){
   const a=it[1].match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);if(!a)continue;
   const time=stripHtml(it[1].match(/calendar_eventtime[^>]*>([\s\S]*?)<\/span>/i)?.[1]||"");
   out.push({href:new URL(decode(a[1]),origin).toString(),title:decode(stripHtml(a[2])),date,time:parseTime(time)});
  }
 }
 return out;
}

export async function fetchGovAccess(cfg:GovAccessConfig,startDate:string,endDate:string):Promise<EventRecord[]>{
 const origin=new URL(cfg.site).origin;
 const items=new Map<string,{href:string;title:string;date:string;time:string;endTime?:string;desc?:string;image?:string;from:string}>();
 let pagesOk=0;const errors:string[]=[];
 const get=async(url:string)=>{const r=await fetchRetry(url,{headers:HEADERS,cache:"no-store"});if(!r.ok){errors.push(`HTTP ${r.status} ${url}`);return null}pagesOk++;return r.text()};
 // Rich tiles first (they carry descriptions and images).
 for(const p of cfg.tilePages||[]){
  const url=origin+p,html=await get(url);if(!html)continue;
  for(const t of parseGovAccessTiles(html,origin))items.set(t.href+"|"+t.date,{...t,from:url});
 }
 // Calendar grid for every month the window touches.
 const months=new Set<string>();
 for(let d=new Date(startDate+"T12:00:00Z");d.toISOString().slice(0,10)<=endDate;d.setUTCDate(d.getUTCDate()+7))months.add(`${d.getUTCMonth()+1}|${d.getUTCFullYear()}`);
 months.add(`${+endDate.slice(5,7)}|${endDate.slice(0,4)}`);
 for(const p of cfg.calendarPaths||[]){
  for(const my of months){
   const [m,y]=my.split("|"),url=`${origin}${p}/-curm-${m}/-cury-${y}`,html=await get(url);if(!html)continue;
   for(const g of parseGovAccessGrid(html,origin)){const k=g.href+"|"+g.date;if(!items.has(k))items.set(k,{...g,from:url})}
  }
 }
 if(pagesOk===0)throw new Error(errors[0]||"No pages fetched");
 const out:EventRecord[]=[];
 for(const it of items.values()){
  if(it.date<startDate||it.date>endDate)continue;
  const blob=(it.title+" "+(it.desc||"")).toLowerCase();
  const kids=/\b(kids?|kid-tacular|children|youth|teens?|story ?time|trunk or treat|egg hunt|chalk)\b/.test(blob);
  const family=kids||/\b(family|festival|parade|movie|fireworks|holiday|celebration|fest)\b/.test(blob);
  const arts=/\b(music|concert|symphony|band|film|movie|theat(re|er)|arts?|dance|pops|show)\b/.test(blob);
  const sports=/\b(run|walk|5k|race|tournament|golf|soccer)\b/.test(blob);
  out.push({id:`${cfg.idPrefix}-${slug(it.title+"-"+it.date)}`,title:it.title,city:cfg.city,venue:cfg.venue,date:it.date,time:it.time,endTime:it.endTime||undefined,
   url:it.href,sourceUrl:it.from,image:it.image,category:family?"Family":arts?"Arts & Theatre":sports?"Sports":"Local",genre:"City Event",
   desc:it.desc||`Official ${cfg.source} event.`,tags:[...(family?["Family"]:[]),...(kids?["Kids"]:[]),...(arts?["Arts & Theatre"]:[]),...(sports?["Sports"]:[]),"Local"],
   emoji:family?"🎉":arts?"🎵":sports?"🏃":"📍",source:cfg.source});
 }
 return out;
}
