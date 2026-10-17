import type {EventRecord} from "../ingestion/types";
import {fetchRetry} from "../http";
import {costFromPage} from "../ingestion/utils";

const HEADERS={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
 "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8","Accept-Language":"en-US,en;q=0.9"};

/** City calendars list events without their cost; the price lives on each event's own page ("Cost: $5"). Open each
 *  event page once (a few at a time, up to `limit` pages per site) and record what it states, so a price that isn't in the
 *  list isn't read as "free". Events whose page names no cost are left as they were. */
export async function addCostsFromPages(events:EventRecord[],limit=40,days=14):Promise<EventRecord[]>{
 // Soonest events first, within the next two weeks: those are the ones people are deciding on now. (Later events
 // get their turn on later runs as they come closer.)
 const until=new Date(Date.now()+days*864e5).toISOString().slice(0,10);
 const soon=events.filter(e=>!e.priceText&&/^https?:/.test(e.url||"")&&e.date<=until).sort((a,b)=>a.date.localeCompare(b.date));
 const urls=[...new Set(soon.map(e=>e.url))].slice(0,limit);
 const cost=new Map<string,string>();let next=0;
 await Promise.all(Array.from({length:4},async()=>{while(next<urls.length){const u=urls[next++];
  try{const r=await fetchRetry(u,{headers:HEADERS,cache:"no-store"},1);if(r.ok){const c=costFromPage(await r.text());if(c)cost.set(u,c)}}catch{}
 }}));
 return events.map(e=>{
  const c=cost.get(e.url);if(!c)return e;
  const paid=/\$\s?[1-9]/.test(c),free=!paid&&/\bfree\b|no (cost|charge)/i.test(c);
  return{...e,priceText:c,isFree:free,tags:[...(e.tags||[]).filter(t=>t!=="Free"&&t!=="Paid"),...(free?["Free"]:paid?["Paid"]:[])]};
 });
}
