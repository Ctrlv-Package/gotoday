import type {EventRecord} from "../ingestion/types";
import {stripHtml,slug} from "../ingestion/utils";
const BASE="https://broward.libnet.info",SOURCE=BASE+"/events";
function dateTime(raw:string){const m=raw.match(/(20\d{2})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::\d{2})?/);return m?{date:m[1]+"-"+m[2]+"-"+m[3],time:m[4]+":"+m[5]+":00"}:null}
function meta(h:string,key:string){const a=new RegExp('<meta[^>]+(?:property|name)=["\\\']'+key+'["\\\'][^>]+content=["\\\']([^"\\\']+)',"i").exec(h);const b=new RegExp('<meta[^>]+content=["\\\']([^"\\\']+)["\\\'][^>]+(?:property|name)=["\\\']'+key+'["\\\']',"i").exec(h);return(a?.[1]||b?.[1]||"").replace(/&amp;/g,"&")}
function labels(text:string,label:string){const m=text.match(new RegExp(label+"\\s*:\\s*\\|?\\s*(.{1,220}?)(?=\\n|TAGS:|EVENT TYPE:|AGE GROUP:|##|$)","i"));return m?m[1].split("|").map(x=>x.trim()).filter(Boolean):[]}
function worthwhile(title:string,types:string[],ages:string[]){const s=(title+" "+types.join(" ")).toLowerCase();if(/tax assistance|computer help|citizenship|legal help|career|business|class\b|tutoring|reading practice|literacy\/learning services/.test(s))return false;return /story|festival|fair|performance|concert|theater|theatre|movie|game|craft|maker|art|cultural|author|exhibit|dance|club|stem|steam|lego|family|kids|children|teen|tween|preschool|toddler/.test(s)||ages.some(a=>/famil|kids|preschool|toddlers|teens|tweens/i.test(a))}
export async function fetchBrowardLibraryEvents(startDate:string,endDate:string):Promise<EventRecord[]>{try{
 const listing=await fetch(SOURCE+"?r=days&n=31&d="+encodeURIComponent(startDate),{next:{revalidate:1800}});if(!listing.ok)return[];const html=await listing.text();
 const ids=[...new Set([...html.matchAll(/(?:https?:\/\/broward\.libnet\.info)?\/event\/(\d+)/gi)].map(x=>x[1]))];
 const out:EventRecord[]=[];
 for(const id of ids.slice(0,300)){const url=BASE+"/event/"+id,dr=await fetch(url,{next:{revalidate:1800}});if(!dr.ok)continue;const h=await dr.text(),text=stripHtml(h);
  const raw=[...text.matchAll(/20\d{2}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?/g)].map(x=>x[0]);const dt=raw.map(dateTime).find(x=>x&&x.date>=startDate&&x.date<=endDate);if(!dt)continue;
  const title=stripHtml(h.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1]||h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||meta(h,"og:title")).replace(/\s*-\s*Broward County Library.*$/i,"").trim();if(!title)continue;
  const ages=labels(text,"AGE GROUP"),types=labels(text,"EVENT TYPE");if(!worthwhile(title,types,ages))continue;
  const venue=(text.match(/(?:####\s*)?([A-Za-z0-9 &'’./-]+(?:Library|Center))(?:\s*-\s*[^\n]+)?/i)?.[1]||"Broward County Library").trim();
  const desc=meta(h,"description")||"Broward County Library event.";
  const kids=ages.some(a=>/famil|kids|preschool|toddlers|teens|tweens|babies/i.test(a)),arts=types.some(t=>/arts|craft|maker|performance|exhibit/i.test(t)),free=!/\$\s*\d|ticket price|registration fee/i.test(text);
  out.push({id:"bcl-"+id,title,city:"Broward County, FL",venue,date:dt.date,time:dt.time,url,sourceUrl:SOURCE,category:kids?"Family":arts?"Arts & Theatre":"Local",genre:types[0]||"Library Event",desc,tags:[...(kids?["Family","Kids"]:[]),...(arts?["Arts & Theatre"]:[]),...(free?["Free"]:[]),"Library"],emoji:kids?"📚":arts?"🎨":"📍",source:"Broward County Library",isFree:free,eventType:"event"});
 }
 return out;
}catch{return[]}}
