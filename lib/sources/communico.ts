import type {EventRecord} from "../ingestion/types";
import {stripHtml,richText} from "../ingestion/utils";

// Communico library calendars (Broward County Library, Miami-Dade Public Library) expose the JSON
// feed that powers their public calendar page: https://<client>.libnet.info/eeventcaldata

export type CommunicoConfig={
 client:string;                       // subdomain, e.g. "broward" -> broward.libnet.info
 source:string;                       // registry name
 idPrefix:string;
 defaultVenue:string;
 cityFor:(venue:string)=>string;      // feed has no addresses, so map branch -> city
 siteUrl?:string;                     // base for relative event URLs
 baseUrl?:string;                     // custom domain serving the feed (e.g. https://attend.ocls.org)
};

function datePart(v:unknown){const m=String(v||"").match(/(20\d{2})-(\d{2})-(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:""}
function timePart(v:unknown){const m=String(v||"").match(/(?:T|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?/);return m?`${m[1].padStart(2,"0")}:${m[2]}:${m[3]||"00"}`:""}
function arr(v:unknown):string[]{if(Array.isArray(v))return v.map(x=>String(x).trim()).filter(Boolean);if(typeof v==="string")return v.split(",").map(x=>x.trim()).filter(Boolean);return[]}

const BOILERPLATE=/a service of the broward county board of county commissioners\.?|this program is a service of[^.]*\.|in the event indoor programs are cancelled[^.]*\.[^.]*\./gi;
function libText(html:string){return richText(html).split("\n").map(l=>l.replace(BOILERPLATE,"").trim()).filter(Boolean).join("\n")}
/** "Registration required · 5 of 20 spots left" / "Waitlist only" / "Full". */
function registration(e:any){
 if(String(e.allow_reg)!=="1")return{};
 const third=String(e.third_party_reg)==="1"&&/^https?:/i.test(String(e.reg_url||""));
 const max=Number(e.max_attendee)||0,taken=Number(e.total_registrants)||0,wait=String(e.allow_waitlist)==="1";
 let text="Registration required";
 if(max>0){const left=max-taken;text+=left>0?` · ${left} of ${max} spots left`:wait?" · Full (waitlist open)":" · Full"}
 return{registrationText:text,registrationUrl:third?String(e.reg_url):undefined};
}

export async function fetchCommunico(cfg:CommunicoConfig,startDate:string,endDate:string):Promise<EventRecord[]>{
 const base=(cfg.baseUrl||`https://${cfg.client}.libnet.info`).replace(/\/$/,"");
 const days=Math.max(1,Math.min(62,Math.round((Date.parse(endDate+"T12:00:00Z")-Date.parse(startDate+"T12:00:00Z"))/86400000)+1));
 const req=JSON.stringify({private:false,date:startDate,days,locations:[],ages:[],types:[]});
 const src=`${base}/eeventcaldata?event_type=0&req=${encodeURIComponent(req)}`;
 const r=await fetch(src,{headers:{"User-Agent":"Mozilla/5.0 (compatible; GoToday/1.0; +https://mygotoday.com)","Accept":"application/json","Referer":`${base}/events`},cache:"no-store"});
 if(!r.ok)throw new Error(`HTTP ${r.status} from ${new URL(base).host}`);
 const payload:any=await r.json();
 const rows:any[]=Array.isArray(payload)?payload:Array.isArray(payload?.events)?payload.events:[];
 if(rows.length===0)throw new Error(`${new URL(base).host} returned zero records`);
 const out:EventRecord[]=[],seen=new Set<string>();
 for(const e of rows){
  const id=String(e.id??"").trim(),title=stripHtml(String(e.title||"")).replace(/\s+/g," ").trim();
  const date=datePart(e.raw_start_time??e.event_start);
  if(!id||seen.has(id)||title.length<3||!date||date<startDate||date>endDate)continue;
  if(String(e.private_event)==="1")continue;
  seen.add(id);
  const allDay=/all day/i.test(String(e.time_string||""));
  const ages=arr(e.agesArray??e.ages),tags=arr(e.tagsArray??e.tags),search=arr(e.search_tagsArray);
  const text=(title+" "+[...ages,...tags,...search].join(" ")).toLowerCase();
  const kids=/\b(kids?|children|preschool|toddlers?|babies|infants|tweens?|story ?time)\b/.test(text);
  const family=kids||/\bfamil(y|ies)\b/.test(text);
  const arts=/\b(arts?|crafts?|music|performance|dance|exhibit|film)\b/.test(text);
  const free=String(e.registration_cost??"0")==="0";
  let url=String(e.url||"").trim();try{url=url?new URL(url,cfg.siteUrl||base).toString():`${base}/event/${id}`}catch{url=`${base}/event/${id}`}
  const venue=String(e.library||e.location||cfg.defaultVenue).trim()||cfg.defaultVenue;
  if(/^(online|virtual)\b|\b(online|virtual) (event|program)s?\b/i.test(venue))continue; // not "near you"
  const image=e.image?(/^https?:/i.test(e.image)?e.image:`https://static.libnet.info/images/events/${cfg.client}/${String(e.image).replace(/^\/+/,"")}`):undefined;
  out.push({id:`${cfg.idPrefix}-${id}`,title,city:cfg.cityFor(venue),venue,date,
   time:allDay?"":timePart(e.raw_start_time),endTime:allDay?undefined:(timePart(e.raw_end_time)||undefined),
   url,sourceUrl:`${base}/events`,image,category:family?"Family":arts?"Arts & Theatre":"Local",genre:"Library Event",
   desc:[libText(e.description),libText(e.long_description)].filter(Boolean).filter((x,i,a)=>i===0||!a[0].includes(x)).join("\n\n").slice(0,3000)||`${cfg.source} event.`,
   ...registration(e),
   tags:[...ages,...tags,...(family?["Family"]:[]),...(kids?["Kids"]:[]),...(free?["Free"]:[]),...(String(e.allow_reg)!=="1"?["Drop-in"]:[]),"Library"],
   emoji:kids?"📚":arts?"🎨":"📍",source:cfg.source,priceText:free?"Free":String(e.registration_cost||""),isFree:free,eventType:"event"});
 }
 return out;
}
