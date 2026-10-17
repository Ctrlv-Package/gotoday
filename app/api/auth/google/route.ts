import {NextRequest,NextResponse} from "next/server";
import {googleStart,googleConfigured} from "../../../../lib/auth";
export const dynamic="force-dynamic";
// GET /api/auth/google?next=/events/db-123 -> Google's sign-in page.
export async function GET(req:NextRequest){
 const origin=req.nextUrl.origin;
 if(!googleConfigured())return NextResponse.redirect(new URL("/signin?error=Google%20sign-in%20isn't%20set%20up%20yet",origin));
 return NextResponse.redirect(await googleStart(origin,req.nextUrl.searchParams.get("next")||"/me"));
}
