import {NextRequest,NextResponse} from "next/server";
import {emailSignup,safeNext} from "../../../../../lib/auth";
export const dynamic="force-dynamic";
// POST /api/auth/email/signup (email, password, name?) -> verification email; nothing signs in yet.
export async function POST(req:NextRequest){
 const origin=req.nextUrl.origin,f=await req.formData().catch(()=>null);
 const next=safeNext(f?.get("next")?.toString()||"/me");
 const out=await emailSignup(origin,f?.get("email")?.toString()||"",f?.get("password")?.toString()||"",f?.get("name")?.toString()||null).catch(()=>({error:"Something went wrong creating your account. Please try again."}));
 if("error" in out)return NextResponse.redirect(new URL(`/signin?mode=signup&error=${encodeURIComponent(out.error)}&next=${encodeURIComponent(next)}`,origin));
 return NextResponse.redirect(new URL(`/signin?notice=${encodeURIComponent("Check your inbox for the verification link — it works for 24 hours.")}&next=${encodeURIComponent(next)}`,origin));
}
