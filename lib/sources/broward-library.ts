import type {EventRecord} from "../ingestion/types";
import {slug,stripHtml} from "../ingestion/utils";
const SOURCE="https://broward.libnet.info/events";
function to24(s:string){const m=s.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);if(!m)return"12:00:00";let h=+m[1];if(/pm/i.test(m[3])&&h<12)h+=12;if(/am/i.test(m[3])&&h===12)h=0;return String(h).padStart(2,"0")+":"+m[2]+":00"}
function ymd(s:string,year:string){const m=s.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})/i);if(!m)return"";const ms=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];return year+"-"+String(ms.indexOf(m[1].toLowerCase().slice(0,3))+1).padStart(2,"0")+"-"+m[2].padStart(2,"0")}
export async function fetchBrowardLibraryEvents(startDate:string,endDate:string):Promise<EventRecord[]>{try{
 const urls=[SOURCE+"?r=thismonth",SOURCE+"?r=nextmonth"],out:EventRecord[]=[];
 for(const src of urls){const r=await fetch(src,{next:{revalidate:1800}});if(!r.ok)continue;const h=await r.text(),text=stripHtml(h),year=startDate.slice(0,4);
  const links=[...h.matchAll(/<a\b[^>]*href=["']([^"']*\/event\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for(const a of links){const title=stripHtml(a[3]).trim();if(title.length<4||/^(details?|more|register)$/i.test(title))continue;const near=stripHtml(h.slice(Math.max(0,(a.index||0)-500),Math.min(h.length,(a.index||0)+1200)));const date=ymd(near,year);if(!date||date<startDate||date>endDate)continue;
   const tm=near.match(/\d{1,2}:\d{2}\s*(?:am|pm)/i)?.[0]||"";const url=new URL(a[1].replace(/&amp;/g,"&"),SOURCE).toString();const family=/family|kids?|children|preschool|toddler|teen|tween|story|lego|steam|craft/i.test(title+" "+near),arts=/art|craft|cartoon|music|performance/i.test(title+" "+near);
   out.push({id:"bcl-"+a[2],title,city:"Broward County, FL",venue:"Broward County Library",date,time:to24(tm),url,sourceUrl:src,category:family?"Family":arts?"Arts & Theatre":"Local",genre:"Library Event",desc:"Broward County Library event.",tags:[...(family?["Family","Kids"]:[]),...(arts?["Arts & Theatre"]:[]),"Free","Library"],emoji:family?"📚":arts?"🎨":"📍",source:"Broward County Library",isFree:true,eventType:"event"});
  }
 }const seen=new Set<string>();return out.filter(e=>{if(seen.has(e.id))return false;seen.add(e.id);return true});
}catch{return[]}}
