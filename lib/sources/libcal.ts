import type {EventRecord} from "../ingestion/types";
import {fetchRetry} from "../http";
import {stripHtml,richText} from "../ingestion/utils";

// Springshare LibCal library calendars (St. Petersburg, Osceola, Boca Raton, ...). The public calendar
// page loads its list from a JSON endpoint:
//   https://<site>.libcal.com/ajax/calendar/list?c=-1&date=0000-00-00&perpage=48&page=N
// -> {total_results, perpage, results:[{id,title,description,startdt,enddt,all_day,url,location,campus,
//     audiences:[{name}],categories_arr:[{name}],featured_image,registration_enabled,online_event,...}]}
// startdt/enddt are local wall-clock times ("YYYY-MM-DD HH:MM:SS").
export type LibCalConfig={site:string;source:string;idPrefix:string;defaultVenue:string;cityFor:(venue:string)=>string;calendarId?:number};

const names=(v:unknown):string[]=>Array.isArray(v)?v.map(x=>typeof x==="string"?x:x?.name).map(x=>String(x||"").trim()).filter(Boolean):[];
const ymd=(s:string)=>String(s||"").match(/^(20\d{2}-\d{2}-\d{2})/)?.[1]||"";
const hms=(s:string)=>{const m=String(s||"").match(/[T ](\d{2}):(\d{2})/);return m?`${m[1]}:${m[2]}:00`:""};
const truthy=(v:unknown)=>v===true||v===1||v==="1"||v==="true";

export async function fetchLibCal(cfg:LibCalConfig,startDate:string,endDate:string):Promise<EventRecord[]>{
 const base=`https://${cfg.site}.libcal.com`;
 const out:EventRecord[]=[],seen=new Set<string>();let total=0;
 for(let page=1;page<=30;page++){
  const url=`${base}/ajax/calendar/list?c=${cfg.calendarId??-1}&date=0000-00-00&perpage=48&page=${page}&audience=&cats=&camps=&inc=0`;
  const r=await fetchRetry(url,{headers:{"Accept":"application/json, text/javascript, */*","X-Requested-With":"XMLHttpRequest","Referer":`${base}/calendar`,
   "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"},cache:"no-store"});
  if(!r.ok){if(page===1)throw new Error(`HTTP ${r.status} from ${cfg.site}.libcal.com`);break}
  const d:any=await r.json();
  const rows:any[]=Array.isArray(d?.results)?d.results:[];
  total+=rows.length;
  let pastEnd=rows.length>0;
  for(const e of rows){
   const date=ymd(e.startdt);
   if(date&&date<=endDate)pastEnd=false;
   const id=String(e.id??"");
   if(!id||!date||date<startDate||date>endDate||seen.has(id+date))continue;
   if(truthy(e.online_event))continue;                       // virtual programs aren't "near you"
   seen.add(id+date);
   const title=stripHtml(String(e.title||"")).replace(/\s+/g," ").trim();if(title.length<3)continue;
   const campus=stripHtml(String(e.campus||"")).trim(),room=stripHtml(String(e.location||"")).trim();
   const venue=campus||room||cfg.defaultVenue;
   const audiences=names(e.audiences),cats=names(e.categories_arr);
   const text=(title+" "+audiences.join(" ")+" "+cats.join(" ")).toLowerCase();
   const kids=/\b(kids?|children|preschool|toddlers?|babies|infants|tweens?|story ?time|elementary)\b/.test(text);
   const family=kids||/\bfamil(y|ies)\b/.test(text);
   const arts=/\b(arts?|crafts?|music|performance|dance|exhibit|film)\b/.test(text);
   const cost=String(e.registration_cost||"").trim();
   const free=!cost||/^(0|0\.00|\$0(\.00)?|free)$/i.test(cost);
   const reg=truthy(e.registration_enabled)||truthy(e.registration);
   const allDay=truthy(e.all_day);
   let link=String(e.url||"").trim();try{link=link?new URL(link,base).toString():`${base}/event/${id}`}catch{link=`${base}/event/${id}`}
   const img=String(e.featured_image||"").trim();
   out.push({id:`${cfg.idPrefix}-${id}-${date}`,title,city:cfg.cityFor(venue+" "+room),venue,date,
    time:allDay?"":hms(e.startdt),endTime:allDay?undefined:(hms(e.enddt)||undefined),
    url:link,sourceUrl:`${base}/calendar`,image:/^https?:/i.test(img)?img:img?new URL(img,base).toString():undefined,
    category:family?"Family":arts?"Arts & Theatre":"Local",genre:"Library Event",
    desc:richText(String(e.description||"")).slice(0,3000)||`${cfg.source} event.`,
    registrationText:reg?"Registration required":undefined,registrationUrl:reg?link:undefined,
    tags:[...audiences,...cats,...(family?["Family"]:[]),...(kids?["Kids"]:[]),...(free?["Free"]:[]),...(reg?[]:["Drop-in"]),"Library"],
    emoji:kids?"📚":arts?"🎨":"📍",source:cfg.source,priceText:free?"Free":cost,isFree:free,eventType:"event"});
  }
  const per=Number(d?.perpage)||48,tot=Number(d?.total_results)||0;
  if(rows.length===0||pastEnd||(tot&&page*per>=tot))break;
 }
 if(total===0)throw new Error(`${cfg.site}.libcal.com returned zero events`);
 return out;
}
