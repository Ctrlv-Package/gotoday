import {NextRequest,NextResponse} from "next/server";
import {emailForgot,safeNext} from "../../../../../lib/auth";
export const dynamic="force-dynamic";
// POST /api/auth/email/forgot (email) -> always the same message, whether or not the address has an account.
export async function POST(req:NextRequest){
 const origin=req.nextUrl.origin,f=await req.formData().catch(()=>null);
 const next=safeNext(f?.get("next")?.toString()||"/me");
 await emailForgot(origin,f?.get("email")?.toString()||"").catch(()=>{});
 return NextResponse.redirect(new URL(`/signin?notice=${encodeURIComponent("If there's an account for that email, you'll get a reset link. It works for 1 hour.")}&next=${encodeURIComponent(next)}`,origin));
}
