import type {EventRecord} from "../ingestion/types";
import {slug,stripHtml} from "../ingestion/utils";

const SOURCE="https://www.fortlauderdale.gov/Explore-FTL/Event-Calendar";
const BAD=/\b(board|commission|committee|advisory|meeting|hearing|webinar|king tides|waste|drop-off|certificate of use|bargaining session)\b/i;
const MONTHS=["january","february","march","april","may","june","july","august","september","october","november","december"];

function dateOf(s:string){const m=s.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(20\d{2})/i);return m?m[3]+"-"+String(MONTHS.indexOf(m[1].toLowerCase())+1).padStart(2,"0")+"-"+m[2].padStart(2,"0"):""}
function timeOf(s:string){const m=s.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);if(!m)return"12:00:00";let h=+m[1];if(/PM/i.test(m[3])&&h<12)h+=12;if(/AM/i.test(m[3])&&h===12)h=0;return String(h).padStart(2,"0")+":"+(m[2]||"00")+":00"}
function abs(u:string){try{return new URL(u.replace(/&amp;/g,"&"),SOURCE).toString()}catch{return""}}

export async function fetchFortLauderdaleEvents(startDate:string,endDate:string):Promise<EventRecord[]>{try{
 const r=await fetch(SOURCE,{next:{revalidate:1800}});if(!r.ok)return[];
 const h=await r.text(),out:EventRecord[]=[];
 const anchors=[...h.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
 for(const a of anchors){
  const title=stripHtml(a[2]).trim();if(title.length<5||title.length>140||BAD.test(title))continue;
  const url=abs(a[1]);if(!url||!url.includes("fortlauderdale.gov")||url===SOURCE)continue;
  const near=stripHtml(h.slice(Math.max(0,(a.index||0)-700),Math.min(h.length,(a.index||0)+2200))).replace(/\s+/g," ");
  const date=dateOf(near);if(!date||date<startDate||date>endDate)continue;
  const family=/kids?|family|festival|parade/i.test(title+" "+near),arts=/music|concert|arts?|theatre|tunes/i.test(title+" "+near),free=/\bfree\b/i.test(near);
  out.push({id:"ftl-"+slug(title+"-"+date),title,city:"Fort Lauderdale, FL",venue:"Fort Lauderdale",date,time:timeOf(near),url,sourceUrl:SOURCE,category:family?"Family":arts?"Arts & Theatre":"Local",genre:"Local Event",desc:near.slice(0,500),tags:[...(family?["Family"]:[]),...(arts?["Arts & Theatre"]:[]),...(free?["Free"]:[]),"Local"],emoji:family?"🎉":arts?"🎵":"📍",source:"City of Fort Lauderdale",isFree:free,eventType:"event"});
 }
 const seen=new Set<string>();return out.filter(e=>{const k=e.title+"|"+e.date;if(seen.has(k))return false;seen.add(k);return true});
}catch{return[]}}
