import {db} from "../db";
import {activeSources} from "./registry";
import {normalize,discoveryRejection,classifyEventType,dedupeKey} from "./utils";
import {quarantineReasons,autoFix} from "./quarantine";
import {ensureSchema} from "../schema";
import {validationErrors} from "./validate";
import {geocodeEvent,cityCoords,venueCoords} from "./geocode";
import {zonedToUtc,DEFAULT_TZ} from "../time";
import type {EventRecord,EventSource} from "./types";

async function sourceRow(s:EventSource){const r=await db.query(`insert into sources(name,source_type,base_url,priority,updated_at) values($1,$2,$3,$4,now()) on conflict(name) do update set source_type=excluded.source_type,base_url=excluded.base_url,priority=excluded.priority,updated_at=now() returning id`,[s.name,s.type,s.url,s.priority]);return Number(r.rows[0].id)}
const venueCache=new Map<string,Promise<number|null>>();
function venueRow(e:EventRecord){const k=`${e.venue}|${e.city||""}|${(e.address||"").trim()}`;let p=venueCache.get(k);if(!p){p=venueRowDb(e);venueCache.set(k,p);p.catch(()=>venueCache.delete(k))}return p}
// A venue row is one place: the same name at a different address (a city's default venue "City of Oakland Park" used
// for City Hall and for a park) is a different row, or every event would show the first event's address.
async function venueRowDb(e:EventRecord){if(!e.venue)return null;const addr=(e.address||"").trim()||null;
 const found=await db.query("select id from venues where name=$1 and coalesce(city,'')=coalesce($2,'') and ($3::text is null or coalesce(address,'')=$3) order by (coalesce(address,'')=coalesce($3,'')) desc limit 1",[e.venue,e.city||null,addr]);if(found.rowCount)return Number(found.rows[0].id);const r=await db.query("insert into venues(name,address,city,state,latitude,longitude) values($1,$2,$3,'FL',$4,$5) returning id",[e.venue,e.address||null,e.city||null,e.latitude??null,e.longitude??null]);return Number(r.rows[0].id)}
// Quarantine: a flagged record is saved with status='quarantine' (public queries only read
// status='active') instead of publishing on a guess. A live row is never pulled back by a flag:
// it keeps its status and only records the reason, so a false positive can't empty a page.
// A quarantined row whose flags clear on a later run auto-releases to 'active'.
async function saveEvent(sourceId:number,e:EventRecord,tz:string,quarantine?:string|null){const v=await venueRow(e),fingerprint=dedupeKey(e);
 const prev=(await db.query(`select status from events where fingerprint=$1 limit 1`,[fingerprint])).rows[0]?.status as string|undefined;
 const status=!prev||prev==="stale"||prev==="quarantine"?(quarantine?"quarantine":"active"):"active";
 // Every event gets coordinates: exact venue location when known, otherwise its city center.
 // A named place without an address is looked up on the map before falling back to the town's center.
 const pt=Number.isFinite(e.latitude)&&Number.isFinite(e.longitude)?{latitude:e.latitude!,longitude:e.longitude!}:(await venueCoords(e.venue,e.city))||await cityCoords(e.city);
 const start=zonedToUtc(e.date,e.time,tz),end=e.endTime?zonedToUtc(e.date,e.endTime,tz):null;await db.query(`insert into events(source_id,external_id,title,description,start_at,end_at,venue_id,city,category,genre,event_type,tags,is_free,is_family_friendly,is_kids_activity,price_text,image_url,official_url,source_url,fingerprint,age_min,age_max,registration_url,registration_text,recurrence,timezone,local_date,latitude,longitude,status,confidence,quarantine_reason,last_verified_at,updated_at)
values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,now(),now())
on conflict(fingerprint) do update set title=excluded.title,description=excluded.description,start_at=excluded.start_at,end_at=excluded.end_at,venue_id=excluded.venue_id,city=excluded.city,category=excluded.category,genre=excluded.genre,event_type=excluded.event_type,tags=excluded.tags,is_free=excluded.is_free,price_text=excluded.price_text,image_url=excluded.image_url,official_url=excluded.official_url,source_url=excluded.source_url,age_min=excluded.age_min,age_max=excluded.age_max,registration_url=excluded.registration_url,registration_text=excluded.registration_text,recurrence=excluded.recurrence,timezone=excluded.timezone,local_date=excluded.local_date,latitude=excluded.latitude,longitude=excluded.longitude,is_family_friendly=excluded.is_family_friendly,is_kids_activity=excluded.is_kids_activity,last_verified_at=now(),updated_at=now(),status=excluded.status,quarantine_reason=excluded.quarantine_reason`,[sourceId,e.id,e.title,e.desc||null,start,end&&end>start?end:null,v,e.city||null,e.category||null,e.genre||null,e.eventType||classifyEventType(e)||"unknown",e.tags||[],!!e.isFree,(e.tags||[]).some(x=>/family/i.test(x)),(e.tags||[]).includes("Kids"),e.priceText||null,e.image||null,e.url,e.sourceUrl||null,fingerprint,e.ageMin??null,e.ageMax??null,e.registrationUrl||null,e.registrationText||null,e.recurrence||null,tz,e.date,pt?.latitude??null,pt?.longitude??null,status,status==="quarantine"?0:100,quarantine||null]);
 if(e.likes!=null)await db.query("update events set likes=$1 where fingerprint=$2",[e.likes,fingerprint]).catch(()=>{})}
type SourceSummary={source:string;found:number;accepted:number;quarantined:number;rejected:number;status:"success"|"error"|"skipped";rejectionReasons?:any[];error?:string};

/** Ingest one source. `getRaw` fetches its records (or returns records fetched elsewhere). */
export async function runSource(s:EventSource,getRaw:()=>Promise<EventRecord[]>):Promise<SourceSummary>{
 await ensureSchema();
 const sourceId=await sourceRow(s),run=await db.query("insert into ingestion_runs(source_id) values($1) returning id",[sourceId]),runId=Number(run.rows[0].id);
 let found=0,accepted=0,quarantined=0,rejected=0;
 try{
  const runStarted=new Date();
  const raw=await getRaw();
  found=raw.length;
  // An Instagram account with no upcoming events is normal; a calendar feed returning nothing usually means it broke.
  // Riverwalk's own calendar often goes empty between seasons (its Instagram covers it), so zero is fine there too.
  // Zero events usually means a calendar broke — unless it's a small calendar that only ever has a few
  // (e.g. a city with 1 listing that just passed). Those are fine.
  if(found===0&&s.platform!=="instagram"&&s.platform!=="riverwalk"){
   const n=(await db.query("select count(*)::int as n from events where source_id=$1 and status='active'",[sourceId])).rows[0]?.n??0;
   if(n>3)throw new Error("Source returned zero records; treating as ingestion failure instead of success");
  }
  // A title this source lists at one place on 12+ different days of the window is the place's daily offering (a museum's
  // permanent gallery, its daily show, an exhibit open every day), not an event: it would flood every day's list.
  const daysOf=new Map<string,Set<string>>();for(const r of raw){const k=`${r.title}|${r.venue||""}`.toLowerCase().replace(/[^a-z0-9|]+/g," ").trim();const d=daysOf.get(k)||new Set<string>();d.add(r.date);daysOf.set(k,d)}
  const daily=new Set([...daysOf].filter(([,d])=>d.size>=12).map(([k])=>k));
  const good:EventRecord[]=[];
  for(const item of raw){
   if(daily.has(`${item.title}|${item.venue||""}`.toLowerCase().replace(/[^a-z0-9|]+/g," ").trim())&&!/ticketmaster/i.test(s.platform||"")){rejected++;await db.query("insert into rejected_events(source_id,ingestion_run_id,raw_title,raw_data,rejection_reason) values($1,$2,$3,$4,$5)",[sourceId,runId,item.title,JSON.stringify({date:item.date,url:item.url}),"not-discovery:daily-attraction"]);continue}
   const e=normalize(item);e.eventType=classifyEventType(e);
   const errors=validationErrors(e),why=discoveryRejection(e);
   if(why)errors.push(`not-discovery:${why}`);
   if(errors.length){rejected++;await db.query("insert into rejected_events(source_id,ingestion_run_id,raw_title,raw_data,rejection_reason) values($1,$2,$3,$4,$5)",[sourceId,runId,e.title,JSON.stringify({date:e.date,time:e.time,url:e.url,venue:e.venue,city:e.city}),Array.from(new Set(errors)).join(",")]);continue}
   good.push(e);
  }
  for(let i=0;i<good.length;i+=5){const batch=good.slice(i,i+5);
   await Promise.all(batch.map(async e=>{const g=autoFix(await geocodeEvent(e)),reasons=quarantineReasons(g);
    if(reasons.length)quarantined++;else accepted++;await saveEvent(sourceId,g,s.timezone||DEFAULT_TZ,reasons.length?reasons.join(","):null)}))}
  // Only a successful refresh may mark this source's older events as stale.
  if(accepted>0)await db.query("update events set status='stale',updated_at=now() where source_id=$1 and status='active' and last_verified_at < $2",[sourceId,runStarted]);
  await db.query("update ingestion_runs set finished_at=now(),status='success',records_found=$1,records_accepted=$2,records_rejected=$3 where id=$4",[found,accepted,rejected,runId]);
  await db.query("update sources set last_success_at=now(),last_error=null,updated_at=now() where id=$1",[sourceId]);
  const reasons=await db.query("select rejection_reason,count(*)::int as count,(array_agg(left(raw_title,90)))[1:4] as examples from rejected_events where ingestion_run_id=$1 group by rejection_reason order by count(*) desc",[runId]);
  return{source:s.name,found,accepted,quarantined,rejected,status:"success",rejectionReasons:reasons.rows};
 }catch(err){
  const msg=err instanceof Error?err.message:String(err);
  // Hitting Instagram's hourly limit isn't the source's fault: skip it this time, keep its last good status.
  if(/^Instagram rate limit/.test(msg)){
   await db.query("update ingestion_runs set finished_at=now(),status='skipped',error_message=$1 where id=$2",[msg,runId]);
   return{source:s.name,found:0,accepted:0,quarantined:0,rejected:0,status:"skipped",error:msg};
  }
  await db.query("update ingestion_runs set finished_at=now(),status='error',records_found=$1,records_accepted=$2,records_rejected=$3,error_message=$4 where id=$5",[found,accepted,rejected,msg,runId]);
  await db.query("update sources set last_error_at=now(),last_error=$1,updated_at=now() where id=$2",[msg,sourceId]);
  return{source:s.name,found,accepted,quarantined,rejected,status:"error",error:msg};
 }
}

export async function persistIngestion(startDate:string,endDate:string,only?:string){
 const list=(await activeSources()).filter(s=>!only||s.name.toLowerCase()===only.toLowerCase());
 if(only&&list.length===0)throw new Error(`Unknown, paused, or remote-only source: ${only}`);
 const summary:SourceSummary[]=[];
 for(const s of list)summary.push(await runSource(s,()=>s.fetch(startDate,endDate)));
 return summary;
}
