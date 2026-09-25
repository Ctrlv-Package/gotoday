import type {EventRecord} from "../ingestion/types";
import {slug,stripHtml} from "../ingestion/utils";
const BASE="https://www.broward.org",SOURCE=BASE+"/parks/Events";
const BAD=/\b(meeting|advisory|commission|hearing|weekly class|academy|lessons?|training|after[- ]school)\b/i;
const MONTHS=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
function dateOf(s:string,year:string){const m=s.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})\b/i);if(!m)return"";return year+"-"+String(MONTHS.indexOf(m[1].toLowerCase().slice(0,3))+1).padStart(2,"0")+"-"+m[2].padStart(2,"0")}
function timeOf(s:string){const m=s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);if(!m)return"12:00:00";let h=+m[1];if(/PM/i.test(m[3])&&h<12)h+=12;if(/AM/i.test(m[3])&&h===12)h=0;return String(h).padStart(2,"0")+":"+(m[2]||"00")+":00"}
function abs(u:string){try{return new URL(u.replace(/&amp;/g,"&"),BASE).toString()}catch{return""}}
export async function fetchBrowardParkEvents(startDate:string,endDate:string):Promise<EventRecord[]>{try{
 const r=await fetch(SOURCE,{next:{revalidate:1800}});if(!r.ok)return[];const h=await r.text(),year=startDate.slice(0,4),out:EventRecord[]=[];
 const anchors=[...h.matchAll(/<a\b[^>]*href=["']([^"']*[?&]event=[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
 const urls=[...new Set(anchors.map(a=>abs(a[1])).filter(Boolean))];
 for(const url of urls.slice(0,250)){const dr=await fetch(url,{next:{revalidate:1800}});if(!dr.ok)continue;const dh=await dr.text(),text=stripHtml(dh);
  const title=(stripHtml(dh.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1]||"")||new URL(url).searchParams.get("event")?.replace(/-20\d{2}.*$/,"").replace(/-/g," ")||"").trim();if(title.length<4||BAD.test(title))continue;
  const date=dateOf(text,year);if(!date||date<startDate||date>endDate)continue;
  const venue=(text.match(/([A-Za-z0-9 .&'’/-]+(?:Park|Nature Center|Stadium|Stables|Center))\s+\d{2,6}\s/i)?.[1]||"Broward County Park").trim();
  const addr=(text.match(/\d{2,6}\s+[^\n]{3,100}?(?:FL\s*)?\d{5}/i)?.[0]||"").trim();
  const price=(text.match(/Price\s+(.{1,100}?)(?=\s(?:Join|Ages|View Details|Register|$))/i)?.[1]||"").trim(),free=/\bfree\b/i.test(price);
  const family=/family|kids?|children|pony|nature|hike|festival|craft/i.test(title+" "+text.slice(0,1000)),sports=/sports?|soccer|tournament|run|5k/i.test(title);
  out.push({id:"broward-parks-"+slug(title+"-"+date),title,city:"Broward County, FL",venue,address:addr,date,time:timeOf(text),url,sourceUrl:SOURCE,category:family?"Family":sports?"Sports":"Local",genre:"Parks & Recreation",desc:"Broward County Parks event.",priceText:price,isFree:free,tags:[...(family?["Family"]:[]),...(sports?["Sports"]:[]),...(free?["Free"]:[]),"Local"],emoji:family?"🌳":sports?"🏃":"📍",source:"Broward County Parks",eventType:"event"});
 }
 return out;
}catch{return[]}}
