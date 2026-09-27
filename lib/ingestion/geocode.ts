import {db} from "../db";
import type { EventRecord } from "./types";
const ENDPOINT="https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const cache=new Map<string,{latitude:number;longitude:number}|null>();
function addressFor(e:EventRecord){const v=(e.address||"").trim();if(v)return v;const venue=(e.venue||"").trim(),city=(e.city||"").trim();if(!venue||/^(city of|broward county|greater fort lauderdale)/i.test(venue))return"";return [venue,city].filter(Boolean).join(", ")}
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
  const hit=await db.query("select latitude,longitude from places where key=$1",[key]);
  if(hit.rowCount)return hit.rows[0].latitude==null?null:{latitude:Number(hit.rows[0].latitude),longitude:Number(hit.rows[0].longitude)};
 }catch{}
 const m=key.match(/^(.+?),\s*([a-z]{2})$/i);
 let coords:{latitude:number;longitude:number}|null=null;
 if(m&&US_STATES[m[2].toUpperCase()]){
  try{
   const r=await fetch(`https://api.zippopotam.us/us/${US_STATES[m[2].toUpperCase()]}/${encodeURIComponent(m[1])}`,{signal:AbortSignal.timeout(10000)});
   if(r.ok){const d:any=await r.json(),pl:any[]=d?.places||[];
    const pts=pl.map(x=>[Number(x.latitude),Number(x.longitude)]).filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b));
    if(pts.length)coords={latitude:pts.reduce((s,x)=>s+x[0],0)/pts.length,longitude:pts.reduce((s,x)=>s+x[1],0)/pts.length};}
  }catch{}
 }
 try{await db.query("insert into places(key,latitude,longitude) values($1,$2,$3) on conflict(key) do update set latitude=excluded.latitude,longitude=excluded.longitude,updated_at=now()",[key,coords?.latitude??null,coords?.longitude??null])}catch{}
 return coords;
}
