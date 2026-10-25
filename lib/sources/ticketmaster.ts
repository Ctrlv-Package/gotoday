import type {EventRecord} from "../ingestion/types";

// Ticketmaster Discovery API: supplemental ticketed inventory (concerts, sports, theatre, comedy).
// Market 15 = South Florida (Broward, Miami-Dade, Palm Beach). Free tier: 5,000 calls/day, 5 req/s,
// and at most 1,000 results per query (size * page < 1000).
// Multi-day passes and bundles of a show that's also listed day by day ("2-Day Ticket (10/30-31) Valid Both Days").
const PASS=/\b(\d+|two|three)[- ]day (ticket|pass)\b|\bvalid (both|all) days\b|\bcannot split\b|\b(weekend|festival|season) pass\b|\bpackage\b.*\b(tickets?|pass)\b/i;
const JUNK=/(^(luxury|premium|club)\s*(&|and)?\s*suites?\b|\bsuites?:|\bhospitality\b)|\b(parking|upgrade|vip package|ride and dine|big bus tours?|(pregame|stadium|ballpark|arena|behind the scenes) tours?|speedboat|gift card|voucher|season tickets?)\b/i;

/** Either a Ticketmaster market (15 = South Florida) or a center point + radius in miles. */
export type TicketmasterConfig={marketId?:string;latlong?:string;radius?:number;label?:string};
export async function fetchTicketmasterEvents(startDate:string,endDate:string,cfg:TicketmasterConfig={marketId:"15"}):Promise<EventRecord[]>{
 const key=process.env.TICKETMASTER_API_KEY;
 if(!key)throw new Error("TICKETMASTER_API_KEY is not set");
 const out:EventRecord[]=[],seen=new Set<string>();
 // Some big venues (Amerant Bank Arena, Boca Black Box) carry no market tag, so a market search misses
 // them: South Florida is also searched by distance. Each week is its own query so the 1,000-result cap
 // never cuts off the end of the month.
 const areas:{marketId?:string;latlong?:string;radius?:number}[]=[];
 if(cfg.latlong)areas.push({latlong:cfg.latlong,radius:cfg.radius});
 if(cfg.marketId||!cfg.latlong){areas.push({marketId:cfg.marketId||"15"});if((cfg.marketId||"15")==="15"&&!cfg.latlong)areas.push({latlong:"26.15,-80.22",radius:60})}
 const weeks:[string,string][]=[];
 for(let d=new Date(`${startDate}T00:00:00Z`);d.toISOString().slice(0,10)<=endDate;d.setUTCDate(d.getUTCDate()+7)){
  const e=new Date(d);e.setUTCDate(e.getUTCDate()+6);const a=d.toISOString().slice(0,10),b=e.toISOString().slice(0,10);weeks.push([a,b<endDate?b:endDate]);
 }
 let calls=0;
 for(const area of areas)for(const [from,to] of weeks)
 for(let page=0;page<5;page++){
  const u=new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  u.searchParams.set("apikey",key);u.searchParams.set("countryCode","US");
  if(area.latlong){u.searchParams.set("latlong",area.latlong);u.searchParams.set("radius",String(area.radius||50));u.searchParams.set("unit","miles")}else u.searchParams.set("marketId",area.marketId!);
  u.searchParams.set("localStartEndDateTime",`${from}T00:00:00,${to}T23:59:59`);
  u.searchParams.set("sort","date,asc");u.searchParams.set("size","199");u.searchParams.set("page",String(page));
  // Ticketmaster allows ~5 requests/second per key and three regions share it: pace pages, wait out 429s.
  if(calls++>0)await new Promise(res=>setTimeout(res,300));
  let r=await fetch(u.toString(),{cache:"no-store"});
  for(let t=0;t<3&&r.status===429;t++){await new Promise(res=>setTimeout(res,2000*(t+1)+Math.random()*1000));r=await fetch(u.toString(),{cache:"no-store"})}
  if(!r.ok){if(calls===1)throw new Error(`Ticketmaster HTTP ${r.status}`);break}
  const d:any=await r.json();
  for(const ev of d?._embedded?.events||[]){
   const title=String(ev.name||"").trim(),date=ev.dates?.start?.localDate||"";
   const seg=ev.classifications?.[0]?.segment?.name,genre=ev.classifications?.[0]?.genre?.name;
   if(!ev.id||seen.has(ev.id)||!title||!date||!ev.url||JUNK.test(title)||PASS.test(title)||!seg||seg==="Undefined"||seg==="Miscellaneous")continue;
   if(ev.dates?.status?.code==="cancelled")continue;
   seen.add(ev.id);
   const v=ev._embedded?.venues?.[0]||{},lat=Number(v.location?.latitude),lng=Number(v.location?.longitude);
   // Ticketmaster's generic category pictures (/dam/c/…) are reused across unrelated shows: only real show photos.
   const price=ev.priceRanges?.[0],img=[...(ev.images||[])].filter((i:any)=>!/\/dam\/c\//.test(i.url||"")).sort((a:any,b:any)=>(b.width||0)-(a.width||0))[0]?.url;
   const family=seg==="Family"||/\bfamily|kids?\b/i.test(title);
   out.push({id:`tm-${ev.id}`,title,city:[v.city?.name,v.state?.stateCode||"FL"].filter(Boolean).join(", "),venue:v.name||"TBA",
    address:[v.address?.line1,v.city?.name,v.state?.stateCode,v.postalCode].filter(Boolean).join(", ")||undefined,
    latitude:Number.isFinite(lat)?lat:undefined,longitude:Number.isFinite(lng)?lng:undefined,
    date,time:ev.dates?.start?.localTime||"",url:ev.url,sourceUrl:"https://www.ticketmaster.com",image:img,
    category:family?"Family":seg,genre:genre&&genre!=="Undefined"?genre:seg,
    desc:String(ev.info||ev.pleaseNote||`${seg} at ${v.name||"a local venue"}.`).slice(0,1000),
    tags:[seg,...(family?["Family"]:[]),"Tickets"],emoji:seg==="Sports"?"🏟️":seg==="Music"?"🎤":"🎟️",source:"Ticketmaster",
    priceText:price?`$${Math.round(price.min)}${price.max&&price.max!==price.min?`–$${Math.round(price.max)}`:""}`:undefined,
    isFree:false,eventType:"event",isDiscoveryEligible:true,registrationUrl:ev.url,registrationText:ev.dates?.status?.code==="offsale"?"Tickets not currently on sale":"Tickets required"});
  }
  const totalPages=Number(d?.page?.totalPages)||0;
  if(page+1>=totalPages||(page+1)*199>=1000)break;
 }
 // A whole market with nothing means a broken setup; a small area can simply have a quiet month.
 if(out.length===0&&!cfg.latlong)throw new Error(`Ticketmaster returned no events for ${cfg.label||cfg.marketId}`);
 return out;
}
