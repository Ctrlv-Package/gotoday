// Detects which event-calendar product a city / county / library website uses and prints ready-to-save
// GoToday source configs.
//
//   npx tsx scripts/discover-sources.ts "Coral Springs, FL=https://www.coralsprings.gov" https://www.orlando.gov ...
//
// Each argument is a URL, optionally prefixed with "City, ST=" to fill in the city.
// Or a candidates file (DISCOVER_FILE) with lines "Name | City, ST | https://site | region".
// With SAVE=1 (+ GOTODAY_URL, INGESTION_SECRET), confirmed sources are saved to GoToday: tested from
// the site first; if the site can't reach them (firewall), saved as remote (fetched by the GitHub job).
// Set USE_BROWSER=1 to fetch through headless Chrome (for sites that block plain HTTP clients).
import {appendFileSync,readFileSync} from "node:fs";
import {installBrowserFetch,closeBrowserFetch} from "./browser-fetch";

type Cand={name?:string;city:string;url:string;region?:string};
type Found={input:string;platform:string;confidence:"confirmed"|"likely";config?:any;note:string};
const UA={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36","Accept":"text/html,application/xhtml+xml,*/*"};
const get=async(url:string)=>{try{const r=await fetch(url,{headers:UA,signal:AbortSignal.timeout(25000)});return{status:r.status,text:r.ok?await r.text():""}}catch(e:any){return{status:0,text:"",error:String(e?.message||e)}}};
const titleName=(html:string,host:string)=>(html.match(/<title>([^<|–-]+)/i)?.[1]||host).trim();

async function probe(c:Cand):Promise<Found[]>{
 const arg=c.name||c.url,city=c.city,url=c.url;
 const origin=new URL(url).origin,host=new URL(url).host.replace(/^www\./,"");
 const home=await get(url),html=home.text,out:Found[]=[];
 if(!html)return[{input:arg,platform:"unreachable",confidence:"likely",note:`HTTP ${home.status||"error"} ${(home as any).error||""}`}];
 const name=c.name||titleName(html,host);

 // Communico (libraries)
 const comm=html.match(/https?:\/\/([a-z0-9-]+)\.libnet\.info/i)?.[1];
 if(comm){const t=await get(`https://${comm}.libnet.info/eeventcaldata?event_type=0&req=${encodeURIComponent(JSON.stringify({private:false,date:new Date().toISOString().slice(0,10),days:3,locations:[],ages:[],types:[]}))}`);
  const n=(()=>{try{return JSON.parse(t.text).length}catch{return 0}})();
  out.push({input:arg,platform:"communico",confidence:n?"confirmed":"likely",note:`${n} events in next 3 days`,config:{name,platform:"communico",params:{client:comm,defaultVenue:name,defaultCity:city||undefined},source_type:"official-county",url:`https://${comm}.libnet.info/events`}})}

 // BiblioCommons (libraries)
 const bib=html.match(/https?:\/\/([a-z0-9-]+)\.bibliocommons\.com/i)?.[1];
 if(bib){const t=await get(`https://gateway.bibliocommons.com/v2/libraries/${bib}/events?limit=1`);
  const n=(()=>{try{return JSON.parse(t.text)?.events?.pagination?.count||0}catch{return 0}})();
  out.push({input:arg,platform:"bibliocommons",confidence:n?"confirmed":"likely",note:`${n} upcoming events`,config:{name,platform:"bibliocommons",params:{library:bib,defaultCity:city||"",state:city.split(",")[1]?.trim()},source_type:"official-county",url:`https://${bib}.bibliocommons.com/v2/events`}})}

 // LibCal (Springshare) — detected, adapter not built yet
 const libcal=html.match(/https?:\/\/([a-z0-9-]+)\.libcal\.com/i)?.[1];
 if(libcal){const t=await get(`https://${libcal}.libcal.com/ajax/calendar/list?c=-1&date=0000-00-00&perpage=1&page=1&audience=&cats=&camps=&inc=0`);
  const n=(()=>{try{return Number(JSON.parse(t.text)?.total_results)||0}catch{return 0}})();
  out.push({input:arg,platform:"libcal",confidence:n?"confirmed":"likely",note:`${n} upcoming events`,config:{name,platform:"libcal",params:{site:libcal,defaultVenue:name,defaultCity:city||undefined},source_type:"official-city",url:`https://${libcal}.libcal.com/calendar`}})}

 // CivicPlus / CivicEngage: calendar RSS feed
 {const t=await get(`${origin}/RSSFeed.aspx?ModID=58&CID=All-calendar.xml`),items=(t.text.match(/<item\b/gi)||[]).length;
  if(items||/civicplus|CivicEngage|\/RSSFeed\.aspx/i.test(html))out.push({input:arg,platform:"civicplus",confidence:items?"confirmed":"likely",note:`${items} items in calendar RSS`,config:{name,platform:"civicplus",params:{site:origin,city},url:`${origin}/Calendar.aspx`}})}

 // Granicus govAccess: /Home/Components/Calendar event links, vi-events-tiles lists
 if(/\/Home\/Components\/Calendar|vi-events-tiles|govAccess/i.test(html)){
  const pages=[...new Set([...html.matchAll(/href="(\/[^"#?]*(?:event|calendar)[^"#?]*)"/gi)].map(x=>x[1]).filter(h=>!/Components\/Calendar\/Event|\.(pdf|jpg|png)$/i.test(h)))].slice(0,6);
  out.push({input:arg,platform:"govaccess",confidence:"likely",note:`candidate pages: ${pages.join(" , ")||"(open the site's Events page and use its path)"} — set tilePages to the page with event tiles, calendarPaths to the month grid`,
   config:{name,platform:"govaccess",params:{site:origin,city,tilePages:pages.filter(p=>/event/i.test(p)).slice(0,1),calendarPaths:pages.filter(p=>/calendar/i.test(p)).slice(0,1)},url:origin+(pages[0]||"")}})}

 // Granicus OpenCities
 if(/OpenCities/i.test(html)){
  const list=[...new Set([...html.matchAll(/href="([^"]*(?:Event[s]?-?Calendar|Events-directory|\/Events)(?:["?\/])?[^"]*)"/gi)].map(x=>x[1]).filter(h=>!/\/-|\.(pdf|jpg|png)$/i.test(h)))][0];
  out.push({input:arg,platform:"opencities",confidence:"likely",note:`event list ${list||"(find the Events page)"}; OpenCities sites usually block cloud servers, so save with remote:true`,
   config:{name,platform:"opencities",remote:true,params:{listUrl:list?new URL(list,origin).toString():"",city},url:list?new URL(list,origin).toString():origin}})}

 // Apptegy Thrillshare
 const org=html.match(/thrillshare[^"']*\/o\/(\d+)|"organization_id"\s*:\s*(\d+)|secondary_org=(\d+)/i);
 if(/thrillshare|apptegy/i.test(html))out.push({input:arg,platform:"thrillshare",confidence:org?"confirmed":"likely",note:org?`org ${org[1]||org[2]||org[3]}`:"find orgId in the Events page network requests (…/api/v4/o/<orgId>/cms/events)",
  config:{name,platform:"thrillshare",params:{orgId:org?Number(org[1]||org[2]||org[3]):null,city,site:origin},url:`${origin}/events`}});

 if(!out.length)out.push({input:arg,platform:"unknown",confidence:"likely",note:"No known calendar product detected on the home page; try the site's Events page URL instead"});
 return out;
}

// Resolve redirects once (apex -> www): the password header is dropped on a redirect to another host.
let resolved:string|undefined;
async function siteBase(){if(resolved)return resolved;const u=(process.env.GOTODAY_URL||"").replace(/\/$/,"");try{resolved=new URL((await fetch(u)).url).origin}catch{resolved=u}return resolved}
async function save(f:Found,c:Cand){
 const base=await siteBase(),secret=process.env.INGESTION_SECRET||"";
 const body={...f.config,region:c.region,timezone:"America/New_York"};
 const post=async(extra:any)=>{const r=await fetch(`${base}/api/admin/sources`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${secret}`},body:JSON.stringify({...body,...extra})});return{status:r.status,json:await r.json().catch(()=>({}))}};
 let r=await post({test:true});
 if(r.status===422)r=await post({remote:true,test:false}).then(x=>({...x,json:{...x.json,remote:true}}));
 return r.status===200?(r.json.remote?"saved (remote)":`saved (${r.json.sample?.count??"?"} events in 14 days)`):`not saved: ${r.json.error||r.status}`;
}

async function main(){
 const cands:Cand[]=[];
 const file=process.env.DISCOVER_FILE;
 if(file){for(const line of readFileSync(file,"utf8").split("\n")){const l=line.trim();if(!l||l.startsWith("#"))continue;const [name,city,url,region]=l.split("|").map(x=>x.trim());if(/^https?:/.test(url||""))cands.push({name,city,url,region})}}
 const text=process.argv.slice(2).join("\n")+"\n"+(process.env.DISCOVER_URLS||"");
 for(const m of text.matchAll(/(?:([A-Z][A-Za-z .'-]*?,\s*[A-Z]{2})\s*=\s*)?(https?:\/\/[^\s,]+)/g))cands.push({city:m[1]||"",url:m[2]});
 if(!cands.length){console.error('Usage: discover-sources.ts "City, ST=https://site" ... or DISCOVER_FILE=discovery/candidates.txt');process.exit(1)}
 if(process.env.GOTODAY_URL)await siteBase(); // before Chrome takes over GET requests
 if(process.env.USE_BROWSER==="1")await installBrowserFetch();
 const doSave=process.env.SAVE==="1"&&process.env.GOTODAY_URL&&process.env.INGESTION_SECRET;
 const all:(Found&{saved?:string})[]=[];
 for(const c of cands){
  const f:Found[]=await probe(c).catch(e=>[{input:c.name||c.url,platform:"error",confidence:"likely",note:String(e?.message||e)}]);
  // One site can run several products (a city calendar plus its library's); keep their saved names distinct.
  if(f.filter(x=>x.config).length>1)for(const x of f)if(x.config&&/^(communico|bibliocommons|libcal)$/.test(x.platform)&&!/librar/i.test(x.config.name))x.config.name=`${x.config.name.replace(/^(City|Town|Village) of /i,"")} Public Library`;
  for(const x of f){
   let saved:string|undefined;
   if(doSave&&x.config&&x.confidence==="confirmed")saved=await save(x,c).catch(e=>`not saved: ${e?.message||e}`);
   all.push({...x,saved});console.log(`${x.platform.padEnd(14)} ${x.confidence.padEnd(9)} ${x.input}  — ${x.note}${saved?`  [${saved}]`:""}`);
  }
 }
 const needsReview=all.filter(x=>x.config&&x.confidence!=="confirmed");
 console.log("\nNeeds a manual look (likely platform, not auto-saved):\n"+JSON.stringify(needsReview.map(x=>x.config),null,1));
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,["### Source discovery","","| Site | Platform | Confidence | Notes | Saved |","|---|---|---|---|---|",
  ...all.map(x=>`| ${x.input} | ${x.platform} | ${x.confidence} | ${x.note.replace(/\|/g,"/").slice(0,200)} | ${x.saved||""} |`),"",
  needsReview.length?"#### Likely matches to review\n```json\n"+JSON.stringify(needsReview.map(x=>x.config),null,1)+"\n```":"",""].join("\n"));
 await closeBrowserFetch();
}
main().catch(e=>{console.error(e);process.exit(1)});
