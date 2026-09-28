import {NextRequest,NextResponse} from "next/server";
import {validate,createEvent} from "../../../lib/community";
export const dynamic="force-dynamic";
export const maxDuration=60;
// Create an event. No account: the response carries a secret manage link, shown once to the creator.
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>null);
 if(!body)return NextResponse.json({ok:false,errors:["Something went wrong reading the form."]},{status:400});
 if(body.website)return NextResponse.json({ok:false,errors:["Something went wrong."]},{status:400}); // bot trap field
 const r=validate(body);if(!r.ok)return NextResponse.json({ok:false,errors:r.errors},{status:422});
 const ip=(req.headers.get("x-forwarded-for")||"").split(",")[0].trim()||"unknown";
 const origin=req.nextUrl.origin;
 const out=await createEvent(r.v,ip,origin);
 if("error" in out)return NextResponse.json({ok:false,errors:[out.error]},{status:422});
 const e=out.event!;
 return NextResponse.json({ok:true,status:e.status,visibility:e.visibility,reviewReason:e.status==="pending"?e.reviewReason:null,
  shareUrl:`${origin}/e/${e.shareToken}`,manageUrl:`${origin}/manage/${out.manageToken}`,title:e.title,date:e.date});
}
