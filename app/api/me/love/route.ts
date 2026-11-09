import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "../../../../lib/auth";
import {db} from "../../../../lib/db";
import {parseId} from "../../../../lib/event-detail";
import {seriesOf} from "../../../../lib/series";
import {loveStatsFor} from "../../../../lib/love";
export const dynamic="force-dynamic";
// POST {id:"db-123",on:true|false}: say you went and it was great (or take it back).
// Sign-in only — no save needed. One row per user per event family: tapping a new occurrence
// of a yearly event moves your love to it instead of stacking a second one.
export async function POST(req:NextRequest){
 const u=await currentUser();if(!u)return NextResponse.json({ok:false,error:"Sign in to say you loved it"},{status:401});
 const b=await req.json().catch(()=>({}));
 const n=parseId(String(b.id||""));
 if(!n)return NextResponse.json({ok:false,error:"No event"},{status:400});
 const ev=(await db.query("select local_date from events where id=$1",[n])).rows[0];
 if(!ev)return NextResponse.json({ok:false,error:"No event"},{status:400});
 const series=await seriesOf(n).catch(()=>null);
 const year=ev.local_date instanceof Date?ev.local_date.getUTCFullYear():Number(String(ev.local_date||"").slice(0,4))||new Date().getFullYear();
 if(b.on===false){
  if(series)await db.query("delete from event_love where user_id=$1 and series_id=$2",[u.id,series]);
  else await db.query("delete from event_love where user_id=$1 and event_id=$2",[u.id,n]);
 }else{
  if(series)await db.query("delete from event_love where user_id=$1 and series_id=$2",[u.id,series]);
  await db.query("insert into event_love(user_id,event_id,series_id,loved_year) values($1,$2,$3,$4) on conflict(user_id,event_id) do nothing",[u.id,n,series,year]);
 }
 // Fresh counts for this event's family, so the button and the tag update together.
 const rows=(await db.query("select event_id,series_id,loved_year,count(*)::int as n from event_love where event_id=$1 or series_id=$2 group by event_id,series_id,loved_year",[n,series]).catch(()=>({rows:[]}))).rows;
 const s=loveStatsFor(rows.map((r:any)=>({event_id:r.event_id==null?null:Number(r.event_id),series_id:r.series_id==null?null:Number(r.series_id),loved_year:Number(r.loved_year),n:Number(r.n)})),{ids:[n],seriesIds:series?[series]:[],year});
 return NextResponse.json({ok:true,loved:b.on!==false,...s});
}
