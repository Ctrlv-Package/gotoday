import type { EventSource } from "./types";
import { fetchCivicPlus } from "../sources/civicplus";
import { fetchSunriseEvents } from "../sources/sunrise";
import { fetchRiverwalkEvents } from "../sources/riverwalk";
import { fetchBrowardParkEvents } from "../sources/broward-parks";
import { fetchBrowardLibraryEvents } from "../sources/broward-library";
import { fetchMiamiDadeLibraryEvents } from "../sources/miami-dade-library";
import { fetchPalmBeachLibraryEvents } from "../sources/palm-beach-library";
import { fetchPlantationEvents } from "../sources/plantation";
import { fetchFortLauderdaleEvents } from "../sources/fort-lauderdale";
import { fetchTicketmasterEvents } from "../sources/ticketmaster";
import { fetchGovAccess } from "../sources/govaccess";
import { fetchThrillshare } from "../sources/thrillshare";

// Preferred source order: JSON API > RSS/ICS feed > HTML scraping (last resort).
const civic=(name:string,site:string,idPrefix:string,city:string)=>({
 name,type:"official-city",url:site+"/Calendar.aspx",priority:100,
 fetch:(s:string,e:string)=>fetchCivicPlus({site,source:name,idPrefix,city,venue:name},s,e)
});

export const sources:EventSource[]=[
 // Official city calendars via CivicPlus RSS feeds (structured, include addresses)
 civic("City of Hollywood","https://www.hollywoodfl.org","hollywood","Hollywood, FL"),
 civic("City of Pembroke Pines","https://www.ppines.com","ppines","Pembroke Pines, FL"),
 civic("City of Parkland","https://www.cityofparkland.org","parkland","Parkland, FL"),
 civic("City of Hallandale Beach","https://www.cohb.org","hallandale","Hallandale Beach, FL"),
 civic("Town of Davie","https://www.davie-fl.gov","davie","Davie, FL"),
 civic("City of Margate","https://www.margatefl.com","margate","Margate, FL"),
 civic("City of Deerfield Beach","https://www.deerfield-beach.com","deerfield","Deerfield Beach, FL"),
 // Weston (Granicus govAccess: Special Events tiles + main calendar grid)
 {name:"City of Weston",type:"official-city",url:"https://www.westonfl.org/about/events-calendar",priority:100,remote:true,
  fetch:(s,e)=>fetchGovAccess({site:"https://www.westonfl.org",source:"City of Weston",idPrefix:"weston",city:"Weston, FL",venue:"City of Weston",
   tilePages:["/government/parks-and-recreation/special-events","/government/parks-and-recreation/special-events/-toggle-next30days"],calendarPaths:["/about/events-calendar"]},s,e)},
 // Cooper City (Apptegy Thrillshare JSON API)
 {name:"City of Cooper City",type:"official-city",url:"https://www.coopercity.gov/events",priority:100,
  fetch:(s,e)=>fetchThrillshare({orgId:30103,source:"City of Cooper City",idPrefix:"coopercity",city:"Cooper City, FL",site:"https://www.coopercity.gov"},s,e)},
 // County-wide and library JSON feeds
 {name:"Broward County Library",type:"official-county",url:"https://broward.libnet.info/events",priority:98,fetch:fetchBrowardLibraryEvents},
 {name:"Broward County Parks",type:"official-county",url:"https://www.broward.org/parks/Events",priority:98,fetch:fetchBrowardParkEvents},
 {name:"Miami-Dade Public Library",type:"official-county",url:"https://mdpls.org/events",priority:90,fetch:fetchMiamiDadeLibraryEvents},
 {name:"Palm Beach County Library",type:"official-county",url:"https://pbclibrary.bibliocommons.com/v2/events",priority:90,fetch:fetchPalmBeachLibraryEvents},
 {name:"Riverwalk Fort Lauderdale",type:"local-aggregator",url:"https://www.goriverwalk.com/events/greater-fort-lauderdale-event-calendar",priority:85,fetch:fetchRiverwalkEvents},
 // Supplemental ticketed inventory
 {name:"Ticketmaster",type:"ticketing",url:"https://www.ticketmaster.com",priority:60,fetch:fetchTicketmasterEvents},
 // Remote-only: these city sites return HTTP 403 to Vercel's servers, so they are fetched by the
 // scheduled GitHub Action (scripts/remote-ingest.ts) and pushed to /api/ingest/push.
 {name:"City of Sunrise",type:"official-city",url:"https://www.sunrisefl.gov/our-city/calendar-of-events",priority:100,fetch:fetchSunriseEvents,remote:true},
 {name:"City of Plantation",type:"official-city",url:"https://www.plantation.org/government/departments/parks-recreation/events",priority:100,fetch:fetchPlantationEvents,remote:true},
 {name:"City of Fort Lauderdale",type:"official-city",url:"https://www.fortlauderdale.gov/Explore-FTL/Event-Calendar",priority:100,fetch:fetchFortLauderdaleEvents,remote:true}
];
export const activeSources=()=>sources.filter(s=>s.enabled!==false&&!s.remote);
export const remoteSources=()=>sources.filter(s=>s.enabled!==false&&s.remote);
export const sourcePriority=(name:string)=>sources.find(s=>s.name===name)?.priority??40;
