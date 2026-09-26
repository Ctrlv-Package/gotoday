import type {EventRecord} from "../ingestion/types";
import {stripHtml} from "../ingestion/utils";

const SOURCE="https://broward.libnet.info/events";
const API="https://broward.libnet.info/eeventcaldata";

function datePart(v:unknown){const s=String(v||"");const m=s.match(/(20\d{2})-(\d{2})-(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:""}
function timePart(v:unknown){const s=String(v||"");const m=s.match(/(?:T|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?/);return m?`${m[1].padStart(2,"0")}:${m[2]}:${m[3]||"00"}`:"12:00:00"}
function arr(v:unknown):string[]{return Array.isArray(v)?v.map(x=>String(x).trim()).filter(Boolean):[]}
function eventUrl(e:any){const raw=String(e.url||"").trim();if(raw){try{return new URL(raw,SOURCE).toString()}catch{}}return e.id?`https://broward.libnet.info/event/${e.id}`:""}
function imageUrl(e:any){const raw=String(e.image||"").trim();if(!raw)return undefined;if(/^https?:\/\//i.test(raw))return raw;return `https://static.libnet.info/images/events/broward/${raw.replace(/^\/+/, "")}`}


// Map branch names to their city so distance filtering works (the feed has no addresses).
const BRANCH_CITY:[RegExp,string][]=[
 [/north regional|broward college.*north/i,"Coconut Creek, FL"],[/northwest regional/i,"Coral Springs, FL"],
 [/southwest regional|south regional|pembroke pines/i,"Pembroke Pines, FL"],[/west regional/i,"Plantation, FL"],
 [/main library|african american research|riverland|fort lauderdale|galt ocean|imperial point/i,"Fort Lauderdale, FL"],
 [/nova southeastern|alvin sherman|davie/i,"Davie, FL"],[/miramar/i,"Miramar, FL"],[/weston/i,"Weston, FL"],
 [/sunrise/i,"Sunrise, FL"],[/hollywood/i,"Hollywood, FL"],[/pompano/i,"Pompano Beach, FL"],
 [/hallandale/i,"Hallandale Beach, FL"],[/lauderdale lakes/i,"Lauderdale Lakes, FL"],[/lauderhill/i,"Lauderhill, FL"],
 [/dania/i,"Dania Beach, FL"],[/tamarac/i,"Tamarac, FL"],[/margate/i,"Margate, FL"],[/deerfield/i,"Deerfield Beach, FL"],
 [/coral springs/i,"Coral Springs, FL"],[/coconut creek/i,"Coconut Creek, FL"],[/plantation/i,"Plantation, FL"],
 [/oakland park/i,"Oakland Park, FL"],[/lighthouse point/i,"Lighthouse Point, FL"],[/cooper city/i,"Cooper City, FL"],
 [/pembroke park|west park/i,"West Park, FL"],[/hillsboro|century plaza/i,"Deerfield Beach, FL"],[/north lauderdale/i,"North Lauderdale, FL"],
 [/wilton manors/i,"Wilton Manors, FL"],[/parkland/i,"Parkland, FL"],[/beach branch/i,"Hollywood, FL"]
];
function branchCity(venue:string){for(const [rx,city] of BRANCH_CITY)if(rx.test(venue))return city;return "Broward County, FL"}

export async function fetchBrowardLibraryEvents(startDate:string,endDate:string):Promise<EventRecord[]>{
 const days=Math.max(1,Math.min(62,Math.ceil((Date.parse(endDate+"T12:00:00Z")-Date.parse(startDate+"T12:00:00Z"))/86400000)+1));
 const req=JSON.stringify({private:false,date:startDate,days,locations:[],ages:[],types:[]});
 const src=`${API}?event_type=0&req=${encodeURIComponent(req)}`;
 const r=await fetch(src,{headers:{"User-Agent":"Mozilla/5.0 (compatible; GoToday/1.0; +https://gotoday-six.vercel.app)","Accept":"application/json","Referer":SOURCE},next:{revalidate:21600}});
 if(!r.ok)throw new Error(`Broward Library API HTTP ${r.status}`);
 const payload:any=await r.json();
 const rows:any[]=Array.isArray(payload)?payload:Array.isArray(payload?.events)?payload.events:Array.isArray(payload?.data)?payload.data:[];
 if(rows.length===0)throw new Error("Broward Library JSON endpoint returned zero records");
 const out:EventRecord[]=[];
 for(const e of rows){
  const id=String(e.id??e.event_id??"").trim(),title=stripHtml(String(e.title||"")).replace(/\s+/g," ").trim();
  const start=e.raw_start_time??e.start_time??e.start,date=datePart(start);
  if(!id||title.length<3||!date||date<startDate||date>endDate)continue;
  const ages=arr(e.agesArray??e.ages),tags=arr(e.tagsArray??e.tags),all=[...ages,...tags];
  const text=(title+" "+all.join(" ")).toLowerCase();
  const family=/baby|babies|child|children|family|kid|preschool|school age|teen|toddler|tween|youth/.test(text);
  const arts=/art|craft|music|performance|dance|exhibit/.test(text);
  const free=String(e.registration_cost??"0")==="0";
  const url=eventUrl(e);if(!url)continue;
  const venue=String(e.library??e.location??e.branch??"Broward County Library").trim()||"Broward County Library";
  out.push({id:"bcl-"+id,title,city:branchCity(venue),venue,date,time:timePart(start),endTime:timePart(e.raw_end_time??e.end_time??e.end),url,sourceUrl:src,image:imageUrl(e),category:family?"Family":arts?"Arts & Theatre":"Local",genre:"Library Event",desc:stripHtml(String(e.description??e.desc??"Broward County Library event.")).replace(/\s+/g," ").trim().slice(0,1000),tags:[...all,...(family?["Family"]:[]),...(free?["Free"]:[]),"Library"],emoji:family?"📚":arts?"🎨":"📍",source:"Broward County Library",priceText:free?"Free":String(e.registration_cost||""),isFree:free,eventType:"event"});
 }
 const seen=new Set<string>();return out.filter(e=>{if(seen.has(e.id))return false;seen.add(e.id);return true});
}
