import {NextRequest,NextResponse} from "next/server";
import {saveUpload,uploadsToday} from "../../../../lib/images";
import {hashToken} from "../../../../lib/community";
export const dynamic="force-dynamic";
export const maxDuration=30;
// Upload a photo for an event someone is creating (the picture itself is the request body; the page shrinks it first).
// Returns {url:"/img/<key>"} to send with the event form. Anyone can upload, so each address gets 30 a day.
export async function POST(req:NextRequest){
 const type=req.headers.get("content-type")||"";
 if(!/^image\//.test(type))return NextResponse.json({ok:false,error:"Please choose a photo (JPG, PNG or WebP)."},{status:415});
 const buf=Buffer.from(await req.arrayBuffer());
 if(buf.length>4_000_000)return NextResponse.json({ok:false,error:"That photo is too large. Please pick a smaller one."},{status:413});
 const ip=(req.headers.get("x-forwarded-for")||"").split(",")[0].trim()||"unknown";
 const who=hashToken(`${ip}|${process.env.INGESTION_SECRET||"gotoday"}`).slice(0,16);
 if(await uploadsToday(who)>=30)return NextResponse.json({ok:false,error:"You've uploaded a lot of photos today. Please try again tomorrow."},{status:429});
 const url=await saveUpload(buf,who);
 if(!url)return NextResponse.json({ok:false,error:"We couldn't read that photo. Try a JPG or PNG at least 200 pixels wide."},{status:422});
 return NextResponse.json({ok:true,url});
}
