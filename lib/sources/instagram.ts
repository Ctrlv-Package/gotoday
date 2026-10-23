import type {EventRecord} from "../ingestion/types";
import {db} from "../db";
import {ensureSchema} from "../schema";
import {fetchRetry} from "../http";
import {slug} from "../ingestion/utils";
import {lookupDetails,thinSummary} from "./eventDetails";
import {freeLookup,captionSites} from "./freeDetails";
import {keepImages} from "../images";

// Venue Instagram accounts (town centers, markets, breweries...) announce events that never reach a
// city calendar. Read them through Instagram's official Business Discovery API:
//   GET graph.facebook.com/<ver>/<IG_USER_ID>?fields=business_discovery.username(<venue>){media{...}}
// IG_USER_ID is GoToday's own Instagram professional account; IG_ACCESS_TOKEN its long-lived token.
// Each new post is read once (caption + flyer image) by Claude, which returns the events it announces;
// results are cached in social_posts so reruns cost nothing. Without ANTHROPIC_API_KEY, captions only.

export type InstagramConfig={username:string;source:string;idPrefix:string;city:string;venue:string;address?:string;tz?:string;maxAgeDays?:number};
type Extracted={slide?:number;place?:string;town?:string;title:string;date:string;start?:string;end?:string;summary?:string;free?:boolean;kids?:boolean;forKids?:boolean;cancelled?:boolean};
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

class AccountMissing extends Error{}
async function loadPosts(username:string):Promise<{posts:Post[];website:string}>{
 const token=await accessToken(),me=process.env.IG_USER_ID;
 if(!token||!me)throw new Error("Instagram not connected yet (set IG_USER_ID and IG_ACCESS_TOKEN in Vercel)");
 const fields=`business_discovery.username(${username}){website,media.limit(30){id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_url,media_type}}}`;
 const r=await fetchRetry(`${GRAPH}/${me}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`,{cache:"no-store"});
 const d:any=await r.json().catch(()=>({}));
 // Meta allows only so many calls per hour. When we hit it, say so plainly; the source is skipped (not failed)
 // and picked up on the next run. Also stop early when Meta reports we're nearly at the limit.
 const usage=(()=>{try{const u=JSON.parse(r.headers.get("x-app-usage")||"{}");return Math.max(u.call_count||0,u.total_time||0,u.total_cputime||0)}catch{return 0}})();
 if([4,17,32,613].includes(d?.error?.code)||/request limit reached|rate limit/i.test(d?.error?.message||""))throw new Error(`Instagram rate limit: ${d?.error?.message||"too many requests"} — will retry next run`);
 if(r.ok&&usage>=95)console.log(`instagram app usage at ${usage}% of the hourly limit`);
 if(!r.ok){if(d?.error?.code===190)tokenCache=null;
  if(/cannot be found|does not exist|invalid user id|not.*business/i.test(d?.error?.message||"")||d?.error?.error_subcode===2207013)throw new AccountMissing(`@${username} isn't a public business/creator account on Instagram (or the handle changed)`);throw new Error(`Instagram API: ${d?.error?.message||`HTTP ${r.status}`}${d?.error?.code===190?" — the Instagram key expired; generate a new one and update IG_ACCESS_TOKEN in Vercel":""}`)}
 return{posts:d?.business_discovery?.media?.data||[],website:d?.business_discovery?.website||""};
}

const slides=(p:Post)=>(p.children?.data||[]).filter(c=>c.media_type==="IMAGE"&&c.media_url).map(c=>c.media_url!);
const imageOf=(p:Post)=>p.media_type==="VIDEO"?p.thumbnail_url:p.media_type==="CAROUSEL_ALBUM"?(p.children?.data.find(c=>c.media_type==="IMAGE")?.media_url||p.media_url):p.media_url;

const PROMPT=(p:Post,venue:string,city:string)=>`This Instagram post is from ${venue} (${city}). It was posted on ${p.timestamp.slice(0,10)}.
Caption:
"""${(p.caption||"").slice(0,3000)}"""

List the dated, public, in-person events this post announces in or near ${city}, using the caption AND the image (flyers often hold the date, time and place).
Rules:
- Only events with a specific calendar date. Resolve weekday/month-only dates relative to the posting date (never earlier than it).
- Recurring series: list each date it states, up to 8.
- ONE event with a schedule: when the post promotes a single named event (an ArtWalk, festival, fair, block party, open house, celebration) and lists the activities or times that happen as part of it ("6 p.m. guided mural tour, 9 p.m. magic show, then live music on the main stage"), list ONE event: the main event's name as the title (e.g. "Downtown Hollywood ArtWalk"), the earliest start and the latest end, the area or venue where it's held, and the schedule in "summary" (e.g. "5 PM champagne welcome at the Art & Culture Center; 6 PM guided mural tour; 7 PM art walk tour; 9 PM magic show at Twisted Roots; live music on the main stage."). Do NOT split its parts into separate events. Only list separate events when they really are separate (different days, different organizers, or unrelated to each other).
- Round-up posts (a list or calendar of many different events): list every event in it, each with its own place. Keep "summary" short (one sentence). Never list the round-up/guide itself ("Fun plans this weekend", "Things to do in Broward") as an event.
- Skip deals and promotions that aren't an event at a specific place (e.g. "free museum admission with your Bank of America card", "kids eat free all month", store coupons), and chain-store activities with no specific location ("at your local Home Depot / check your local store").
- Skip sales, promotions, store openings without an event, giveaways, and vague "coming soon" posts.
- Skip government business: commission/council/board meetings, hearings, budget workshops, road closures, service notices, job fairs for city jobs.
- "place": the venue or park name (and street address if shown), e.g. "Vista Park, 4001 Southwest 142nd Ave". Omit if not stated.
- "town": the city the event is in, if the post says (e.g. "Plantation"). Omit if not stated.
- If the post says an event is cancelled or moved, list the original date with "cancelled": true and the new date as a normal event.
- Use a short, stable title (e.g. "Artisan Market", not "Fall Artisan Market is back!").
- "kids": true when children are welcome and it suits them: family/community events, all-ages festivals, open houses, kids in the photo or flyer, kid activities. false only for adult events (21+, bars, wine/beer, business networking). null if you truly cannot tell.
- "forKids": true only when the event is made FOR children or teens (story time, kids' class or camp, children's show, kids' party, trick-or-treating, egg hunt, teen night). A plant sale, market, festival or concert that families can attend is NOT forKids. Judge each event on its own, even when one post lists several.
- "slide": if several images are attached, the number (1 = first) of the image that shows THIS event best (its own flyer or photo); omit if none does.
Reply with JSON only: {"events":[{"title":"","date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","slide":1,"place":"","town":"","summary":"one or two sentences","free":true|false|null,"kids":true|false|null,"forKids":true|false,"cancelled":false}]} — omit start/end when not stated.`;

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
 let r!:Response,d:any={};
 // Many accounts are read in one run: wait out rate limits instead of failing the post.
 for(let attempt=0;attempt<5;attempt++){
  r=await fetchRetry("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":process.env.ANTHROPIC_API_KEY!,"anthropic-version":"2023-06-01"},
   body:JSON.stringify({model:MODEL,max_tokens:4096,messages:[{role:"user",content}]})},1);
  d=await r.json().catch(()=>({}));
  if(r.status!==429&&r.status!==529&&r.status<500)break;
  const wait=Math.min(40,Number(r.headers.get("retry-after"))||8*(attempt+1));
  await new Promise(res=>setTimeout(res,wait*1000));
 }
 if(!r.ok)throw new Error(`Claude API: ${d?.error?.message||`HTTP ${r.status}`}`);
 return parseEvents((d.content||[]).map((c:any)=>c.text||"").join(""),"Claude API");
}
function parseEvents(text:string,who:string):Extracted[]{
 const json=text.match(/\{[\s\S]*\}/)?.[0];
 if(!json)throw new Error(`${who}: reply had no JSON`);
 return(JSON.parse(json).events||[]).filter((e:any)=>/^\d{4}-\d{2}-\d{2}$/.test(e?.date)&&String(e?.title||"").trim());
}

/** Google Gemini's free tier (GEMINI_API_KEY from aistudio.google.com) reads flyers at no cost.
 *  Same prompt and images as Claude. Once a Gemini key is set, a Gemini failure no longer falls
 *  back to paid Claude by default: the post is left uncached, read from its caption for now, and
 *  re-read by Gemini on a later run. Set AI_PAID_FALLBACK=on in Vercel to restore the old
 *  Claude-within-the-daily-budget fallback. Without a Gemini key, Claude is still the reader. */
const GEMINI_MODEL=process.env.GEMINI_MODEL||"gemini-2.5-flash";   // pinned: the "gemini-flash-latest" alias points at the newest Flash, whose free quota can be far smaller; 2.5 Flash is the generous-quota model. Override with GEMINI_MODEL in Vercel.
async function askGemini(content:any[]):Promise<Extracted[]>{
 const parts=content.map((c:any)=>c.type==="image"?{inline_data:{mime_type:c.source.media_type,data:c.source.data}}:{text:c.text});
 const r=await fetchRetry(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,{method:"POST",
  headers:{"content-type":"application/json","x-goog-api-key":process.env.GEMINI_API_KEY!},
  body:JSON.stringify({contents:[{role:"user",parts}],generationConfig:{responseMimeType:"application/json",maxOutputTokens:4096,temperature:0}})},2);
 const d:any=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(`Gemini API: ${d?.error?.message||`HTTP ${r.status}`}`);
 return parseEvents((d.candidates?.[0]?.content?.parts||[]).map((x:any)=>x.text||"").join(""),"Gemini API");
}

// Round-up accounts post one event per slide in carousels, so they get every slide read (up to 6), and
// their posts are re-read once with the newer reading (each event's own town).
const KIDS_TITLE=/\b(kids?|children'?s?|child|toddlers?|preschool\w*|story ?time|tots?|teens?|tweens?|youth|trick[- ]or[- ]treat\w*|trunk[- ]or[- ]treat|egg hunt|kids'? camp|baby|babies|little ones|junior)\b/i;
const ROUNDUPS=new Set(["miami_residents","weekendbroward","todowithkidsbroward","todowithkidsmiami","thebrowardscene"]);
async function extractWithClaude(p:Post,venue:string,city:string,roundup=false,allowClaude=true):Promise<Extracted[]>{
 // Carousels: every slide is read (up to 6, or 4 for ordinary accounts) so each event can use its own slide as its picture.
 const urls=p.media_type==="CAROUSEL_ALBUM"?slides(p).slice(0,roundup?6:4):[imageOf(p)];
 const imgs=(await Promise.all(urls.map(u=>imageBlock(u)))).filter(Boolean);
 const img=imgs[0];
 const text={type:"text",text:PROMPT(p,venue,city)};
 if(process.env.GEMINI_API_KEY){
  try{return await askGemini([...imgs,text])}
  catch(e:any){console.log(`gemini: ${e?.message||e}`);
   // A free key is set, so a Gemini failure (quota, busy, bad key) must not silently bill Claude.
   // NoCredit leaves the post uncached: it is caption-read for now and retried on a later run.
   if(process.env.AI_PAID_FALLBACK!=="on")throw new NoCredit(`Gemini reading failed (${e?.message||e}); paid Claude fallback is off — set AI_PAID_FALLBACK=on in Vercel to allow it`)}
 }
 if(!process.env.ANTHROPIC_API_KEY||!allowClaude)throw new NoCredit("no paid reading available");
 try{return await askClaude([...imgs,text])}
 catch(e:any){
  // Out of API credit or over the spend limit: fall back to the free caption reading instead of failing.
  if(/credit|billing|balance|spend|limit|quota/i.test(e?.message||""))throw new NoCredit(e.message);
  if(!img)throw e;return askClaude([text])}   // image rejected: read the caption alone
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

class NoCredit extends Error{}
async function cached(p:Post,venue:string,city:string,roundup=false):Promise<Extracted[]>{
 if(!process.env.ANTHROPIC_API_KEY&&!process.env.GEMINI_API_KEY)return captionOnly(p);   // don't cache the weaker caption-only reading
 let prev:Extracted[]|null=null;   // an earlier reading, kept if a new one can't be done today
 const id=`${p.id}:${roundup?"v5":"v4"}`;   // bump when the reading logic changes, so posts are read again
 const {rows}=await db.query("select extracted from social_posts where id=$1",[id]);
 if(rows[0])return rows[0].extracted||[];
 // v4 only changed how one event with a schedule is read (one card, not one per activity). Earlier readings stay
 // valid unless they split a post into 3+ events on one day, so only those posts are read again.
 if(!roundup){
  const old=(await db.query("select extracted from social_posts where id=$1",[`${p.id}:v3`])).rows[0];
  if(old){prev=old.extracted||[];const perDay=new Map<string,number>();for(const e of prev!)perDay.set(e.date,(perDay.get(e.date)||0)+1);
   if(![...perDay.values()].some(n=>n>=3))return prev!;}
 }
 // Budget: at most AI_POSTS_PER_DAY posts get read by the AI each day (default 120, roughly $0.50/day).
 // Past that, posts are read from the caption for free and get the full reading on a later day.
 const cap=Number(process.env.AI_POSTS_PER_DAY||120);
 const today=(await db.query("select count(*)::int as n from social_posts where created_at>=date_trunc('day',now() at time zone 'America/New_York') at time zone 'America/New_York'")).rows[0]?.n||0;
 // Free Gemini reading isn't capped; only paid Claude reading is.
 // Re-reading a post that was split into pieces gets a small extra allowance (about half a cent each, at most 15 a day).
 const allowance=prev?cap+15:cap;
 if(today>=allowance&&!process.env.GEMINI_API_KEY)return prev??captionOnly(p);
 let ev:Extracted[];
 try{ev=await extractWithClaude(p,venue,city,roundup,today<allowance)}
 catch(e){if(e instanceof NoCredit)return prev??captionOnly(p);throw e}   // not cached: read properly once credit is back
 await db.query("insert into social_posts(id,permalink,posted_at,extracted) values($1,$2,$3,$4) on conflict(id) do update set extracted=excluded.extracted",[id,p.permalink,p.timestamp,JSON.stringify(ev)]);
 return ev;
}

export async function fetchInstagram(cfg:InstagramConfig,startDate:string,endDate:string):Promise<EventRecord[]>{
 await ensureSchema();
 let posts:Post[],website="";
 try{({posts,website}=await loadPosts(cfg.username))}
 catch(e){
  // A wrong or private handle can't be read: switch the source off so it stops failing every run.
  if(e instanceof AccountMissing){await db.query("update source_configs set enabled=false,updated_at=now() where name=$1",[cfg.source]).catch(()=>{});throw new Error(`${e.message}. Source paused.`)}
  throw e;
 }
 const cutoff=new Date(Date.now()-(cfg.maxAgeDays??45)*86400e3).toISOString();
 const found:(Extracted&{post:Post})[]=[];let errors=0,firstError="";
 // Newest first, so a later "moved to Sunday" post wins over the original announcement.
 // Read up to 3 posts at once (each is an AI call with an image); results are cached, so later runs are instant.
 // The latest 15 posts are read (new ones by AI, the rest from the saved reading). The 15 before those are used
 // only when they were read before: that keeps their events' pictures fresh without any new AI reading.
 const byDate=posts.filter(p=>p.timestamp>=cutoff).sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
 const older=byDate.slice(15).map(p=>p.id);
 const known=new Set(older.length?(await db.query("select id from social_posts where id=any($1)",[older]).catch(()=>({rows:[]}))).rows.map((r:any)=>r.id):[]);
 const recent=byDate.filter((p,i)=>i<15||known.has(p.id));
 const results:Extracted[][]=new Array(recent.length);
 let next=0;
 await Promise.all(Array.from({length:Math.min(3,recent.length)},async()=>{
  while(next<recent.length){const i=next++;const p=recent[i];
   try{results[i]=await cached(p,cfg.venue,cfg.city,ROUNDUPS.has(cfg.username))}catch(e:any){results[i]=[];errors++;firstError||=String(e?.message||e);console.log(`instagram ${cfg.username} post ${p.id}: ${e?.message||e}`)}}
 }));
 recent.forEach((p,i)=>{for(const e of results[i]||[])found.push({...e,post:p})});
 const key=(e:Extracted)=>`${e.date}|${slug(e.title).split("-").filter(w=>w.length>2).slice(0,2).join("-")}`;
 const cancelled=new Set(found.filter(e=>e.cancelled).map(key)),seen=new Set<string>(),out:EventRecord[]=[];
 // When an event is cancelled, the activities that were part of it go too ("POP-UP at ArtWalk" when the ArtWalk is
 // cancelled): same day, and the title carries the cancelled event's distinctive name.
 const townWords=new Set(String(cfg.city||"").toLowerCase().split(/[^a-z]+/));
 const GENERIC=new Set(["downtown","annual","event","night","day","the","and","city","town","village","fall","spring","summer","winter","community","family","festival","fest","party","market","show"]);
 const cancelCore=found.filter(e=>e.cancelled).map(e=>({date:e.date,core:e.title.toLowerCase().replace(/^\W*cancel+ed\W*/,"").split(/[^a-z0-9]+/).filter(w=>w.length>=5&&!townWords.has(w)&&!GENERIC.has(w)).sort((a,b)=>b.length-a.length)[0]})).filter(c=>c.core);
 const partOfCancelled=(e:Extracted)=>!e.cancelled&&cancelCore.some(c=>c.date===e.date&&new RegExp(`\\b${c.core}\\b`,"i").test(e.title));
 // A post that lists several events (a weekly round-up) usually has one cover photo: that photo belongs to none
 // of them. An event gets a picture only when the reading found its own slide (one no other event uses);
 // otherwise the card shows its category art instead of someone else's photo.
 // Counted by different events, not dates: a 3-day festival is one event and keeps its flyer.
 const sameEvent=(t:string)=>slug(t.replace(/\b(day|night) ?\d\b|\b(fri|sat|sun|mon|tue|wed|thu)\w*\b|\(.*?\)/gi," ")).split("-").filter(w=>w.length>2).slice(0,3).join("-");
 const titlesPer=new Map<string,Set<string>>(),slideTitles=new Map<string,Set<string>>();
 for(const e of found){
  titlesPer.set(e.post.id,(titlesPer.get(e.post.id)||new Set()).add(sameEvent(e.title)));
  if(e.slide){const k=`${e.post.id}#${e.slide}`;slideTitles.set(k,(slideTitles.get(k)||new Set()).add(sameEvent(e.title)))}
 }
 const perPost=new Map([...titlesPer].map(([k,v])=>[k,v.size])),perSlide=new Map([...slideTitles].map(([k,v])=>[k,v.size]));
 const pictureFor=(e:any)=>{
  const many=(perPost.get(e.post.id)||0)>=3||ROUNDUPS.has(cfg.username)&&(perPost.get(e.post.id)||0)>=2;
  const own=e.slide&&e.post.media_type==="CAROUSEL_ALBUM"&&(perSlide.get(`${e.post.id}#${e.slide}`)||0)===1&&!(many&&e.slide===1)?slides(e.post)[e.slide-1]:undefined;
  return own||(many?undefined:imageOf(e.post));
 };
 for(const e of found){
  const k=key(e);if(e.cancelled||cancelled.has(k)||partOfCancelled(e)||seen.has(k)||e.date<startDate||e.date>endDate)continue;seen.add(k);
  // Round-up accounts aren't a place: an event from them must name where it is, and the round-up itself isn't an event.
  if(ROUNDUPS.has(cfg.username)&&(!(e.place||"").trim()||/^(fun plans|things to do|what to do|weekend (guide|plans|events)|(this|the) weekend|events? (this|for the) weekend|freebies|.*\bround-?up\b|.*\bguide\b)/i.test(e.title.trim())))continue;
  const blob=`${e.title} ${e.summary||""}`.toLowerCase();
  // Kids = made for children (the Kids filter); Family = children welcome. "kids" from the reading means only
  // "welcome", and one post can list a kids' event next to a plant sale, so Kids needs forKids or a kids' title.
  const forKids=e.forKids===true||KIDS_TITLE.test(e.title);
  const family=forKids||e.kids===true||/\b(kids?|family|children|festival|halloween|trick|santa|egg hunt|parade)\b/.test(blob);
  const arts=/\b(music|concert|band|dj|art|artisan|craft|theat(er|re)|dance|film|movie)\b/.test(blob);
  const time=e.start&&/^\d{2}:\d{2}$/.test(e.start)?e.start+":00":"";
  const end=e.end&&/^\d{2}:\d{2}$/.test(e.end)?e.end+":00":undefined;
  const town=(e.town||"").trim().replace(/,?\s*(FL|Florida)$/i,"");
  out.push({id:`${cfg.idPrefix}-${slug(e.title)}-${e.date}`,title:e.title.trim(),city:town&&/^[A-Za-z .'-]{3,40}$/.test(town)?`${town}, FL`:cfg.city,
   // City and parks accounts post events all over town: use the place the post names, else the account's own venue.
   venue:(e.place||"").split(",")[0].trim().slice(0,120)||cfg.venue,address:e.place&&/\d/.test(e.place)?e.place.split(",").slice(1).join(",").trim()||e.place:e.place?undefined:cfg.address,date:e.date,time,endTime:end&&time&&end>time?end:undefined,
   url:e.post.permalink,sourceUrl:`https://www.instagram.com/${cfg.username}/`,image:pictureFor(e),
   category:family?"Family":arts?"Arts & Theatre":"Local",genre:"Venue Event",desc:(e.summary||"").trim()||`Posted by @${cfg.username}.`,
   tags:[...(family?["Family"]:[]),...(forKids?["Kids"]:[]),...(arts?["Arts & Theatre"]:[]),...(e.free?["Free"]:e.free===false?["Paid"]:[]),"Local"],
   emoji:family?"🎉":arts?"🎨":"📍",source:cfg.source,isFree:e.free===true||undefined,eventType:"event"});
 }
 // Flyers that only name the event: look it up on the web for the official page and a real description.
 // Soonest first, a few per account per run (each look-up is cached, so the rest are done on later runs).
 const thin=out.filter(e=>thinSummary(e.title,e.desc&&!/^Posted by @/.test(e.desc)?e.desc:"")).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,Number(process.env.EVENT_DETAILS_PER_ACCOUNT||4));
 for(const e of thin){
  try{
   // Free first: the sites the post links to and the account's own website. The paid web search only
   // runs if EVENT_DETAILS_WEB_SEARCH=on is set in Vercel (off by default).
   const post=found.find(f=>`${cfg.idPrefix}-${slug(f.title)}-${f.date}`===e.id)?.post;
   let d=await freeLookup({title:e.title,date:e.date,city:cfg.city,sites:[...captionSites(post?.caption||""),...(website?[website]:[])]});
   // Already-paid look-ups are still used from the cache; new ones only when switched on.
   if(!d)d=await lookupDetails({title:e.title,date:e.date,city:cfg.city,place:e.venue!==cfg.venue?e.venue:undefined,account:cfg.username},process.env.EVENT_DETAILS_WEB_SEARCH!=="on");
   if(!d)continue;
   if(d.summary&&d.summary.length>40)e.desc=d.summary.trim().slice(0,1000);
   if(d.url){e.url=d.url}
   const t=(x?:string)=>x&&/^\d{2}:\d{2}$/.test(x)?x+":00":undefined;
   if(!e.time&&t(d.start))e.time=t(d.start)!;
   if(!e.endTime&&t(d.end)&&e.time&&t(d.end)!>e.time)e.endTime=t(d.end);
   // The post named no place (we fell back to the account's home venue): use the event page's place.
   if(d.place&&(e.venue===cfg.venue||!e.venue)&&d.place.trim()!==cfg.venue){e.venue=d.place.trim().slice(0,120);e.address=d.address||undefined}
   else if(d.address&&!e.address)e.address=d.address;
   if(d.free===true){e.isFree=true;if(!e.tags.includes("Free"))e.tags.push("Free")}
   if(d.kids===true&&!e.tags.includes("Family"))e.tags.push("Family");   // children welcome, not a kids' event
  }catch(err:any){console.log(`event details ${e.title}: ${err?.message||err}`)}
 }
 // Nothing upcoming is fine; only report a failure when posts couldn't be read.
 if(!out.length&&errors>0&&errors>=recent.length/2)throw new Error(`@${cfg.username}: ${posts.length} posts read, ${found.length} dated events found, none in ${startDate}..${endDate}${errors?`; ${errors} posts failed (${firstError.slice(0,200)})`:""}${process.env.ANTHROPIC_API_KEY?"":"; ANTHROPIC_API_KEY not set (captions only)"}`);
 // Keep our own copy of each picture: Instagram's links expire after a few days.
 return keepImages(out);
}
