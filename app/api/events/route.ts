import { db } from "../../../lib/db";
import { facetsFor, cleanAges, displayTags, settingFor } from "../../../lib/facets";
import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "../../../lib/schema";
import { cityCoords } from "../../../lib/ingestion/geocode";
import { discoveryRejection } from "../../../lib/ingestion/utils";
import { localParts, todayIn, DEFAULT_TZ } from "../../../lib/time";

function decodeHtml(s:string){return s.replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16))).replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'")}
function collapseKey(title:string,date:string){return [title.toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g," ").trim(),date].join("|")}
// Fallback centers for events saved before every event carried coordinates.
const CITY_COORDS:Record<string,[number,number]>={
"Sunrise, FL":[26.16697,-80.25659],"Pembroke Pines, FL":[26.00777,-80.29626],"Hollywood, FL":[26.0112,-80.14949],
"Fort Lauderdale, FL":[26.12231,-80.14338],"Davie, FL":[26.06287,-80.2331],"Weston, FL":[26.10037,-80.39977],
"Miramar, FL":[25.98731,-80.23227],"Coconut Creek, FL":[26.25175,-80.17894],"Hallandale Beach, FL":[25.9812,-80.14838],
"Pompano Beach, FL":[26.23786,-80.12477],"Coral Springs, FL":[26.27119,-80.2706],"Plantation, FL":[26.12759,-80.2331],
"Lauderhill, FL":[26.1404,-80.2134],"Lauderdale Lakes, FL":[26.1664,-80.2084],"Dania Beach, FL":[26.0523,-80.1439],
"Tamarac, FL":[26.2129,-80.2498],"Margate, FL":[26.2445,-80.2064],"Deerfield Beach, FL":[26.3184,-80.0998],
"Oakland Park, FL":[26.1723,-80.132],"Lighthouse Point, FL":[26.2756,-80.0873],"Cooper City, FL":[26.0573,-80.2717],
"West Park, FL":[25.9845,-80.1987],"North Lauderdale, FL":[26.2173,-80.2259],"Wilton Manors, FL":[26.1604,-80.1389],
"Parkland, FL":[26.3101,-80.2373],"Southwest Ranches, FL":[26.0587,-80.3373],"Lauderdale-By-The-Sea, FL":[26.192,-80.0964],
"Hillsboro Beach, FL":[26.2995,-80.0784],"Pembroke Park, FL":[25.9879,-80.1773],"Sea Ranch Lakes, FL":[26.2003,-80.0937],"Broward County, FL":[26.1224,-80.2],
"Miami, FL":[25.7617,-80.1918],"Miami Beach, FL":[25.7907,-80.13],"North Miami, FL":[25.8901,-80.1867],"North Miami Beach, FL":[25.9331,-80.1625],
"Coral Gables, FL":[25.7215,-80.2684],"Hialeah, FL":[25.8576,-80.2781],"Homestead, FL":[25.4687,-80.4776],"Doral, FL":[25.8195,-80.3553],
"Miami Springs, FL":[25.8223,-80.2895],"Miami Lakes, FL":[25.9087,-80.3087],"Opa-locka, FL":[25.9023,-80.2503],"Key Biscayne, FL":[25.6937,-80.1628],
"Aventura, FL":[25.9565,-80.1392],"Sunny Isles Beach, FL":[25.9429,-80.1234],"Pinecrest, FL":[25.6671,-80.3081],"Cutler Bay, FL":[25.5808,-80.3468],
"Miami Gardens, FL":[25.942,-80.2456],"Sweetwater, FL":[25.7634,-80.3731],"Kendall, FL":[25.6793,-80.3173],
"West Palm Beach, FL":[26.7153,-80.0534],"Lake Worth, FL":[26.6168,-80.0684],"Lake Worth Beach, FL":[26.6168,-80.0556],"Boca Raton, FL":[26.3683,-80.1289],
"Delray Beach, FL":[26.4615,-80.0728],"Boynton Beach, FL":[26.5318,-80.0905],"Wellington, FL":[26.6618,-80.2684],"Jupiter, FL":[26.9342,-80.0942],
"Royal Palm Beach, FL":[26.7084,-80.2306],"Greenacres, FL":[26.6276,-80.1253],"Palm Beach Gardens, FL":[26.8234,-80.1387],"Belle Glade, FL":[26.6845,-80.6676],
"Lantana, FL":[26.5865,-80.0521],"Tequesta, FL":[26.9709,-80.1284],"Palm Springs, FL":[26.6359,-80.0962],"Loxahatchee, FL":[26.6837,-80.2798]
};
function miles(a:number,b:number,c:number,d:number){const R=3958.8,q=(x:number)=>x*Math.PI/180,dp=q(c-a),dl=q(d-b),z=Math.sin(dp/2)**2+Math.cos(q(a))*Math.cos(q(c))*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(z))}
const zipPlace=new Map<string,string>();
/** ZIPs the lookup service says don't exist (as opposed to the service being unreachable). */
const badZips=new Set<string>();
async function zipCoords(zip:string):Promise<[number,number]|null>{if(!/^\d{5}$/.test(zip)){badZips.add(zip);return null}try{const r=await fetch(`https://api.zippopotam.us/us/${zip}`,{next:{revalidate:2592000}});if(r.status===404){badZips.add(zip);return null}if(!r.ok)return null;const d=await r.json(),p=d?.places?.[0],la=Number(p?.latitude),lo=Number(p?.longitude);if(p?.["place name"])zipPlace.set(zip,`${p["place name"]}, ${p["state abbreviation"]||""}`.replace(/, $/,""));return Number.isFinite(la)&&Number.isFinite(lo)?[la,lo]:null}catch{return null}}
/** Does GoToday cover this area at all? (any upcoming event within ~60 miles) */
async function covered(lat:number,lng:number,today:string){
 const dLat=60/69,dLng=60/(69*Math.cos(lat*Math.PI/180));
 const {rows}=await db.query(`select 1 from events where status='active' and local_date between $1::date and $1::date+45 and latitude between $2 and $3 and longitude between $4 and $5 limit 1`,[today,lat-dLat,lat+dLat,lng-dLng,lng+dLng]);
 return rows.length>0;
}

/** Date window for a range, from the searcher's own "today" (sent by the browser) or Eastern time. */
function windowDates(range:string,today:string){
 const base=new Date(today+"T12:00:00Z"),ymd=(d:Date)=>d.toISOString().slice(0,10);let s=new Date(base),e=new Date(base);
 // A specific day ("2026-10-21"), up to 60 days ahead.
 if(/^\d{4}-\d{2}-\d{2}$/.test(range)){const d=new Date(range+"T12:00:00Z"),days=(d.getTime()-base.getTime())/864e5;if(days>=0&&days<=60){s=d;e=new Date(d)}}
 if(range==="tomorrow"){s.setUTCDate(s.getUTCDate()+1);e=new Date(s)}
 // Weekend = Saturday and Sunday (any other day can be picked from "Pick day").
 if(range==="weekend"){const day=base.getUTCDay(),n=day===6?7:(6-day+7)%7||7;s.setUTCDate(s.getUTCDate()+n);e=new Date(s);e.setUTCDate(e.getUTCDate()+1)}
 return{startDate:ymd(s),endDate:ymd(e)};
}
const TM_JUNK=/^(luxury|premium|club)\s*(&|and)?\s*suites?\b|\bsuites?:|\bparking\b|\b(pregame|stadium|ballpark|behind the scenes) tours?\b/i;

/** Two listings of the same event: keep the first, fill its gaps (photo, real description, facets) from the other. */
const thinDesc=(d:string)=>!d||/^Official .* event\.$/.test(d)||d.length<40;
function mergeCopy(keep:any,other:any){
 const m={...keep};
 if(!m.image&&other.image)m.image=other.image;
 if(thinDesc(m.desc)&&!thinDesc(other.desc||""))m.desc=other.desc;
 m.facets=[...new Set([...(m.facets||[]),...(other.facets||[])])];
 if(!(m.labels||[]).length&&(other.labels||[]).length)m.labels=other.labels;
 if(!m.isFree&&other.isFree)m.isFree=true;
 if(m.ageMin==null&&other.ageMin!=null){m.ageMin=other.ageMin;m.ageMax=other.ageMax}
 return m;
}

export async function GET(request:NextRequest){
 const p=request.nextUrl.searchParams,postalCode=p.get("postalCode")||"33326",radius=Math.min(100,Math.max(1,Number(p.get("radius"))||25)),range=p.get("range")||"today";
 const clientToday=p.get("today"),today=clientToday&&/^\d{4}-\d{2}-\d{2}$/.test(clientToday)?clientToday:todayIn(DEFAULT_TZ);
 // Number(null) is 0, so only parse coordinates that were actually sent.
 const num=(k:string)=>{const v=p.get(k);return v==null||v.trim()===""?NaN:Number(v)};
 let lat=num("lat"),lng=num("lng");
 let usedZip=false;
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||(lat===0&&lng===0)){const c=await zipCoords(postalCode);usedZip=!!c;
  // Not a real US ZIP (e.g. 00000, 99999): say so instead of showing some other area's events.
  if(!c&&badZips.has(postalCode))return NextResponse.json({invalidZip:true,events:[],coverage:{covered:true}});
  [lat,lng]=c||[26.12,-80.25]}
 const w=windowDates(range,today);
 await ensureSchema();
 // Bounding box first (uses the lat/lng index), exact distance second; rows without coordinates
 // (saved before coordinates existed) fall back to their city center below.
 const dLat=radius/69,dLng=radius/(69*Math.cos(lat*Math.PI/180));
 const {rows}=await db.query(`select e.id,e.title,e.description,e.start_at,e.end_at,e.local_date::text as local_date,e.timezone,e.city,e.category,e.genre,e.tags,e.is_free,e.price_text,e.image_url,
   e.official_url,e.age_min,e.age_max,e.registration_text,e.latitude,e.longitude,s.name as source,v.name as venue
  from events e join sources s on s.id=e.source_id left join venues v on v.id=e.venue_id
  where e.status='active' and e.local_date between $1::date and $2::date
   and ((e.latitude between $3 and $4 and e.longitude between $5 and $6) or e.latitude is null)
  order by e.start_at limit 4000`,[w.startDate,w.endDate,lat-dLat,lat+dLat,lng-dLng,lng+dLng]);
 const now=Date.now();
 let events:any[]=[];
 for(const r of rows){
  const tz=r.timezone||DEFAULT_TZ,start=new Date(r.start_at),lp=localParts(start,tz);
  let la=r.latitude==null?NaN:Number(r.latitude),lo=r.longitude==null?NaN:Number(r.longitude),acc="venue";
  if(!Number.isFinite(la)){const k=String(r.city||"").trim();let c=CITY_COORDS[k];if(!c){const p=await cityCoords(k);if(p)c=[p.latitude,p.longitude]}if(!c)continue;[la,lo]=c;acc="city"}
  const d=miles(lat,lng,la,lo);if(d>radius)continue;
  const allDay=lp.time==="00:00:00";
  const e:any={id:"db-"+r.id,title:decodeHtml(r.title||""),city:r.city||"",venue:decodeHtml(r.venue||""),date:r.local_date||lp.date,time:allDay?"":lp.time,
   image:r.image_url||"",url:r.official_url||"",category:r.category||"Local",genre:r.genre||"",desc:decodeHtml(r.description||""),tags:Array.isArray(r.tags)?r.tags:[],
   source:/^Ticketmaster/.test(r.source)?"Ticketmaster":r.source,priceText:r.price_text||undefined,isFree:Boolean(r.is_free),ageMin:r.age_min??undefined,ageMax:r.age_max??undefined,registration:r.registration_text||undefined,
   distanceMiles:Math.round(d*10)/10,distanceAccuracy:acc};
  if(e.source==="Ticketmaster"&&TM_JUNK.test(e.title))continue;
  if(/^\W*(cancel+ed|postponed)\b/i.test(e.title))continue;   // "CANCELED: Kids in Motion" etc.
  if(discoveryRejection({...e,isDiscoveryEligible:e.source==="Ticketmaster"?true:undefined}))continue;
  // Instagram photo links are signed and stop working after a few days (the "oe" value is the expiry).
  {const oe=/cdninstagram\.com|fbcdn\.net/.test(e.image)&&e.image.match(/[?&]oe=([0-9A-Fa-f]{8})/);if(oe&&parseInt(oe[1],16)*1000<now+3600e3)e.image=""}
  {const st=settingFor(e);e.tags=[...e.tags.filter((t:string)=>t!=="Indoor"&&t!=="Outdoor"),...(st?[st]:[])];
   const facets=facetsFor(e),ages=cleanAges(e);e.facets=facets;e.labels=displayTags(e,facets).slice(0,3);e.ageMin=ages.ageMin;e.ageMax=ages.ageMax}
  // "Today": hide timed events that have already ended (or started over 2 hours ago with no end time).
  // "Today": hide events that are over. Many listings give only a start time (open houses, festivals),
  // so without an end time we assume 4 hours. Events in progress are marked "Happening now".
  let live=false;
  if(range==="today"&&!allDay){const end=r.end_at&&new Date(r.end_at).getTime()>start.getTime()?new Date(r.end_at).getTime():start.getTime()+4*3600e3;if(end<now)continue;live=start.getTime()<=now}
  if(live)e.live=true;
  events.push(e);
 }
 // Same program on the same day at several places (library branches, city + Ticketmaster) -> one card, nearest first.
 const groups=new Map<string,any[]>();
 const isIg=(e:any)=>/ · Instagram$/.test(e.source||"")||e.genre==="Venue Event";
 // Round-up accounts repost other people's events: their copy gives way to the organizer's own listing.
 const isRoundup=(e:any)=>/^(Miami Residents|Weekend Broward|The Broward Scene|To Do with Kids (Broward|Miami)) · Instagram$/.test(e.source||"");
 for(const e of events){const k=collapseKey(e.title,e.date);const g=groups.get(k);g?g.push(e):groups.set(k,[e])}
 events=[...groups.values()].map(g=>{g.sort((a:any,b:any)=>a.distanceMiles-b.distanceMiles||((a.source==="Ticketmaster"?1:0)-(b.source==="Ticketmaster"?1:0))||(isIg(a)?1:0)-(isIg(b)?1:0)||(isRoundup(a)?1:0)-(isRoundup(b)?1:0));const venues=new Set(g.map((x:any)=>x.venue));let m={...g[0]};for(const o of g.slice(1))m=mergeCopy(m,o);return{...m,moreLocations:venues.size-1,otherVenues:[...venues].slice(1,6)}})
  .sort((a:any,b:any)=>(a.date+(a.time||"")).localeCompare(b.date+(b.time||""))||((a.source==="Ticketmaster"?1:0)-(b.source==="Ticketmaster"?1:0)));
 // An event a town posts on Instagram is often also on its calendar under a slightly different title
 // ("Fall Festival" vs "Weston Fall Festival 2026"). Keep the calendar listing, drop the Instagram copy.
 const STOP=new Set(["the","and","of","a","at","in","on","for","with","to","annual","city","town","village","free","fl","event","day","night","2025","2026","2027"]);
 const words=(t:string)=>new Set(t.toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").split(" ").filter(w=>w.length>2&&!STOP.has(w)));
 const cal=events.filter((e:any)=>!isIg(e)),official=events.filter((e:any)=>!isRoundup(e));
 events=events.filter((e:any)=>{
  if(!isIg(e))return true;
  const w=words(e.title);if(!w.size)return true;
  return!(isRoundup(e)?official:cal).some((c:any)=>{if(c===e)return false;if(c.date!==e.date)return false;
   // Same place: close together, or the same town (posts without a street address sit at the town's center).
   const town=(x:string)=>String(x||"").toLowerCase().replace(/^ft\.?\s/,"fort ").replace(/,.*$/,"").trim();
   const near=(typeof c.distanceMiles==="number"&&typeof e.distanceMiles==="number"&&Math.abs(c.distanceMiles-e.distanceMiles)<4)||(!!town(c.city)&&town(c.city)===town(e.city));
   if(!near)return false;const cw=words(c.title);let hit=0;for(const x of w)if(cw.has(x))hit++;
   if(!(hit>=Math.min(2,w.size)&&hit/Math.min(w.size,cw.size||1)>=0.6))return false;
   Object.assign(c,mergeCopy(c,e));return true});   // keep the calendar listing, but take the post's photo and details
 });
 // The same photo on 3+ different Instagram events is a round-up cover, not any one event's picture.
 const igPics=[...new Set((events as any[]).filter(e=>e.image&&isIg(e)).map(e=>e.image as string))];
 if(igPics.length){
  const shared=new Set((await db.query("select image_url from events where image_url=any($1) group by image_url having count(distinct lower(title))>=3",[igPics]).catch(()=>({rows:[]}))).rows.map((r:any)=>r.image_url));
  for(const e of events as any[])if(shared.has(e.image))e.image="";
 }
 // One account often posts the same event several times ("Champagne Welcome & Gallery Tour", "Hollywood Art Walk
 // Guided Tour"): same account and day, plus the same time and venue or nearly the same title -> one card.
 const place=(x:string)=>String(x||"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g," ").trim();
 const kept:any[]=[];
 for(const e of events as any[]){
  if(!isIg(e)){kept.push(e);continue}
  const w=words(e.title);
  const twin=kept.find((c:any)=>{if(!isIg(c)||c.source!==e.source||c.date!==e.date)return false;
   if(e.time&&c.time===e.time&&place(c.venue)===place(e.venue))return true;
   const cw=words(c.title);let hit=0;for(const x of w)if(cw.has(x))hit++;
   return hit>=3&&hit/Math.min(w.size,cw.size||1)>=0.75&&(!e.time||!c.time||e.time===c.time)});
  if(!twin){kept.push(e);continue}
  // Keep whichever copy has a picture (then the longer description) as the card; fold the other in.
  const better=(!twin.image&&e.image)||(!!twin.image===!!e.image&&(e.desc||"").length>(twin.desc||"").length);
  const merged=better?mergeCopy(e,twin):mergeCopy(twin,e);
  kept[kept.indexOf(twin)]=merged;
 }
 events=kept;
 const localCount=events.filter((e:any)=>e.source!=="Ticketmaster").length;
 // No results: tell the page whether that's "nothing this day" or "we're not in this area yet".
 const coverage=events.length?{covered:true}:{covered:await covered(lat,lng,today),place:usedZip?zipPlace.get(postalCode)||null:null};
 // Same search within 10 minutes is answered from Vercel's cache, not the database (keeps the free database tier happy).
 return NextResponse.json({coverage,events:events.slice(0,2000).map((e:any)=>({...e,desc:e.desc.length>320?e.desc.slice(0,317)+"…":e.desc})),range,startDate:w.startDate,endDate:w.endDate,center:[lat,lng],radius,localCount,ticketmasterCount:events.length-localCount,total:events.length},{headers:{"cache-control":"public, s-maxage=600, stale-while-revalidate=1800"}});
}
