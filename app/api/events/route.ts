import { db } from "../../../lib/db";
import { ensureSchema } from "../../../lib/schema";
import { discoveryRejection } from "../../../lib/ingestion/utils";
import { NextRequest, NextResponse } from "next/server";
function decodeHtml(s:string){return s.replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16))).replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'")}
function collapseKey(title:string,date:string){return [title.toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g," ").trim(),date].join("|")}
function dedupeKey(title:string,venue:string,date:string){return [title.toLowerCase().replace(/[^a-z0-9]+/g," ").trim(),venue.toLowerCase().trim(),date].join("|")}
const CITY_COORDS:Record<string,[number,number]>={
"Sunrise, FL":[26.16697,-80.25659],"Pembroke Pines, FL":[26.00777,-80.29626],"Hollywood, FL":[26.0112,-80.14949],
"Fort Lauderdale, FL":[26.12231,-80.14338],"Davie, FL":[26.06287,-80.2331],"Weston, FL":[26.10037,-80.39977],
"Miramar, FL":[25.98731,-80.23227],"Coconut Creek, FL":[26.25175,-80.17894],"Hallandale Beach, FL":[25.9812,-80.14838],
"Pompano Beach, FL":[26.23786,-80.12477],"Coral Springs, FL":[26.27119,-80.2706],"Plantation, FL":[26.12759,-80.2331],
"Lauderhill, FL":[26.1404,-80.2134],"Lauderdale Lakes, FL":[26.1664,-80.2084],"Dania Beach, FL":[26.0523,-80.1439],
"Tamarac, FL":[26.2129,-80.2498],"Margate, FL":[26.2445,-80.2064],"Deerfield Beach, FL":[26.3184,-80.0998],
"Oakland Park, FL":[26.1723,-80.132],"Lighthouse Point, FL":[26.2756,-80.0873],"Cooper City, FL":[26.0573,-80.2717],
"West Park, FL":[25.9845,-80.1987],"North Lauderdale, FL":[26.2173,-80.2259],"Wilton Manors, FL":[26.1604,-80.1389],
"Parkland, FL":[26.3101,-80.2373],"Broward County, FL":[26.1224,-80.2],
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
function localWithinRadius(e:any,lat:string|null,lng:string|null,radius:string){if(!lat||!lng)return true;const exact=Number.isFinite(e.latitude)&&Number.isFinite(e.longitude),key=String(e.city||"").replace(/\s+/g," ").trim(),p=exact?[e.latitude,e.longitude]:CITY_COORDS[key];if(!p)return false;const d=miles(+lat,+lng,p[0],p[1]);e.distanceMiles=Math.round(d*10)/10;e.distanceAccuracy=exact?"venue":"city";return d<=+radius}
function windowDates(range:string){const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const get=(t:string)=>parts.find(p=>p.type===t)?.value||"";const today=`${get("year")}-${get("month")}-${get("day")}`,base=new Date(today+"T12:00:00Z"),ymd=(d:Date)=>d.toISOString().slice(0,10);let s=new Date(base),e=new Date(base);if(range==="tomorrow"){s.setUTCDate(s.getUTCDate()+1);e=new Date(s)}if(range==="weekend"){const day=base.getUTCDay(),n=day===6?7:(6-day+7)%7||7;s=new Date(base);s.setUTCDate(s.getUTCDate()+n);e=new Date(s);e.setUTCDate(e.getUTCDate()+1)}return{startDate:ymd(s),endDate:ymd(e)}}

async function zipCoords(zip:string):Promise<[number,number]|null>{if(!/^\d{5}$/.test(zip))return null;try{const r=await fetch(`https://api.zippopotam.us/us/${zip}`,{next:{revalidate:2592000}});if(!r.ok)return null;const d=await r.json(),p=d?.places?.[0],la=Number(p?.latitude),lo=Number(p?.longitude);return Number.isFinite(la)&&Number.isFinite(lo)?[la,lo]:null}catch{return null}}
async function databaseEvents(startDate:string,endDate:string){
 await ensureSchema();
 const {rows}=await db.query("select e.id,e.title,e.description,e.start_at,e.city,e.category,e.genre,e.tags,e.is_free,e.price_text,e.image_url,e.official_url,e.source_url,e.age_min,e.age_max,s.name as source,v.name as venue,v.latitude,v.longitude from events e join sources s on s.id=e.source_id left join venues v on v.id=e.venue_id where e.status='active' and e.start_at::date between $1::date and $2::date order by e.start_at asc",[startDate,endDate]);
 const formatter=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
 const value=(ps:Intl.DateTimeFormatPart[],t:string)=>ps.find(x=>x.type===t)?.value||"";
 return rows.map((r:any)=>{const ps=formatter.formatToParts(new Date(r.start_at));return{id:"db-"+r.id,title:decodeHtml(r.title||""),city:r.city||"",venue:decodeHtml(r.venue||""),date:value(ps,"year")+"-"+value(ps,"month")+"-"+value(ps,"day"),time:(()=>{const t=value(ps,"hour").replace(/^24$/,"00")+":"+value(ps,"minute")+":"+value(ps,"second");return t==="00:00:00"?"":t})(),image:r.image_url||"",url:r.official_url||"",sourceUrl:r.source_url||"",category:r.category||"Local",genre:r.genre||"",desc:decodeHtml(r.description||""),tags:Array.isArray(r.tags)?r.tags:[],emoji:"🎟️",source:r.source,priceText:r.price_text||undefined,isFree:Boolean(r.is_free),ageMin:r.age_min==null?undefined:Number(r.age_min),ageMax:r.age_max==null?undefined:Number(r.age_max),latitude:r.latitude==null?undefined:Number(r.latitude),longitude:r.longitude==null?undefined:Number(r.longitude)}});
}
export async function GET(request:NextRequest){
 const p=request.nextUrl.searchParams,postalCode=p.get("postalCode")||"33326",radius=p.get("radius")||"25",range=p.get("range")||"today",w=windowDates(range);
 let lat=p.get("lat"),lng=p.get("lng");
 // ZIP searches: resolve the ZIP to coordinates so the radius applies (fallback: central Broward).
 if(!lat||!lng){const c=await zipCoords(postalCode);[lat,lng]=(c||[26.12,-80.25]).map(String) as [string,string]}
 // Re-apply the current discovery rules at read time, so rule changes take effect without waiting for re-ingestion.
 let events:any[]=(await databaseEvents(w.startDate,w.endDate))
  .filter((e:any)=>!(e.source==="Ticketmaster"&&/^(luxury|premium|club)\s*(&|and)?\s*suites?\b|\bsuites?:|\bparking\b/i.test(e.title)))
  .filter((e:any)=>!discoveryRejection({...e,isDiscoveryEligible:e.source==="Ticketmaster"?true:undefined}))
  .filter((e:any)=>localWithinRadius(e,lat,lng,radius));
 if(range==="today"){const np=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());const nowTime=(np.find(x=>x.type==="hour")?.value||"00").replace(/^24$/,"00")+":"+(np.find(x=>x.type==="minute")?.value||"00")+":00";events=events.filter((e:any)=>!e.time||e.time==="00:00:00"||e.time>=nowTime)}
 const groups=new Map<string,any[]>();
 for(const e of events){const k=collapseKey(e.title,e.date);const g=groups.get(k);g?g.push(e):groups.set(k,[e])}
 events=[...groups.values()].map(g=>{g.sort((a:any,b:any)=>(a.distanceMiles??999)-(b.distanceMiles??999)||((a.source==="Ticketmaster"?1:0)-(b.source==="Ticketmaster"?1:0)));const venues=new Set(g.map((x:any)=>x.venue));return{...g[0],moreLocations:venues.size-1,otherVenues:[...venues].slice(1,6)}})
  // Local inventory first, Ticketmaster supplemental; then soonest.
  .sort((a:any,b:any)=>(a.date+(a.time||"")).localeCompare(b.date+(b.time||""))||((a.source==="Ticketmaster"?1:0)-(b.source==="Ticketmaster"?1:0)));
 const localCount=events.filter((e:any)=>e.source!=="Ticketmaster").length;
 return NextResponse.json({events:events.slice(0,150),configured:Boolean(process.env.TICKETMASTER_API_KEY),range,startDate:w.startDate,endDate:w.endDate,localCount,ticketmasterCount:events.length-localCount,total:events.length});
}
