import {NextRequest,NextResponse} from "next/server";
import {getImage} from "../../../lib/images";
export const dynamic="force-dynamic";

// Our saved copy of an event picture. A key always means the same picture, so browsers and Vercel's CDN keep it.
export async function GET(_req:NextRequest,{params}:{params:Promise<{key:string}>}){
 const {key}=await params;
 if(!/^[0-9a-f]{24}$/.test(key))return new NextResponse("Not found",{status:404});
 const img=await getImage(key).catch(()=>undefined);
 if(!img)return new NextResponse("Not found",{status:404,headers:{"cache-control":"public, max-age=300"}});
 return new NextResponse(new Uint8Array(img.data),{headers:{"content-type":img.type,"cache-control":"public, max-age=31536000, s-maxage=31536000, immutable"}});
}
