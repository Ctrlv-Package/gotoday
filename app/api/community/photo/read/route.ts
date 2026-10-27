import {NextRequest,NextResponse} from "next/server";
import {getImage} from "../../../../../lib/images";
import {readFlyerImage} from "../../../../../lib/sources/instagram";
import {toFlyerDraft} from "../../../../../lib/flyerDraft";
export const dynamic="force-dynamic";
export const maxDuration=30;
// Read an uploaded event photo (/img/<key>) with Gemini and return the event fields the flyer states, for the
// create form to prefill. Gemini-only, no paid fallback, no daily cap: uploads are already capped per address,
// and only our own /img/ keys are accepted, so a read always follows an upload. A failed read returns ok:false
// and the form just asks the user to fill the fields in.
export async function POST(req:NextRequest){
 try{
  const {imageUrl}=await req.json().catch(()=>({}));
  if(typeof imageUrl!=="string"||!imageUrl.startsWith("/img/"))return NextResponse.json({ok:false});
  const key=imageUrl.slice(5);
  if(!/^[0-9a-f]{24}$/.test(key))return NextResponse.json({ok:false});
  const img=await getImage(key).catch(()=>undefined);
  if(!img)return NextResponse.json({ok:false});
  const today=new Date().toLocaleDateString("en-CA",{timeZone:"America/New_York"});
  const evs=await readFlyerImage(img.data,img.type,today);
  console.log(`flyer read: ${evs.length} event(s)`);
  return NextResponse.json({ok:true,draft:evs[0]?toFlyerDraft(evs[0],today):{},found:evs.length});
 }catch(e:any){console.log(`flyer read: ${e?.message||e}`);return NextResponse.json({ok:false});}
}
