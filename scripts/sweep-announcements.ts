// Sweep: re-run the discovery filter over live listings and quarantine the announcements that
// slipped through before the rule existed ("Day After Thanksgiving", "Government Center Closed
// All Day", "will operate on regular hours" — a closure/hours notice published as an event).
// Two modes:
//   npx tsx scripts/sweep-announcements.ts [--out sweep.json]
//     Dry run (default): samples the public /api/events endpoint (same 10 areas x 7 days as
//     scripts/quality-audit.ts) and reports every row the filter now rejects as an announcement.
//     No secrets, no database access. Against production this is the quarantine list; against a
//     preview running the new rule it should be empty — that is the live verification.
//   npx tsx scripts/sweep-announcements.ts --apply
//     Needs DATABASE_URL: marks every matching ACTIVE row in the whole database (not just the
//     sample) status='quarantine', quarantine_reason='announcement'. Run once, after the rule
//     ships, by someone with database access. Re-ingestion will not re-activate swept rows:
//     the new rule rejects them at ingest (they land in rejected_events instead).
// The sweep is hygiene, not the fix: the list route already hides these rows (it re-runs
// discoveryRejection on every row it serves) and the detail page 404s them, so nothing the
// sweep quarantines is visible on the site. It takes them out of counts, the sitemap and the
// admin active list, and puts them in front of the admin review.
import {discoveryRejection} from "../lib/ingestion/utils";

const BASE=(process.env.GOTODAY_URL||"https://www.mygotoday.com").replace(/\/$/,"");
const args=process.argv.slice(2);
const outFile=args[args.indexOf("--out")+1];
const apply=args.includes("--apply");
// One representative ZIP per area (the site searches a 25-mile radius from it).
const AREAS:Record<string,string>={"Sunrise, FL":"33326","Fort Lauderdale, FL":"33301","Miami, FL":"33101",
 "Tampa, FL":"33602","Orlando, FL":"32801","Jacksonville, FL":"32202","Atlanta, GA":"30301",
 "Charlotte, NC":"28202","Washington, DC":"20001","Boston, MA":"02108"};
const DAYS=7;
const ymd=(d:Date)=>d.toISOString().slice(0,10);
type Match={id:string;title:string;date:string;area:string;source:string};
async function main(){
 if(apply){
  const {db}=await import("../lib/db");
  const rows=(await db.query(`select e.id,e.title,e.description,e.tags,s.name as source from events e join sources s on s.id=e.source_id where e.status='active' and e.local_date>=current_date and e.local_date<=current_date+45`)).rows;
  let n=0;
  for(const r of rows){
   const reason=discoveryRejection({id:`db-${r.id}`,title:r.title,city:"",venue:"",date:"",time:"",url:"",category:"",genre:"",desc:r.description||"",tags:r.tags||[],emoji:"",source:r.source,isDiscoveryEligible:/^Ticketmaster/.test(r.source||"")?true:undefined});
   if(reason!=="announcement")continue;
   await db.query(`update events set status='quarantine',quarantine_reason='announcement',updated_at=now() where id=$1`,[r.id]);
   n++;console.log(`quarantined db-${r.id} ${r.title}`);
  }
  console.log(`sweep --apply: ${n} of ${rows.length} active rows quarantined as announcements`);
  return;
 }
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York"}).format(new Date());
 const dates=Array.from({length:DAYS},(_,i)=>{const d=new Date(today+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+i);return ymd(d)});
 const seen=new Set<string>(),matches:Match[]=[];
 let total=0;
 for(const [area,zip] of Object.entries(AREAS))for(const date of dates){
  const r=await fetch(`${BASE}/api/events?postalCode=${zip}&range=${date}&today=${today}`,{headers:{"user-agent":"gotoday-sweep-announcements"}});
  if(!r.ok)throw new Error(`${r.status} for ${zip} ${date}`);
  const j=await r.json();const evs=j.events||[];
  for(const e of evs){total++;const id=String(e.id);if(seen.has(id))continue;seen.add(id);
   const reason=discoveryRejection({id,title:e.title,city:"",venue:"",date:"",time:"",url:"",category:"",genre:"",desc:e.desc||"",tags:e.tags||[],emoji:"",source:e.source||""});
   if(reason==="announcement")matches.push({id,title:e.title,date:e.date||date,area,source:e.source||""});}
 }
 for(const m of matches)console.log(`${m.id} ${m.date} [${m.area}] ${m.title} (${m.source})`);
 console.log(`sweep dry run: ${matches.length} announcement(s) in ${total} sampled listings (${seen.size} distinct)`);
 if(outFile){const {writeFileSync}=await import("fs");writeFileSync(outFile,JSON.stringify({base:BASE,today,matches},null,2));}
}
main().catch(e=>{console.error(e);process.exit(1)});
