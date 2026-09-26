import type {EventRecord} from "../ingestion/types";

// Ticketmaster Discovery API: supplemental ticketed inventory (concerts, sports, theatre, comedy).
// Market 15 = South Florida (Broward, Miami-Dade, Palm Beach). Free tier: 5,000 calls/day, 5 req/s,
// and at most 1,000 results per query (size * page < 1000).
const JUNK=/\b(parking|upgrade|vip package|ride and dine|big bus tours?|speedboat|gift card|voucher|season tickets?)\b/i;

export async function fetchTicketmasterEvents(startDate:string,endDate:string):Promise<EventRecord[]>{
 const key=process.env.TICKETMASTER_API_KEY;
 if(!key)throw new Error("TICKETMASTER_API_KEY is not set");
 const out:EventRecord[]=[],seen=new Set<string>();
 for(let page=0;page<5;page++){
  const u=new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  u.searchParams.set("apikey",key);u.searchParams.set("marketId","15");u.searchParams.set("countryCode","US");
  u.searchParams.set("localStartEndDateTime",`${startDate}T00:00:00,${endDate}T23:59:59`);
  u.searchParams.set("sort","date,asc");u.searchParams.set("size","199");u.searchParams.set("page",String(page));
  const r=await fetch(u.toString(),{cache:"no-store"});
  if(!r.ok){if(page===0)throw new Error(`Ticketmaster HTTP ${r.status}`);break}
  const d:any=await r.json();
  for(const ev of d?._embedded?.events||[]){
   const title=String(ev.name||"").trim(),date=ev.dates?.start?.localDate||"";
   const seg=ev.classifications?.[0]?.segment?.name,genre=ev.classifications?.[0]?.genre?.name;
   if(!ev.id||seen.has(ev.id)||!title||!date||!ev.url||JUNK.test(title)||!seg||seg==="Undefined"||seg==="Miscellaneous")continue;
   if(ev.dates?.status?.code==="cancelled")continue;
   seen.add(ev.id);
   const v=ev._embedded?.venues?.[0]||{},lat=Number(v.location?.latitude),lng=Number(v.location?.longitude);
   const price=ev.priceRanges?.[0],img=[...(ev.images||[])].sort((a:any,b:any)=>(b.width||0)-(a.width||0))[0]?.url;
   const family=seg==="Family"||/\bfamily|kids?\b/i.test(title);
   out.push({id:`tm-${ev.id}`,title,city:[v.city?.name,v.state?.stateCode||"FL"].filter(Boolean).join(", "),venue:v.name||"TBA",
    address:[v.address?.line1,v.city?.name,v.state?.stateCode,v.postalCode].filter(Boolean).join(", ")||undefined,
    latitude:Number.isFinite(lat)?lat:undefined,longitude:Number.isFinite(lng)?lng:undefined,
    date,time:ev.dates?.start?.localTime||"",url:ev.url,sourceUrl:"https://www.ticketmaster.com",image:img,
    category:family?"Family":seg,genre:genre&&genre!=="Undefined"?genre:seg,
    desc:String(ev.info||ev.pleaseNote||`${seg} at ${v.name||"a local venue"}.`).slice(0,1000),
    tags:[seg,...(family?["Family"]:[]),"Tickets"],emoji:seg==="Sports"?"🏟️":seg==="Music"?"🎤":"🎟️",source:"Ticketmaster",
    priceText:price?`$${Math.round(price.min)}${price.max&&price.max!==price.min?`–$${Math.round(price.max)}`:""}`:undefined,
    isFree:false,eventType:"event",isDiscoveryEligible:true});
  }
  const totalPages=Number(d?.page?.totalPages)||0;
  if(page+1>=totalPages||(page+1)*199>=1000)break;
 }
 if(out.length===0)throw new Error("Ticketmaster returned no events for South Florida");
 return out;
}
