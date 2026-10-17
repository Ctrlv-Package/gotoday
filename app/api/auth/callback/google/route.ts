import {NextRequest,NextResponse} from "next/server";
import {googleFinish} from "../../../../../lib/auth";
export const dynamic="force-dynamic";
// Google sends the person back here after they pick their account.
export async function GET(req:NextRequest){
 const origin=req.nextUrl.origin,p=req.nextUrl.searchParams;
 if(p.get("error"))return NextResponse.redirect(new URL("/signin?error=Sign-in%20was%20cancelled",origin));
 const out=await googleFinish(origin,p.get("code"),p.get("state")).catch(()=>({error:"Something went wrong signing in. Please try again."}));
 if("error" in out)return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(out.error)}`,origin));
 const to=new URL(out.next,origin);to.searchParams.set("signedin","1");
 return NextResponse.redirect(to);
}
