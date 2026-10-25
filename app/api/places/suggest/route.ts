import {NextResponse} from "next/server";
import {db} from "../../../../lib/db";
import {rankPlaceSuggestions} from "../../../../lib/places";
export const dynamic="force-dynamic";
// Suggest real places as the user types a place name in the create form. The candidates come
// from GoToday's own venues table (public listings only: private events never reach it), so
// there is no external API, no key and no cost. A place the site has never seen is still typed
// freehand; suggestions never block typing.
export async function GET(req:Request){
 const p=new URL(req.url).searchParams,q=(p.get("q")||"").trim().slice(0,80),city=(p.get("city")||"").trim().slice(0,80);
 if(q.length<2)return NextResponse.json({ok:true,suggestions:[]});
 const esc=q.replace(/[\\%_]/g,m=>"\\"+m),pat=`%${esc}%`;
 const r=await db.query(`select name,address,city from venues where name<>'' and (name ilike $1 or address ilike $1) limit 50`,[pat]).catch(()=>({rows:[]}));
 const rows=(r.rows||[]).map((x:any)=>({name:String(x.name||""),address:String(x.address||""),city:String(x.city||"")}));
 return NextResponse.json({ok:true,suggestions:rankPlaceSuggestions(q,city,rows)});
}
