import {db} from "../db";
import type { EventRecord } from "./types";
const ENDPOINT="https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const cache=new Map<string,{latitude:number;longitude:number}|null>();
function addressFor(e:EventRecord){const v=(e.address||"").trim();if(v)return v;const venue=(e.venue||"").trim(),city=(e.city||"").trim();if(!venue||/^((city|town|village) of|broward county|greater fort lauderdale)/i.test(venue))return"";return [venue,city].filter(Boolean).join(", ")}
export async function geocodeEvent(e:EventRecord):Promise<EventRecord>{if(Number.isFinite(e.latitude)&&Number.isFinite(e.longitude))return e;const q=addressFor(e);if(!q)return e;if(cache.has(q)){const hit=cache.get(q);return hit?{...e,...hit}:e}try{const u=new URL(ENDPOINT);u.searchParams.set("address",q);u.searchParams.set("benchmark","Public_AR_Current");u.searchParams.set("format","json");const r=await fetch(u.toString(),{next:{revalidate:86400}});if(!r.ok){cache.set(q,null);return e}const d=await r.json(),m=d?.result?.addressMatches?.[0],x=Number(m?.coordinates?.x),y=Number(m?.coordinates?.y);if(!Number.isFinite(x)||!Number.isFinite(y)){cache.set(q,null);return e}const p={latitude:y,longitude:x};cache.set(q,p);return{...e,...p,address:e.address||m?.matchedAddress||undefined}}catch{cache.set(q,null);return e}}
export async function geocodeEvents(events:EventRecord[]){const out:EventRecord[]=[];for(let i=0;i<events.length;i+=8){const batch=events.slice(i,i+8);out.push(...await Promise.all(batch.map(geocodeEvent)))}return out}
export function distanceMiles(a:number,b:number,c:number,d:number){const R=3958.8,q=(x:number)=>x*Math.PI/180,dp=q(c-a),dl=q(d-b),z=Math.sin(dp/2)**2+Math.cos(q(a))*Math.cos(q(c))*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(z))}

// ---------- City centroids ----------
// "Weston, FL" -> the average of Weston's ZIP code centers (zippopotam.us, free, US-wide).
// Cached in memory and in the `places` table so each city is looked up once.
const US_STATES:Record<string,string>={AL:"al",AK:"ak",AZ:"az",AR:"ar",CA:"ca",CO:"co",CT:"ct",DE:"de",DC:"dc",FL:"fl",GA:"ga",HI:"hi",ID:"id",IL:"il",IN:"in",IA:"ia",KS:"ks",KY:"ky",LA:"la",ME:"me",MD:"md",MA:"ma",MI:"mi",MN:"mn",MS:"ms",MO:"mo",MT:"mt",NE:"ne",NV:"nv",NH:"nh",NJ:"nj",NM:"nm",NY:"ny",NC:"nc",ND:"nd",OH:"oh",OK:"ok",OR:"or",PA:"pa",RI:"ri",SC:"sc",SD:"sd",TN:"tn",TX:"tx",UT:"ut",VT:"vt",VA:"va",WA:"wa",WV:"wv",WI:"wi",WY:"wy"};
const cityCache=new Map<string,Promise<{latitude:number;longitude:number}|null>>();
export function cityCoords(city:string){
 const key=city.replace(/\s+/g," ").trim().toLowerCase();
 if(!key)return Promise.resolve(null);
 let p=cityCache.get(key);
 if(!p){p=lookupCity(key);cityCache.set(key,p)}
 return p;
}
async function lookupCity(key:string){
 try{
  const hit=await db.query("select latitude,longitude,updated_at from places where key=$1",[key]);
  // A failed lookup is retried after a week (the town may be known by then, or the service was down).
  if(hit.rowCount&&!(hit.rows[0].latitude==null&&Date.now()-new Date(hit.rows[0].updated_at).getTime()>7*864e5))return hit.rows[0].latitude==null?null:{latitude:Number(hit.rows[0].latitude),longitude:Number(hit.rows[0].longitude)};
 }catch{}
 const coords=await townCenter(key);
 try{await db.query("insert into places(key,latitude,longitude) values($1,$2,$3) on conflict(key) do update set latitude=excluded.latitude,longitude=excluded.longitude,updated_at=now()",[key,coords?.latitude??null,coords?.longitude??null])}catch{}
 return coords;
}

// OpenStreetMap allows about one request a second: space them out across the whole process.
let osmQueue:Promise<unknown>=Promise.resolve();
function osm(params:Record<string,string>):Promise<any[]>{
 const run=osmQueue.then(async()=>{
  const u=new URL("https://nominatim.openstreetmap.org/search");
  for(const [k,v] of Object.entries({format:"json",countrycodes:"us",...params}))u.searchParams.set(k,v);
  try{const r=await fetch(u.toString(),{headers:{"user-agent":"GoToday/1.0 (https://www.mygotoday.com)"},signal:AbortSignal.timeout(10000)});return r.ok?await r.json():[]}catch{return[]}
  finally{await new Promise(r=>setTimeout(r,1100))}
 });
 osmQueue=run.catch(()=>{});
 return run as Promise<any[]>;
}
const mi=(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number})=>Math.hypot((a.latitude-b.latitude)*69,(a.longitude-b.longitude)*69*Math.cos(a.latitude*Math.PI/180));

/** A town's own center point (OpenStreetMap's point for the town, near downtown / city hall). The old way, the average
 *  of the town's ZIP codes, lands miles off for towns whose mail area sprawls (Hollywood's ZIPs reach Pembroke Pines). */
export async function townCenter(key:string):Promise<{latitude:number;longitude:number}|null>{
 const m=key.match(/^(.+?),\s*([a-z]{2})$/i);if(!m||!US_STATES[m[2].toUpperCase()])return null;
 // The ZIP-code average is only a rough guide (it sprawls), but it says which of several same-named places is meant:
 // Miramar in Broward, not Miramar Beach in the Panhandle. The town point nearest to it (within 15 miles) wins.
 let zip:{latitude:number;longitude:number}|null=null;
 try{
  const r=await fetch(`https://api.zippopotam.us/us/${US_STATES[m[2].toUpperCase()]}/${encodeURIComponent(m[1])}`,{signal:AbortSignal.timeout(10000)});
  if(r.ok){const j:any=await r.json(),pts=(j?.places||[]).map((x:any)=>[Number(x.latitude),Number(x.longitude)]).filter(([a,b]:number[])=>Number.isFinite(a)&&Number.isFinite(b));
   if(pts.length)zip={latitude:pts.reduce((s:number,x:number[])=>s+x[0],0)/pts.length,longitude:pts.reduce((s:number,x:number[])=>s+x[1],0)/pts.length}}
 }catch{}
 const d=await osm({city:m[1],state:m[2].toUpperCase(),limit:"5"});
 const cands=(d||[]).filter((x:any)=>x?.class==="place"||x?.class==="boundary").map((x:any)=>({latitude:Number(x.lat),longitude:Number(x.lon),name:String(x.display_name||"")}))
  .filter((p:any)=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&p.name.toLowerCase().startsWith(m[1].toLowerCase()));
 if(zip){
  const best=cands.map((p:any)=>({p,d:mi(p,zip!)})).filter((x:any)=>x.d<=15).sort((a:any,b:any)=>a.d-b.d)[0];
  return best?{latitude:best.p.latitude,longitude:best.p.longitude}:zip;
 }
 return cands[0]?{latitude:cands[0].latitude,longitude:cands[0].longitude}:null;
}

/** A named place ("ArtsPark at Young Circle", Hollywood, FL) looked up on OpenStreetMap; kept only if it's in or near
 *  that town (12 miles) and isn't just the town itself. Remembered, so each place is looked up once. */
const lookups={n:0,at:Date.now()};let lookupLimit=40;
export const setLookupLimit=(n:number)=>{lookupLimit=n};
export async function venueCoords(venue:string,city:string):Promise<{latitude:number;longitude:number}|null>{
 const v=String(venue||"").trim(),c=String(city||"").trim();
 if(!v||!c||/^(the\s+)?(town|city|village)\s+of\s/i.test(v)||v.toLowerCase()===c.toLowerCase().replace(/,.*$/,"").trim()||/^\d/.test(v))return null;
 const key=`venue:${v.toLowerCase()}|${c.toLowerCase()}`;
 try{const hit=await db.query("select latitude,longitude,updated_at from places where key=$1",[key]);
  if(hit.rowCount&&!(hit.rows[0].latitude==null&&Date.now()-new Date(hit.rows[0].updated_at).getTime()>30*864e5))return hit.rows[0].latitude==null?null:{latitude:Number(hit.rows[0].latitude),longitude:Number(hit.rows[0].longitude)};
 }catch{}
 // At most 40 new look-ups per 5 minutes per server, so an update run never stalls; the rest wait for the next run.
 if(Date.now()-lookups.at>300e3){lookups.at=Date.now();lookups.n=0}
 if(lookups.n>=lookupLimit)return null;lookups.n++;
 const center=await cityCoords(c);
 const d=await osm({q:`${v}, ${c}`,limit:"3",addressdetails:"0"});
 let found:{latitude:number;longitude:number}|null=null;
 for(const x of d||[]){
  if(x?.class==="boundary"||x?.class==="place"&&/^(city|town|village|hamlet|suburb|county|state)$/.test(x?.type))continue;
  const p={latitude:Number(x.lat),longitude:Number(x.lon)};if(!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude))continue;
  if(center&&mi(p,center)>12)continue;
  found=p;break;
 }
 try{await db.query("insert into places(key,latitude,longitude) values($1,$2,$3) on conflict(key) do update set latitude=excluded.latitude,longitude=excluded.longitude,updated_at=now()",[key,found?.latitude??null,found?.longitude??null])}catch{}
 return found;
}
