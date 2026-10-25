import {NextResponse} from "next/server";
import {db} from "../../../../lib/db";
import {rankPlaceSuggestions,photonSuggestion} from "../../../../lib/places";
export const dynamic="force-dynamic";
// Suggest real places as the user types a place name in the create form.
// First GoToday's own venues table (public listings only: private events never reach it).
// Then, when the site's own list runs short, Photon (OpenStreetMap, free, no key) fills the
// rest — that's what finds a real business the site has never listed, like a trampoline park
// in the user's town. Photon is a best-effort extra: if it fails or is slow, the site's own
// places still answer. Typing a place name sends that name to Photon; nothing personal.
export async function GET(req:Request){
 const p=new URL(req.url).searchParams,q=(p.get("q")||"").trim().slice(0,80),city=(p.get("city")||"").trim().slice(0,80);
 if(q.length<2)return NextResponse.json({ok:true,suggestions:[]});
 const esc=(s:string)=>s.replace(/[\\%_]/g,m=>"\\"+m);
 const words=q.split(/\s+/).filter(Boolean).slice(0,5);
 const conds=words.map((_,i)=>`(name||' '||coalesce(address,'')||' '||coalesce(city,'')) ilike $${i+1}`).join(" and ");
 const r=await db.query(`select name,address,city from venues where name<>'' and ${conds} limit 50`,words.map(w=>`%${esc(w)}%`)).catch(()=>({rows:[]}));
 const rows=(r.rows||[]).map((x:any)=>({name:String(x.name||""),address:String(x.address||""),city:String(x.city||"")}));
 const out=rankPlaceSuggestions(q,city,rows);
 if(out.length<8){
  try{
   const res=await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en`,{signal:AbortSignal.timeout(3000)});
   const d=await res.json().catch(()=>({}));
   const seen=new Set(out.map(o=>`${o.name.toLowerCase()}|${o.city.toLowerCase()}`));
   for(const f of Array.isArray(d.features)?d.features:[]){
    const s=photonSuggestion(f);if(!s)continue;
    const k=`${s.name.toLowerCase()}|${s.city.toLowerCase()}`;if(seen.has(k))continue;seen.add(k);out.push(s);
    if(out.length>=8)break;
   }
  }catch{}
 }
 return NextResponse.json({ok:true,suggestions:out});
}
