import type {EventRecord} from "../ingestion/types";
import {slug,stripHtml} from "../ingestion/utils";

// Apptegy "Thrillshare" CMS (used by Cooper City and many schools/cities) serves its calendar as JSON:
//   https://thrillshare-cmsv2.services.thrillshare.com/api/v4/o/<orgId>/cms/events?start_date=&end_date=&paginate=false
// Records include local start/end times, venue + address and latitude/longitude.
export type ThrillshareConfig={orgId:number;source:string;idPrefix:string;city:string;site:string};

export async function fetchThrillshare(cfg:ThrillshareConfig,startDate:string,endDate:string):Promise<EventRecord[]>{
 const u=`https://thrillshare-cmsv2.services.thrillshare.com/api/v4/o/${cfg.orgId}/cms/events?start_date=${startDate}&end_date=${endDate}&view=list-month&paginate=false&locale=en`;
 const r=await fetch(u,{headers:{"Accept":"application/json","User-Agent":"Mozilla/5.0 (compatible; GoToday/1.0; +https://gotoday-six.vercel.app)"},cache:"no-store"});
 if(!r.ok)throw new Error(`HTTP ${r.status} from Thrillshare events API (org ${cfg.orgId})`);
 const d:any=await r.json();
 const rows:any[]=Array.isArray(d?.events)?d.events:[];
 const out:EventRecord[]=[];
 for(const e of rows){
  const title=stripHtml(String(e.title||"")).trim();
  const start=String(e.start_at||e.formatted_start||"");
  const date=start.slice(0,10);
  if(!e.id||!title||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<startDate||date>endDate)continue;
  const time=e.all_day?"":(start.match(/[T ](\d{2}:\d{2})/)?.[1]||"")+(start.match(/[T ]\d{2}:\d{2}/)?":00":"");
  const endAt=String(e.end_at||e.formatted_end||"");
  const endTime=e.all_day?undefined:(endAt.match(/[T ](\d{2}:\d{2})/)?.[1]?endAt.match(/[T ](\d{2}:\d{2})/)![1]+":00":undefined);
  const venueRaw=String(e.venue||e.address||"").trim();
  const [venueName,...rest]=venueRaw.split(" - ");
  const address=(rest.join(" - ")||(/\d/.test(venueName)?venueName:"")).replace(/,\s*USA$/,"")||undefined;
  const cityM=address?.match(/,\s*([A-Za-z .'-]+),\s*FL/i);
  const lat=Number(e.latitude),lng=Number(e.longitude);
  const desc=stripHtml(String(e.description||"")).replace(/\s+/g," ").trim().slice(0,1000);
  const filters:string[]=(Array.isArray(e.filter_name)?e.filter_name:[]).filter(Boolean);
  const blob=(title+" "+desc+" "+filters.join(" ")).toLowerCase();
  const free=/\bfree\b/.test(blob);
  const kids=/\b(kids?|children|youth|teens?|story ?time|trunk or treat|egg hunt)\b/.test(blob);
  const family=kids||/\b(family|festival|parade|movie|fireworks|holiday|celebration)\b/.test(blob);
  const arts=/\b(music|concert|band|film|movie|theat(re|er)|arts?|ceramics|dance|show)\b/.test(blob);
  out.push({id:`${cfg.idPrefix}-${e.id}`,title,city:cityM?`${cityM[1].trim()}, FL`:cfg.city,venue:(venueName&&!/^\d/.test(venueName)?venueName:cfg.source).trim(),address,
   latitude:Number.isFinite(lat)&&lat!==0?lat:undefined,longitude:Number.isFinite(lng)&&lng!==0?lng:undefined,
   date,time,endTime,url:`${cfg.site}/events?id=${e.id}`,sourceUrl:`${cfg.site}/events`,
   category:family?"Family":arts?"Arts & Theatre":"Local",genre:filters[0]||"City Event",desc:desc||`Official ${cfg.source} event.`,
   tags:[...filters,...(family?["Family"]:[]),...(kids?["Kids"]:[]),...(arts?["Arts & Theatre"]:[]),...(free?["Free"]:[]),"Local"],
   emoji:family?"🎉":arts?"🎨":"📍",source:cfg.source,isFree:free||undefined});
 }
 if(rows.length===0)throw new Error(`Thrillshare events API returned no events (org ${cfg.orgId})`);
 return out;
}
