import type {EventRecord} from "../ingestion/types";
import {db} from "../db";
import {ensureSchema} from "../schema";
import {fetchRetry} from "../http";
import {slug} from "../ingestion/utils";

// Venue Instagram accounts (town centers, markets, breweries...) announce events that never reach a
// city calendar. Read them through Instagram's official Business Discovery API:
//   GET graph.facebook.com/<ver>/<IG_USER_ID>?fields=business_discovery.username(<venue>){media{...}}
// IG_USER_ID is GoToday's own Instagram professional account; IG_ACCESS_TOKEN its long-lived token.
// Each new post is read once (caption + flyer image) by Claude, which returns the events it announces;
// results are cached in social_posts so reruns cost nothing. Without ANTHROPIC_API_KEY, captions only.

export type InstagramConfig={username:string;source:string;idPrefix:string;city:string;venue:string;address?:string;tz?:string;maxAgeDays?:number};
type Extracted={title:string;date:string;start?:string;end?:string;summary?:string;free?:boolean;kids?:boolean;cancelled?:boolean};
type Post={id:string;caption?:string;media_type:string;media_url?:string;thumbnail_url?:string;permalink:string;timestamp:string;children?:{data:{media_url?:string;media_type:string}[]}};

const GRAPH="https://graph.facebook.com/v25.0";
const MODEL=process.env.EVENT_EXTRACT_MODEL||"claude-haiku-4-5-20251001";

async function loadPosts(username:string):Promise<Post[]>{
 const token=process.env.IG_ACCESS_TOKEN,me=process.env.IG_USER_ID;
 if(!token||!me)throw new Error("Instagram not connected yet (set IG_USER_ID and IG_ACCESS_TOKEN in Vercel)");
 const fields=`business_discovery.username(${username}){media.limit(25){id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_url,media_type}}}`;
 const r=await fetchRetry(`${GRAPH}/${me}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`,{cache:"no-store"});
 const d:any=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(`Instagram API: ${d?.error?.message||`HTTP ${r.status}`}`);
 return d?.business_discovery?.media?.data||[];
}

const imageOf=(p:Post)=>p.media_type==="VIDEO"?p.thumbnail_url:p.media_type==="CAROUSEL_ALBUM"?(p.children?.data.find(c=>c.media_type==="IMAGE")?.media_url||p.media_url):p.media_url;

const PROMPT=(p:Post,venue:string)=>`This Instagram post is from ${venue}. It was posted on ${p.timestamp.slice(0,10)}.
Caption:
"""${(p.caption||"").slice(0,3000)}"""

List the dated, public, in-person events this post announces at or near ${venue}, using the caption AND the image (flyers often hold the date and time).
Rules:
- Only events with a specific calendar date. Resolve weekday/month-only dates relative to the posting date (never earlier than it).
- Recurring series: list each date it states, up to 8.
- Skip sales, promotions, store openings without an event, giveaways, and vague "coming soon" posts.
- If the post says an event is cancelled or moved, list the original date with "cancelled": true and the new date as a normal event.
- Use a short, stable title (e.g. "Artisan Market", not "Fall Artisan Market is back!").
Reply with JSON only: {"events":[{"title":"","date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","summary":"one or two sentences","free":true|false|null,"kids":true|false|null,"cancelled":false}]} — omit start/end when not stated.`;

async function extractWithClaude(p:Post,venue:string):Promise<Extracted[]>{
 const key=process.env.ANTHROPIC_API_KEY;if(!key)return captionOnly(p);
 const img=imageOf(p);
 const content:any[]=[];
 if(img)content.push({type:"image",source:{type:"url",url:img}});
 content.push({type:"text",text:PROMPT(p,venue)});
 const r=await fetchRetry("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01"},
  body:JSON.stringify({model:MODEL,max_tokens:1200,messages:[{role:"user",content}]})});
 const d:any=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(`Claude API: ${d?.error?.message||`HTTP ${r.status}`}`);
 const text=(d.content||[]).map((c:any)=>c.text||"").join("");
 const json=text.match(/\{[\s\S]*\}/)?.[0];
 try{return(JSON.parse(json||"{}").events||[]).filter((e:any)=>/^\d{4}-\d{2}-\d{2}$/.test(e?.date)&&String(e?.title||"").trim())}catch{return[]}
}

/** Fallback without an AI key: a caption that names a month + day ("Sunday, Sept 27 · 4-8pm"). */
const MONTHS=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
export function captionOnly(p:Post):Extracted[]{
 const c=p.caption||"";const m=c.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/i);if(!m)return[];
 const posted=p.timestamp.slice(0,10);let y=+posted.slice(0,4);const mo=MONTHS.indexOf(m[1].slice(0,3).toLowerCase())+1;
 let date=`${y}-${String(mo).padStart(2,"0")}-${m[2].padStart(2,"0")}`;if(date<posted){y++;date=`${y}${date.slice(4)}`}
 const t=c.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
 const h=(hh:string,mm:string|undefined,ap:string)=>{let x=+hh%12;if(/pm/i.test(ap))x+=12;return`${String(x).padStart(2,"0")}:${mm||"00"}`};
 const title=(c.split(/\n|[.!?]/)[0]||"Event").replace(/[^\p{L}\p{N}&' -]/gu,"").trim().slice(0,80)||"Event";
 return[{title,date,start:t?h(t[1],t[2],t[3]||t[6]):undefined,end:t?h(t[4],t[5],t[6]):undefined,summary:c.slice(0,300)}];
}

async function cached(p:Post,venue:string):Promise<Extracted[]>{
 if(!process.env.ANTHROPIC_API_KEY)return captionOnly(p);   // don't cache the weaker caption-only reading
 const {rows}=await db.query("select extracted from social_posts where id=$1",[p.id]);
 if(rows[0])return rows[0].extracted||[];
 const ev=await extractWithClaude(p,venue);
 await db.query("insert into social_posts(id,permalink,posted_at,extracted) values($1,$2,$3,$4) on conflict(id) do update set extracted=excluded.extracted",[p.id,p.permalink,p.timestamp,JSON.stringify(ev)]);
 return ev;
}

export async function fetchInstagram(cfg:InstagramConfig,startDate:string,endDate:string):Promise<EventRecord[]>{
 await ensureSchema();
 const posts=await loadPosts(cfg.username);
 const cutoff=new Date(Date.now()-(cfg.maxAgeDays??60)*86400e3).toISOString();
 const found:(Extracted&{post:Post})[]=[];
 // Newest first, so a later "moved to Sunday" post wins over the original announcement.
 for(const p of posts.filter(p=>p.timestamp>=cutoff).sort((a,b)=>b.timestamp.localeCompare(a.timestamp))){
  try{for(const e of await cached(p,cfg.venue))found.push({...e,post:p})}catch(e:any){console.log(`instagram ${cfg.username} post ${p.id}: ${e?.message||e}`)}
 }
 const key=(e:Extracted)=>`${e.date}|${slug(e.title).split("-").filter(w=>w.length>2).slice(0,2).join("-")}`;
 const cancelled=new Set(found.filter(e=>e.cancelled).map(key)),seen=new Set<string>(),out:EventRecord[]=[];
 for(const e of found){
  const k=key(e);if(e.cancelled||cancelled.has(k)||seen.has(k)||e.date<startDate||e.date>endDate)continue;seen.add(k);
  const blob=`${e.title} ${e.summary||""}`.toLowerCase();
  const family=e.kids===true||/\b(kids?|family|children|festival|halloween|trick|santa|egg hunt|parade)\b/.test(blob);
  const arts=/\b(music|concert|band|dj|art|artisan|craft|theat(er|re)|dance|film|movie)\b/.test(blob);
  const time=e.start&&/^\d{2}:\d{2}$/.test(e.start)?e.start+":00":"";
  const end=e.end&&/^\d{2}:\d{2}$/.test(e.end)?e.end+":00":undefined;
  out.push({id:`${cfg.idPrefix}-${slug(e.title)}-${e.date}`,title:e.title.trim(),city:cfg.city,venue:cfg.venue,address:cfg.address,date:e.date,time,endTime:end&&time&&end>time?end:undefined,
   url:e.post.permalink,sourceUrl:`https://www.instagram.com/${cfg.username}/`,image:imageOf(e.post),
   category:family?"Family":arts?"Arts & Theatre":"Local",genre:"Venue Event",desc:(e.summary||"").trim()||`Posted by @${cfg.username}.`,
   tags:[...(family?["Family"]:[]),...(e.kids?["Kids"]:[]),...(arts?["Arts & Theatre"]:[]),...(e.free?["Free"]:[]),"Local"],
   emoji:family?"🎉":arts?"🎨":"📍",source:cfg.source,isFree:e.free===true||undefined,eventType:"event"});
 }
 return out;
}
