import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "../../../../lib/auth";
import {db} from "../../../../lib/db";
import {parseId} from "../../../../lib/event-detail";
export const dynamic="force-dynamic";
// POST {id:"db-123",on:true|false} saves/unsaves one event; {merge:["db-1",…]} adds a guest's saved events after sign-in.
export async function POST(req:NextRequest){
 const u=await currentUser();if(!u)return NextResponse.json({ok:false,error:"Sign in to save across devices"},{status:401});
 const b=await req.json().catch(()=>({}));
 const ids=(Array.isArray(b.merge)?b.merge:[b.id]).map((x:any)=>parseId(String(x||""))).filter((n:any):n is number=>!!n).slice(0,500);
 if(!ids.length)return NextResponse.json({ok:false,error:"No event"},{status:400});
 if(b.on===false&&!b.merge)await db.query("delete from saved_events where user_id=$1 and event_id=$2",[u.id,ids[0]]);
 else await db.query("insert into saved_events(user_id,event_id) select $1,x from unnest($2::int[]) x where exists(select 1 from events where id=x) on conflict do nothing",[u.id,ids]);
 return NextResponse.json({ok:true});
}
