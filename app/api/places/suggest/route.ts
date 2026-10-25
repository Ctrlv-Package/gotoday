import {NextResponse} from "next/server";
import {db} from "../../../../lib/db";
import {rankPlaceSuggestions,photonSuggestion,filterOutsideSuggestions,photonQuery,distanceRank,type PlaceSuggestion} from "../../../../lib/places";
export const dynamic="force-dynamic";
// Suggest real places as the user types a place name in the create form.
// First GoToday's own venues table (public listings only: private events never reach it).
// Then, when the site's own list runs short, Photon (OpenStreetMap, free, no key) fills the
// rest — that's what finds a real business the site has never listed, like a trampoline park
// in the user's town. Photon answers globally, so its results are filtered to the form's
// town when one is given (50 candidates fetched, so the town's own places can't be cut off
// before filtering) and results that are neither a street nor a town are dropped. Photon is
// a best-effort extra: if it fails or is slow, the site's own places still answer. Typing a
// place name sends that name to Photon; nothing personal.
// "Use my location" (lat/lon from the form) switches to nearby mode: Photon gets the
// coordinates for distance bias, the town filter is skipped (the live coordinates are
// fresher than a possibly-stale City field), and the combined list — the site's venues
// and Photon's results together — is ranked by distance, so a far-away venue the site
// already knows can no longer outrank a near one it doesn't. The coordinates ride along
// with this one search only: they are never saved to the event or anywhere else.
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
 if(coords||local.length<8){
  try{
   const pq=coords?q:photonQuery(q,city);
   const res=await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(pq)}&limit=50&lang=en${coords?`&lat=${coords.lat}&lon=${coords.lon}`:""}`,{signal:AbortSignal.timeout(3000)});
   const d=await res.json().catch(()=>({}));
   const mapped:PlaceSuggestion[]=[];
   for(const f of Array.isArray(d.features)?d.features:[]){const s=photonSuggestion(f);if(s)mapped.push(s)}
   const seen=new Set(local.map(o=>`${o.name.toLowerCase()}|${o.city.toLowerCase()}`));
   for(const s of filterOutsideSuggestions(mapped,coords?"":city)){
    const k=`${s.name.toLowerCase()}|${s.city.toLowerCase()}`;if(seen.has(k))continue;seen.add(k);local.push(s);
   }
  }catch{}
 }
 const out=coords?distanceRank(local,coords.lat,coords.lon).slice(0,8):local.slice(0,8);
 return NextResponse.json({ok:true,suggestions:out.map(({name,address,city})=>({name,address,city}))});
}
