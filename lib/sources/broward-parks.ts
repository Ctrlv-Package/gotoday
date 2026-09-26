import type {EventRecord} from "../ingestion/types";
import {stripHtml} from "../ingestion/utils";

// Broward County Parks: the county's own site (broward.org/parks/Events) loads its calendar from
//   POST https://www.broward.org/api/event-calendar  {datasource, language, first, after}
// Each record is a program with a date range, a time string ("4-5:30PM") and recurrence rules
// ("Every Thursday", "Every Second Friday", "Everyday"). We expand them into dated events.
const API="https://www.broward.org/api/event-calendar";
const DATASOURCE="664bd9fb-a5e7-4dba-aa32-874cc2a8ba51"; // "Broward County Park Events" calendar component
const PAGE="https://www.broward.org/parks/Events";
const DAYS=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const NTH:Record<string,number>={first:1,second:2,third:3,fourth:4,last:-1};
// Not "things to go do": standing hours of attractions, ranges, and public meetings.
const INELIGIBLE=/^(meetings?|waterparks?|target practice)$/i;

const v=(e:any,k:string)=>e?.[k]?.jsonValue?.value;
const ymd=(d:Date)=>d.toISOString().slice(0,10);

/** Dates in [from,to] that match the recurrence rules (UTC-safe; dates only). */
export function expandDates(start:string,end:string,rules:string[],from:string,to:string):string[]{
 const s=start>from?start:from,e=(end||start)<to?(end||start):to;
 if(s>e)return[];
 const out:string[]=[];
 for(let d=new Date(s+"T12:00:00Z");ymd(d)<=e;d.setUTCDate(d.getUTCDate()+1)){
  const date=ymd(d),dow=d.getUTCDay(),dom=d.getUTCDate();
  const dim=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
  const ok=rules.length===0||rules.some(r=>{
   const x=r.toLowerCase().trim();
   if(/every\s*day|everyday|daily/.test(x))return true;
   if(/weekdays?/.test(x)&&!/weekends?/.test(x))return dow>=1&&dow<=5;
   if(/weekends?/.test(x))return dow===0||dow===6;
   const m=x.match(/every\s+(?:(first|second|third|fourth|last)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/);
   if(!m||DAYS.indexOf(m[2])!==dow)return false;
   if(!m[1])return true;
   const n=NTH[m[1]];
   return n===-1?dom+7>dim:Math.ceil(dom/7)===n;
  });
  if(ok)out.push(date);
 }
 return out;
}

/** "4-5:30PM" -> ["16:00:00","17:30:00"], "11AM-Noon", "10:30 - 11:45AM", "8PM", "10:00AM". */
export function parseTimeRange(s:string):[string,string]{
 const t=String(s||"").replace(/noon/ig,"12PM").replace(/\s+/g," ");
 const m=t.match(/(\d{1,2})(?::(\d{2}))?\s*([AP])?\.?M?\.?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*([AP])\.?M/i);
 const fmt=(h:number,mi:string)=>`${String(h).padStart(2,"0")}:${mi||"00"}:00`;
 const to24=(h:number,ap:string)=>ap==="p"?(h%12)+12:h%12;
 if(m){
  const ap2=m[6].toLowerCase(),endH=to24(+m[4],ap2);
  let ap1=(m[3]||"").toLowerCase()||ap2,startH=to24(+m[1],ap1);
  if(!m[3]&&startH>endH)startH=to24(+m[1],"a"); // "11-1PM" -> 11 AM
  return[fmt(startH,m[2]),fmt(endH,m[5])];
 }
 const one=t.match(/(\d{1,2})(?::(\d{2}))?\s*([AP])\.?M/i);
 return one?[fmt(to24(+one[1],one[3].toLowerCase()),one[2]),""]:["",""];
}

/** "2-4 with parent", "6-17 Years", "50+", "18 and over", "For ages 2 to 4". */
export function parseAgesField(s:string):[number,number]|null{
 const t=String(s||"");
 let m=t.match(/(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})/);if(m&&+m[1]<=+m[2])return[+m[1],+m[2]];
 m=t.match(/(\d{1,2})\s*(?:\+|years?\s*(?:and|or)\s*(?:older|over|up)|and\s*(?:older|over|up)|or\s*older)/i);if(m)return[+m[1],99];
 if(/all ages/i.test(t))return[0,99];
 return null;
}

export async function fetchBrowardParkEvents(startDate:string,endDate:string):Promise<EventRecord[]>{
 const rows:any[]=[];let after:string|null=null;
 for(let i=0;i<20;i++){
  const r=await fetch(API,{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json","User-Agent":"Mozilla/5.0 (compatible; GoToday/1.0; +https://gotoday-six.vercel.app)","Referer":PAGE},
   body:JSON.stringify({datasource:DATASOURCE,language:"en",first:48,after}),cache:"no-store"});
  if(!r.ok)throw new Error(`HTTP ${r.status} from broward.org event-calendar API`);
  const d:any=await r.json();
  rows.push(...(d.events||[]));
  if(!d.pageInfo?.hasNext||!d.pageInfo?.endCursor)break;
  after=String(d.pageInfo.endCursor);
 }
 if(rows.length===0)throw new Error("broward.org event-calendar API returned zero programs (datasource id may have changed)");
 const out:EventRecord[]=[];
 for(const e of rows){
  const title=stripHtml(String(v(e,"title")||"")).trim();
  const start=String(v(e,"startDate")||"").slice(0,10),end=String(v(e,"endDate")||"").slice(0,10)||start;
  if(!title||!/^\d{4}-\d{2}-\d{2}$/.test(start))continue;
  const rules:string[]=(e.recurrence?.jsonValue||[]).map((r:any)=>String(r.fields?.recurrenceDays?.value||r.displayName||"")).filter(Boolean);
  const dates=expandDates(start,end,rules,startDate,endDate);
  if(!dates.length)continue;
  const cat=String(v(e,"eventCategory")||"").trim();
  const [t1,t2]=parseTimeRange(v(e,"time"));
  const loc=String(v(e,"location")||"").trim();
  const addrMatch=loc.match(/(\d+\s+[^:]+,\s*[A-Za-z .'-]+,\s*FL\s*\d{5})/i);
  const address=addrMatch?addrMatch[1].trim():undefined;
  const cityM=address?.match(/,\s*([A-Za-z .'-]+),\s*FL/i);
  const city=cityM?`${cityM[1].trim()}, FL`:"Broward County, FL";
  const park=String(v(e,"park")?.text||"").trim()||"Broward County Park";
  const price=String(v(e,"price")||"").trim();
  const free=/^free\b/i.test(price);
  const ages=parseAgesField(String(v(e,"ages")||""))||(cat.toLowerCase()==="kids"?[0,12] as [number,number]:null);
  const desc=stripHtml(String(v(e,"description")||"").replace(/&lt;/g,"<").replace(/&gt;/g,">")).replace(/\s+/g," ").trim().slice(0,1000);
  const reg=String(v(e,"register")?.href||"");
  const image=v(e,"featuredImage")?.src||undefined;
  const blob=(title+" "+cat+" "+desc).toLowerCase();
  const kids=cat.toLowerCase()==="kids"||(!!ages&&ages[1]<=18);
  const arts=/\b(arts?|crafts?|performances?|music|dance|cultural|theat)/.test(blob);
  const sports=/\b(sports?|soccer|volleyball|golf|biking|tennis|basketball|pickleball|boccia|walk|run)\b/.test(blob);
  const nature=/\b(nature|hike|trail|bird|garden|wildlife|stables?|pony|farm)\b/.test(blob);
  for(const date of dates){
   out.push({id:`bcparks-${e.id}-${date}`,title,city,venue:park,address,date,time:t1,endTime:t2||undefined,
    url:`${PAGE}?event=${encodeURIComponent(e.name)}`,sourceUrl:/^https?:\/\/.{8,}/.test(reg)?reg:PAGE,image,
    category:kids?"Family":arts?"Arts & Theatre":sports?"Sports":"Local",genre:cat||"Parks & Recreation",
    desc:desc||`${title} at ${park}.`,priceText:price.slice(0,120)||undefined,isFree:free,
    ageMin:ages?.[0],ageMax:ages?.[1],
    tags:[...(cat?[cat]:[]),...(kids?["Kids","Family"]:[]),...(arts?["Arts & Theatre"]:[]),...(sports?["Sports"]:[]),...(nature?["Outdoors"]:[]),"Parks"],
    emoji:kids?"🧒":nature?"🌳":sports?"⚽":arts?"🎨":"📍",source:"Broward County Parks",
    isDiscoveryEligible:INELIGIBLE.test(cat)?false:undefined});
  }
 }
 return out;
}
