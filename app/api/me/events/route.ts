import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "../../../../lib/auth";
import {claimEvents} from "../../../../lib/community";
export const dynamic="force-dynamic";
// POST {manageUrls:[…]}: events created on this device before signing in join the account.
export async function POST(req:NextRequest){
 const u=await currentUser();if(!u)return NextResponse.json({ok:false},{status:401});
 const b=await req.json().catch(()=>({}));
 const tokens=(Array.isArray(b.manageUrls)?b.manageUrls:[]).map((x:any)=>String(x).match(/\/manage\/([A-Za-z0-9_-]+)/)?.[1]).filter(Boolean) as string[];
 return NextResponse.json({ok:true,claimed:await claimEvents(u.id,tokens)});
}
