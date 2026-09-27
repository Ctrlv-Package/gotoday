import type {EventRecord} from "./types";
import {fetchCommunico} from "../sources/communico";
import {branchCity as browardBranchCity} from "../sources/broward-library";
import {cityFor as miamiDadeBranchCity} from "../sources/miami-dade-library";
import {fetchBiblioCommons} from "../sources/bibliocommons";
import {fetchCivicPlus} from "../sources/civicplus";
import {fetchGovAccess} from "../sources/govaccess";
import {fetchOpenCities} from "../sources/opencities";
import {fetchThrillshare} from "../sources/thrillshare";
import {fetchTicketmasterEvents} from "../sources/ticketmaster";
import {fetchBrowardParkEvents} from "../sources/broward-parks";
import {fetchRiverwalkEvents} from "../sources/riverwalk";

// Every source is (platform, params). Platforms are the calendar products cities, counties and
// libraries buy, so one adapter covers every customer of that product nationwide. Adding a city is
// a new row in source_configs, not new code.
export type Fetcher=(startDate:string,endDate:string)=>Promise<EventRecord[]>;
type Params=Record<string,any>;
type Meta={name:string};

const CITY_MAPS:Record<string,(venue:string)=>string>={broward:browardBranchCity,"miami-dade":miamiDadeBranchCity};
const need=(p:Params,...keys:string[])=>{for(const k of keys)if(p[k]==null||p[k]==="")throw new Error(`Missing param "${k}"`)};
const rx=(s?:string)=>s?new RegExp(s,"i"):undefined;

export const PLATFORMS:Record<string,{describe:string;params:string;build:(p:Params,m:Meta)=>Fetcher}>={
 communico:{describe:"Communico library calendars (*.libnet.info)",params:"client, defaultVenue, defaultCity | cityMap (broward|miami-dade) | branchCities [[regex,city]], siteUrl?",
  build:(p,m)=>{need(p,"client");
   const pairs:[RegExp,string][]=(p.branchCities||[]).map(([r,c]:[string,string])=>[new RegExp(r,"i"),c]);
   const cityFor=CITY_MAPS[p.cityMap]||((v:string)=>{for(const [r,c] of pairs)if(r.test(v))return c;return p.defaultCity||""});
   return(s,e)=>fetchCommunico({client:p.client,source:m.name,idPrefix:p.idPrefix||p.client,defaultVenue:p.defaultVenue||m.name,cityFor,siteUrl:p.siteUrl},s,e)}},
 bibliocommons:{describe:"BiblioCommons library events (gateway.bibliocommons.com)",params:"library, defaultCity, state?",
  build:(p,m)=>{need(p,"library","defaultCity");return(s,e)=>fetchBiblioCommons({library:p.library,source:m.name,idPrefix:p.idPrefix||p.library,defaultCity:p.defaultCity,defaultVenue:p.defaultVenue,state:p.state},s,e)}},
 civicplus:{describe:"CivicPlus/CivicEngage city calendar RSS (RSSFeed.aspx?ModID=58)",params:"site, city, cid?",
  build:(p,m)=>{need(p,"site","city");return(s,e)=>fetchCivicPlus({site:p.site,source:m.name,idPrefix:p.idPrefix||m.name.toLowerCase().replace(/[^a-z]+/g,""),city:p.city,venue:p.venue||m.name,cid:p.cid},s,e)}},
 govaccess:{describe:"Granicus govAccess sites (/Home/Components/Calendar)",params:"site, city, tilePages[], calendarPaths[]",
  build:(p,m)=>{need(p,"site","city");return(s,e)=>fetchGovAccess({site:p.site,source:m.name,idPrefix:p.idPrefix||m.name.toLowerCase().replace(/[^a-z]+/g,""),city:p.city,venue:p.venue||m.name,tilePages:p.tilePages,calendarPaths:p.calendarPaths},s,e)}},
 opencities:{describe:"Granicus OpenCities event lists",params:"listUrl, eventPath, city, pageUrlTemplate? ({n}), block?",
  build:(p,m)=>{need(p,"listUrl","eventPath","city");return(s,e)=>fetchOpenCities({listUrl:p.listUrl,eventPath:p.eventPath,source:m.name,idPrefix:p.idPrefix||m.name.toLowerCase().replace(/[^a-z]+/g,""),city:p.city,venue:p.venue||m.name,block:rx(p.block),maxPages:p.maxPages||8,
   pageUrl:p.pageUrlTemplate?(n:number)=>String(p.pageUrlTemplate).replace("{n}",String(n)):undefined},s,e)}},
 thrillshare:{describe:"Apptegy Thrillshare CMS calendars",params:"orgId, city, site",
  build:(p,m)=>{need(p,"orgId","city","site");return(s,e)=>fetchThrillshare({orgId:Number(p.orgId),source:m.name,idPrefix:p.idPrefix||`ts${p.orgId}`,city:p.city,site:p.site},s,e)}},
 ticketmaster:{describe:"Ticketmaster Discovery API",params:"marketId | latlong + radius",
  build:(p)=>(s,e)=>fetchTicketmasterEvents(s,e,{marketId:p.marketId,latlong:p.latlong,radius:p.radius,label:p.label})},
 "broward-parks":{describe:"Broward County Parks event-calendar API",params:"(none)",build:()=>fetchBrowardParkEvents},
 riverwalk:{describe:"Riverwalk Fort Lauderdale calendar",params:"(none)",build:()=>fetchRiverwalkEvents},
};

export function buildFetcher(platform:string,params:Params,meta:Meta):Fetcher{
 const pl=PLATFORMS[platform];if(!pl)throw new Error(`Unknown platform "${platform}"`);
 return pl.build(params||{},meta);
}
