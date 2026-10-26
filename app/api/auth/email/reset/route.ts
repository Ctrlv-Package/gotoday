import {NextRequest,NextResponse} from "next/server";
import {emailReset,safeNext} from "../../../../../lib/auth";
export const dynamic="force-dynamic";
// POST /api/auth/email/reset (token, password, confirm) -> the page to return to, signed in with the new password.
export async function POST(req:NextRequest){
 const origin=req.nextUrl.origin,f=await req.formData().catch(()=>null);
 const next=safeNext(f?.get("next")?.toString()||"/me");
 const token=f?.get("token")?.toString()||"";
 const out=await emailReset(token,f?.get("password")?.toString()||"",f?.get("confirm")?.toString()||"").catch(()=>({error:"Something went wrong saving your new password. Please try again."}));
 if("error" in out)return NextResponse.redirect(new URL(`/signin?reset=${encodeURIComponent(token)}&error=${encodeURIComponent(out.error)}&next=${encodeURIComponent(next)}`,origin));
 const to=new URL(next,origin);to.searchParams.set("signedin","1");
 return NextResponse.redirect(to);
}
