// Detects which event-calendar product a city / county / library website uses and prints ready-to-save
// GoToday source configs.
//
//   npx tsx scripts/discover-sources.ts "Coral Springs, FL=https://www.coralsprings.gov" https://www.orlando.gov ...
//
// Each argument is a URL, optionally prefixed with "City, ST=" to fill in the city.
// Set USE_BROWSER=1 to fetch through headless Chrome (for sites that block plain HTTP clients).
import {appendFileSync} from "node:fs";
import {installBrowserFetch,closeBrowserFetch} from "./browser-fetch";

type Found={input:string;platform:string;confidence:"confirmed"|"likely";config?:any;note:string};
const UA={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36","Accept":"text/html,application/xhtml+xml,*/*"};
const get=async(url:string)=>{try{const r=await fetch(url,{headers:UA,signal:AbortSignal.timeout(25000)});return{status:r.status,text:r.ok?await r.text():""}}catch(e:any){return{status:0,text:"",error:String(e?.message||e)}}};
const titleName=(html:string,host:string)=>(html.match(/<title>([^<|–-]+)/i)?.[1]||host).trim();

async function probe(arg:string):Promise<Found[]>{
 const m=arg.match(/^(.+?,\s*[A-Z]{2})=(https?:\/\/.+)$/),city=m?.[1]||"",url=m?.[2]||arg;
 const origin=new URL(url).origin,host=new URL(url).host.replace(/^www\./,"");
 const home=await get(url),html=home.text,out:Found[]=[];
 if(!html)return[{input:arg,platform:"unreachable",confidence:"likely",note:`HTTP ${home.status||"error"} ${(home as any).error||""}`}];
 const name=titleName(html,host);

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
 if(libcal)out.push({input:arg,platform:"libcal",confidence:"likely",note:`LibCal site ${libcal}.libcal.com (adapter not built yet; has iCal feeds)`});

 // CivicPlus / CivicEngage: calendar RSS feed
 if(/civicplus|CivicEngage|\/RSSFeed\.aspx|Calendar\.aspx/i.test(html)){
  const t=await get(`${origin}/RSSFeed.aspx?ModID=58&CID=All-calendar.xml`),items=(t.text.match(/<item\b/gi)||[]).length;
  out.push({input:arg,platform:"civicplus",confidence:items?"confirmed":"likely",note:`${items} items in calendar RSS`,config:{name,platform:"civicplus",params:{site:origin,city},url:`${origin}/Calendar.aspx`}})}

 // Granicus govAccess: /Home/Components/Calendar event links, vi-events-tiles lists
 if(/\/Home\/Components\/Calendar|vi-events-tiles|govAccess/i.test(html)){
  const pages=[...new Set([...html.matchAll(/href="(\/[^"#?]*(?:event|calendar)[^"#?]*)"/gi)].map(x=>x[1]).filter(h=>!/Components\/Calendar\/Event|\.(pdf|jpg|png)$/i.test(h)))].slice(0,6);
  out.push({input:arg,platform:"govaccess",confidence:"likely",note:`candidate pages: ${pages.join(" , ")||"(open the site's Events page and use its path)"} — set tilePages to the page with event tiles, calendarPaths to the month grid`,
   config:{name,platform:"govaccess",params:{site:origin,city,tilePages:pages.filter(p=>/event/i.test(p)).slice(0,1),calendarPaths:pages.filter(p=>/calendar/i.test(p)).slice(0,1)},url:origin+(pages[0]||"")}})}

 // Granicus OpenCities
 if(/OpenCities/i.test(html)){
  const list=[...new Set([...html.matchAll(/href="([^"]*Event[s]?-?Calendar[^"]*)"/gi)].map(x=>x[1]))][0];
  out.push({input:arg,platform:"opencities",confidence:"likely",note:`event list ${list||"(find the Events page)"}; check how its pager builds page 2 (pageUrlTemplate)`,
   config:{name,platform:"opencities",params:{listUrl:list?new URL(list,origin).toString():"",eventPath:list?new URL(list,origin).pathname:"",city},url:list?new URL(list,origin).toString():origin}})}

 // Apptegy Thrillshare
 const org=html.match(/thrillshare[^"']*\/o\/(\d+)|"organization_id"\s*:\s*(\d+)|secondary_org=(\d+)/i);
 if(/thrillshare|apptegy/i.test(html))out.push({input:arg,platform:"thrillshare",confidence:org?"confirmed":"likely",note:org?`org ${org[1]||org[2]||org[3]}`:"find orgId in the Events page network requests (…/api/v4/o/<orgId>/cms/events)",
  config:{name,platform:"thrillshare",params:{orgId:org?Number(org[1]||org[2]||org[3]):null,city,site:origin},url:`${origin}/events`}});

 if(!out.length)out.push({input:arg,platform:"unknown",confidence:"likely",note:"No known calendar product detected on the home page; try the site's Events page URL instead"});
 return out;
}

async function main(){
 const text=process.argv.slice(2).join("\n")+"\n"+(process.env.DISCOVER_URLS||"");
 const args=[...text.matchAll(/(?:([A-Z][A-Za-z .'-]*?,\s*[A-Z]{2})\s*=\s*)?(https?:\/\/[^\s,]+)/g)].map(m=>m[1]?`${m[1]}=${m[2]}`:m[2]);
 if(!args.length){console.error('Usage: discover-sources.ts "City, ST=https://site" ...');process.exit(1)}
 if(process.env.USE_BROWSER==="1")await installBrowserFetch();
 const all:Found[]=[];
 for(const a of args){const f=await probe(a);all.push(...f);for(const x of f)console.log(`${x.platform.padEnd(14)} ${x.confidence.padEnd(9)} ${a}  — ${x.note}`)}
 console.log("\nReady-to-save configs (POST each to /api/admin/sources with \"test\": true):\n"+JSON.stringify(all.filter(x=>x.config).map(x=>x.config),null,1));
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,["### Source discovery","","| Site | Platform | Confidence | Notes |","|---|---|---|---|",
  ...all.map(x=>`| ${x.input} | ${x.platform} | ${x.confidence} | ${x.note.replace(/\|/g,"/")} |`),"","```json",JSON.stringify(all.filter(x=>x.config).map(x=>x.config),null,1),"```",""].join("\n"));
 await closeBrowserFetch();
}
main().catch(e=>{console.error(e);process.exit(1)});
