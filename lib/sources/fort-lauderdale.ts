import type {EventRecord} from "../ingestion/types";
import {slug,stripHtml} from "../ingestion/utils";

const BASE="https://www.fortlauderdale.gov";
const SOURCE=BASE+"/government/departments-i-z/strategic-communications/event-calendar-list-view/-toggle-allupcoming-670/-sortn-EDate-670/-sortd-asc-670";
const BAD=/\b(board|commission|committee|advisory|meeting|hearing|webinar|king tides|waste|drop-off|certificate of use|bargaining session|magistrate|development review|code enforcement)\b/i;
const MONTHS=["january","february","march","april","may","june","july","august","september","october","november","december"];

function dateOf(s:string){const m=s.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(20\d{2})/i);return m?m[3]+"-"+String(MONTHS.indexOf(m[1].toLowerCase())+1).padStart(2,"0")+"-"+m[2].padStart(2,"0"):""}
function timeOf(s:string){const m=s.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);if(!m)return"12:00:00";let h=+m[1];if(/PM/i.test(m[3])&&h<12)h+=12;if(/AM/i.test(m[3])&&h===12)h=0;return String(h).padStart(2,"0")+":"+(m[2]||"00")+":00"}
function abs(u:string){try{return new URL(u.replace(/&amp;/g,"&"),BASE).toString()}catch{return""}}

export async function fetchFortLauderdaleEvents(startDate:string,endDate:string):Promise<EventRecord[]>{try{
 const out:EventRecord[]=[];
 for(let page=1;page<=12;page++){
  const src=SOURCE+`/-npage-${page}-670`;
  const r=await fetch(src,{next:{revalidate:1800}});if(!r.ok)continue;
  const h=await r.text();
  const rows=[...h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for(const row of rows){
   const rh=row[1],text=stripHtml(rh).replace(/\s+/g," ").trim();
   const date=dateOf(text);if(!date||date<startDate||date>endDate)continue;
   const a=rh.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
   const title=stripHtml(a?.[2]||text.split(/\s+(?=January|February|March|April|May|June|July|August|September|October|November|December)/i)[0]).trim();
   if(title.length<5||title.length>140||BAD.test(title))continue;
   const url=a?abs(a[1]):src;if(!url)continue;
   const family=/kids?|family|festival|parade|block party/i.test(title+" "+text),arts=/music|concert|arts?|theatre|tunes|musical/i.test(title+" "+text),free=/\bfree\b/i.test(text);
   out.push({id:"ftl-"+slug(title+"-"+date+"-"+timeOf(text)),title,city:"Fort Lauderdale, FL",venue:"Fort Lauderdale",date,time:timeOf(text),url,sourceUrl:src,category:family?"Family":arts?"Arts & Theatre":"Local",genre:"Local Event",desc:text.slice(0,500),tags:[...(family?["Family"]:[]),...(arts?["Arts & Theatre"]:[]),...(free?["Free"]:[]),"Local"],emoji:family?"🎉":arts?"🎵":"📍",source:"City of Fort Lauderdale",isFree:free,eventType:"event"});
  }
 }
 if(out.length===0)throw new Error("Fort Lauderdale calendar returned no extractable event records");
 const seen=new Set<string>();return out.filter(e=>{const k=e.title+"|"+e.date+"|"+e.time;if(seen.has(k))return false;seen.add(k);return true});
}catch(e){throw e}}
