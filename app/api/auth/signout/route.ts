import {NextRequest,NextResponse} from "next/server";
import {signOut} from "../../../../lib/auth";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest){await signOut();return NextResponse.redirect(new URL("/",req.nextUrl.origin),303)}
