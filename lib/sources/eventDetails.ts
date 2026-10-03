import {db} from "../db";
import {ensureSchema} from "../schema";
import {fetchRetry} from "../http";
import {slug} from "../ingestion/utils";

// Instagram flyers often name an event and nothing else ("03 OCT · Las Olas Autumn Festival").
// For those, ask Claude to look the event up on the web and bring back the official page and a real
// description. Each event is looked up once (results are cached in event_details), and only a few per
// account per run, so the cost stays small.

export type Details={url?:string;summary?:string;start?:string;end?:string;place?:string;address?:string;free?:boolean|null;kids?:boolean|null};
type Ask={title:string;date:string;city:string;place?:string;account:string};

const MODEL=process.env.EVENT_DETAILS_MODEL||process.env.EVENT_EXTRACT_MODEL||"claude-haiku-4-5-20251001";
let searchUnavailable="";   // set when the API says web search isn't enabled, so we stop trying this run

const PROMPT=(a:Ask)=>`Find the official web page for this event and summarize it.
Event: "${a.title}"
Date: ${a.date}
City: ${a.city}${a.place?`\nPlace: ${a.place}`:""}
Seen on Instagram: @${a.account}

Search the web. Only use a page that is clearly about THIS event on THIS date (the organizer's site, the venue's site, the city's calendar, Eventbrite, etc.). Prefer the organizer's own page. If you can't find one, say so — never guess.
Reply with JSON only:
{"found":true|false,"url":"https://...","summary":"2–3 plain sentences: what it is and what there is to do","start":"HH:MM","end":"HH:MM","place":"venue name","address":"street, city","free":true|false|null,"kids":true|false|null}
Omit fields you don't know.`;

export async function lookupDetails(a:Ask,cacheOnly=false):Promise<Details|null>{
 await ensureSchema();
 const key=`${slug(a.title)}|${a.date}|${slug(a.city)}`;
 const {rows}=await db.query("select data,created_at from event_details where key=$1",[key]);
 // A miss is retried after 2 days (the page may be posted later); a hit is kept.
 if(rows[0]&&(rows[0].data?.found||Date.now()-new Date(rows[0].created_at).getTime()<2*86400e3))return rows[0].data?.found?rows[0].data:null;
 if(cacheOnly||!process.env.ANTHROPIC_API_KEY||searchUnavailable)return null;
 let r!:Response,d:any={};
 for(let attempt=0;attempt<3;attempt++){
  r=await fetchRetry("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":process.env.ANTHROPIC_API_KEY!,"anthropic-version":"2023-06-01"},
   body:JSON.stringify({model:MODEL,max_tokens:1200,tools:[{type:"web_search_20250305",name:"web_search",max_uses:3}],messages:[{role:"user",content:PROMPT(a)}]})},1);
  d=await r.json().catch(()=>({}));
  if(r.status!==429&&r.status!==529&&r.status<500)break;
  await new Promise(res=>setTimeout(res,Math.min(30,Number(r.headers.get("retry-after"))||8*(attempt+1))*1000));
 }
 if(!r.ok){
  const msg=d?.error?.message||`HTTP ${r.status}`;
  if(/web.?search|not enabled|not available|tool/i.test(msg)){searchUnavailable=msg;console.log(`event details: web search unavailable — ${msg}`);
   await db.query("insert into event_details(key,data,created_at) values('__error',$1,now()) on conflict(key) do update set data=excluded.data,created_at=now()",[JSON.stringify({msg})]).catch(()=>{})}
  else console.log(`event details for "${a.title}": ${msg}`);
  return null;
 }
 const text=(d.content||[]).filter((c:any)=>c.type==="text").map((c:any)=>c.text||"").join("");
 let data:any={found:false};
 try{data=JSON.parse(text.match(/\{[\s\S]*\}$/)?.[0]||text.match(/\{[\s\S]*\}/)?.[0]||"{}")}catch{}
 if(data.found&&!/^https?:\/\//.test(data.url||""))data.found=false;
 if(data.found&&/instagram\.com|facebook\.com\/.*\/posts/i.test(data.url))data.found=false;   // we already have the post
 await db.query("insert into event_details(key,data,created_at) values($1,$2,now()) on conflict(key) do update set data=excluded.data,created_at=now()",[key,JSON.stringify(data)]);
 await db.query("delete from event_details where key='__error'").catch(()=>{});
 return data.found?data:null;
}

/** Does this description actually say anything? */
export const thinSummary=(title:string,summary?:string)=>{
 const s=(summary||"").trim();if(s.length<90)return true;
 const rest=s.toLowerCase().replace(title.toLowerCase(),"").replace(/\b(on|at|in|the|from|to|and|join us|for|this|event|oct(ober)?|sept?(ember)?|nov(ember)?|\d+(st|nd|rd|th)?|a\.?m\.?|p\.?m\.?)\b/g,"").replace(/[^a-z]/g,"");
 return rest.length<40;
};
