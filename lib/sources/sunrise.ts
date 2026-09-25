import type {EventRecord} from "../ingestion/types";
import {slug,stripHtml} from "../ingestion/utils";
const BASE="https://www.sunrisefl.gov",SOURCE=BASE+"/departments-services/leisure-services/events";
const BLOCK=/\b(board|commission|committee|hearing|workshop|advisory|meeting|budget|development review|planning and zoning)\b/i;
function to24(s:string){const m=s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);if(!m)return"12:00:00";let h=+m[1];if(/PM/i.test(m[3])&&h<12)h+=12;if(/AM/i.test(m[3])&&h===12)h=0;return String(h).padStart(2,"0")+":"+m[2]+":00"}
function classify(t:string){if(/family|festival|story|kids|children|market/i.test(t))return{category:"Family",tags:["Family","Kids","Local"],emoji:"🎉"};if(/comedy|theatre|gallery|exhibit|open mic|art/i.test(t))return{category:"Arts & Theatre",tags:["Arts & Theatre","Local"],emoji:"🎭"};if(/music|concert|tunes/i.test(t))return{category:"Music",tags:["Music","Local"],emoji:"🎵"};if(/fitness|basketball|5k|tournament/i.test(t))return{category:"Sports",tags:["Sports","Local"],emoji:"🏃"};return{category:"Local",tags:["Local"],emoji:"📍"}}
function abs(u:string){try{return new URL(u.replace(/&amp;/g,"&"),BASE).toString()}catch{return""}}
export async function fetchSunriseEvents(startDate:string,endDate:string):Promise<EventRecord[]>{try{
 const r=await fetch(SOURCE,{next:{revalidate:1800}});if(!r.ok)return[];const h=await r.text(),out:EventRecord[]=[];
 const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
 for(const a of h.matchAll(re)){const title=stripHtml(a[2]).trim();if(title.length<4||title.length>150||BLOCK.test(title))continue;
  const near=stripHtml(h.slice(Math.max(0,(a.index||0)-500),Math.min(h.length,(a.index||0)+900)));
  const dm=near.match(/(\d{2})\/(\d{2})\/(20\d{2})\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i);if(!dm)continue;
  const date=dm[3]+"-"+dm[1]+"-"+dm[2];if(date<startDate||date>endDate)continue;
  const detail=abs(a[1]);if(!detail||!detail.includes("sunrisefl.gov")||detail===SOURCE)continue;
  const cl=classify(title),free=/\bfree\b/i.test(near);
  out.push({id:"sunrise-"+slug(title+"-"+date),title,city:"Sunrise, FL",venue:"City of Sunrise",date,time:to24(dm[4]),url:detail,sourceUrl:SOURCE,category:cl.category,genre:"Local Event",desc:"Official City of Sunrise Leisure Services event.",tags:[...cl.tags,...(free?["Free"]:[])],emoji:cl.emoji,source:"City of Sunrise",isFree:free,eventType:"event"});
 }
 const seen=new Set<string>();return out.filter(e=>{const k=e.url+"|"+e.date;if(seen.has(k))return false;seen.add(k);return true});
}catch{return[]}}
