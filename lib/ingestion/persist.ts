import {db} from "../db";
import {activeSources} from "./registry";
import {normalize,discoveryRejection,classifyEventType,dedupeKey} from "./utils";
import {ensureSchema} from "../schema";
import {validationErrors} from "./validate";
import {geocodeEvent} from "./geocode";
import type {EventRecord,EventSource} from "./types";

const eastern=(date:string,time?:string)=>new Date(`${date}T${(time||"00:00:00").slice(0,8).padEnd(8,"0")}-04:00`);
async function sourceRow(s:EventSource){const r=await db.query(`insert into sources(name,source_type,base_url,priority,updated_at) values($1,$2,$3,$4,now()) on conflict(name) do update set source_type=excluded.source_type,base_url=excluded.base_url,priority=excluded.priority,updated_at=now() returning id`,[s.name,s.type,s.url,s.priority]);return Number(r.rows[0].id)}
const venueCache=new Map<string,Promise<number|null>>();
function venueRow(e:EventRecord){const k=`${e.venue}|${e.city||""}`;let p=venueCache.get(k);if(!p){p=venueRowDb(e);venueCache.set(k,p);p.catch(()=>venueCache.delete(k))}return p}
async function venueRowDb(e:EventRecord){if(!e.venue)return null;const found=await db.query("select id from venues where name=$1 and coalesce(city,'')=coalesce($2,'') limit 1",[e.venue,e.city||null]);if(found.rowCount)return Number(found.rows[0].id);const r=await db.query("insert into venues(name,address,city,state,latitude,longitude) values($1,$2,$3,'FL',$4,$5) returning id",[e.venue,e.address||null,e.city||null,e.latitude??null,e.longitude??null]);return Number(r.rows[0].id)}
async function saveEvent(sourceId:number,e:EventRecord){const v=await venueRow(e),fingerprint=dedupeKey(e);await db.query(`insert into events(source_id,external_id,title,description,start_at,end_at,venue_id,city,category,genre,event_type,tags,is_free,is_family_friendly,is_kids_activity,price_text,image_url,official_url,source_url,fingerprint,age_min,age_max,status,confidence,last_verified_at,updated_at)
values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'active',100,now(),now())
on conflict(fingerprint) do update set title=excluded.title,description=excluded.description,start_at=excluded.start_at,end_at=excluded.end_at,venue_id=excluded.venue_id,city=excluded.city,category=excluded.category,genre=excluded.genre,event_type=excluded.event_type,tags=excluded.tags,is_free=excluded.is_free,price_text=excluded.price_text,image_url=excluded.image_url,official_url=excluded.official_url,source_url=excluded.source_url,age_min=excluded.age_min,age_max=excluded.age_max,is_family_friendly=excluded.is_family_friendly,is_kids_activity=excluded.is_kids_activity,last_verified_at=now(),updated_at=now(),status='active'`,[sourceId,e.id,e.title,e.desc||null,eastern(e.date,e.time),e.endTime?eastern(e.date,e.endTime):null,v,e.city||null,e.category||null,e.genre||null,e.eventType||classifyEventType(e)||"unknown",e.tags||[],!!e.isFree,(e.tags||[]).some(x=>/family/i.test(x)),(e.tags||[]).includes("Kids"),e.priceText||null,e.image||null,e.url,e.sourceUrl||null,fingerprint,e.ageMin??null,e.ageMax??null])}
type SourceSummary={source:string;found:number;accepted:number;rejected:number;status:"success"|"error";rejectionReasons?:any[];error?:string};

/** Ingest one source. `getRaw` fetches its records (or returns records fetched elsewhere). */
export async function runSource(s:EventSource,getRaw:()=>Promise<EventRecord[]>):Promise<SourceSummary>{
 await ensureSchema();
 const sourceId=await sourceRow(s),run=await db.query("insert into ingestion_runs(source_id) values($1) returning id",[sourceId]),runId=Number(run.rows[0].id);
 let found=0,accepted=0,rejected=0;
 try{
  const runStarted=new Date();
  const raw=await getRaw();
  found=raw.length;
  if(found===0)throw new Error("Source returned zero records; treating as ingestion failure instead of success");
  const good:EventRecord[]=[];
  for(const item of raw){
   const e=normalize(item);e.eventType=classifyEventType(e);
   const errors=validationErrors(e),why=discoveryRejection(e);
   if(why)errors.push(`not-discovery:${why}`);
   if(errors.length){rejected++;await db.query("insert into rejected_events(source_id,ingestion_run_id,raw_title,raw_data,rejection_reason) values($1,$2,$3,$4,$5)",[sourceId,runId,e.title,JSON.stringify(e),Array.from(new Set(errors)).join(",")]);continue}
   good.push(e);
  }
  for(let i=0;i<good.length;i+=5){await Promise.all(good.slice(i,i+5).map(async e=>saveEvent(sourceId,await geocodeEvent(e))));accepted+=good.slice(i,i+5).length}
  // Only a successful refresh may mark this source's older events as stale.
  if(accepted>0)await db.query("update events set status='stale',updated_at=now() where source_id=$1 and status='active' and last_verified_at < $2",[sourceId,runStarted]);
  await db.query("update ingestion_runs set finished_at=now(),status='success',records_found=$1,records_accepted=$2,records_rejected=$3 where id=$4",[found,accepted,rejected,runId]);
  await db.query("update sources set last_success_at=now(),last_error=null,updated_at=now() where id=$1",[sourceId]);
  const reasons=await db.query("select rejection_reason,count(*)::int as count from rejected_events where ingestion_run_id=$1 group by rejection_reason order by count(*) desc",[runId]);
  return{source:s.name,found,accepted,rejected,status:"success",rejectionReasons:reasons.rows};
 }catch(err){
  const msg=err instanceof Error?err.message:String(err);
  await db.query("update ingestion_runs set finished_at=now(),status='error',records_found=$1,records_accepted=$2,records_rejected=$3,error_message=$4 where id=$5",[found,accepted,rejected,msg,runId]);
  await db.query("update sources set last_error_at=now(),last_error=$1,updated_at=now() where id=$2",[msg,sourceId]);
  return{source:s.name,found,accepted,rejected,status:"error",error:msg};
 }
}

export async function persistIngestion(startDate:string,endDate:string,only?:string){
 const list=activeSources().filter(s=>!only||s.name.toLowerCase()===only.toLowerCase());
 if(only&&list.length===0)throw new Error(`Unknown, paused, or remote-only source: ${only}`);
 const summary:SourceSummary[]=[];
 for(const s of list)summary.push(await runSource(s,()=>s.fetch(startDate,endDate)));
 return summary;
}
