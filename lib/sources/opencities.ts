import type {EventRecord} from "../ingestion/types";
import {fetchRetry} from "../http";
import {slug,stripHtml} from "../ingestion/utils";

// Shared parser for Granicus OpenCities event calendars (Fort Lauderdale, Sunrise, Plantation).
// It keys off links to event detail pages instead of exact CSS classes, so small template
// changes don't break it. Each item's text looks like: "Title 25 Sep 2026 [time] description".

export const BROWSER_HEADERS={
 "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
 "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
 "Accept-Language":"en-US,en;q=0.9"
};

const MON=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const MONTH_RX="(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?";

export function parseDate(s:string){
 let m=s.match(new RegExp(`\\b(\\d{1,2})\\s+${MONTH_RX}\\s+(20\\d{2})\\b`,"i"));
 if(m)return `${m[3]}-${String(MON.indexOf(m[2].slice(0,3).toLowerCase())+1).padStart(2,"0")}-${m[1].padStart(2,"0")}`;
 m=s.match(new RegExp(`\\b${MONTH_RX}\\s+(\\d{1,2}),?\\s+(20\\d{2})\\b`,"i"));
 if(m)return `${m[3]}-${String(MON.indexOf(m[1].slice(0,3).toLowerCase())+1).padStart(2,"0")}-${m[2].padStart(2,"0")}`;
 m=s.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
 if(m)return `${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`;
 return "";
}

export function parseTime(s:string){
 const m=s.match(/\b(\d{1,2})(?::(\d{2}))?\s*([AP])\.?M\.?\b/i);
 if(!m)return "";
 let h=+m[1];if(h>12)return "";
 if(/p/i.test(m[3])&&h<12)h+=12;if(/a/i.test(m[3])&&h===12)h=0;
 return `${String(h).padStart(2,"0")}:${m[2]||"00"}:00`;
}

export type OpenCitiesConfig={
 listUrl:string;        // calendar list page
 eventPath:string;      // path that event detail links start with, e.g. "/Explore-FTL/Event-Calendar"
 source:string;         // must match the registry name
 idPrefix:string;
 city:string;
 venue:string;
 block?:RegExp;         // titles to skip (meetings etc.)
 maxPages?:number;
 pageUrl?:(page:number)=>string; // URL of page N (default: "<listUrl>/-npage-N")
};

export async function fetchOpenCities(cfg:OpenCitiesConfig,startDate:string,endDate:string):Promise<EventRecord[]>{
 const origin=new URL(cfg.listUrl).origin;
 const path=cfg.eventPath.replace(/\/$/,"").toLowerCase();
 const out:EventRecord[]=[],seenHref=new Set<string>();
 let linksSeen=0;
 for(let page=1;page<=(cfg.maxPages??8);page++){
  const url=page===1?cfg.listUrl:(cfg.pageUrl?cfg.pageUrl(page):`${cfg.listUrl.replace(/\/$/,"")}/-npage-${page}`);
  const r=await fetchRetry(url,{headers:BROWSER_HEADERS,cache:"no-store"});
  if(!r.ok){if(page===1)throw new Error(`HTTP ${r.status} from ${url}`);break}
  const html=await r.text();

  // Every anchor pointing at an event detail page (skip OpenCities filter/paging URLs, which contain "/-").
  const anchors=[...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
   .map(a=>{let href="";try{href=new URL(a[1].replace(/&amp;/g,"&"),origin).toString()}catch{}return{href,inner:a[2],at:a.index??0}})
   .filter(a=>{if(!a.href)return false;const p=new URL(a.href).pathname.toLowerCase();return p.startsWith(path+"/")&&!p.slice(path.length).includes("/-")});

  // Collapse consecutive anchors to the same event (image link + title link) into one item.
  const items:{href:string;inner:string;at:number}[]=[];
  for(const a of anchors){const last=items[items.length-1];if(last&&last.href===a.href){last.inner+=" "+a.inner;continue}items.push({...a})}
  linksSeen+=items.length;

  let newOnPage=0,allPastEnd=items.length>0;
  items.forEach((it,i)=>{
   if(seenHref.has(it.href))return;
   seenHref.add(it.href);newOnPage++;
   const chunkHtml=html.slice(it.at,items[i+1]?.at??it.at+5000);
   const text=stripHtml(chunkHtml);
   const date=parseDate(text);
   if(date&&date<=endDate)allPastEnd=false;
   if(!date||date<startDate||date>endDate)return;
   const heading=chunkHtml.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
   let title=stripHtml(heading?.[1]||it.inner);
   // If the anchor wraps the whole card, cut the title at the date.
   const cut=title.search(new RegExp(`\\b\\d{1,2}\\s+${MONTH_RX}\\s+20\\d{2}|\\b${MONTH_RX}\\s+\\d{1,2},?\\s+20\\d{2}`,"i"));
   if(cut>3)title=title.slice(0,cut);
   title=title.replace(/\s+/g," ").trim();
   if(title.length<4||title.length>140||cfg.block?.test(title))return;
   const afterDate=text.slice(text.indexOf(title)+title.length).replace(/\s+/g," ").trim();
   const desc=afterDate.replace(new RegExp(`^.*?\\b(20\\d{2})\\b`),"").trim().slice(0,500)||`Official ${cfg.source} event.`;
   const blob=(title+" "+desc).toLowerCase();
   const family=/kids?|family|festival|parade|block party|children|story|pumpkin|halloween|trunk/.test(blob);
   const arts=/music|concert|arts?\b|theatre|theater|musical|comedy|film|movie/.test(blob);
   const free=/\bfree\b/.test(blob);
   out.push({id:`${cfg.idPrefix}-${slug(title+"-"+date)}`,title,city:cfg.city,venue:cfg.venue,date,time:parseTime(text)||"12:00:00",url:it.href,sourceUrl:url,
    category:family?"Family":arts?"Arts & Theatre":"Local",genre:"Local Event",desc,
    tags:[...(family?["Family"]:[]),...(arts?["Arts & Theatre"]:[]),...(free?["Free"]:[]),"Local"],
    emoji:family?"🎉":arts?"🎵":"📍",source:cfg.source,isFree:free,eventType:"event"});
  });
  // Stop when a page adds nothing new or the list has moved past the window.
  if(newOnPage===0||allPastEnd)break;
 }
 if(out.length===0)throw new Error(`No events in ${startDate}..${endDate} (found ${linksSeen} event links under ${cfg.eventPath})`);
 return out;
}
