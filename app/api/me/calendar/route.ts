import {NextRequest,NextResponse} from "next/server";
import {currentUser,calendarToken} from "../../../../lib/auth";
import {db} from "../../../../lib/db";
export const dynamic="force-dynamic";
// GET: is a calendar app reading this person's GoToday calendar yet? (Shown as "Connected to Google Calendar".)
export async function GET(){
 const u=await currentUser();if(!u)return NextResponse.json({ok:false},{status:401});
 const r=(await db.query("select cal_clicked_at,cal_clicked,cal_fetched_at,cal_client from users where id=$1",[u.id])).rows[0]||{};
 return NextResponse.json({ok:true,clickedAt:r.cal_clicked_at,clicked:r.cal_clicked,fetchedAt:r.cal_fetched_at,client:r.cal_client},{headers:{"cache-control":"no-store"}});
}
// POST {clicked:"Google Calendar"}: they tapped an "Add to …" button. POST {reset:true}: replace the private link.
export async function POST(req:NextRequest){
 const u=await currentUser();if(!u)return NextResponse.json({ok:false},{status:401});
 const b=await req.json().catch(()=>({}));
 if(b.clicked){await db.query("update users set cal_clicked_at=now(),cal_clicked=$1 where id=$2",[String(b.clicked).slice(0,40),u.id]);return NextResponse.json({ok:true})}
 const t=await calendarToken(u,true);
 await db.query("update users set cal_fetched_at=null,cal_client=null where id=$1",[u.id]);
 return NextResponse.json({ok:true,token:t});
}
