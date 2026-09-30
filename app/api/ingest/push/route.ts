import {NextRequest,NextResponse} from "next/server";
import {remoteSources,activeSources} from "../../../../lib/ingestion/registry";
import {runSource} from "../../../../lib/ingestion/persist";
import type {EventRecord} from "../../../../lib/ingestion/types";
export const dynamic="force-dynamic";
export const maxDuration=300;

// Receives events for a remote-only source (fetched outside Vercel by scripts/remote-ingest.ts)
// and runs them through the same validation, classification and persistence as every other source.
// Body: {source: "<registry name>", events: EventRecord[]} or {source, error: "<why the fetch failed>"}
export async function POST(req:NextRequest){
 const secret=process.env.INGESTION_SECRET;
 if(!secret||req.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 let body:any;try{body=await req.json()}catch{return NextResponse.json({ok:false,error:"Invalid JSON"},{status:400})}
 // Remote-only sources, or (with fallback:true) a website source the GitHub job re-fetched after Vercel was blocked.
 const s=(await remoteSources()).find(x=>x.name===body?.source)||(body?.fallback?(await activeSources()).find(x=>x.name===body?.source):undefined);
 if(!s)return NextResponse.json({ok:false,error:`Not a remote source: ${body?.source}`},{status:400});
 if(!Array.isArray(body.events)&&!body.error)return NextResponse.json({ok:false,error:"events[] or error required"},{status:400});
 const events:EventRecord[]=(body.events||[]).filter((e:any)=>e&&typeof e.title==="string"&&typeof e.date==="string"&&typeof e.url==="string").slice(0,5000)
  .map((e:any)=>({...e,source:s.name,tags:Array.isArray(e.tags)?e.tags.map(String):[]}));
 const summary=await runSource(s,async()=>{if(body.error)throw new Error(String(body.error).slice(0,300));return events});
 return NextResponse.json({ok:true,summary});
}
