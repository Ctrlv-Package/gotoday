// What the page reader (source type "webpage") sees on a page and what the AI reads from it — to check a page
// before adding it as a source. GET ?url=…&venue=…&city=…
import {NextRequest,NextResponse} from "next/server";
import {fetchRetry} from "../../../../lib/http";
import {pageText} from "../../../../lib/sources/webpage";
import {readPageText,geminiCheck} from "../../../../lib/sources/instagram";
export const maxDuration=120;
export async function GET(req:NextRequest){
 const s=process.env.INGESTION_SECRET;
 if(!s||req.headers.get("authorization")!==`Bearer ${s}`)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const q=req.nextUrl.searchParams,url=q.get("url")||"";
 if(!url)return NextResponse.json({ok:true,gemini:await geminiCheck()});
 try{
  const r=await fetchRetry(url,{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"},cache:"no-store"},2,45000);
  const text=pageText(await r.text());
  const events=await readPageText(text,url,q.get("venue")||"",q.get("city")||"");
  return NextResponse.json({ok:true,status:r.status,chars:text.length,start:text.slice(0,400),events});
 }catch(e:any){return NextResponse.json({ok:false,error:String(e?.message||e),name:e?.name})}
}
