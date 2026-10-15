import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../lib/db";
export const dynamic="force-dynamic";

// GET /api/admin/find?q=pumpkin (Bearer INGESTION_SECRET): where did an event go? Stored events (any status)
// and filtered-out events whose title matches, plus recent Instagram posts whose caption reading mentions it.
export async function GET(req:NextRequest){
 const s=process.env.INGESTION_SECRET;
 if(!s||req.headers.get("authorization")!==`Bearer ${s}`)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const q=`%${(req.nextUrl.searchParams.get("q")||"").trim()}%`;
 if(q.length<5)return NextResponse.json({ok:false,error:"q required"});
 const events=(await db.query(`select e.title,e.local_date::text as date,e.status,e.city,e.latitude,e.longitude,s.name as source,v.name as venue,e.updated_at
   from events e join sources s on s.id=e.source_id left join venues v on v.id=e.venue_id where e.title ilike $1 order by e.local_date desc limit 40`,[q])).rows;
 const rejected=(await db.query(`select r.raw_title as title,r.rejection_reason,s.name as source,r.raw_data->>'date' as date from rejected_events r join sources s on s.id=r.source_id
   where r.raw_title ilike $1 order by r.id desc limit 20`,[q]).catch(()=>({rows:[]}))).rows;
 const posts=(await db.query(`select permalink,posted_at,extracted from social_posts where extracted::text ilike $1 order by posted_at desc limit 10`,[q]).catch(()=>({rows:[]}))).rows;
 // &tm=1: what Ticketmaster itself lists for this keyword (to tell "not on Ticketmaster" from "we dropped it").
 let ticketmaster:any[]|undefined;
 if(req.nextUrl.searchParams.get("tm")&&process.env.TICKETMASTER_API_KEY){
  const u=new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  u.searchParams.set("apikey",process.env.TICKETMASTER_API_KEY);u.searchParams.set("keyword",q.slice(1,-1));u.searchParams.set("stateCode","FL");u.searchParams.set("size","30");
  const d:any=await fetch(u.toString(),{cache:"no-store"}).then(r=>r.json()).catch(()=>({}));
  ticketmaster=(d?._embedded?.events||[]).map((e:any)=>({title:e.name,date:e.dates?.start?.localDate,status:e.dates?.status?.code,segment:e.classifications?.[0]?.segment?.name,venue:e._embedded?.venues?.[0]?.name,city:e._embedded?.venues?.[0]?.city?.name,markets:(e._embedded?.venues?.[0]?.markets||[]).map((m:any)=>m.id).join(",")}));
 }
 return NextResponse.json({ok:true,events,rejected,posts,ticketmaster});
}
