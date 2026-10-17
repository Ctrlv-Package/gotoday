import {NextResponse} from "next/server";
import {currentUser,calendarToken} from "../../../../lib/auth";
export const dynamic="force-dynamic";
// POST: replace the private calendar link (if it was shared by mistake). The old link stops working.
export async function POST(){
 const u=await currentUser();if(!u)return NextResponse.json({ok:false},{status:401});
 const t=await calendarToken(u,true);
 return NextResponse.json({ok:true,token:t});
}
