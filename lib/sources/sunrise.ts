import type {EventRecord} from "../ingestion/types";
import {slug,stripHtml} from "../ingestion/utils";
const SOURCE="https://www.sunrisefl.gov/departments-services/leisure-services/events";
const BLOCK=/\b(board|commission|committee|hearing|workshop|advisory|meeting|budget|planning and zoning)\b/i;
const MONTHS=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
function to24(s:string){const m=s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);if(!m)return"12:00:00";let h=+m[1];if(/PM/i.test(m[3])&&h<12)h+=12;if(/AM/i.test(m[3])&&h===12)h=0;return String(h).padStart(2,"0")+":"+m[2]+":00"}
function classify(t:string){if(/family|festival|story|kids|children|market/i.test(t))return{category:"Family",tags:["Family","Kids","Local"],emoji:"🎉"};if(/comedy|theatre|gallery|exhibit|art/i.test(t))return{category:"Arts & Theatre",tags:["Arts & Theatre","Local"],emoji:"🎭"};if(/music|concert|tunes/i.test(t))return{category:"Music",tags:["Music","Local"],emoji:"🎵"};if(/fitness|basketball|5k|tournament/i.test(t))return{category:"Sports",tags:["Sports","Local"],emoji:"🏃"};return{category:"Local",tags:["Local"],emoji:"📍"}}
export async function fetchSunriseEvents(startDate:string,endDate:string):Promise<EventRecord[]>{try{
 const r=await fetch(SOURCE,{next:{revalidate:1800}});if(!r.ok)return[];const text=stripHtml(await r.text()).replace(/\s+/g," ").trim(),out:EventRecord[]=[];
 const rx=/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})\s+(?:(All Day)|(\d{1,2}:\d{2}\s*(?:AM|PM))(?:\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM))?)\s+(\d{2})\/(\d{2})\/(20\d{2})(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM))?(?:\s+\d{2}\/\d{2}\/20\d{2}(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM))?)?\s+(.{3,220}?)(?=\s+\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\s+(?:All Day|\d{1,2}:\d{2}\s*(?:AM|PM))|$)/gi;
 for(const m of text.matchAll(rx)){const date=m[7]+"-"+m[5]+"-"+m[6];if(date<startDate||date>endDate)continue;const title=m[8].trim().replace(/\s{2,}.*/,"").slice(0,140);if(title.length<4||BLOCK.test(title))continue;const cl=classify(title),free=/\bfree\b/i.test(title);
  out.push({id:"sunrise-"+slug(title+"-"+date),title,city:"Sunrise, FL",venue:"City of Sunrise",date,time:m[3]?"12:00:00":to24(m[4]),url:SOURCE,sourceUrl:SOURCE,category:cl.category,genre:"Local Event",desc:"Official City of Sunrise Leisure Services event.",tags:[...cl.tags,...(free?["Free"]:[])],emoji:cl.emoji,source:"City of Sunrise",isFree:free,eventType:"event"});
 }return out;
}catch{return[]}}
