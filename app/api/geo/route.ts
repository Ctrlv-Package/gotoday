// Approximate location from the visitor's internet connection (Vercel's edge adds it to every request) — the
// fallback when the phone can't report its position in time. City-level, never stored.
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
 const h=req.headers,lat=Number(h.get("x-vercel-ip-latitude")),lng=Number(h.get("x-vercel-ip-longitude"));
 const city=decodeURIComponent(h.get("x-vercel-ip-city")||""),region=h.get("x-vercel-ip-country-region")||"",country=h.get("x-vercel-ip-country")||"";
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||(!lat&&!lng))return NextResponse.json({ok:false},{headers:{"cache-control":"no-store"}});
 return NextResponse.json({ok:true,lat,lng,city,region,country},{headers:{"cache-control":"no-store"}});
}
