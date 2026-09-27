import type {EventRecord} from "../ingestion/types";
import {fetchRetry} from "../http";
import {slug,stripHtml} from "../ingestion/utils";
import {parseDate,parseTime} from "./opencities";

// CivicPlus / CivicEngage city sites publish an RSS feed of their calendar:
//   https://<city site>/RSSFeed.aspx?ModID=58&CID=All-calendar.xml
// Each <item> has title, link (official event page), calendarEvent:EventDates / EventTimes,
// and a description with "Location:" (often a street address) and "Description:".
// Meetings are NOT filtered here on purpose: the validation step rejects them and records why,
// so the ingestion report shows real counts.

export type CivicPlusConfig={site:string;source:string;idPrefix:string;city:string;venue:string;cid?:string};

function decode(s:string){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n)).replace(/&amp;/g,"&")}
function tag(item:string,name:string){const m=item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`,"i"));return m?decode(m[1]).trim():""}

export function parseCivicPlusRss(xml:string,cfg:CivicPlusConfig,startDate:string,endDate:string,feedUrl:string):{items:number;events:EventRecord[]}{
 const items=[...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(m=>m[0]);
 const out:EventRecord[]=[],seen=new Set<string>();
 for(const it of items){
  const title=stripHtml(tag(it,"title")).replace(/\s+/g," ").trim();
  const link=tag(it,"link");
  const descHtml=tag(it,"description");
  const date=parseDate(tag(it,"calendarEvent:EventDates")||stripHtml(descHtml));
  if(!title||!link||!date||date<startDate||date>endDate)continue;
  const times=tag(it,"calendarEvent:EventTimes");
  const [t1,t2]=times.split(/\s+-\s+/);
  // Location block: lines between "Location:" and the next <strong> label.
  const locHtml=descHtml.split(/<strong>\s*Location:\s*<\/strong>/i)[1]?.split(/<strong>/i)[0]||"";
  const lines=locHtml.split(/<br\s*\/?>/i).map(x=>stripHtml(x)).filter(Boolean);
  const cityLine=lines.find(l=>/,\s*FL\b/i.test(l));
  const city=cityLine?cityLine.replace(/\s*\d{5}(-\d{4})?\s*$/,"").replace(/,\s*FL.*$/i,"").trim()+", FL":cfg.city;
  const hasStreet=lines.some(l=>/^\d+\s+\S/.test(l));
  const venueName=lines.length&&!/^\d/.test(lines[0])&&lines[0]!==cityLine?lines[0]:cfg.venue;
  const address=hasStreet?lines.filter(l=>l!==venueName).join(", "):"";
  const desc=stripHtml(descHtml.split(/<strong>\s*Description:\s*<\/strong>/i)[1]||"").replace(/\s+/g," ").trim().slice(0,1000)||`Official ${cfg.source} event.`;
  const image=it.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i)?.[1];
  const key=link+"|"+date;if(seen.has(key))continue;seen.add(key);
  const blob=(title+" "+desc).toLowerCase(),free=/\bfree\b/.test(blob);
  const kids=/\b(kids?|children|youth|teens?|story ?time|trunk or treat|egg hunt)\b/.test(blob);
  const family=kids||/\b(family|festival|parade|movie night|holiday)\b/.test(blob);
  const arts=/\b(music|concert|band|theat(re|er)|arts?|comedy|dance|film|movie|jazz)\b/.test(blob);
  const sports=/\b(5k|run|walk|race|tournament|game|fishing)\b/.test(blob);
  out.push({id:`${cfg.idPrefix}-${slug(title+"-"+date)}`,title,city,venue:venueName,address:address||undefined,date,
   time:/all day/i.test(times)?"":parseTime(t1||""),endTime:t2?parseTime(t2)||undefined:undefined,url:link,sourceUrl:feedUrl,image,
   category:family?"Family":arts?"Arts & Theatre":sports?"Sports":"Local",genre:"Local Event",desc,
   tags:[...(family?["Family"]:[]),...(kids?["Kids"]:[]),...(arts?["Arts & Theatre"]:[]),...(sports?["Sports"]:[]),...(free?["Free"]:[]),"Local"],
   emoji:family?"🎉":arts?"🎵":sports?"🏃":"📍",source:cfg.source,isFree:free});
 }
 return {items:items.length,events:out};
}

export async function fetchCivicPlus(cfg:CivicPlusConfig,startDate:string,endDate:string):Promise<EventRecord[]>{
 const feed=`${cfg.site.replace(/\/$/,"")}/RSSFeed.aspx?ModID=58&CID=${cfg.cid||"All-calendar.xml"}`;
 const r=await fetchRetry(feed,{headers:{"User-Agent":"Mozilla/5.0 (compatible; GoToday/1.0; +https://gotoday-six.vercel.app)","Accept":"application/rss+xml,application/xml,text/xml"},cache:"no-store"});
 if(!r.ok)throw new Error(`HTTP ${r.status} from ${feed}`);
 const {items,events}=parseCivicPlusRss(await r.text(),cfg,startDate,endDate,feed);
 if(items===0)throw new Error(`Calendar RSS feed has no items: ${feed}`);
 return events;
}
