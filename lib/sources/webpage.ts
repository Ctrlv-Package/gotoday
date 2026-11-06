// Any web page that lists events in plain text, with no calendar feed or schema.org data behind it — a church's
// festival page, a club's "upcoming events" page, a fair's site (often Wix or a hand-built page). The page's text is
// read by the same free AI reader as Instagram posts (lib/sources/instagram readPageText); it only re-reads when the
// page changes.
import type {EventRecord} from "../ingestion/types";
import {fetchRetry} from "../http";
import {readPageText} from "./instagram";
import {decodeEntities} from "../html";

export type WebpageConfig={url:string;source:string;idPrefix:string;city:string;venue:string;address?:string};
const UA={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36","Accept":"text/html,*/*;q=0.8","Accept-Language":"en-US,en;q=0.9"};
const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50);

/** The words a visitor sees: no scripts, styles, menus' markup; collapsed; capped (the event is near the top). */
export function pageText(html:string):string{
 const body=html.replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi," ").replace(/<!--[\s\S]*?-->/g," ")
  .replace(/<(br|p|div|li|h[1-6]|tr|section)\b[^>]*>/gi,"\n").replace(/<[^>]+>/g," ");
 return decodeEntities(body).split("\n").map(l=>l.replace(/[ \t\u00a0\u200b]+/g," ").trim()).filter(l=>l.length>1).join("\n").replace(/\n{2,}/g,"\n").slice(0,12000);
}

export async function fetchWebpage(cfg:WebpageConfig,startDate:string,endDate:string):Promise<EventRecord[]>{
 const r=await fetchRetry(cfg.url,{headers:UA,cache:"no-store"},2,45000);
 if(!r.ok)throw new Error(`HTTP ${r.status} from ${new URL(cfg.url).host}`);
 const html=await r.text();
 const text=pageText(html);
 if(text.length<80)throw new Error(`No readable text on ${new URL(cfg.url).host}`);
 const image=html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1]||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
 const found=await readPageText(text,cfg.url,cfg.venue,cfg.city);
 const st=cfg.city.split(",")[1]?.trim()||"";
 const out:EventRecord[]=[],seen=new Set<string>();
 for(const e of found){
  if(e.cancelled||e.date<startDate||e.date>endDate)continue;
  const title=String(e.title||"").trim();if(title.length<3)continue;
  const id=`${cfg.idPrefix}-${slug(title)}-${e.date}`;if(seen.has(id))continue;seen.add(id);
  const t=(x?:string)=>x&&/^\d{2}:\d{2}$/.test(x)?x+":00":undefined;
  const time=t(e.start)||"",end=t(e.end);
  const family=e.kids===true,forKids=e.forKids===true;
  out.push({id,title,date:e.date,time,endTime:end&&time&&end>time?end:undefined,
   city:e.town&&st?`${e.town}, ${st}`:cfg.city,venue:(e.place||cfg.venue).slice(0,120),address:e.place?undefined:cfg.address,
   url:cfg.url,sourceUrl:cfg.url,image:image&&/^https?:/.test(image)?image:undefined,
   category:family?"Family":"Local",genre:"Venue Event",desc:(e.summary||"").trim()||`${title} at ${cfg.venue}.`,
   tags:[...(family?["Family"]:[]),...(forKids?["Kids"]:[]),...(e.free?["Free"]:e.free===false?["Paid"]:[]),"Local"],
   emoji:family?"🎉":"📍",source:cfg.source,isFree:e.free===true||undefined,eventType:"event"} as EventRecord);
 }
 return out;
}
