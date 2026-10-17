import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "../../../../lib/auth";
import {db} from "../../../../lib/db";
import {parseId} from "../../../../lib/event-detail";
import {seriesOf} from "../../../../lib/series";
export const dynamic="force-dynamic";
// POST {id:"db-123",on:true|false}: follow/unfollow the event's annual family (every future year's listing).
export async function POST(req:NextRequest){
 const u=await currentUser();if(!u)return NextResponse.json({ok:false,error:"Sign in to follow events"},{status:401});
 const b=await req.json().catch(()=>({}));
 // Unfollow straight from My GoToday's list, by family.
 if(b.series&&b.on===false){await db.query("delete from follows where user_id=$1 and series_id=$2",[u.id,Number(b.series)]);return NextResponse.json({ok:true,series:Number(b.series)})}
 const n=parseId(String(b.id||""));
 if(!n)return NextResponse.json({ok:false,error:"No event"},{status:400});
 const s=await seriesOf(n);if(!s)return NextResponse.json({ok:false,error:"This event can't be followed"},{status:400});
 if(b.on===false)await db.query("delete from follows where user_id=$1 and series_id=$2",[u.id,s]);
 else{
  await db.query("insert into follows(user_id,series_id) values($1,$2) on conflict do nothing",[u.id,s]);
  // Following includes this year's date: save it too, so it's in their list and calendar.
  await db.query("insert into saved_events(user_id,event_id) values($1,$2) on conflict do nothing",[u.id,n]);
 }
 return NextResponse.json({ok:true,series:s});
}
