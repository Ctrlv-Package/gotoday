import type {EventRecord} from "../ingestion/types";
import {fetchRetry} from "../http";
import {costFromPage,pictureFromPage,richText} from "../ingestion/utils";

const HEADERS={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
 "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8","Accept-Language":"en-US,en;q=0.9"};

/** City calendars list events without their cost; the price lives on each event's own page ("Cost: $5"). Open each
 *  event page once (a few at a time, up to `limit` pages per site) and record what it states, so a price that isn't in the
 *  list isn't read as "free". Events whose page names no cost are left as they were. Events without a picture
 *  take the photo their page shows, when it has its own. */
export async function addCostsFromPages(events:EventRecord[],limit=40,days=14):Promise<EventRecord[]>{
 // Opening event pages is the slow part of the GitHub update job (free minutes are limited). Prices and photos rarely
 // change within a day, so only the morning run (before 14:00 UTC) reads them; the later runs only pick up new events.
 if(process.env.GITHUB_ACTIONS&&new Date().getUTCHours()>=14&&!process.env.READ_EVENT_PAGES)return events;
 // Soonest events first, within the next two weeks: those are the ones people are deciding on now. (Later events
 // get their turn on later runs as they come closer.)
 const until=new Date(Date.now()+days*864e5).toISOString().slice(0,10);
 const thin=(e:EventRecord)=>!e.desc||e.desc.length<40||/^official .* event\.$/i.test(e.desc);
 const soon=events.filter(e=>(!e.priceText||!e.image||thin(e))&&/^https?:/.test(e.url||"")&&e.date<=until).sort((a,b)=>a.date.localeCompare(b.date));
 const urls=[...new Set(soon.map(e=>e.url))].slice(0,limit);
 const cost=new Map<string,string>(),pic=new Map<string,string>(),about=new Map<string,string>();let next=0;
 await Promise.all(Array.from({length:4},async()=>{while(next<urls.length){const u=urls[next++];
  try{const r=await fetchRetry(u,{headers:HEADERS,cache:"no-store"},1);if(r.ok){const h=await r.text(),c=costFromPage(h),p=pictureFromPage(h,u),a=aboutFromPage(h);if(c)cost.set(u,c);if(p)pic.set(u,p);if(a)about.set(u,a)}}catch{}
 }}));
 // The same picture on pages of DIFFERENTLY named events is the site's banner, not an event photo. (One show's
 // flyer on its Saturday and Sunday pages is still that show's flyer.)
 const titlesOf=new Map<string,Set<string>>();for(const e of events){const p=pic.get(e.url);if(p){const t=titlesOf.get(p)||new Set();t.add(e.title.toLowerCase().trim());titlesOf.set(p,t)}}
 const sharedAbout=new Map<string,number>();for(const a of about.values())sharedAbout.set(a,(sharedAbout.get(a)||0)+1);
 return events.map(e=>{
  const p=pic.get(e.url),a=about.get(e.url);
  if(!e.image&&p&&(titlesOf.get(p)?.size||0)<2)e={...e,image:p};
  if(thin(e)&&a&&(sharedAbout.get(a)||0)<3)e={...e,desc:a};
  const c=e.priceText?undefined:cost.get(e.url);if(!c)return e;
  const paid=/\$\s?[1-9]/.test(c),free=!paid&&/\bfree\b|no (cost|charge)/i.test(c);
  return{...e,priceText:c,isFree:free,tags:[...(e.tags||[]).filter(t=>t!=="Free"&&t!=="Paid"),...(free?["Free"]:paid?["Paid"]:[])]};
 });
}

/** The event's own description: the page's og:description / meta description, when it says something. */
function aboutFromPage(html:string):string|undefined{
 const m=html.match(/<meta[^>]+(?:property|name)="(?:og:description|description)"[^>]+content="([^"]{40,})"/i)||html.match(/<meta[^>]+content="([^"]{40,})"[^>]+(?:property|name)="(?:og:description|description)"/i);
 const t=m?richText(m[1]).trim():"";
 return t.length>=40?t.slice(0,1500):undefined;
}
