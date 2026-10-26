import {NextRequest,NextResponse} from "next/server";
import {emailSignin,safeNext} from "../../../../../lib/auth";
export const dynamic="force-dynamic";
// POST /api/auth/email/signin (email, password) -> the page to return to, or back to sign-in with a message.
export async function POST(req:NextRequest){
 const origin=req.nextUrl.origin,f=await req.formData().catch(()=>null);
 const next=safeNext(f?.get("next")?.toString()||"/me");
 const out=await emailSignin(origin,f?.get("email")?.toString()||"",f?.get("password")?.toString()||"").catch(()=>({error:"Something went wrong signing in. Please try again."}));
 if("resent" in out)return NextResponse.redirect(new URL(`/signin?notice=${encodeURIComponent("Your email isn't verified yet — we just sent a fresh link. It works for 24 hours.")}&next=${encodeURIComponent(next)}`,origin));
 if("error" in out)return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(out.error)}&next=${encodeURIComponent(next)}`,origin));
 const to=new URL(next,origin);to.searchParams.set("signedin","1");
 return NextResponse.redirect(to);
}
