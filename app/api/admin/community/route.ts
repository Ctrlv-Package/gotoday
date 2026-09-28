import {NextRequest,NextResponse} from "next/server";
import {pendingEvents,reviewEvent} from "../../../../lib/community";
export const dynamic="force-dynamic";
const authed=(req:NextRequest)=>{const s=process.env.INGESTION_SECRET;return!!s&&req.headers.get("authorization")===`Bearer ${s}`};
// Public events the automatic check wasn't sure about wait here for approval.
export async function GET(req:NextRequest){
 if(!authed(req))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 return NextResponse.json({ok:true,pending:(await pendingEvents()).map(({eventId,...e})=>({...e,shareUrl:`${req.nextUrl.origin}/e/${e.shareToken}`}))});
}
export async function POST(req:NextRequest){
 if(!authed(req))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const b=await req.json().catch(()=>({}));
 const ok=await reviewEvent(Number(b.id),b.approve===true,req.nextUrl.origin);
 return NextResponse.json({ok},{status:ok?200:404});
}
