import {NextRequest,NextResponse} from "next/server";
import {vapidKeys,saveSubscription} from "../../../lib/push";
import {currentUser} from "../../../lib/auth";
import {db} from "../../../lib/db";
import {hashToken} from "../../../lib/community";
export const dynamic="force-dynamic";
// GET: the public key the browser needs to subscribe. POST {subscription, manageToken?}: save it for this host.
export async function GET(){return NextResponse.json({ok:true,publicKey:(await vapidKeys()).publicKey})}
export async function POST(req:NextRequest){
 const b=await req.json().catch(()=>null);
 const user=await currentUser().catch(()=>null);
 const t=String(b?.manageToken||"").trim();
 if(!user&&!t)return NextResponse.json({ok:false,error:"Sign in or open your manage link first."},{status:401});
 const ok=await saveSubscription(b?.subscription,{userId:user?.id??null,manageHash:t?hashToken(t):null});
 return NextResponse.json({ok},{status:ok?200:400});
}
// DELETE {endpoint}: stop notifications on that device.
export async function DELETE(req:NextRequest){
 const b=await req.json().catch(()=>null);const ep=String(b?.endpoint||"");
 if(!/^https:\/\//.test(ep))return NextResponse.json({ok:false},{status:400});
 await db.query("delete from push_subs where endpoint=$1",[ep]).catch(()=>{});
 return NextResponse.json({ok:true});
}
