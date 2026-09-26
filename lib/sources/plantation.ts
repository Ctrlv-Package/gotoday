import type {EventRecord} from "../ingestion/types";
import {stripHtml,slug} from "../ingestion/utils";
const BASE="https://www.plantation.org",SOURCE=BASE+"/i-want-to/advanced-components/basic-pages/calendar-month-view";
const BLOCK=/\b(board|committee|hearing|meeting|selection committee|rfsp|itb no|bid|council|advisory|budget|planning|zoning)\b/i;
function to24(s:string){const m=s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);if(!m)return"12:00:00";let h=+m[1];if(/PM/i.test(m[3])&&h<12)h+=12;if(/AM/i.test(m[3])&&h===12)h=0;return String(h).padStart(2,"0")+":"+m[2]+":00"}
function abs(u:string){try{return new URL(u.replace(/&amp;/g,"&"),BASE).toString()}catch{return""}}
export async function fetchPlantationEvents(startDate:string,endDate:string):Promise<EventRecord[]>{try{
 const months=new Set<string>();for(let d=new Date(startDate+"T12:00:00Z"),e=new Date(endDate+"T12:00:00Z");d<=e;d.setUTCMonth(d.getUTCMonth()+1))months.add((d.getUTCMonth()+1)+"|"+d.getUTCFullYear());
 const out:EventRecord[]=[];
 for(const my of months){const[m,y]=my.split("|"),src=SOURCE+`/-curm-${m}/-cury-${y}`;const r=await fetch(src,{next:{revalidate:1800}});if(!r.ok)continue;const h=await r.text();
  const links=[...h.matchAll(/<a\b[^>]*href=["']([^"']*\/Home\/Components\/Calendar\/Event\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const seen=new Set<string>();
  for(const a of links){const url=abs(a[1]);if(!url||seen.has(url))continue;seen.add(url);const dr=await fetch(url,{next:{revalidate:1800}});if(!dr.ok)continue;const dh=await dr.text(),text=stripHtml(dh);
   const title=stripHtml(dh.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1]||a[2]).trim();if(title.length<4||BLOCK.test(title))continue;
   const dm=text.match(/Date:\s*(\d{2})\/(\d{2})\/(20\d{2})/i);if(!dm)continue;const date=dm[3]+"-"+dm[1]+"-"+dm[2];if(date<startDate||date>endDate)continue;
   const tm=text.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/i)?.[0]||"";const loc=(text.match(/Location:\s*(.{3,180}?)(?=Add to my Calendar|For more information|$)/i)?.[1]||"City of Plantation").trim();const address=(loc.match(/\d{2,6}\s+.{3,100}?(?:Florida|FL)\s*\d{5}/i)?.[0]||"").trim();
   const family=/family|festival|kids?|children|bioblitz|wildlife|holiday|market/i.test(title),arts=/art|concert|music|theatre/i.test(title),free=/\bfree\b/i.test(text);
   out.push({id:"plantation-"+slug(title+"-"+date),title,city:"Plantation, FL",venue:loc.split(/\d{2,6}\s/)[0].trim()||"City of Plantation",address,date,time:to24(tm),url,sourceUrl:src,category:family?"Family":arts?"Arts & Theatre":"Local",genre:"Community Event",desc:"Official City of Plantation event.",tags:[...(family?["Family"]:[]),...(arts?["Arts & Theatre"]:[]),...(free?["Free"]:[]),"Local"],emoji:family?"🌿":arts?"🎨":"📍",source:"City of Plantation",isFree:free,eventType:"event"});
  }
 }return out;
}catch{return[]}}
