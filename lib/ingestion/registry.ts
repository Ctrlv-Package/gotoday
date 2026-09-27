import type {EventSource} from "./types";
import {buildFetcher} from "./platforms";
import {db} from "../db";
import {ensureSchema} from "../schema";

// Source list. These are SEEDS: on first run they're copied into the source_configs table, and from
// then on the database is the source of truth (add/edit/disable sources via /api/admin/sources
// without deploying). Preferred source order: JSON API > RSS/ICS > HTML.
export type SourceConfig={name:string;platform:string;params:Record<string,any>;source_type?:string;url?:string;priority?:number;region?:string;timezone?:string;enabled?:boolean;remote?:boolean};

const civic=(name:string,site:string,city:string,region:string):SourceConfig=>({name,platform:"civicplus",params:{site,city,idPrefix:city.split(",")[0].toLowerCase().replace(/[^a-z]/g,"")},source_type:"official-city",url:site+"/Calendar.aspx",priority:100,region});
export const SEED_SOURCES:SourceConfig[]=[
 // ---- Broward ----
 civic("City of Hollywood","https://www.hollywoodfl.org","Hollywood, FL","broward"),
 {...civic("City of Pembroke Pines","https://www.ppines.com","Pembroke Pines, FL","broward"),params:{site:"https://www.ppines.com",city:"Pembroke Pines, FL",idPrefix:"ppines"}},
 civic("City of Parkland","https://www.cityofparkland.org","Parkland, FL","broward"),
 {...civic("City of Hallandale Beach","https://www.cohb.org","Hallandale Beach, FL","broward"),params:{site:"https://www.cohb.org",city:"Hallandale Beach, FL",idPrefix:"hallandale"}},
 {...civic("Town of Davie","https://www.davie-fl.gov","Davie, FL","broward"),params:{site:"https://www.davie-fl.gov",city:"Davie, FL",idPrefix:"davie"}},
 civic("City of Margate","https://www.margatefl.com","Margate, FL","broward"),
 {...civic("City of Deerfield Beach","https://www.deerfield-beach.com","Deerfield Beach, FL","broward"),params:{site:"https://www.deerfield-beach.com",city:"Deerfield Beach, FL",idPrefix:"deerfield"}},
 {name:"City of Cooper City",platform:"thrillshare",params:{orgId:30103,city:"Cooper City, FL",site:"https://www.coopercity.gov",idPrefix:"coopercity"},url:"https://www.coopercity.gov/events",priority:100,region:"broward"},
 {name:"City of Weston",platform:"govaccess",remote:true,params:{site:"https://www.westonfl.org",city:"Weston, FL",idPrefix:"weston",tilePages:["/government/parks-and-recreation/special-events"],calendarPaths:["/about/events-calendar"]},url:"https://www.westonfl.org/about/events-calendar",priority:100,region:"broward"},
 {name:"City of Sunrise",platform:"govaccess",remote:true,params:{site:"https://www.sunrisefl.gov",city:"Sunrise, FL",idPrefix:"sunrise",tilePages:["/departments-services/leisure-services/events"],calendarPaths:["/our-city/calendar-of-events"]},url:"https://www.sunrisefl.gov/our-city/calendar-of-events",priority:100,region:"broward"},
 {name:"City of Plantation",platform:"govaccess",remote:true,params:{site:"https://www.plantation.org",city:"Plantation, FL",idPrefix:"plantation",tilePages:["/government/departments/parks-recreation/events","/government/departments/parks-recreation/events/-toggle-next30days"]},url:"https://www.plantation.org/government/departments/parks-recreation/events",priority:100,region:"broward"},
 {name:"City of Fort Lauderdale",platform:"opencities",remote:true,params:{listUrl:"https://www.fortlauderdale.gov/Explore-FTL/Event-Calendar",eventPath:"/Explore-FTL/Event-Calendar",city:"Fort Lauderdale, FL",venue:"Fort Lauderdale",idPrefix:"ftl",
  pageUrlTemplate:"https://www.fortlauderdale.gov/Explore-FTL/Event-Calendar?dlv_OC%20CL%20Public%20Events%20Listing=(pageindex={n})",block:"\\b(board|commission|committee|advisory|meeting|hearing|webinar|king tides|hazardous waste|waste|drop-off|certificate of use|bargaining session|magistrate|development review|code enforcement)\\b"},url:"https://www.fortlauderdale.gov/Explore-FTL/Event-Calendar",priority:100,region:"broward"},
 {name:"Broward County Library",platform:"communico",params:{client:"broward",idPrefix:"bcl",defaultVenue:"Broward County Library",cityMap:"broward"},source_type:"official-county",url:"https://broward.libnet.info/events",priority:98,region:"broward"},
 {name:"Broward County Parks",platform:"broward-parks",params:{},source_type:"official-county",url:"https://www.broward.org/parks/Events",priority:98,region:"broward"},
 {name:"Riverwalk Fort Lauderdale",platform:"riverwalk",params:{},source_type:"local-aggregator",url:"https://www.goriverwalk.com/events/greater-fort-lauderdale-event-calendar",priority:85,region:"broward"},
 // ---- Miami-Dade / Palm Beach ----
 {name:"Miami-Dade Public Library",platform:"communico",params:{client:"mdpls",idPrefix:"mdpl",defaultVenue:"Miami-Dade Public Library",cityMap:"miami-dade",siteUrl:"https://mdpls.org"},source_type:"official-county",url:"https://mdpls.org/events",priority:90,region:"miami-dade"},
 {name:"Palm Beach County Library",platform:"bibliocommons",params:{library:"pbclibrary",idPrefix:"pbcl",defaultCity:"Palm Beach County, FL",defaultVenue:"Palm Beach County Library"},source_type:"official-county",url:"https://pbclibrary.bibliocommons.com/v2/events",priority:90,region:"palm-beach"},
 // ---- Ticketed (supplemental) ----
 {name:"Ticketmaster",platform:"ticketmaster",params:{marketId:"15",label:"South Florida"},source_type:"ticketing",url:"https://www.ticketmaster.com",priority:60,region:"south-florida"},
];

function toSource(c:SourceConfig):EventSource{
 return{name:c.name,type:c.source_type||"official-city",url:c.url||"",priority:c.priority??90,enabled:c.enabled!==false,remote:!!c.remote,timezone:c.timezone||"America/New_York",region:c.region,platform:c.platform,
  fetch:(s,e)=>buildFetcher(c.platform,c.params,{name:c.name})(s,e)};
}

/** Load source configs from the database, seeding any code seeds it doesn't have yet. */
export async function loadSourceConfigs():Promise<SourceConfig[]>{
 await ensureSchema();
 for(const c of SEED_SOURCES){
  await db.query(`insert into source_configs(name,platform,params,source_type,url,priority,region,timezone,enabled,remote) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(name) do nothing`,
   [c.name,c.platform,JSON.stringify(c.params||{}),c.source_type||"official-city",c.url||null,c.priority??90,c.region||null,c.timezone||"America/New_York",c.enabled!==false,!!c.remote]);
 }
 const {rows}=await db.query("select * from source_configs order by priority desc,name");
 return rows.map((r:any)=>({name:r.name,platform:r.platform,params:r.params||{},source_type:r.source_type,url:r.url,priority:r.priority,region:r.region,timezone:r.timezone,enabled:r.enabled,remote:r.remote}));
}
export async function allSources(){return(await loadSourceConfigs()).map(toSource)}
/** Sources ingested on Vercel. */
export async function activeSources(){return(await allSources()).filter(s=>s.enabled!==false&&!s.remote)}
/** Sources fetched outside Vercel (city sites that block cloud servers). */
export async function remoteSources(){return(await allSources()).filter(s=>s.enabled!==false&&s.remote)}
export const sourceFromConfig=toSource;
export async function sourcePriority(name:string){return(await allSources()).find(s=>s.name===name)?.priority??40}
