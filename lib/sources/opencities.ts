import type {EventRecord} from "../ingestion/types";
import {fetchRetry} from "../http";
import {slug,stripHtml,costFromPage} from "../ingestion/utils";
import {isGenericPicture} from "../pictures";

// Shared parser for Granicus OpenCities event calendars (Fort Lauderdale, Sunrise, Plantation).
// It keys off links to event detail pages instead of exact CSS classes, so small template
// changes don't break it. Each item's text looks like: "Title 25 Sep 2026 [time] description".

export const BROWSER_HEADERS={
 "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
 "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
 "Accept-Language":"en-US,en;q=0.9"
};

const MON=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const MONTH_RX="(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?";

export function parseDate(s:string){
 let m=s.match(new RegExp(`\\b(\\d{1,2})\\s+${MONTH_RX}\\s+(20\\d{2})\\b`,"i"));
 if(m)return `${m[3]}-${String(MON.indexOf(m[2].slice(0,3).toLowerCase())+1).padStart(2,"0")}-${m[1].padStart(2,"0")}`;
 m=s.match(new RegExp(`\\b${MONTH_RX}\\s+(\\d{1,2}),?\\s+(20\\d{2})\\b`,"i"));
 if(m)return `${m[3]}-${String(MON.indexOf(m[1].slice(0,3).toLowerCase())+1).padStart(2,"0")}-${m[2].padStart(2,"0")}`;
 m=s.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
 if(m)return `${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`;
 return "";
}

/** A card date with no year ("Saturday, October 31", "Oct 31", "31 Oct"): the next such date from `from`. */
export function parseDateNoYear(s:string,from:string){
 let m=s.match(new RegExp(`\\b${MONTH_RX}\\s+(\\d{1,2})\\b(?!\\s*,?\\s*20\\d{2})`,"i")),mo=0,d=0;
 if(m){mo=MON.indexOf(m[1].slice(0,3).toLowerCase())+1;d=+m[2]}
 else{m=s.match(new RegExp(`\\b(\\d{1,2})\\s+${MONTH_RX}\\b`,"i"));if(m){d=+m[1];mo=MON.indexOf(m[2].slice(0,3).toLowerCase())+1}}
 if(!mo||!d||d>31)return "";
 let y=+from.slice(0,4);const mk=(yy:number)=>`${yy}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
 // A date more than two months back means next year's ("Jan 10" seen in November).
 if(mk(y)<new Date(Date.parse(from)-60*864e5).toISOString().slice(0,10))y++;
 return mk(y);
}

export function parseTime(s:string){
 const m=s.match(/\b(\d{1,2})(?::(\d{2}))?\s*([AP])\.?M\.?\b/i);
 if(!m)return "";
 let h=+m[1];if(h>12)return "";
 if(/p/i.test(m[3])&&h<12)h+=12;if(/a/i.test(m[3])&&h===12)h=0;
 return `${String(h).padStart(2,"0")}:${m[2]||"00"}:00`;
}

export type OpenCitiesConfig={
 listUrl:string;        // calendar list page
 eventPath?:string;     // fallback only: path event links start with, for templates without <article> cards
 source:string;         // must match the registry name
 idPrefix:string;
 city:string;
 venue:string;
 block?:RegExp;         // titles to skip (meetings etc.)
 maxPages?:number;
 pageUrl?:(page:number)=>string; // URL of page N (default: OpenCities "dlv" pager on listUrl)
 detailLimit?:number;   // max event pages opened for all dates + exact times (0 = list cards only)
};

// Government business that shows up on city event lists; discovery rules catch most, this catches the rest.
const DEFAULT_BLOCK=/\b(board|commission|committee|advisory|council meeting|meetings?|hearings?|office hours|city commission|workshop agenda|webinar|budget|magistrate|code enforcement|development review|bargaining|election|canvassing)\b/i;
const DATE_ANY=new RegExp(`\\b\\d{1,2}\\s+${MONTH_RX}\\s+20\\d{2}|\\b${MONTH_RX}\\s+\\d{1,2},?\\s+20\\d{2}`,"i");

type Item={href:string;title:string;html:string;desc?:string;address?:string;tags?:string[]};

/** OpenCities list pages render each event as <article> with a link, an <h2 class="list-item-title"> and a date. */
function articleItems(html:string,origin:string):Item[]{
 const out:Item[]=[];
 for(const m of html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)){
  const body=m[1];
  const a=body.match(/<a\b[^>]*href=["']([^"'#]+)["']/i);if(!a)continue;
  let href="";try{href=new URL(a[1].replace(/&amp;/g,"&"),origin).toString()}catch{continue}
  const h=body.match(/<(h[1-6])[^>]*class=["'][^"']*list-item-title[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i)||body.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  let title=stripHtml(h?(h[2]??h[1]):"");
  if(!title){title=stripHtml(body);const cut=title.search(DATE_ANY);if(cut>3)title=title.slice(0,cut)}
  const cls=(c:string)=>body.match(new RegExp(`<(p|span|div)[^>]*class=["'][^"']*\\b${c}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`,"i"))?.[2];
  const desc=cls("list-item-block-desc"),address=cls("list-item-address");
  const tagsHtml=body.match(/class=["']tagged-as-list["'][\s\S]*?<span class=["']text["']>([\s\S]*?)<\/span><\/p>/i)?.[1];
  const tags=tagsHtml?stripHtml(tagsHtml.replace(/<span class=["']separator["']>[\s\S]*?<\/span>/gi,"|")).split("|").map(t=>t.trim()).filter(Boolean):undefined;
  out.push({href,title:title.replace(/\s+/g," ").trim(),html:body,desc:desc?stripHtml(desc):undefined,address:address?stripHtml(address).split(",").map(x=>x.trim()).filter(Boolean).join(", "):undefined,tags});
 }
 return out;
}

/** Older templates: anchors pointing under eventPath (image link + title link collapsed into one item). */
function anchorItems(html:string,origin:string,eventPath:string):Item[]{
 const path=eventPath.replace(/\/$/,"").toLowerCase();
 const anchors=[...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  .map(a=>{let href="";try{href=new URL(a[1].replace(/&amp;/g,"&"),origin).toString()}catch{}return{href,inner:a[2],at:a.index??0}})
  .filter(a=>{if(!a.href)return false;const p=new URL(a.href).pathname.toLowerCase();return p.startsWith(path+"/")&&!p.slice(path.length).includes("/-")});
 const groups:{href:string;inner:string;at:number}[]=[];
 for(const a of anchors){const last=groups[groups.length-1];if(last&&last.href===a.href){last.inner+=" "+a.inner;continue}groups.push({...a})}
 return groups.map((g,i)=>{
  const chunk=html.slice(g.at,groups[i+1]?.at??g.at+5000);
  const heading=chunk.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  let title=stripHtml(heading?.[1]||g.inner);const cut=title.search(DATE_ANY);if(cut>3)title=title.slice(0,cut);
  return{href:g.href,title:title.replace(/\s+/g," ").trim(),html:chunk};
 });
}

/** "Venue, 123 Main St, Coral Springs 33065" -> "123 Main St, Coral Springs, FL 33065" (street address for geocoding). */
function streetAddress(addr:string|undefined,city:string){
 if(!addr||!/\d/.test(addr))return undefined;
 const parts=addr.split(",").map(x=>x.trim()).filter(Boolean);
 if(parts.length>1&&!/^\d/.test(parts[0]))parts.shift();              // drop the venue name
 const zip=parts.join(" ").match(/\b(\d{5})\s*$/)?.[1];
 if(zip)parts[parts.length-1]=parts[parts.length-1].replace(/\s*\d{5}\s*$/,"").trim();
 const cityName=city.split(",")[0],state=city.split(",")[1]?.trim()||"FL";
 const rest=parts.filter(Boolean).filter(x=>x.toLowerCase()!==cityName.toLowerCase());
 if(!rest.length||!/^\d/.test(rest[0]))return undefined;
 return `${rest.join(", ")}, ${cityName}, ${state}${zip?" "+zip:""}`;
}

type Occurrence={date:string;time:string;endTime?:string};
const pad=(n:string|number)=>String(n).padStart(2,"0");
/** Event detail pages list every date with exact times:
 *  <li class="multi-date-item" data-start-year='2026' data-start-month='10' data-start-day='07' data-start-hour='18' ...>
 *  or, for one-off events, <p class="event-date">Next date: Wednesday, October 07, 2026 | 06:00 PM to 08:00 PM</p>. */
export function detailOccurrences(html:string):Occurrence[]{
 const out:Occurrence[]=[];
 for(const m of html.matchAll(/<li[^>]*class=["'][^"']*multi-date-item[^"']*["'][^>]*>/gi)){
  const a=(k:string)=>m[0].match(new RegExp(`data-${k}=['"](\\d+)['"]`))?.[1];
  const y=a("start-year"),mo=a("start-month"),d=a("start-day");if(!y||!mo||!d)continue;
  const sh=a("start-hour"),sm=a("start-mins"),eh=a("end-hour"),em=a("end-mins");
  const time=sh!=null&&!(sh==="0"&&(sm||"0")==="0"&&eh==="23")?`${pad(sh)}:${pad(sm||0)}:00`:"";
  const endTime=time&&eh!=null&&`${pad(eh)}:${pad(em||0)}`>time.slice(0,5)?`${pad(eh)}:${pad(em||0)}:00`:undefined;
  out.push({date:`${y}-${pad(mo)}-${pad(d)}`,time,endTime});
 }
 if(out.length)return out;
 const line=html.match(/<p[^>]*class=["'][^"']*event-date[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1];
 if(line){const t=stripHtml(line),date=parseDate(t);if(date){const times=[...t.matchAll(/\b\d{1,2}(?::\d{2})?\s*[AP]\.?M\.?/gi)].map(x=>parseTime(x[0])).filter(Boolean);
  out.push({date,time:times[0]||"",endTime:times[1]&&times[1]>times[0]?times[1]:undefined})}}
 return out;
}

export async function fetchOpenCities(cfg:OpenCitiesConfig,startDate:string,endDate:string,hop=0):Promise<EventRecord[]>{
 // A landing page ("Calendars", "City Calendar") instead of the event list itself: follow its links to the actual
 // list (".../Calendars/Events", ".../Community-Events-Calendar") — the one with the most event cards.
 if(hop===0){try{
  const r=await fetchRetry(cfg.listUrl,{headers:BROWSER_HEADERS,cache:"no-store"});
  if(r.ok){const html=await r.text(),origin=new URL(cfg.listUrl).origin;
   if(articleItems(html,origin).length<3){
    const subs=[...new Set([...html.matchAll(/href=["']([^"'#?]+)["']/gi)].map(m=>{try{return new URL(m[1].replace(/&amp;/g,"&"),origin).toString()}catch{return""}})
     .filter(u=>u.startsWith(origin)&&u!==cfg.listUrl&&/\/[^\/]*(events?|calendar)[^\/]*$/i.test(new URL(u).pathname)&&!/permit|sponsor|apply|meeting|government|parking|faq|directions|rental/i.test(u)))].slice(0,6);
    let best:{u:string;n:number}|null=null;
    for(const u of subs){const rr=await fetchRetry(u,{headers:BROWSER_HEADERS,cache:"no-store"}).catch(()=>null);if(!rr?.ok)continue;const n=articleItems(await rr.text(),origin).length;if(n>=3&&(!best||n>best.n))best={u,n}}
    if(best)return fetchOpenCities({...cfg,listUrl:best.u},startDate,endDate,1);
   }}
 }catch{}}
 const origin=new URL(cfg.listUrl).origin;
 const listBase=cfg.listUrl.split("?")[0].replace(/\/$/,"");
 const pageUrl=cfg.pageUrl||((n:number)=>`${listBase}?dlv_OC%20CL%20Public%20Events%20Listing=(pageindex=${n})`);
 const block=cfg.block||DEFAULT_BLOCK;
 const listPath=new URL(listBase).pathname; // only the part of an event URL after the list path says its category
 const out:EventRecord[]=[],seenHref=new Set<string>();
 let linksSeen=0;const undated:Item[]=[];
 for(let page=1;page<=(cfg.maxPages??8);page++){
  const url=page===1?cfg.listUrl:pageUrl(page);
  const r=await fetchRetry(url,{headers:BROWSER_HEADERS,cache:"no-store"});
  if(!r.ok){if(page===1)throw new Error(`HTTP ${r.status} from ${url}`);break}
  const html=await r.text();
  let items=articleItems(html,origin);
  // No <article> cards: event links under the list's own folder (or the configured path).
  if(!items.length)items=anchorItems(html,origin,cfg.eventPath||listPath);
  linksSeen+=items.length;

  let newOnPage=0,allPastEnd=items.length>0;
  for(const it of items){
   const text=stripHtml(it.html);
   const date=parseDate(text)||parseDateNoYear(text,startDate);
   // No date on the card at all: its own page lists the dates (read below, a few per run).
   if(!date){if(!undated.some(u=>u.href===it.href)&&!block.test(it.title))undated.push(it);continue}
   const key=it.href+"|"+date;
   if(seenHref.has(key))continue;
   seenHref.add(key);newOnPage++;
   if(date&&date<=endDate)allPastEnd=false;
   if(!date||date<startDate||date>endDate)continue;
   const title=it.title;
   if(title.length<4||title.length>140||block.test(title)||(it.tags||[]).some(t=>block.test(t))||block.test(new URL(it.href).pathname.replace(listPath,"").replace(/[-\/]/g," ")))continue;
   const afterTitle=text.includes(title)?text.slice(text.indexOf(title)+title.length):text;
   const desc=it.desc||afterTitle.replace(/\s+/g," ").replace(new RegExp(`^.*?\\b(20\\d{2})\\b`),"").replace(/^[\s\-–|,:]+/,"").replace(/\b\d{1,2}(:\d{2})?\s*[ap]\.?m\.?\s*(-|–|to)?\s*(\d{1,2}(:\d{2})?\s*[ap]\.?m\.?)?/i,"").trim().slice(0,500)||`Official ${cfg.source} event.`;
   const img=it.html.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1];
   const blob=(title+" "+desc+" "+(it.tags||[]).join(" ")).toLowerCase();
   const family=/kids?|family|festival|parade|block party|children|story|pumpkin|halloween|trunk|egg hunt|holiday/.test(blob);
   const arts=/music|concert|arts?\b|theatre|theater|musical|comedy|film|movie/.test(blob);
   const free=/\bfree\b/.test(blob);
   const times=[...text.matchAll(/\b\d{1,2}(?::\d{2})?\s*[AP]\.?M\.?/gi)].map(x=>parseTime(x[0])).filter(Boolean);
   let image:string|undefined;try{image=img?new URL(img.replace(/&amp;/g,"&"),origin).toString():undefined}catch{}
   out.push({id:`${cfg.idPrefix}-${slug(title+"-"+date)}`,title,city:cfg.city,venue:it.address?.split(",")[0].trim()||cfg.venue,address:streetAddress(it.address,cfg.city),date,time:times[0]||"",endTime:times[1]&&times[1]>times[0]?times[1]:undefined,
    url:it.href,sourceUrl:cfg.listUrl,image,
    category:family?"Family":arts?"Arts & Theatre":"Local",genre:"Local Event",desc,
    tags:[...(it.tags||[]),...(family?["Family"]:[]),...(arts?["Arts & Theatre"]:[]),...(free?["Free"]:[]),"Local"],
    emoji:family?"🎉":arts?"🎵":"📍",source:cfg.source,isFree:free,eventType:"event"});
  }
  // Stop when a page adds nothing new or the list has moved past the window.
  if(newOnPage===0||allPastEnd)break;
 }
 for(const it of undated.slice(0,40)){
  try{const r=await fetchRetry(it.href,{headers:BROWSER_HEADERS,cache:"no-store"});if(!r.ok)continue;const h=await r.text();
   const title=it.title;if(title.length<4||title.length>140)continue;
   const desc=(it.desc||h.match(/<meta name=["']description["'] content=["']([^"']+)["']/i)?.[1]||`Official ${cfg.source} event.`).slice(0,500);
   const blob=(title+" "+desc).toLowerCase(),family=/kids?|family|festival|parade|block party|children|story|pumpkin|halloween|trunk|egg hunt|holiday/.test(blob),free=/\bfree\b/.test(blob);
   for(const o of detailOccurrences(h).filter(o=>o.date>=startDate&&o.date<=endDate))
    out.push({id:`${cfg.idPrefix}-${slug(title+"-"+o.date)}`,title,city:cfg.city,venue:it.address?.split(",")[0].trim()||cfg.venue,address:streetAddress(it.address,cfg.city),
     date:o.date,time:o.time,endTime:o.endTime,url:it.href,sourceUrl:cfg.listUrl,category:family?"Family":"Local",genre:"Local Event",desc:stripHtml(desc),
     tags:[...(it.tags||[]),...(family?["Family"]:[]),...(free?["Free"]:[]),"Local"],emoji:family?"🎉":"📍",source:cfg.source,isFree:free,eventType:"event"});
  }catch{}
 }
 // Cards found but none are public events (all council meetings) is a quiet list, not a broken one.
 if(out.length===0&&linksSeen===0)throw new Error(`No event cards on ${cfg.listUrl}`);
 if(out.length===0)return[];
 return expandFromDetails(out,startDate,endDate,cfg.detailLimit??120);
}

/** List cards show only the next date and rarely a time ("Open Play Chess · 5 more dates"). Open each event's
 *  page once to get every date in the window with its real start/end time and a full-size image. */
async function expandFromDetails(events:EventRecord[],startDate:string,endDate:string,limit:number):Promise<EventRecord[]>{
 const out:EventRecord[]=[],byUrl=new Map<string,EventRecord>();
 for(const e of events)if(!byUrl.has(e.url))byUrl.set(e.url,e);
 let opened=0;const siteImg=new Map<string,Set<string>>(),listImg=new Map<string,string|undefined>();
 for(const [url,e] of byUrl){
  let occ:Occurrence[]=[],img:string|undefined,desc:string|undefined,cost:string|undefined;listImg.set(url,e.image);
  if(opened<limit){
   opened++;
   try{const r=await fetchRetry(url,{headers:BROWSER_HEADERS,cache:"no-store"});
    if(r.ok){const h=await r.text();occ=detailOccurrences(h);
     img=h.match(/<meta property=["']og:image["'] content=["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g,"&");
     if(img&&isGenericPicture(img))img=undefined;
     if(img)siteImg.set(img,(siteImg.get(img)||new Set()).add(e.title.toLowerCase()));
     desc=h.match(/<meta name=["']description["'] content=["']([^"']+)["']/i)?.[1];
     cost=costFromPage(h)}}catch{}
  }
  // The page's Cost field decides free vs paid ("$5 (pre-purchase) $8 (day of event)"), not just the description.
  if(cost){const paid=/\$\s?[1-9]/.test(cost),free=!paid&&/\bfree\b|no (cost|charge)/i.test(cost);
   e.priceText=cost;e.isFree=free;e.tags=[...(e.tags||[]).filter(t=>t!=="Free"&&t!=="Paid"),...(free?["Free"]:paid?["Paid"]:[])]}
  const dates=occ.filter(o=>o.date>=startDate&&o.date<=endDate);
  if(!dates.length){out.push({...e,image:img||e.image});continue}
  for(const o of dates)out.push({...e,id:`${e.id.replace(/-\d{4}-\d{2}-\d{2}$/,"")}-${o.date}`,
   date:o.date,time:o.time||e.time,endTime:o.time?o.endTime:e.endTime,image:img||e.image,
   desc:e.desc.length<60&&desc&&desc.length>e.desc.length?stripHtml(desc):e.desc});
 }
 // A page picture that several different events' pages show is the site's banner: keep the list's own picture instead.
 for(const o of out)if(o.image&&(siteImg.get(o.image)?.size||0)>1)o.image=listImg.get(o.url);
 return out;
}
