import type {EventRecord} from "./types";
import {fetchNycParks} from "../sources/nycparks";
import {fetchCommunico} from "../sources/communico";
import {branchCity as browardBranchCity} from "../sources/broward-library";
import {cityFor as miamiDadeBranchCity} from "../sources/miami-dade-library";
import {fetchBiblioCommons} from "../sources/bibliocommons";
import {fetchCivicPlus} from "../sources/civicplus";
import {fetchGovAccess} from "../sources/govaccess";
import {fetchOpenCities} from "../sources/opencities";
import {fetchLibCal} from "../sources/libcal";
import {cityCoords} from "./geocode";
import {fetchInstagram} from "../sources/instagram";
import {fetchThrillshare} from "../sources/thrillshare";
import {fetchTicketmasterEvents} from "../sources/ticketmaster";
import {fetchBrowardParkEvents} from "../sources/broward-parks";
import {fetchRiverwalkEvents} from "../sources/riverwalk";
import {fetchIcal,fetchTribe,fetchLocalist} from "../sources/generic";

// Every source is (platform, params). Platforms are the calendar products cities, counties and
// libraries buy, so one adapter covers every customer of that product nationwide. Adding a city is
// a new row in source_configs, not new code.
export type Fetcher=(startDate:string,endDate:string)=>Promise<EventRecord[]>;
type Params=Record<string,any>;
type Meta={name:string};

const CITY_MAPS:Record<string,(venue:string)=>string>={broward:browardBranchCity,"miami-dade":miamiDadeBranchCity};
/** Branch -> city lookup from params: cityMap (built-in) or branchCities [[regex,city],...], else defaultCity. */
function cityLookup(p:Params){
 if(CITY_MAPS[p.cityMap])return CITY_MAPS[p.cityMap];
 const pairs:[RegExp,string][]=(p.branchCities||[]).map(([r,c]:[string,string])=>[new RegExp(r,"i"),c]);
 return(v:string)=>{for(const [r,c] of pairs)if(r.test(v))return c;return townFromLibrary(v,p.defaultCity)||p.defaultCity||""};
}

// A shared (consortium) library calendar lists many towns' libraries ("Montclair Public Library", "Fair Lawn's Maurice
// M. Pine Library"). With no branch map, the town in the library's own name says where the event is; without this every
// event was placed in the source's home town, miles from the real library.
const NOT_TOWN=/^(the|main|central|downtown|county|regional|region|branch|children'?s?|kids|teen|youth|law|our|mobile|bookmobile|virtual|online|headquarters|hq|community|public|free|memorial|joint|university|college|school|district|city|town|village|township|borough|library|system|outreach|local|history|genealogy|technology|learning|reference|music|art|arts|science|meeting|room|auditorium)$/i;
/** A town read from a library's name counts only if it is a real town within 40 miles of the calendar's home town
 *  ("Cypress Creek Library" is a branch name, not a town): otherwise the event keeps the home town, as before. */
async function realTowns(events:EventRecord[],p:Params):Promise<EventRecord[]>{
 const home=p.defaultCity?await cityCoords(p.defaultCity):null;if(!home)return events;
 const mapped=new Set((p.branchCities||[]).map((x:[string,string])=>x[1]));const ok=new Map<string,boolean>();
 for(const e of events){const c=e.city||"";if(!c||c===p.defaultCity||mapped.has(c)||ok.has(c))continue;
  const pt=await cityCoords(c);ok.set(c,!!pt&&Math.hypot((pt.latitude-home.latitude)*69,(pt.longitude-home.longitude)*69*Math.cos(home.latitude*Math.PI/180))<=40)}
 return events.map(e=>ok.get(e.city||"")===false?{...e,city:p.defaultCity}:e);
}
export function townFromLibrary(venue:string,defaultCity?:string):string{
 const st=String(defaultCity||"").match(/,\s*([A-Z]{2})$/)?.[1];if(!st)return"";
 const v=String(venue||"").replace(/\s+/g," ").trim();
 const m=v.match(/^(?:the\s+)?([A-Z][A-Za-z.\-]*(?:\s+[A-Z][A-Za-z.\-]*){0,2}?)(?:'s\s|\s+(?:Free\s+)?(?:Public\s+)?(?:Memorial\s+)?(?:Township\s+|Borough\s+|Town\s+|City\s+|Village\s+)?Library\b)/);
 if(!m)return"";
 const town=m[1].replace(/\s+(Twp|Township|Borough|Boro|Town|City|Village)\.?$/i,"").trim();
 if(town.length<3||/county|university|college|school|district|library/i.test(town)||town.split(" ").some(w=>NOT_TOWN.test(w)))return"";
 if(town.toLowerCase()===String(defaultCity).replace(/,.*$/,"").trim().toLowerCase())return"";
 return `${town}, ${st}`;
}
const need=(p:Params,...keys:string[])=>{for(const k of keys)if(p[k]==null||p[k]==="")throw new Error(`Missing param "${k}"`)};
const rx=(s?:string)=>s?new RegExp(s,"i"):undefined;

export const PLATFORMS:Record<string,{describe:string;params:string;build:(p:Params,m:Meta)=>Fetcher}>={
 communico:{describe:"Communico library calendars (*.libnet.info)",params:"client, defaultVenue, defaultCity | cityMap (broward|miami-dade) | branchCities [[regex,city]], siteUrl?, baseUrl? (custom domain)",
  build:(p,m)=>{need(p,"client");
   return(s,e)=>fetchCommunico({client:p.client,source:m.name,idPrefix:p.idPrefix||p.client,defaultVenue:p.defaultVenue||m.name,cityFor:cityLookup(p),siteUrl:p.siteUrl,baseUrl:p.baseUrl},s,e).then(r=>realTowns(r,p))}},
 libcal:{describe:"Springshare LibCal library calendars (*.libcal.com)",params:"site, defaultVenue, defaultCity | branchCities [[regex,city]], calendarId?",
  build:(p,m)=>{need(p,"site");
   return(s,e)=>fetchLibCal({site:p.site,source:m.name,idPrefix:p.idPrefix||p.site,defaultVenue:p.defaultVenue||m.name,cityFor:cityLookup(p),calendarId:p.calendarId},s,e).then(r=>realTowns(r,p))}},
 bibliocommons:{describe:"BiblioCommons library events (gateway.bibliocommons.com)",params:"library, defaultCity, state?",
  build:(p,m)=>{need(p,"library","defaultCity");return(s,e)=>fetchBiblioCommons({library:p.library,source:m.name,idPrefix:p.idPrefix||p.library,defaultCity:p.defaultCity,defaultVenue:p.defaultVenue,state:p.state},s,e)}},
 civicplus:{describe:"CivicPlus/CivicEngage city calendar RSS (RSSFeed.aspx?ModID=58)",params:"site, city, cid?",
  build:(p,m)=>{need(p,"site","city");return(s,e)=>fetchCivicPlus({site:p.site,source:m.name,idPrefix:p.idPrefix||m.name.toLowerCase().replace(/[^a-z]+/g,""),city:p.city,venue:p.venue||m.name,cid:p.cid},s,e)}},
 govaccess:{describe:"Granicus govAccess sites (/Home/Components/Calendar)",params:"site, city, tilePages[], calendarPaths[]",
  build:(p,m)=>{need(p,"site","city");return(s,e)=>fetchGovAccess({site:p.site,source:m.name,idPrefix:p.idPrefix||m.name.toLowerCase().replace(/[^a-z]+/g,""),city:p.city,venue:p.venue||m.name,tilePages:p.tilePages,calendarPaths:p.calendarPaths},s,e)}},
 opencities:{describe:"Granicus OpenCities event lists",params:"listUrl, city, eventPath?, pageUrlTemplate? ({n}), block?",
  build:(p,m)=>{need(p,"listUrl","city");return(s,e)=>fetchOpenCities({listUrl:p.listUrl,eventPath:p.eventPath,source:m.name,idPrefix:p.idPrefix||m.name.toLowerCase().replace(/[^a-z]+/g,""),city:p.city,venue:p.venue||m.name,block:rx(p.block),maxPages:p.maxPages||8,
   pageUrl:p.pageUrlTemplate?(n:number)=>String(p.pageUrlTemplate).replace("{n}",String(n)):undefined},s,e)}},
 thrillshare:{describe:"Apptegy Thrillshare CMS calendars",params:"orgId, city, site",
  build:(p,m)=>{need(p,"orgId","city","site");return(s,e)=>fetchThrillshare({orgId:Number(p.orgId),source:m.name,idPrefix:p.idPrefix||`ts${p.orgId}`,city:p.city,site:p.site},s,e)}},
 instagram:{describe:"Venue Instagram accounts via the official Business Discovery API (needs IG_USER_ID, IG_ACCESS_TOKEN; ANTHROPIC_API_KEY reads flyers)",params:"username, city, venue, address?",
  build:(p,m)=>{need(p,"username","city","venue");return(s,e)=>fetchInstagram({username:String(p.username).replace(/^@/,""),source:m.name,idPrefix:p.idPrefix||`ig-${String(p.username).replace(/[^a-z0-9]/gi,"").toLowerCase()}`,city:p.city,venue:p.venue,address:p.address,maxAgeDays:p.maxAgeDays},s,e)}},
 ticketmaster:{describe:"Ticketmaster Discovery API",params:"marketId | latlong + radius",
  build:(p)=>(s,e)=>fetchTicketmasterEvents(s,e,{marketId:p.marketId,latlong:p.latlong,radius:p.radius,label:p.label})},
 "broward-parks":{describe:"Broward County Parks event-calendar API",params:"(none)",build:()=>fetchBrowardParkEvents},
 riverwalk:{describe:"Riverwalk Fort Lauderdale calendar",params:"(none)",build:()=>fetchRiverwalkEvents},
 ical:{describe:"Any iCal (.ics) calendar feed (Trumba, Google Calendar, CMS exports)",params:"url, city, venue?, tz?",
  build:(p,m)=>{need(p,"url","city");return(s,e)=>fetchIcal({url:p.url,source:m.name,idPrefix:p.idPrefix||m.name.toLowerCase().replace(/[^a-z]+/g,""),city:p.city,venue:p.venue||m.name,tz:p.tz},s,e)}},
 tribe:{describe:"WordPress 'The Events Calendar' (wp-json/tribe/events)",params:"url, city, venue?",
  build:(p,m)=>{need(p,"url","city");return(s,e)=>fetchTribe({url:p.url,source:m.name,idPrefix:p.idPrefix||m.name.toLowerCase().replace(/[^a-z]+/g,""),city:p.city,venue:p.venue||m.name},s,e)}},
 localist:{describe:"Localist event calendars (/api/2/events)",params:"url, city, venue?, tz?",
  build:(p,m)=>{need(p,"url","city");return(s,e)=>fetchLocalist({url:p.url,source:m.name,idPrefix:p.idPrefix||m.name.toLowerCase().replace(/[^a-z]+/g,""),city:p.city,venue:p.venue||m.name,tz:p.tz},s,e)}},
 "nyc-parks":{describe:"NYC Parks public events (NYC Open Data)",params:"(none)",build:(p,m)=>(s,e)=>fetchNycParks(s,e,m.name)},
};

export function buildFetcher(platform:string,params:Params,meta:Meta):Fetcher{
 const pl=PLATFORMS[platform];if(!pl)throw new Error(`Unknown platform "${platform}"`);
 return pl.build(params||{},meta);
}
