import type {EventRecord} from "../ingestion/types";
import {stripHtml} from "../ingestion/utils";

// NYC Parks public events (next 14 days) from NYC Open Data — free, official, with map coordinates:
//   https://data.cityofnewyork.us/resource/w3wp-dpdi.json
// Fields: title, description, starttime, endtime, parknames, parkids (M/X/B/Q/R + number = borough),
// location, categories ("Fitness | Kids | ..."), coordinates ("lat, lng"), link.url, image.url, registration_url.url
const API="https://data.cityofnewyork.us/resource/w3wp-dpdi.json";
const BOROUGH:Record<string,string>={M:"Manhattan, NY",X:"Bronx, NY",B:"Brooklyn, NY",Q:"Queens, NY",R:"Staten Island, NY"};

export async function fetchNycParks(startDate:string,endDate:string,source="NYC Parks"):Promise<EventRecord[]>{
 const u=new URL(API);
 u.searchParams.set("$limit","5000");
 u.searchParams.set("$where",`starttime >= '${startDate}T00:00:00' AND starttime <= '${endDate}T23:59:59'`);
 u.searchParams.set("$order","starttime");
 const r=await fetch(u.toString(),{headers:{accept:"application/json"},cache:"no-store"});
 if(!r.ok)throw new Error(`NYC Open Data HTTP ${r.status}`);
 const rows:any[]=await r.json();
 const out:EventRecord[]=[];
 for(const x of rows){
  const title=stripHtml(String(x.title||"")).trim(),start=String(x.starttime||"");
  if(!title||!/^\d{4}-\d{2}-\d{2}T/.test(start)||/^(cancel+ed|postponed)\b/i.test(title))continue;
  const date=start.slice(0,10),time=start.slice(11,19),end=String(x.endtime||"").slice(11,19)||undefined;
  const cats=String(x.categories||"").split("|").map(s=>s.trim()).filter(Boolean);
  const [lat,lng]=String(x.coordinates||"").split(",").map(s=>Number(s.trim()));
  const park=String(x.parknames||"").split(",")[0].trim();
  const desc=stripHtml(String(x.description||"").replace(/&nbsp;/g," ")).replace(/\s+/g," ").trim();
  const kids=cats.some(c=>/kids|family|children|teens?/i.test(c))||/\b(kids|children|family|families)\b/i.test(title);
  const paid=/\$\s?\d|\bfee\b|tickets? (are|cost)|admission (is|costs)/i.test(desc);
  out.push({
   id:`nycparks-${x.guid||`${title}-${start}`}`,title,city:BOROUGH[String(x.parkids||"").charAt(0)]||"New York, NY",
   venue:park||String(x.location||"NYC Parks"),address:x.location?String(x.location):undefined,
   date,time:time==="00:00:00"?"":time,endTime:end&&end>time?end:undefined,
   url:x.link?.url?String(x.link.url).replace(/^http:/,"https:"):"https://www.nycgovparks.org/events",
   sourceUrl:"https://www.nycgovparks.org/events",image:x.image?.url?String(x.image.url).replace(/^http:/,"https:"):undefined,
   category:kids?"Family":cats.some(c=>/art|music|dance|film|theat/i.test(c))?"Arts & Theatre":cats.some(c=>/fitness|sports?/i.test(c))?"Sports":"Local",
   genre:cats[0]||"Parks",desc:desc.slice(0,1500),tags:[...cats.slice(0,6),...(kids?["Family"]:[]),"Parks",...(paid?[]:["Free"])],
   emoji:kids?"🎉":"🌳",source,isFree:!paid,
   latitude:Number.isFinite(lat)?lat:undefined,longitude:Number.isFinite(lng)?lng:undefined,
   registrationUrl:x.registration_url?.url||undefined,registrationText:x.registration_description||undefined,eventType:"event"});
 }
 return out;
}
