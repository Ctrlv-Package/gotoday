import crypto from "node:crypto";
import {db} from "./db";
import {ensureSchema} from "./schema";
import {zonedToUtc,DEFAULT_TZ} from "./time";
import {geocodeEvent,cityCoords} from "./ingestion/geocode";
import {fetchRetry} from "./http";
import {getImage} from "./images";
import {type Repeat,NO_REPEAT,cleanRepeat,occurrences,describe as describeRepeat} from "./repeat";

// Events people create on GoToday (no account needed).
//  - public: screened automatically, then listed in search for their area (mirrored into `events`).
//  - private: never listed; only people with the link can open it; guests can RSVP.
// The creator gets a secret manage link (only its hash is stored) to edit, delete and see RSVPs.

export const COMMUNITY_SOURCE="GoToday Community";
export type Visibility="public"|"private";
export type CommunityInput={title:string;description:string;date:string;startTime:string;endTime:string;allDay:boolean;venue:string;address:string;city:string;
 visibility:Visibility;isFree:boolean;priceText:string;ageMin:number|null;ageMax:number|null;category:string;categories:string[];link:string;hostName:string;image:string;repeat:Repeat;rsvp:RsvpSettings};
export type CommunityEvent=CommunityInput&{id:number;shareToken:string;status:"live"|"pending"|"rejected"|"deleted";reviewReason:string|null;tz:string;
 latitude:number|null;longitude:number|null;eventId:number|null;createdAt:Date};
export type Rsvp={id:number;name:string;status:"going"|"maybe"|"no";guests:number;note:string;createdAt:Date};

/** How guests answer: Going/Maybe/Can't go on GoToday, and/or straight to the host by text, call or email. */
export type RsvpSettings={onSite:boolean;name:string;phone:string;email:string;by:string};
export const rsvpDefaults=(visibility:Visibility):RsvpSettings=>({onSite:visibility==="private",name:"",phone:"",email:"",by:""});
/** "754-715-2330", "(754) 715 2330", "+1 754…" → "+17547152330"; "" when it isn't a phone number. */
export function cleanPhone(raw:unknown){const d=String(raw??"").replace(/[^\d+]/g,"");const digits=d.replace(/\D/g,"");
 if(digits.length===10)return`+1${digits}`;if(digits.length===11&&digits[0]==="1")return`+${digits}`;if(d.startsWith("+")&&digits.length>=8&&digits.length<=15)return`+${digits}`;return""}
export const showPhone=(p:string)=>/^\+1\d{10}$/.test(p)?`(${p.slice(2,5)}) ${p.slice(5,8)}-${p.slice(8)}`:p;
export function cleanRsvp(raw:any,visibility:Visibility,date:string):{rsvp:RsvpSettings;errors:string[]}{
 const d=rsvpDefaults(visibility);if(!raw||typeof raw!=="object")return{rsvp:d,errors:[]};
 const errors:string[]=[],str=(x:any,n:number)=>String(x??"").replace(/\s+/g," ").trim().slice(0,n);
 const phoneIn=str(raw.phone,40),emailIn=str(raw.email,120).toLowerCase(),phone=cleanPhone(phoneIn);
 if(phoneIn&&!phone)errors.push("The RSVP phone number doesn't look right.");
 const email=/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(emailIn)?emailIn:"";if(emailIn&&!email)errors.push("The RSVP email doesn't look right.");
 let by=/^\d{4}-\d{2}-\d{2}$/.test(String(raw.by||""))?String(raw.by):"";if(by&&date&&by>date)by=date;
 return{rsvp:{onSite:raw.onSite===undefined?d.onSite:!!raw.onSite,name:str(raw.name,60),phone,email,by},errors};
}

export const CATEGORIES=["Family","Kids","Music","Arts & Theatre","Sports","Food & Drink","Market","Community","Party","Outdoors","Other"];

const token=(bytes:number)=>crypto.randomBytes(bytes).toString("base64url");
export const hashToken=(t:string)=>crypto.createHash("sha256").update(t).digest("hex");

// Rough state -> time zone (the few split states use their majority zone).
const STATE_TZ:Record<string,string>={AL:"America/Chicago",AK:"America/Anchorage",AZ:"America/Phoenix",AR:"America/Chicago",CA:"America/Los_Angeles",CO:"America/Denver",HI:"Pacific/Honolulu",
 ID:"America/Boise",IL:"America/Chicago",IA:"America/Chicago",KS:"America/Chicago",LA:"America/Chicago",MN:"America/Chicago",MS:"America/Chicago",MO:"America/Chicago",MT:"America/Denver",
 NE:"America/Chicago",NV:"America/Los_Angeles",NM:"America/Denver",ND:"America/Chicago",OK:"America/Chicago",OR:"America/Los_Angeles",SD:"America/Chicago",TN:"America/Chicago",
 TX:"America/Chicago",UT:"America/Denver",WA:"America/Los_Angeles",WI:"America/Chicago",WY:"America/Denver"};
export const tzForCity=(city:string)=>STATE_TZ[(city.split(",")[1]||"").trim().toUpperCase()]||DEFAULT_TZ;

/** Clean + validate form input. Returns the input or a list of problems. */
export function validate(raw:any):{ok:true;v:CommunityInput}|{ok:false;errors:string[]}{
 const s=(x:any,max:number)=>String(x??"").replace(/\s+/g," ").trim().slice(0,max);
 const time=(x:any)=>{const m=String(x||"").match(/^(\d{1,2}):(\d{2})/);return m&&+m[1]<24&&+m[2]<60?`${m[1].padStart(2,"0")}:${m[2]}`:""};
 const age=(x:any)=>x===""||x==null?null:Math.max(0,Math.min(120,Math.round(Number(x))||0));
 let city=s(raw.city,80);if(city&&!/,\s*[A-Za-z]{2}$/.test(city))city+=", FL";
 const link=s(raw.link,500);
 const v:CommunityInput={title:s(raw.title,120),description:String(raw.description??"").replace(/\r/g,"").trim().slice(0,4000),date:s(raw.date,10),
  startTime:time(raw.startTime),endTime:time(raw.endTime),allDay:!!raw.allDay,venue:s(raw.venue,120),address:s(raw.address,200),city,
  visibility:raw.visibility==="private"?"private":"public",isFree:raw.isFree!==false,priceText:s(raw.priceText,120),ageMin:age(raw.ageMin),ageMax:age(raw.ageMax),
  repeat:NO_REPEAT,
  ...(()=>{const cats=[...new Set((Array.isArray(raw.categories)?raw.categories:[raw.category]).map((x:any)=>String(x||"")).filter((x:string)=>CATEGORIES.includes(x)))].slice(0,4) as string[];
   return{categories:cats.length?cats:["Community"],category:cats[0]||"Community"}})(),link:/^https?:\/\/\S+$/i.test(link)?link:"",hostName:s(raw.hostName,80),
  image:/^\/img\/[0-9a-f]{24}$/.test(String(raw.image||""))?String(raw.image):"",rsvp:rsvpDefaults("public")};
 const errors:string[]=[];
 {const r=cleanRsvp(raw.rsvp,v.visibility,v.date);v.rsvp=r.rsvp;errors.push(...r.errors)}
 if(v.title.length<3)errors.push("Add a title.");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v.date))errors.push("Pick a date.");
 else{const today=new Date(Date.now()-86400e3).toISOString().slice(0,10),max=new Date(Date.now()+400*86400e3).toISOString().slice(0,10);if(v.date<today)errors.push("The date has already passed.");if(v.date>max)errors.push("Pick a date within the next year.")}
 if(!v.allDay&&!v.startTime)errors.push("Add a start time (or mark it all day).");
 if(v.allDay){v.startTime="";v.endTime=""}
 v.repeat=cleanRepeat(raw.repeat,v.date);
 // A repeating event lists dates for at most two years.
 if(v.repeat.kind!=="none"&&/^\d{4}-\d{2}-\d{2}$/.test(v.date)){const cap=new Date(Date.parse(v.date)+730*86400e3).toISOString().slice(0,10);if(!v.repeat.until||v.repeat.until>cap)v.repeat={...v.repeat,until:v.repeat.kind==="yearly"?"":cap}}
 if(v.endTime&&v.startTime&&v.endTime<=v.startTime)v.endTime="";
 if(!v.venue&&!v.address)errors.push("Add a place (venue name or address).");
 if(!v.city)errors.push("Add the city.");
 if(v.ageMin!=null&&v.ageMax!=null&&v.ageMax<v.ageMin)[v.ageMin,v.ageMax]=[v.ageMax,v.ageMin];
 if(v.isFree)v.priceText="";
 return errors.length?{ok:false,errors}:{ok:true,v};
}

// ---------- Automatic screening for public events ----------
type Screen={decision:"approve"|"review"|"reject";reason:string};
// The event's photo goes to the check too (a public listing shows it to everyone).
async function withPhoto(prompt:string,image:string):Promise<any>{
 if(!image)return prompt;
 const img=await getImage(image.slice(5)).catch(()=>undefined);
 if(!img)return prompt;
 return[{type:"image",source:{type:"base64",media_type:img.type,data:Buffer.from(img.data).toString("base64")}},{type:"text",text:prompt+"\nThe event's photo is attached: reject if it is sexual, violent, hateful or shows private information."}];
}
export async function screen(v:CommunityInput):Promise<Screen>{
 const key=process.env.ANTHROPIC_API_KEY;
 if(!key)return{decision:"review",reason:"Automatic check unavailable (no ANTHROPIC_API_KEY)"};
 const prompt=`You review event listings submitted by the public to GoToday, a local "things to do near you" site. Decide if this listing may be shown publicly.
Approve: real, in-person events open to the public (markets, concerts, meetups, festivals, classes open to anyone, sports, fundraisers, community gatherings), including paid ones.
Review (a human decides): unclear or thin details, looks like a private gathering, a business ad more than an event, or anything you're unsure about.
Reject: spam, scams, adult/sexual content, hate or harassment, violence, illegal activity, sales pitches with no event, gibberish, or personal information about others.
Listing:
${JSON.stringify({title:v.title,description:v.description,date:v.date,time:v.allDay?"all day":`${v.startTime}${v.endTime?"-"+v.endTime:""}`,place:[v.venue,v.address,v.city].filter(Boolean).join(", "),price:v.isFree?"free":v.priceText,ages:[v.ageMin,v.ageMax],category:v.categories.join(", "),link:v.link,host:v.hostName})}
Reply with JSON only: {"decision":"approve"|"review"|"reject","reason":"short reason"}`;
 try{
  const r=await fetchRetry("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01"},
   body:JSON.stringify({model:process.env.EVENT_EXTRACT_MODEL||"claude-haiku-4-5-20251001",max_tokens:200,messages:[{role:"user",content:await withPhoto(prompt,v.image)}]})});
  const d:any=await r.json().catch(()=>({}));
  if(!r.ok)return{decision:"review",reason:`Automatic check failed: ${d?.error?.message||r.status}`};
  const j=JSON.parse(((d.content||[]).map((c:any)=>c.text||"").join("").match(/\{[\s\S]*\}/)||["{}"])[0]);
  const decision=["approve","review","reject"].includes(j.decision)?j.decision:"review";
  return{decision,reason:String(j.reason||"").slice(0,300)};
 }catch(e:any){return{decision:"review",reason:`Automatic check failed: ${e?.message||e}`}}
}

// ---------- Storage ----------
async function locate(v:CommunityInput){
 const g=await geocodeEvent({id:"",title:v.title,venue:v.venue,address:v.address?`${v.address}, ${v.city}`:"",city:v.city,date:v.date,time:"",url:"",category:"",genre:"",desc:"",tags:[],emoji:"",source:COMMUNITY_SOURCE} as any);
 if(Number.isFinite(g.latitude)&&Number.isFinite(g.longitude))return{latitude:g.latitude!,longitude:g.longitude!};
 return await cityCoords(v.city);
}

export function rowToEvent(r:any):CommunityEvent{
 return{id:r.id,shareToken:r.share_token,status:r.status,reviewReason:r.review_reason,tz:r.timezone,latitude:r.latitude,longitude:r.longitude,eventId:r.event_id,createdAt:new Date(r.created_at),
  title:r.title,description:r.description||"",date:r.start_date instanceof Date?r.start_date.toISOString().slice(0,10):String(r.start_date).slice(0,10),startTime:r.start_time||"",endTime:r.end_time||"",allDay:r.all_day,
  venue:r.venue||"",address:r.address||"",city:r.city||"",visibility:r.visibility,isFree:r.is_free,priceText:r.price_text||"",ageMin:r.age_min,ageMax:r.age_max,category:r.category||"Community",link:r.link||"",hostName:r.host_name||"",image:r.image||"",repeat:r.repeat&&r.repeat.kind?{...NO_REPEAT,...r.repeat}:NO_REPEAT,categories:r.categories?.length?r.categories:[r.category||"Community"],rsvp:{...rsvpDefaults(r.visibility),...(r.rsvp&&typeof r.rsvp==="object"?r.rsvp:{})}};
}

export async function eventByShare(shareToken:string){await ensureSchema();const {rows}=await db.query("select * from community_events where share_token=$1 and status<>'deleted'",[shareToken]);return rows[0]?rowToEvent(rows[0]):null}
export async function eventByManage(manageToken:string){await ensureSchema();const {rows}=await db.query("select * from community_events where manage_hash=$1 and status<>'deleted'",[hashToken(manageToken)]);return rows[0]?rowToEvent(rows[0]):null}

export const startOf=(e:CommunityEvent,date=e.date)=>zonedToUtc(date,e.allDay?"":`${e.startTime}:00`,e.tz);
export const endOf=(e:CommunityEvent,date=e.date)=>!e.allDay&&e.endTime?zonedToUtc(date,`${e.endTime}:00`,e.tz):null;

/** The dates a listing shows: the event's own date, or for a repeating one the next months' dates (yearly: the next
 *  two years, so "Remind me next year" knows the next date). Refreshed daily so the window keeps moving. */
export function listingDates(e:CommunityEvent,today=new Date().toISOString().slice(0,10)){
 if(e.repeat.kind==="none")return[e.date];
 const from=new Date(Date.parse(today)-86400e3).toISOString().slice(0,10);
 const to=new Date(Date.parse(today)+(e.repeat.kind==="yearly"?800:120)*86400e3).toISOString().slice(0,10);
 return occurrences(e.date,e.repeat,from,to,e.repeat.kind==="yearly"?3:60);
}

/** Mirror a live public event into the searchable `events` table (one row per date); hide it otherwise. */
async function syncListing(e:CommunityEvent,origin:string){
 const listed=e.visibility==="public"&&e.status==="live";
 if(!listed){await db.query("update events set status='stale',updated_at=now() where external_id=$1 or external_id like $2",[`community-${e.id}`,`community-${e.id}-%`]);return}
 const src=await db.query(`insert into sources(name,source_type,base_url,priority,updated_at) values($1,'community',$2,70,now()) on conflict(name) do update set updated_at=now() returning id`,[COMMUNITY_SOURCE,origin]);
 const sourceId=Number(src.rows[0].id);
 let venueId:number|null=null;
 const vname=e.venue||e.address;
 if(vname){const f=await db.query("select id from venues where name=$1 and coalesce(city,'')=coalesce($2,'') limit 1",[vname,e.city||null]);
  venueId=f.rowCount?Number(f.rows[0].id):Number((await db.query("insert into venues(name,address,city,state,latitude,longitude) values($1,$2,$3,$4,$5,$6) returning id",[vname,e.address||null,e.city||null,(e.city.split(",")[1]||"FL").trim(),e.latitude,e.longitude])).rows[0].id)}
 const tags=[...new Set([...e.categories,...(e.isFree?["Free"]:[]),...(e.ageMax!=null&&e.ageMax<=18?["Kids"]:[]),...(e.categories.some(c=>c==="Family"||c==="Kids")?["Family"]:[]),"Community"])];
 // Weekly and monthly events say so ("Every Saturday"); yearly ones don't, so they offer "Remind me next year".
 const recurrence=e.repeat.kind==="weekly"||e.repeat.kind==="monthly"?describeRepeat(e.date,e.repeat):null;
 const repeating=e.repeat.kind!=="none",kept:string[]=[];let firstId:number|null=null;
 for(const date of listingDates(e)){
  const fp=repeating?`community|${e.id}|${date}`:`community|${e.id}`;kept.push(fp);
  const url=`${origin}/e/${e.shareToken}${repeating?`?d=${date}`:""}`,start=startOf(e,date),end=endOf(e,date);
  const vals=[sourceId,repeating?`community-${e.id}-${date}`:`community-${e.id}`,e.title,e.description||null,start,end,venueId,e.city,e.category,"Community Event","event",tags,e.isFree,tags.includes("Family"),tags.includes("Kids"),
   e.isFree?"Free":e.priceText||null,url,url,fp,e.ageMin,e.ageMax,e.tz,date,e.latitude,e.longitude,e.image||null,recurrence];
  const r=await db.query(`insert into events(source_id,external_id,title,description,start_at,end_at,venue_id,city,category,genre,event_type,tags,is_free,is_family_friendly,is_kids_activity,
    price_text,official_url,source_url,fingerprint,age_min,age_max,timezone,local_date,latitude,longitude,image_url,recurrence,status,confidence,last_verified_at,updated_at)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,'active',100,now(),now())
   on conflict(fingerprint) do update set title=excluded.title,description=excluded.description,start_at=excluded.start_at,end_at=excluded.end_at,venue_id=excluded.venue_id,city=excluded.city,
    category=excluded.category,tags=excluded.tags,is_free=excluded.is_free,is_family_friendly=excluded.is_family_friendly,is_kids_activity=excluded.is_kids_activity,price_text=excluded.price_text,
    official_url=excluded.official_url,age_min=excluded.age_min,age_max=excluded.age_max,timezone=excluded.timezone,local_date=excluded.local_date,latitude=excluded.latitude,longitude=excluded.longitude,
    image_url=excluded.image_url,recurrence=excluded.recurrence,status='active',last_verified_at=now(),updated_at=now() returning id`,vals);
  firstId??=Number(r.rows[0].id);
 }
 // Dates no longer in the schedule (edited, or the repeat was turned off) come off the listings.
 await db.query("update events set status='stale',updated_at=now() where (external_id=$1 or external_id like $2) and fingerprint<>all($3) and status='active'",[`community-${e.id}`,`community-${e.id}-%`,kept]);
 if(firstId!=null&&firstId!==e.eventId)await db.query("update community_events set event_id=$1 where id=$2",[firstId,e.id]);
}

/** Daily: keep repeating events' listed dates a few months ahead. */
export async function refreshRepeating(origin:string){
 await ensureSchema();
 const {rows}=await db.query("select * from community_events where status='live' and visibility='public' and repeat is not null and repeat->>'kind'<>'none'");
 for(const r of rows)await syncListing(rowToEvent(r),origin).catch(()=>{});
 return rows.length;
}

export async function createEvent(v:CommunityInput,ip:string,origin:string,userId?:number|null){
 await ensureSchema();
 const ipHash=hashToken(`${ip}|${process.env.INGESTION_SECRET||"gotoday"}`);
 const recent=await db.query("select count(*)::int as n from community_events where ip_hash=$1 and created_at>now()-interval '1 day'",[ipHash]);
 if(recent.rows[0].n>=10)return{error:"You've created a lot of events today. Please try again tomorrow."};
 const sc=v.visibility==="public"?await screen(v):{decision:"approve" as const,reason:"Private (link-only)"};
 if(sc.decision==="reject")return{error:`This event can't be posted publicly: ${sc.reason||"it doesn't look like a public event"}. You can still create it as a private event.`};
 const status=sc.decision==="approve"?"live":"pending";
 const share=token(9),manage=token(24),pt=await locate(v),tz=tzForCity(v.city);
 const {rows}=await db.query(`insert into community_events(share_token,manage_hash,visibility,status,review_reason,title,description,start_date,start_time,end_time,all_day,timezone,venue,address,city,
   latitude,longitude,is_free,price_text,age_min,age_max,category,link,host_name,ip_hash,image,categories,repeat,rsvp) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29) returning *`,
  [share,hashToken(manage),v.visibility,status,sc.reason,v.title,v.description,v.date,v.startTime||null,v.endTime||null,v.allDay,tz,v.venue||null,v.address||null,v.city,
   pt?.latitude??null,pt?.longitude??null,v.isFree,v.priceText||null,v.ageMin,v.ageMax,v.category,v.link||null,v.hostName||null,ipHash,v.image||null,v.categories,v.repeat.kind==='none'?null:JSON.stringify(v.repeat),JSON.stringify(v.rsvp)]);
 if(userId)await db.query("update community_events set user_id=$1,owner_token=$2 where id=$3",[userId,manage,rows[0].id]);
 const e=rowToEvent(rows[0]);
 await syncListing(e,origin);
 return{event:e,manageToken:manage};
}

export async function updateEvent(manageToken:string,v:CommunityInput,origin:string){
 const cur=await eventByManage(manageToken);if(!cur)return{error:"Event not found."};
 // Changing what a public listing says re-runs the check; making it private just unlists it.
 let status=cur.status,reason=cur.reviewReason;
 if(v.visibility==="public"&&cur.status!=="rejected"){const sc=await screen(v);if(sc.decision==="reject")return{error:`This can't be posted publicly: ${sc.reason}. You can make it private instead.`};status=sc.decision==="approve"?"live":"pending";reason=sc.reason}
 if(v.visibility==="private"){status="live";reason="Private (link-only)"}
 const moved=v.address!==cur.address||v.venue!==cur.venue||v.city!==cur.city;
 const pt=moved?await locate(v):{latitude:cur.latitude,longitude:cur.longitude};
 const {rows}=await db.query(`update community_events set visibility=$2,status=$3,review_reason=$4,title=$5,description=$6,start_date=$7,start_time=$8,end_time=$9,all_day=$10,timezone=$11,venue=$12,address=$13,
   city=$14,latitude=$15,longitude=$16,is_free=$17,price_text=$18,age_min=$19,age_max=$20,category=$21,link=$22,host_name=$23,image=$24,categories=$25,repeat=$26,rsvp=$27,updated_at=now() where id=$1 returning *`,
  [cur.id,v.visibility,status,reason,v.title,v.description,v.date,v.startTime||null,v.endTime||null,v.allDay,tzForCity(v.city),v.venue||null,v.address||null,v.city,pt?.latitude??null,pt?.longitude??null,
   v.isFree,v.priceText||null,v.ageMin,v.ageMax,v.category,v.link||null,v.hostName||null,v.image||null,v.categories,v.repeat.kind==='none'?null:JSON.stringify(v.repeat),JSON.stringify(v.rsvp)]);
 const e=rowToEvent(rows[0]);await syncListing(e,origin);return{event:e};
}

export async function deleteEvent(manageToken:string){
 const cur=await eventByManage(manageToken);if(!cur)return false;
 await db.query("update community_events set status='deleted',updated_at=now() where id=$1",[cur.id]);
 if(cur.eventId)await db.query("update events set status='stale',updated_at=now() where id=$1",[cur.eventId]);
 return true;
}

/** Hand an event to another GoToday account, by the email they signed in with. The manage link rotates,
 * so the old owner's link stops working — a transfer, not a copy. RSVPs and the public listing stay
 * with the event, and the new owner finds it in My GoToday. */
export async function transferEvent(manageToken:string,recipientEmail:string){
 await ensureSchema();
 const cur=await eventByManage(manageToken);if(!cur)return{error:"Event not found."};
 const email=String(recipientEmail||"").trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return{error:"Add the email address of their GoToday account."};
 const r=await db.query("select id from users where lower(email)=lower($1)",[email]);
 if(!r.rowCount)return{error:"No GoToday account uses that email yet. Ask them to sign in to GoToday first, then try again."};
 const toId=Number(r.rows[0].id);
 const owner=await db.query("select user_id from community_events where id=$1",[cur.id]);
 if(owner.rows[0]?.user_id!=null&&Number(owner.rows[0].user_id)===toId)return{error:"That account already owns this event."};
 const next=token(24);
 await db.query("update community_events set user_id=$2,owner_token=$3,manage_hash=$4,updated_at=now() where id=$1",[cur.id,toId,next,hashToken(next)]);
 return{event:cur,recipientEmail:email};
}

/** Admin review of public events the automatic check wasn't sure about. */
export async function pendingEvents(){await ensureSchema();const {rows}=await db.query("select * from community_events where status='pending' order by created_at");return rows.map(rowToEvent)}
export async function reviewEvent(id:number,approve:boolean,origin:string){
 const {rows}=await db.query("update community_events set status=$2,review_reason=$3,updated_at=now() where id=$1 and status='pending' returning *",[id,approve?"live":"rejected",approve?"Approved by admin":"Rejected by admin"]);
 if(!rows[0])return false;await syncListing(rowToEvent(rows[0]),origin);return true;
}

// ---------- RSVPs ----------
export async function addRsvp(shareToken:string,raw:any){
 const e=await eventByShare(shareToken);if(!e||e.status!=="live")return{error:"Event not found."};
 if(!e.rsvp.onSite)return{error:"This host takes RSVPs by phone or email."};
 const name=String(raw.name||"").replace(/\s+/g," ").trim().slice(0,60);if(name.length<2)return{error:"Add your name."};
 const status=["going","maybe","no"].includes(raw.status)?raw.status:"going";
 const guests=Math.max(0,Math.min(20,Math.round(Number(raw.guests)||0)));
 const note=String(raw.note||"").trim().slice(0,280);
 const n=await db.query("select count(*)::int as n from rsvps where community_event_id=$1",[e.id]);
 if(n.rows[0].n>=500)return{error:"This guest list is full."};
 // Same name again = update their answer instead of a duplicate row.
 const {rows}=await db.query(`insert into rsvps(community_event_id,name,status,guests,note) values($1,$2,$3,$4,$5)
  on conflict(community_event_id,lower(name)) do update set status=excluded.status,guests=excluded.guests,note=excluded.note,created_at=now() returning *`,[e.id,name,status,guests,note||null]);
 return{rsvp:rows[0]};
}
export async function rsvpsFor(eventId:number):Promise<Rsvp[]>{
 const {rows}=await db.query("select * from rsvps where community_event_id=$1 order by created_at",[eventId]);
 return rows.map((r:any)=>({id:r.id,name:r.name,status:r.status,guests:r.guests,note:r.note||"",createdAt:new Date(r.created_at)}));
}
export async function rsvpCounts(eventId:number){
 const {rows}=await db.query("select status,count(*)::int as n,coalesce(sum(guests),0)::int as g from rsvps where community_event_id=$1 group by status",[eventId]);
 const c={going:0,maybe:0,no:0};for(const r of rows)(c as any)[r.status]=r.status==="no"?r.n:r.n+r.g;return c;
}

/** Events someone created, for My GoToday. */
export async function eventsOfUser(userId:number){
 await ensureSchema();
 const {rows}=await db.query("select * from community_events where user_id=$1 and status<>'deleted' order by start_date desc,id desc limit 100",[userId]);
 // Replies so far (going / maybe / can't go), so the host sees them in My GoToday.
 const ids=rows.map((r:any)=>r.id);const c=new Map<number,{going:number;maybe:number;no:number}>();
 if(ids.length){const q=await db.query("select community_event_id as id,status,count(*)::int as n,coalesce(sum(guests),0)::int as g from rsvps where community_event_id=any($1) group by 1,2",[ids]).catch(()=>({rows:[]}));
  for(const x of q.rows as any[]){const o=c.get(x.id)||{going:0,maybe:0,no:0};(o as any)[x.status]=x.status==="no"?x.n:x.n+x.g;c.set(x.id,o)}}
 return rows.map((r:any)=>({...rowToEvent(r),ownerToken:r.owner_token as string|null,rsvpCounts:c.get(r.id)||null}));
}
/** Attach events made on this device before signing in (proved by their manage links) to the account. */
export async function claimEvents(userId:number,manageTokens:string[]){
 await ensureSchema();let n=0;
 for(const t of manageTokens.slice(0,50)){
  if(!/^[A-Za-z0-9_-]{16,}$/.test(t))continue;
  const r=await db.query("update community_events set user_id=$1,owner_token=$2 where manage_hash=$3 and user_id is null and status<>'deleted'",[userId,t,hashToken(t)]);
  n+=r.rowCount||0;
 }
 return n;
}
