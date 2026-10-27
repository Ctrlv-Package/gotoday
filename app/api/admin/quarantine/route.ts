import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../lib/db";
import {QUARANTINE_LABELS} from "../../../../lib/ingestion/quarantine";
import {hasFamilySignal} from "../../../../lib/quality/signals";
import {discoveryRejection} from "../../../../lib/ingestion/utils";
export const dynamic="force-dynamic";
const authed=(req:NextRequest)=>{const s=process.env.INGESTION_SECRET;return!!s&&req.headers.get("authorization")===`Bearer ${s}`};
// Listings the quality gate held (status='quarantine'), plus live listings carrying a flag.
// Approving a held row publishes it; rejecting deletes it (the next ingest re-quarantines it
// if the flag is still there, so a rejection can never silently re-publish).
const shape=(r:any)=>({id:r.id,title:r.title,city:r.city,venue:r.venue,date:r.local_date,source:r.source,
 reasons:String(r.quarantine_reason||"").split(",").filter(Boolean).map(c=>QUARANTINE_LABELS[c]||c)});
export async function GET(req:NextRequest){
 if(!authed(req))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 // Events carry venue_id, not a venue column — the name comes from the venues table. Selecting e.venue
 // errors on every call, which left the admin page stuck on "Loading…" with no error shown.
 const held=await db.query(`select e.id,e.title,e.city,v.name as venue,e.local_date,e.quarantine_reason,s.name as source from events e left join sources s on s.id=e.source_id left join venues v on v.id=e.venue_id where e.status='quarantine' order by e.local_date asc limit 200`);
 const flagged=await db.query(`select e.id,e.title,e.city,v.name as venue,e.local_date,e.quarantine_reason,s.name as source from events e left join sources s on s.id=e.source_id left join venues v on v.id=e.venue_id where e.status='active' and e.quarantine_reason is not null order by e.local_date asc limit 200`);
 return NextResponse.json({ok:true,held:held.rows.map(shape),flagged:flagged.rows.map(shape)});
}
export async function POST(req:NextRequest){
 if(!authed(req))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const b=await req.json().catch(()=>({}));
 // Re-apply today's rules to everything held or flagged: post text and meetings are removed, a borrowed picture comes
 // off, a Family/Kids label with no signal comes off — then the row publishes with its note cleared.
 if(b.reapply){
  const {rows}=await db.query(`select e.id,e.title,e.description,e.tags,e.age_min,e.age_max,e.category,e.quarantine_reason,s.name as source,v.name as venue from events e left join sources s on s.id=e.source_id left join venues v on v.id=e.venue_id where e.quarantine_reason is not null and e.status in ('active','quarantine')`);
  const out={removed:0,pictures:0,familyCleared:0,familyKept:0};
  for(const r of rows){
   if(discoveryRejection({title:r.title,desc:r.description,tags:r.tags||[],source:r.source} as any)){await db.query("delete from events where id=$1",[r.id]);out.removed++;continue}
   const why=String(r.quarantine_reason||"");
   if(why.includes("borrowed-image")){await db.query("update events set image_url=null where id=$1",[r.id]);out.pictures++}
   if(why.includes("family-no-signal")){
    if(hasFamilySignal(r.title,r.description,r.tags||[],r.venue,{ageMin:r.age_min,ageMax:r.age_max}))out.familyKept++;
    else{const allAges=r.age_min!=null&&r.age_max!=null&&r.age_min<=2&&r.age_max>=18;
     await db.query(`update events set tags=array(select t from unnest(tags) t where lower(btrim(t)) not in ('family','families','kids','children','all ages','everyone','youth','family friendly')),
      category=case when category='Family' then 'Local' else category end,is_family_friendly=false,is_kids_activity=false${allAges?",age_min=null,age_max=null":""} where id=$1`,[r.id]);out.familyCleared++}
   }
   await db.query("update events set status='active',quarantine_reason=null where id=$1",[r.id]);
  }
  return NextResponse.json({ok:true,...out});
 }
 if(b.approveAll){await db.query(`update events set status='active',quarantine_reason=null where status='quarantine'`);return NextResponse.json({ok:true})}
 // Live rows only: a flag on a published listing is a note, not a hold, and clearing it in bulk
 // is the only sane way through a flood. Held rows still need Approve/Reject one by one.
 if(b.clearAllFlags){await db.query(`update events set quarantine_reason=null where status='active' and quarantine_reason is not null`);return NextResponse.json({ok:true})}
 const id=Number(b.id);if(!id)return NextResponse.json({ok:false},{status:400});
 if(b.approve===true)await db.query(`update events set status='active',quarantine_reason=null where id=$1`,[id]);
 else await db.query(`delete from events where id=$1`,[id]);
 return NextResponse.json({ok:true});
}
