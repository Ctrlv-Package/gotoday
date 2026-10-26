// AudienceView Professional (OvationTix): the ticketing system of many community and regional theaters
// (ci.ovationtix.com/<clientId>). Its public box-office API lists productions and their performances:
//   GET https://web.ovationtix.com/trs/api/rest/Production                         (header clientId: <id>)
//   GET https://web.ovationtix.com/trs/api/rest/Production(<productionId>)/performance  → {…, venue, performances:[{id,startDate:"YYYY-MM-DD HH:mm"}]}
import type {EventRecord} from "../ingestion/types";
import {fetchRetry} from "../http";
import {stripHtml,richText} from "../ingestion/utils";

export type OvationConfig={clientId:number;source:string;idPrefix:string;city:string;venue:string};
const API="https://web.ovationtix.com/trs/api/rest";
const clean=(s:unknown)=>stripHtml(String(s??"")).replace(/\s+/g," ").trim();
const titleCase=(s:string)=>s===s.toUpperCase()?s.toLowerCase().replace(/\b([a-z])/g,c=>c.toUpperCase()).replace(/\b(A|An|The|Of|And|In|On|At|To|For)\b(?!$)/g,w=>w.toLowerCase()).replace(/^./,c=>c.toUpperCase()):s;

export async function fetchOvationTix(cfg:OvationConfig,startDate:string,endDate:string):Promise<EventRecord[]>{
 const headers={clientId:String(cfg.clientId),Accept:"application/json","User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"};
 const r=await fetchRetry(`${API}/Production`,{headers,cache:"no-store"});
 if(!r.ok)throw new Error(`HTTP ${r.status} from OvationTix (client ${cfg.clientId})`);
 const prods:any[]=await r.json();if(!Array.isArray(prods))throw new Error("OvationTix returned no production list");
 const out:EventRecord[]=[];
 for(const p of prods.slice(0,40)){
  const d=await fetchRetry(`${API}/Production(${p.id})/performance`,{headers,cache:"no-store"}).then(x=>x.ok?x.json():null).catch(()=>null);if(!d)continue;
  const title=titleCase(clean(p.supertitle||p.productionName||d.productionName));if(title.length<3)continue;
  const v=d.venue||p.venue||{},a=v.address||{};
  const desc=richText(String(d.description||p.description||"")).slice(0,3000);
  const t=`${title} ${desc.slice(0,300)}`.toLowerCase();
  const kids=/\b(kids?|children|family|youth|jr\.?|junior)\b/.test(t),music=/\b(concert|band|jazz|symphony|orchestra|choir)\b/.test(t)&&!/\bmusical\b/.test(t);
  for(const pf of d.performances||[]){
   const m=String(pf.startDate||"").match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);if(!m)continue;
   const date=m[1];if(date<startDate||date>endDate||pf.shutOff)continue;
   const em=String(pf.endDate||"").match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);
   out.push({id:`${cfg.idPrefix}-${pf.id}`,title,city:a.city&&a.stateAbbrev?`${clean(a.city)}, ${a.stateAbbrev}`:cfg.city,venue:clean(v.name)||cfg.venue,
    address:[clean(a.line1),clean(a.city),a.stateAbbrev].filter(Boolean).join(", ")||undefined,date,time:`${m[2]}:${m[3]}:00`,
    endTime:em&&em[1]===date?`${em[2]}:${em[3]}:00`:undefined,
    url:`https://ci.ovationtix.com/${cfg.clientId}/production/${p.id}?performanceId=${pf.id}`,sourceUrl:`https://ci.ovationtix.com/${cfg.clientId}`,
    image:/^https?:/.test(String(d.logoUrl||p.logoUrl||""))?String(d.logoUrl||p.logoUrl):undefined,
    category:kids?"Family":music?"Music":"Arts & Theatre",genre:music?"Concert":"Theatre",desc:desc||`${title} at ${clean(v.name)||cfg.venue}.`,
    tags:[...(kids?["Family"]:[]),...(music?["Music"]:["Arts & Theatre"]),"Tickets"],emoji:music?"🎵":"🎭",source:cfg.source,isFree:false,eventType:"event"});
  }
 }
 return out;
}
