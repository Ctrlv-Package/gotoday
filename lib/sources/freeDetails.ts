import {db} from "../db";
import {ensureSchema} from "../schema";
import {slug,stripHtml} from "../ingestion/utils";
import type {Details} from "./eventDetails";

// Free way to fill in an Instagram event that only has a name: look on the websites the post points to
// (links in the caption, the account's own website from its Instagram profile) for a page about the
// event, and read that page's own summary (schema.org Event data, or its share-card description).
// No AI and no search engine: just the site's sitemap and a few page loads, cached per event.

const UA="Mozilla/5.0 (compatible; GoTodayBot/1.0; +https://www.mygotoday.com)";
const STOP=new Set(["the","and","of","a","at","in","on","for","with","to","annual","day","night","event","events","2025","2026","2027","presents","fl","free"]);
const words=(t:string)=>slug(t).split("-").filter(w=>w.length>2&&!STOP.has(w));

async function get(url:string,ms=12000):Promise<string>{
 try{const r=await fetch(url,{headers:{"user-agent":UA,accept:"text/html,application/xml;q=0.9,*/*;q=0.8"},signal:AbortSignal.timeout(ms),redirect:"follow"});
  if(!r.ok)return"";const t=r.headers.get("content-type")||"";if(/image|video|audio|pdf|zip|font|octet-stream/.test(t)&&!/html|xml|text/.test(t)&&!/\/$|\.(html?|xml)$|\/[^.]*$/.test(new URL(url).pathname))return"";return(await r.text()).slice(0,1500000)}catch{return""}
}
const origin=(u:string)=>{try{const x=new URL(/^https?:/.test(u)?u:`https://${u}`);return x.origin}catch{return""}};

/** Every page URL in a site's sitemap (follows sitemap indexes a little). */
const sitemapCache=new Map<string,string[]>();
async function sitemapUrls(site:string):Promise<string[]>{
 const o=origin(site);if(!o)return[];
 if(sitemapCache.has(o))return sitemapCache.get(o)!;
 const out:string[]=[],seen=new Set<string>();
 let queue=[`${o}/sitemap.xml`,`${o}/sitemap_index.xml`];
 const robots=await get(`${o}/robots.txt`,8000);for(const m of robots.matchAll(/sitemap:\s*(\S+)/gi))queue.unshift(m[1]);
 for(let i=0;i<queue.length&&i<12;i++){
  const u=queue[i];if(seen.has(u))continue;seen.add(u);
  const x=await get(u,10000);if(!x)continue;
  const locs=[...x.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m=>m[1].replace(/&amp;/g,"&"));
  if(/<sitemapindex/i.test(x)){
   // Event-ish child sitemaps first (Wix: event-pages-sitemap.xml, WordPress: tribe_events-sitemap.xml).
   queue.push(...locs.sort((a,b)=>Number(/event/i.test(b))-Number(/event/i.test(a))).slice(0,8));
  }else out.push(...locs);
  if(out.length>20000)break;
 }
 sitemapCache.set(o,out);return out;
}

function pageFacts(html:string){
 const meta=(k:string)=>{const a=new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]+content=(["'])([\\s\\S]*?)\\1`,"i").exec(html)?.[2];const b=new RegExp(`<meta[^>]+content=(["'])([\\s\\S]*?)\\1[^>]+(?:property|name)=["']${k}["']`,"i").exec(html)?.[2];return stripHtml((a||b||"").replace(/&#39;/g,"'"))};
 let ev:any=null;
 for(const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)){
  try{const j=JSON.parse(m[1].trim());const all=[j,...(Array.isArray(j)?j:[]),...(j["@graph"]||[])].flat();ev=all.find((x:any)=>x&&/Event$/.test(String(x["@type"]||"")));if(ev)break}catch{}
 }
 const title=stripHtml(ev?.name||meta("og:title")||html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"");
 const desc=stripHtml(String(ev?.description||meta("og:description")||meta("description")||""));
 const loc=ev?.location,place=typeof loc==="string"?loc:loc?.name,addr=loc?.address;
 const address=typeof addr==="string"?addr:addr?[addr.streetAddress,addr.addressLocality].filter(Boolean).join(", "):undefined;
 const hm=(s?:string)=>s&&/T(\d{2}:\d{2})/.exec(s)?.[1];
 const offers=[ev?.offers].flat().filter(Boolean);
 const free=offers.length?offers.every((o:any)=>Number(o?.price)===0):(ev?.isAccessibleForFree===true?true:null);
 return{title,desc,start:ev?.startDate as string|undefined,startTime:hm(ev?.startDate),endTime:hm(ev?.endDate),place:place?stripHtml(place):undefined,address,free,text:stripHtml(html).slice(0,20000)};
}

const MONTHS=["january","february","march","april","may","june","july","august","september","october","november","december"];
function mentionsDate(text:string,date:string){
 const [y,m,d]=date.split("-").map(Number),mon=MONTHS[m-1],t=text.toLowerCase();
 return t.includes(date)||new RegExp(`\\b(${mon}|${mon.slice(0,3)})\\.?\\s+${d}(st|nd|rd|th)?\\b`).test(t)||new RegExp(`\\b${m}/${d}(/${y}|/${String(y).slice(2)})?\\b`).test(t);
}

/** Look for the event on the given sites. Returns null when nothing clearly about this event is found. */
export async function freeLookup(a:{title:string;date:string;city:string;sites:string[]}):Promise<Details|null>{
 await ensureSchema();
 const key=`free|${slug(a.title)}|${a.date}|${slug(a.city)}`;
 const {rows}=await db.query("select data,created_at from event_details where key=$1",[key]).catch(()=>({rows:[]as any[]}));
 if(rows[0]&&(rows[0].data?.found||Date.now()-new Date(rows[0].created_at).getTime()<2*86400e3))return rows[0].data?.found?rows[0].data:null;
 const w=words(a.title);let found:any={found:false};
 if(w.length){
  const need=Math.min(w.length,w.length>=3?2:w.length);   // short titles: every word; longer: at least 2
  const cands:{u:string;score:number}[]=[];
  for(const site of [...new Set(a.sites.map(origin).filter(Boolean))].slice(0,3)){
   for(const u of await sitemapUrls(site)){
    const path=decodeURIComponent(u.toLowerCase());const hit=w.filter(x=>path.includes(x)).length;
    if(hit>=need)cands.push({u,score:hit/w.length+(/event/.test(path)?0.2:0)+(path.includes(String(a.date.slice(0,4)))?0.1:0)});
   }
  }
  cands.sort((x,y)=>y.score-x.score);
  for(const c of cands.slice(0,4)){
   const html=await get(c.u);if(!html)continue;
   const f=pageFacts(html);
   const titleHit=w.filter(x=>slug(f.title).includes(x)).length>=need;
   const dateOk=f.start?f.start.slice(0,10)===a.date:mentionsDate(f.text,a.date);
   if(!titleHit||!dateOk||f.desc.length<40)continue;
   found={found:true,url:c.u,summary:f.desc.slice(0,700),start:f.startTime,end:f.endTime,place:f.place,address:f.address,free:f.free};
   break;
  }
 }
 await db.query("insert into event_details(key,data,created_at) values($1,$2,now()) on conflict(key) do update set data=excluded.data,created_at=now()",[key,JSON.stringify(found)]).catch(()=>{});
 return found.found?found:null;
}

/** Web addresses written in a caption ("WWW.GORIVERWALK.COM/CALENDAR", "link: https://…"). */
export const captionSites=(caption:string)=>[...(caption||"").matchAll(/\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|gov|us|info|events|fl\.us)(?:\/[^\s)]*)?)/gi)].map(m=>m[1].replace(/[!.,;:]+$/,"")).filter(u=>!/instagram|facebook|tiktok|linktr\.ee|bit\.ly/i.test(u));
