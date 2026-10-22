import {NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {db} from "../../../lib/db";
import {calendarConnected} from "../../../lib/me";
export const dynamic="force-dynamic";
// Who's signed in (if anyone) and what they've saved/followed, for the Save and Follow buttons.
export async function GET(){
 const u=await currentUser();
 if(!u)return NextResponse.json({signedIn:false},{headers:{"cache-control":"no-store"}});
 const saved=(await db.query("select event_id from saved_events where user_id=$1",[u.id])).rows.map((r:any)=>`db-${r.event_id}`);
 const following=(await db.query("select series_id from follows where user_id=$1",[u.id])).rows.map((r:any)=>r.series_id);
 return NextResponse.json({signedIn:true,name:u.name,email:u.email,image:u.image,saved,following,calConnected:await calendarConnected(u.id)},{headers:{"cache-control":"no-store"}});
}
