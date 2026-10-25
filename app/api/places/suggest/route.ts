import {NextResponse} from "next/server";
import {db} from "../../../../lib/db";
import {rankPlaceSuggestions,photonSuggestion,filterOutsideSuggestions,photonQuery,mergeSuggestions,withinRadiusKm,nearbyRank,tomtomSuggestion,mapboxSuggestion,NEARBY_RADIUS_KM,type PlaceSuggestion} from "../../../../lib/places";
export const dynamic="force-dynamic";
// Suggest real places as the user types a place name in the create form, from every
// source the site can reach for free:
//  1. GoToday's own venues table (public listings only: private events never reach it).
//  2. Photon (OpenStreetMap, free, no key) when the site's own list runs short — that's
//     what finds a real business the site has never listed. Photon answers globally, so
//     its results are filtered to the form's town when one is given (50 candidates
//     fetched, so the town's own places can't be cut off before filtering) and results
//     that are neither a street nor a town are dropped.
//  3. TomTom Search and Mapbox Geocoding (free tiers, keys in Vercel only, never in the
//     browser) when the free sources leave a thin bench: in nearby mode when fewer than
//     3 results are actually near the user, otherwise when the combined list is short.
//     Each is fetched in parallel with a 3 s timeout and fails open, and an absent key
//     skips that source silently — so the list works with any subset of sources.
// Merging: first source wins on duplicates (same name in the same town). Ranking: in
// nearby mode ("Use my location") the combined list is distance-ranked and only results
// within NEARBY_RADIUS_KM survive — strict, no fallback: when nothing qualifies the list
// is empty and the form says so, because a far result must never pose as a nearby one.
// Without coordinates the order is locals first, then outside sources in Photon, TomTom,
// Mapbox order. Typing a place name sends that name to Photon and, when the bench is
// thin, to TomTom/Mapbox; coordinates ride along with the search only and are never
// saved to the event or anywhere else.
export async function GET(req:Request){
 const p=new URL(req.url).searchParams,q=(p.get("q")||"").trim().slice(0,80),city=(p.get("city")||"").trim().slice(0,80);
 const laN=Number(p.get("lat")),loN=Number(p.get("lon"));
 const coords=p.get("lat")!=null&&p.get("lon")!=null&&Number.isFinite(laN)&&Math.abs(laN)<=90&&Number.isFinite(loN)&&Math.abs(loN)<=180?{lat:laN,lon:loN}:null;
 if(q.length<2)return NextResponse.json({ok:true,suggestions:[]});
 const esc=(s:string)=>s.replace(/[\\%_]/g,m=>"\\"+m);
 const words=q.split(/\s+/).filter(Boolean).slice(0,5);
 const conds=words.map((_,i)=>`(name||' '||coalesce(address,'')||' '||coalesce(city,'')) ilike $${i+1}`).join(" and ");
 const r=await db.query(`select name,address,city,latitude,longitude from venues where name<>'' and ${conds} limit 50`,words.map(w=>`%${esc(w)}%`)).catch(()=>({rows:[]}));
 const rows=(r.rows||[]).map((x:any)=>({name:String(x.name||""),address:String(x.address||""),city:String(x.city||""),lat:x.latitude!=null?Number(x.latitude):null,lon:x.longitude!=null?Number(x.longitude):null}));
 const local=rankPlaceSuggestions(q,city,rows,coords?50:8);
 let photonList:PlaceSuggestion[]=[];
 if(coords||local.length<8){
  try{
   const pq=coords?q:photonQuery(q,city);
   const res=await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(pq)}&limit=50&lang=en${coords?`&lat=${coords.lat}&lon=${coords.lon}`:""}`,{signal:AbortSignal.timeout(3000)});
   const d=await res.json().catch(()=>({}));
   const mapped:PlaceSuggestion[]=[];
   for(const f of Array.isArray(d.features)?d.features:[]){const s=photonSuggestion(f);if(s)mapped.push(s)}
   photonList=filterOutsideSuggestions(mapped,coords?"":city);
  }catch{}
 }
 let combined=mergeSuggestions([local,photonList]);
 const tomKey=process.env.TOMTOM_API_KEY||"",mbKey=process.env.MAPBOX_ACCESS_TOKEN||"";
 const needKeyed=coords?withinRadiusKm(combined,coords.lat,coords.lon,NEARBY_RADIUS_KM).length<3:combined.length<8;
 if(needKeyed&&(tomKey||mbKey)){
  const keyedQuery=coords?q:photonQuery(q,city);
  const jobs:Promise<PlaceSuggestion[]>[]=[];
  if(tomKey)jobs.push((async()=>{
   try{
    const res=await fetch(`https://api.tomtom.com/search/2/search/${encodeURIComponent(keyedQuery)}.json?key=${encodeURIComponent(tomKey)}&idxSet=POI&limit=20&language=en-US${coords?`&lat=${coords.lat}&lon=${coords.lon}`:""}`,{signal:AbortSignal.timeout(3000)});
    const d=await res.json().catch(()=>({}));
    const out:PlaceSuggestion[]=[];
    for(const r of Array.isArray(d.results)?d.results:[]){const s=tomtomSuggestion(r);if(s)out.push(s)}
    return out;
   }catch{return []}
  })());
  if(mbKey)jobs.push((async()=>{
   try{
    const mq=keyedQuery.replace(/;/g," ");
    const res=await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(mq)}.json?access_token=${encodeURIComponent(mbKey)}&autocomplete=true&types=poi&limit=10&language=en${coords?`&proximity=${coords.lon},${coords.lat}`:""}`,{signal:AbortSignal.timeout(3000)});
    const d=await res.json().catch(()=>({}));
    const out:PlaceSuggestion[]=[];
    for(const f of Array.isArray(d.features)?d.features:[]){const s=mapboxSuggestion(f);if(s)out.push(s)}
    return out;
   }catch{return []}
  })());
  const parts=await Promise.all(jobs);
  combined=mergeSuggestions([combined,...parts]);
 }
 let out:PlaceSuggestion[];
 if(coords){
  out=nearbyRank(combined,coords.lat,coords.lon).slice(0,8);
 }else{
  out=combined.slice(0,8);
 }
 return NextResponse.json({ok:true,suggestions:out.map(({name,address,city})=>({name,address,city}))});
}
