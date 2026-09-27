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

const GRAPH="https://graph.facebook.com/v26.0";
const MODEL=process.env.EVENT_EXTRACT_MODEL||"claude-haiku-4-5-20251001";

/** Long-lived Meta user tokens last 60 days. Keep the newest one in the database and swap it for a fresh one
 *  when fewer than 20 days remain (needs FB_APP_ID + FB_APP_SECRET); IG_ACCESS_TOKEN in Vercel is the starting token. */
let tokenCache:{token:string;checked:number}|null=null;
async function accessToken():Promise<string|undefined>{
 const envToken=process.env.IG_ACCESS_TOKEN;if(!envToken)return undefined;
 if(tokenCache&&Date.now()-tokenCache.checked<6*3600e3)return tokenCache.token;
 await ensureSchema();
 const {rows}=await db.query("select value,expires_at,seed from app_tokens where name='instagram'");
 let token=envToken,expires:number|undefined;
 // A new IG_ACCESS_TOKEN pasted into Vercel replaces the stored one.
 if(rows[0]&&rows[0].seed===envToken.slice(-16)){token=rows[0].value;expires=rows[0].expires_at?new Date(rows[0].expires_at).getTime():undefined}
 const id=process.env.FB_APP_ID,secret=process.env.FB_APP_SECRET;
 if(id&&secret&&(!expires||expires-Date.now()<20*86400e3)){
  try{
   const r=await fetchRetry(`${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${id}&client_secret=${encodeURIComponent(secret)}&fb_exchange_token=${encodeURIComponent(token)}`,{cache:"no-store"});
   const d:any=await r.json().catch(()=>({}));
   if(r.ok&&d.access_token){token=d.access_token;expires=Date.now()+(Number(d.expires_in)||60*86400)*1000;
    await db.query(`insert into app_tokens(name,value,expires_at,seed,updated_at) values('instagram',$1,$2,$3,now()) on conflict(name) do update set value=excluded.value,expires_at=excluded.expires_at,seed=excluded.seed,updated_at=now()`,[token,new Date(expires),envToken.slice(-16)])}
   else console.log(`instagram token refresh failed: ${d?.error?.message||r.status}`);
  }catch(e:any){console.log(`instagram token refresh failed: ${e?.message||e}`)}
 }
 tokenCache={token,checked:Date.now()};
 return token;
}

async function loadPosts(username:string):Promise<Post[]>{
 const token=await accessToken(),me=process.env.IG_USER_ID;
 if(!token||!me)throw new Error("Instagram not connected yet (set IG_USER_ID and IG_ACCESS_TOKEN in Vercel)");
 const fields=`business_discovery.username(${username}){media.limit(25){id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_url,media_type}}}`;
 const r=await fetchRetry(`${GRAPH}/${me}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`,{cache:"no-store"});
 const d:any=await r.json().catch(()=>({}));
 if(!r.ok){if(d?.error?.code===190)tokenCache=null;throw new Error(`Instagram API: ${d?.error?.message||`HTTP ${r.status}`}${d?.error?.code===190?" — the Instagram key expired; generate a new one and update IG_ACCESS_TOKEN in Vercel":""}`)}
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

/** Instagram's image links are signed CDN URLs that outside services may not be allowed to open, so download
 *  the flyer here and send the bytes. */
async function imageBlock(url?:string){
 if(!url)return null;
 try{const r=await fetchRetry(url,{headers:{"User-Agent":"Mozilla/5.0"},cache:"no-store"});if(!r.ok)return null;
  const type=(r.headers.get("content-type")||"image/jpeg").split(";")[0];if(!/^image\/(jpeg|png|gif|webp)$/.test(type))return null;
  const buf=Buffer.from(await r.arrayBuffer());if(buf.length>4.5e6)return null;
  return{type:"image",source:{type:"base64",media_type:type,data:buf.toString("base64")}}}catch{return null}
}

async function askClaude(content:any[]):Promise<Extracted[]>{
 const r=await fetchRetry("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":process.env.ANTHROPIC_API_KEY!,"anthropic-version":"2023-06-01"},
  body:JSON.stringify({model:MODEL,max_tokens:1500,messages:[{role:"user",content}]})});
 const d:any=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(`Claude API: ${d?.error?.message||`HTTP ${r.status}`}`);
 const text=(d.content||[]).map((c:any)=>c.text||"").join("");
 const json=text.match(/\{[\s\S]*\}/)?.[0];
 if(!json)throw new Error("Claude API: reply had no JSON");
 return(JSON.parse(json).events||[]).filter((e:any)=>/^\d{4}-\d{2}-\d{2}$/.test(e?.date)&&String(e?.title||"").trim());
}

async function extractWithClaude(p:Post,venue:string):Promise<Extracted[]>{
 if(!process.env.ANTHROPIC_API_KEY)return captionOnly(p);
 const img=await imageBlock(imageOf(p));
 const text={type:"text",text:PROMPT(p,venue)};
 try{return await askClaude(img?[img,text]:[text])}
 catch(e){if(!img)throw e;return askClaude([text])}   // image rejected: read the caption alone
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
 const id=`${p.id}:v2`;   // bump when the reading logic changes, so posts are read again
 const {rows}=await db.query("select extracted from social_posts where id=$1",[id]);
 if(rows[0])return rows[0].extracted||[];
 const ev=await extractWithClaude(p,venue);
 await db.query("insert into social_posts(id,permalink,posted_at,extracted) values($1,$2,$3,$4) on conflict(id) do update set extracted=excluded.extracted",[id,p.permalink,p.timestamp,JSON.stringify(ev)]);
 return ev;
}

export async function fetchInstagram(cfg:InstagramConfig,startDate:string,endDate:string):Promise<EventRecord[]>{
 await ensureSchema();
 const posts=await loadPosts(cfg.username);
 const cutoff=new Date(Date.now()-(cfg.maxAgeDays??60)*86400e3).toISOString();
 const found:(Extracted&{post:Post})[]=[];let errors=0,firstError="";
 // Newest first, so a later "moved to Sunday" post wins over the original announcement.
 for(const p of posts.filter(p=>p.timestamp>=cutoff).sort((a,b)=>b.timestamp.localeCompare(a.timestamp))){
  try{for(const e of await cached(p,cfg.venue))found.push({...e,post:p})}catch(e:any){errors++;firstError||=String(e?.message||e);console.log(`instagram ${cfg.username} post ${p.id}: ${e?.message||e}`)}
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
 if(!out.length)throw new Error(`@${cfg.username}: ${posts.length} posts read, ${found.length} dated events found, none in ${startDate}..${endDate}${errors?`; ${errors} posts failed (${firstError.slice(0,200)})`:""}${process.env.ANTHROPIC_API_KEY?"":"; ANTHROPIC_API_KEY not set (captions only)"}`);
 return out;
}
