import {NextRequest,NextResponse} from "next/server";
import {addRsvp} from "../../../../lib/community";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest){
 const b=await req.json().catch(()=>null);
 if(!b?.share)return NextResponse.json({ok:false,error:"Missing event."},{status:400});
 const r=await addRsvp(String(b.share),b);
 if("error" in r)return NextResponse.json({ok:false,error:r.error},{status:422});
 return NextResponse.json({ok:true});
}
