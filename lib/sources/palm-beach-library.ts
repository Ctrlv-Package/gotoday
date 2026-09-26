import type {EventRecord} from "../ingestion/types";
import {stripHtml} from "../ingestion/utils";

// Palm Beach County Library System uses BiblioCommons, which serves its event calendar from a public
// JSON gateway. Event records are normalized: ids in events.items, data in entities.events,
// branches (with street addresses) in entities.locations.
const LIB="pbclibrary";
const API=`https://gateway.bibliocommons.com/v2/libraries/${LIB}/events`;
const SITE=`https://${LIB}.bibliocommons.com/v2/events`;

function ymd(s:string){const m=String(s||"").match(/(20\d{2})-(\d{2})-(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:""}
function hms(s:string){const m=String(s||"").match(/T(\d{2}):(\d{2})/);return m?`${m[1]}:${m[2]}:00`:""}
function names(ids:unknown,table:any):string[]{return Array.isArray(ids)?ids.map(id=>table?.[id]?.name).filter(Boolean):[]}

export async function fetchPalmBeachLibraryEvents(startDate:string,endDate:string):Promise<EventRecord[]>{
 const out:EventRecord[]=[],seen=new Set<string>();let total=0;
 for(let page=1;page<=40;page++){
  const url=`${API}?limit=100&page=${page}`;
  const r=await fetch(url,{headers:{"Accept":"application/json","User-Agent":"Mozilla/5.0 (compatible; GoToday/1.0; +https://gotoday-six.vercel.app)"},cache:"no-store"});
  if(!r.ok){if(page===1)throw new Error(`HTTP ${r.status} from BiblioCommons events API`);break}
  const d:any=await r.json();
  const ids:string[]=d?.events?.items||[],ents=d?.entities||{};
  total+=ids.length;
  for(const id of ids){
   const ev=ents.events?.[id];if(!ev||seen.has(id))continue;
   const def=ev.definition||ev;
   if(def.isCancelled||ev.isCancelled)continue;
   const date=ymd(def.start);if(!date||date<startDate||date>endDate)continue;
   seen.add(id);
   const title=stripHtml(String(def.title||"")).replace(/\s+/g," ").trim();if(title.length<3)continue;
   const loc=ents.locations?.[def.branchLocationId];
   const a=loc?.address||{};
   const street=[a.number,a.street].filter(Boolean).join(" ");
   const city=a.city?`${a.city}, FL`:"Palm Beach County, FL";
   const audiences=names(def.audienceIds,ents.eventAudiences),types=names(def.typeIds,ents.eventTypes);
   const text=(title+" "+audiences.join(" ")+" "+types.join(" ")).toLowerCase();
   const kids=/\b(kids?|children|preschool|toddlers?|babies|tweens?|story ?time|ages \d)\b/.test(text);
   const family=kids||/\bfamil(y|ies)\b/.test(text);
   const arts=/\b(arts?|crafts?|music|performance|dance|film|exhibit)\b/.test(text);
   const img=ents.images?.[def.featuredImageId];
   out.push({id:`pbcl-${id}`,title,city,venue:loc?.name||"Palm Beach County Library",address:street?[street,a.city,"FL",a.zip].filter(Boolean).join(", "):undefined,
    date,time:hms(def.start),endTime:hms(def.end)||undefined,url:`${SITE}/${id}`,sourceUrl:`https://${LIB}.bibliocommons.com/v2/events`,
    image:img?.url||img?.src||undefined,category:family?"Family":arts?"Arts & Theatre":"Local",genre:"Library Event",
    desc:stripHtml(String(def.description||"")).replace(/\s+/g," ").trim().slice(0,1000)||"Palm Beach County Library event.",
    tags:[...audiences,...types,...(family?["Family"]:[]),...(kids?["Kids"]:[]),"Free","Library"],
    emoji:kids?"📚":arts?"🎨":"📍",source:"Palm Beach County Library",priceText:"Free",isFree:true,eventType:"event"});
  }
  const pages=Number(d?.events?.pagination?.pages)||0;
  if(ids.length===0||(pages&&page>=pages))break;
 }
 if(total===0)throw new Error("BiblioCommons events API returned zero records");
 return out;
}
