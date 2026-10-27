import {NextRequest,NextResponse} from "next/server";
import {trackAction} from "../../../lib/track";
export const dynamic="force-dynamic";
// POST /api/track {id:"db-123",action:"share"|"view"} — counted for the Popular ranking (no visitor details stored).
export async function POST(req:NextRequest){
 const b:any=await req.json().catch(()=>({}));
 if(typeof b?.id==="string"&&/^db-\d+$/.test(b.id)&&(b.action==="share"||b.action==="view"))await trackAction(b.id,b.action);
 return NextResponse.json({ok:true});
}
