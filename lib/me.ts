// What a signed-in person has saved and follows, shaped for the My GoToday page and their calendar feed.
import {db} from "./db";
import {decodeHtml,isAllDay} from "./event-detail";
import type {CalEvent} from "./calendar";
import {DEFAULT_TZ} from "./time";

const SITE=process.env.NEXT_PUBLIC_SITE_URL||"https://www.mygotoday.com";
export type MyEventRow={id:number;title:string;start:Date;end:Date|null;tz:string;venue:string|null;city:string;image:string|null;description:string;cancelled:boolean;source:string;date:string};
const isCancelled=(t:string)=>/^\W*(cancel+ed|postponed)\b/i.test(t);
const COLS=`e.id,e.title,e.start_at,e.end_at,e.timezone,e.city,e.image_url,e.description,e.local_date::text as date,v.name as venue,s.name as source`;
const row=(r:any):MyEventRow=>({id:r.id,title:decodeHtml(r.title).replace(/^\W*(cancel+ed|postponed)\W*/i,""),start:new Date(r.start_at),end:r.end_at?new Date(r.end_at):null,tz:r.timezone||DEFAULT_TZ,
 venue:r.venue?decodeHtml(r.venue):null,city:r.city||"",image:r.image_url,description:decodeHtml(r.description||""),cancelled:isCancelled(r.title||""),source:r.source,date:r.date});

export async function savedEvents(userId:number,fromDaysAgo=30){
 const {rows}=await db.query(`select ${COLS} from saved_events se join events e on e.id=se.event_id join sources s on s.id=e.source_id left join venues v on v.id=e.venue_id
  where se.user_id=$1 and e.start_at>now()-make_interval(days=>$2) order by e.start_at`,[userId,fromDaysAgo]);
 return rows.map(row);
}

export type Followed={seriesId:number;title:string;town:string|null;next:MyEventRow|null;last:{date:string}|null};
/** Followed families: their next listed date (if announced) and when it last happened. */
export async function followedSeries(userId:number):Promise<Followed[]>{
 const {rows}=await db.query(`select es.id,es.title,es.town from follows f join event_series es on es.id=f.series_id where f.user_id=$1 order by f.created_at desc`,[userId]);
 if(!rows.length)return[];
 const ids=rows.map((r:any)=>r.id);
 const next=(await db.query(`select distinct on (e.series_id) e.series_id,${COLS} from events e join sources s on s.id=e.source_id left join venues v on v.id=e.venue_id
   where e.series_id=any($1::int[]) and e.status='active' and e.local_date>=current_date and e.title !~* '^\\W*(cancel+ed|postponed)'
   order by e.series_id,e.start_at,(s.name like '% · Instagram')`,[ids])).rows;
 const last=(await db.query(`select series_id,max(local_date)::text as date from events where series_id=any($1::int[]) and local_date<current_date group by series_id`,[ids])).rows;
 const N=new Map(next.map((r:any)=>[r.series_id,row(r)])),L=new Map(last.map((r:any)=>[r.series_id,{date:r.date}]));
 return rows.map((r:any)=>({seriesId:r.id,title:r.title,town:r.town,next:N.get(r.id)||null,last:L.get(r.id)||null}));
}

/** Everything for the personal calendar: saved events plus every listed date of followed events (one per day). */
export async function calendarEvents(userId:number){
 const saved=await savedEvents(userId,60);
 const fol=(await db.query(`select distinct on (e.series_id,e.local_date) ${COLS} from follows f join events e on e.series_id=f.series_id
   join sources s on s.id=e.source_id left join venues v on v.id=e.venue_id
   where f.user_id=$1 and e.start_at>now()-interval '60 days' and (e.status='active' or e.title ~* '^\\W*(cancel+ed|postponed)')
   order by e.series_id,e.local_date,(e.title ~* '^\\W*cancel') desc,(s.name like '% · Instagram'),e.start_at`,[userId])).rows.map(row);
 // A date that's cancelled anywhere is shown as cancelled; the same date from two sources is one entry.
 const seen=new Set<string>(),out:{e:CalEvent;cancelled?:boolean}[]=[];
 for(const r of [...fol,...saved]){
  const k=`${r.title.toLowerCase()}|${r.date}`;if(seen.has(k))continue;seen.add(k);
  out.push({cancelled:r.cancelled,e:{uid:`gotoday-${r.id}`,title:r.title,description:r.description,location:[r.venue,r.city].filter(Boolean).join(", "),
   start:r.start,end:r.end,allDay:isAllDay(r.start,r.tz),tz:r.tz,url:`${SITE}/events/db-${r.id}`}});
 }
 return out;
}

/** Which calendar apps read this person's GoToday calendar (each one separately), and which "Add to…" they tapped last. */
export async function calendarStatus(userId:number){
 const r=(await db.query("select cal_clicked_at,cal_clicked from users where id=$1",[userId])).rows[0]||{};
 const apps=(await db.query("select client,last_seen from calendar_clients where user_id=$1 and last_seen>now()-interval '30 days' order by first_seen",[userId]).catch(()=>({rows:[]}))).rows;
 return{clickedAt:r.cal_clicked_at?.toISOString?.()||r.cal_clicked_at||null,clicked:r.cal_clicked||null,apps:apps.map((a:any)=>({client:a.client,lastSeen:a.last_seen?.toISOString?.()||a.last_seen}))};
}

/** Is a calendar app reading this person's GoToday calendar (or did they just tap "Add to …")? Then saved events
 *  are already in their calendar, and the calendar buttons say so. */
export async function calendarConnected(userId:number|string):Promise<boolean>{
 const r=await db.query(`select 1 from users where id=$1 and (cal_fetched_at is not null or cal_clicked_at>now()-interval '7 days')
  union all select 1 from calendar_clients where user_id=$1 limit 1`,[userId]).catch(()=>({rowCount:0}));
 return !!r.rowCount;
}
