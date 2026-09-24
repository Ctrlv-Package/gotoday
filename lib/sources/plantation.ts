import type {EventRecord} from "../ingestion/types";
import {stripHtml,slug} from "../ingestion/utils";
const BASE="https://www.plantation.org",SOURCE=BASE+"/government/departments/parks-recreation/events/-toggle-next30days";
function dateOf(s:string){const m=s.match(/(?:Date:\s*)?(\d{1,2})\/(\d{1,2})\/(\d{4})/i);return m?m[3]+"-"+m[1].padStart(2,"0")+"-"+m[2].padStart(2,"0"):""}
function time24(s:string){const m=s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);if(!m)return"12:00:00";let h=+m[1];if(/PM/i.test(m[3])&&h<12)h+=12;if(/AM/i.test(m[3])&&h===12)h=0;return String(h).padStart(2,"0")+":"+m[2]+":00"}
function abs(u:string){try{return new URL(u.replace(/&amp;/g,"&"),BASE).toString()}catch{return""}}
export async function fetchPlantationEvents(startDate:string,endDate:string):Promise<EventRecord[]>{try{
 const r=await fetch(SOURCE,{next:{revalidate:1800}});if(!r.ok)return[];const html=await r.text();
 const links=[...html.matchAll(/<a\b[^>]*href=["']([^"']*\/Home\/Components\/Calendar\/Event\/\d+\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)];
 const urls=[...new Set(links.map(x=>abs(x[1])).filter(Boolean))],out:EventRecord[]=[];
 for(const url of urls.slice(0,80)){const dr=await fetch(url,{next:{revalidate:1800}});if(!dr.ok)continue;const dh=await dr.text(),text=stripHtml(dh);
  const h=stripHtml(dh.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i)?.[1]||"");const title=h.replace(/\s*\|.*$/,"").trim();const date=dateOf(text);
  if(!title||title.length<4||!date||date<startDate||date>endDate)continue;
  const loc=(text.match(/Location:\s*(.{3,180}?)(?=Add to|For more|$)/i)?.[1]||"City of Plantation").trim();
  const addr=(loc.match(/\d{2,6}\s+.{3,100}?(?:FL|Florida)\s*\d{5}/i)?.[0]||"").trim();
  const desc=(text.match(/Add to my Calendar\s+(.{20,700}?)(?=Return to|$)/i)?.[1]||"Official City of Plantation event.").trim();
  const family=/\b(family|kids?|children|wildlife|festival|pumpkin)\b/i.test(title+" "+desc),free=/\bfree\b/i.test(desc);
  out.push({id:"plantation-"+slug(title+"-"+date),title,city:"Plantation, FL",venue:loc.split(/\d{2,6}\s/)[0].trim()||"City of Plantation",address:addr,date,time:time24(text),url,sourceUrl:SOURCE,category:family?"Family":"Local",genre:"Community Event",desc,tags:[...(family?["Family"]:[]),...(free?["Free"]:[]),"Local"],emoji:family?"🌿":"📍",source:"City of Plantation",isFree:free,eventType:"event"});
 }
 return out;
}catch{return[]}}
