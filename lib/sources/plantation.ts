import type {EventRecord} from "../ingestion/types";
import {stripHtml,slug} from "../ingestion/utils";
const BASE="https://www.plantation.org",SOURCE=BASE+"/government/departments/parks-recreation/events/-toggle-next30days";
function to24(s:string){const m=s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);if(!m)return"12:00:00";let h=+m[1];if(/PM/i.test(m[3])&&h<12)h+=12;if(/AM/i.test(m[3])&&h===12)h=0;return String(h).padStart(2,"0")+":"+m[2]+":00"}
function abs(u:string){try{return new URL(u.replace(/&amp;/g,"&"),BASE).toString()}catch{return""}}
export async function fetchPlantationEvents(startDate:string,endDate:string):Promise<EventRecord[]>{try{
 const r=await fetch(SOURCE,{next:{revalidate:1800}});if(!r.ok)return[];const h=await r.text(),out:EventRecord[]=[];
 const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
 for(const a of h.matchAll(re)){const title=stripHtml(a[2]).trim();if(title.length<4||title.length>150)continue;
  const near=stripHtml(h.slice(Math.max(0,(a.index||0)-450),Math.min(h.length,(a.index||0)+900)));
  const dm=near.match(/(\d{2})\/(\d{2})\/(20\d{2})(?:\s+(\d{1,2}:\d{2}\s*(?:AM|PM)))?/i);if(!dm)continue;
  const date=dm[3]+"-"+dm[1]+"-"+dm[2];if(date<startDate||date>endDate)continue;
  const url=abs(a[1]);if(!url||!url.includes("plantation.org")||url===SOURCE)continue;
  const family=/family|festival|kids|children|bioblitz|wildlife/i.test(title),arts=/art|concert|music|theatre/i.test(title),free=/\bfree\b/i.test(near);
  out.push({id:"plantation-"+slug(title+"-"+date),title,city:"Plantation, FL",venue:"City of Plantation",date,time:dm[4]?to24(dm[4]):"12:00:00",url,sourceUrl:SOURCE,category:family?"Family":arts?"Arts & Theatre":"Local",genre:"Community Event",desc:"Official City of Plantation event.",tags:[...(family?["Family"]:[]),...(arts?["Arts & Theatre"]:[]),...(free?["Free"]:[]),"Local"],emoji:family?"🌿":arts?"🎨":"📍",source:"City of Plantation",isFree:free,eventType:"event"});
 }
 const seen=new Set<string>();return out.filter(e=>{const k=e.url+"|"+e.date;if(seen.has(k))return false;seen.add(k);return true});
}catch{return[]}}
