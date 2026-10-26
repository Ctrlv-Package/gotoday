import {NextRequest,NextResponse} from "next/server";
import {emailVerify} from "../../../../../lib/auth";
export const dynamic="force-dynamic";
// GET /api/auth/email/verify?token=... (from the verification email) -> My GoToday, signed in.
export async function GET(req:NextRequest){
 const origin=req.nextUrl.origin;
 const out=await emailVerify(req.nextUrl.searchParams.get("token")||"").catch(()=>({error:"Something went wrong verifying your email. Please try again."}));
 if("error" in out)return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(out.error)}`,origin));
 return NextResponse.redirect(new URL("/me?signedin=1",origin));
}
