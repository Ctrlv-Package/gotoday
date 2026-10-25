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
 // Listings of events this person created (every date): already in their GoToday calendar.
 const mine=(await db.query(`select e.id from community_events c join events e on (e.external_id='community-'||c.id or e.external_id like 'community-'||c.id||'-%')
   where c.user_id=$1 and c.status in ('live','pending') and e.status='active'`,[u.id]).catch(()=>({rows:[]}))).rows.map((r:any)=>`db-${r.id}`);
 const following=(await db.query("select series_id from follows where user_id=$1",[u.id])).rows.map((r:any)=>r.series_id);
 // Guest replies the host hasn't looked at yet (a dot on their avatar).
 const newReplies=(await db.query("select count(*)::int as n from rsvps r join community_events c on c.id=r.community_event_id where c.user_id=$1 and c.status<>'deleted' and r.created_at>coalesce(c.rsvp_seen_at,'epoch')",[u.id]).catch(()=>({rows:[{n:0}]}))).rows[0]?.n||0;
 return NextResponse.json({signedIn:true,name:u.name,email:u.email,image:u.image,saved,following,mine,newReplies,calConnected:await calendarConnected(u.id)},{headers:{"cache-control":"no-store"}});
}
