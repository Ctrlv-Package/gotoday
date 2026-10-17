import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../lib/db";
import {ensureSchema} from "../../../../lib/schema";
import {kidAgeRange,settingFor} from "../../../../lib/facets";
export const dynamic="force-dynamic";
export const maxDuration=300;

// GET /api/admin/audit (Bearer INGESTION_SECRET): checks what visitors actually see — the same /api/events
// results the page shows — for every area on the start screen, today plus the next 6 days, and counts each kind
// of problem found so far (duplicates, borrowed photos, labels that contradict the title, captions as titles…).
// ?save=1 stores the summary for the status page.
const AREAS:[string,string][]=[["Fort Lauderdale","33301"],["Weston","33326"],["Miami","33130"],["Boca Raton","33432"],["West Palm Beach","33401"],["Orlando","32801"],["Tampa","33602"],["St. Petersburg","33701"],["Manhattan","10001"],["Brooklyn","11201"]];
const STOP=new Set(["the","and","of","a","at","in","on","for","with","to","annual","city","town","village","free","fl","event","day","night","2025","2026","2027","park","library","branch","center"]);
const words=(t:string)=>new Set(t.toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").split(" ").filter(w=>w.length>2&&!STOP.has(w)));
const town=(x:string)=>String(x||"").toLowerCase().replace(/^ft\.?\s/,"fort ").replace(/,.*$/,"").trim();
type Hit={area:string;date:string;title:string;source:string;note?:string;id?:string};

export async function GET(req:NextRequest){
 const s=process.env.INGESTION_SECRET;
 if(!s||req.headers.get("authorization")!==`Bearer ${s}`)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const origin=req.nextUrl.origin,days:string[]=[];
 const base=new Date(new Date().toLocaleString("en-US",{timeZone:"America/New_York"}));
 for(let i=0;i<7;i++){const d=new Date(base);d.setDate(d.getDate()+i);days.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`)}
 const jobs=AREAS.flatMap(([area,zip])=>days.map(day=>({area,zip,day})));
 const results:{area:string;day:string;events:any[]}[]=[];
 let next=0;
 await Promise.all(Array.from({length:6},async()=>{while(next<jobs.length){const j=jobs[next++];
  try{const r=await fetch(`${origin}/api/events?postalCode=${j.zip}&radius=25&range=${j.day}&today=${days[0]}`,{cache:"no-store"});const d:any=await r.json();results.push({area:j.area,day:j.day,events:d.events||[]})}catch{results.push({area:j.area,day:j.day,events:[]})}}}));

 const found:Record<string,Hit[]>={freeButPriced:[],duplicates:[],sharedPhoto:[],kidsTitleNotKids:[],freeTitleNotFree:[],adultTitleFamily:[],outdoorTitleIndoor:[],captionTitle:[],venueIsAccount:[],noSetting:[],kidsNoAgesNarrowed:[]};
 const add=(k:string,h:Hit)=>{if(found[k].length<400)found[k].push(h)};
 let total=0;const seen=new Set<string>();
 for(const {area,day,events} of results){
  total+=events.length;
  // Duplicates: same day, same place or town, mostly the same title words, still two cards.
  for(let i=0;i<events.length;i++)for(let j=i+1;j<events.length;j++){
   const a=events[i],b=events[j];if(a.date!==b.date)continue;
   // Same town (or the very same spot); a festival in Plantation and one in Boynton Beach are different events.
   const near=town(a.city)===town(b.city)||(a.venue&&a.venue===b.venue);if(!near)continue;
   // A part of an event listed on its own (its opening reception, a VIP preview) is its own listing, not a copy.
   const partOf=(t:string)=>/^(opening|closing) reception|^vip\b|\bpreview\b|after ?party|pre-?show|meet (and|&) greet/i.test(t);
   if(partOf(a.title)!==partOf(b.title))continue;
   const wa=words(a.title),wb=words(b.title);let hit=0;for(const x of wa)if(wb.has(x))hit++;
   const fa=a.title.toLowerCase().replace(/[^a-z0-9]+/g,""),fb=b.title.toLowerCase().replace(/[^a-z0-9]+/g,"");
   const sameVenue=String(a.venue).toLowerCase().replace(/&/g,"and")===String(b.venue).toLowerCase().replace(/&/g,"and");
   const sameSlot=a.time&&a.time===b.time&&sameVenue;
   const contains=fa.length>=6&&fb.length>=6&&(fa.includes(fb)||fb.includes(fa));
   // Different programs at different library branches aren't duplicates; the same thing listed twice is.
   const crossSource=a.source!==b.source;
   const timesOk=!a.time||!b.time||a.time===b.time;
   if((sameSlot&&(hit>=1||contains))||(timesOk&&(crossSource||sameVenue)&&(contains||(hit>=2&&hit/Math.max(1,Math.min(wa.size,wb.size))>=0.75))))
    add("duplicates",{area,date:day,title:`${a.title}  ⟷  ${b.title}`,source:`${a.source} / ${b.source}`});
  }
  const pics=new Map<string,string[]>();
  for(const e of events){
   const key=`${e.id}|${day}`;if(seen.has(key))continue;seen.add(key);
   const t=e.title||"",f:string[]=e.facets||[],h={area,date:day,title:t,source:e.source,id:e.id};
   if(e.image&&!/static\.libnet\.info/.test(e.image)){const k=String(e.image).split("?")[0];pics.set(k,[...(pics.get(k)||[]),t])}
   if(/\b(kids?|children'?s?|toddlers?|bab(y|ies)|preschool|storytime|tweens?|teens?|youth|family|families)\b/i.test(t)&&!f.includes("Kids")&&!f.includes("Family")&&!((e.ageMin??0)>=18))add("kidsTitleNotKids",h);
   if(/\bfree\b/i.test(t)&&!/\b(gluten|sugar|alcohol|dairy)[- ]free|free ?style|\beats? free\b/i.test(t)&&!f.includes("Free"))add("freeTitleNotFree",h);
   // Labeled Free while the listing names a ticket price ("$5 per person", "$10 admission").
   if(f.includes("Free")&&/\$\s?[1-9]\d*[^.]{0,25}\b(per (person|child|adult|car|family)|admission|entry|tickets?|wristband|each|pp)\b/i.test(`${t} ${e.desc||""} ${e.priceText||""}`))add("freeButPriced",{...h,note:(e.desc||"").slice(0,120)});
   if(/\b(21\+|18\+|wine|beer|brewery|cocktails?|happy hour|bar crawl|burlesque)\b/i.test(t)&&f.includes("Family"))add("adultTitleFamily",h);
   const st=(e.tags||[]).find((x:string)=>x==="Indoor"||x==="Outdoor");
   if(st==="Indoor"&&settingFor({title:t,venue:e.venue,source:e.source})==="Outdoor")add("outdoorTitleIndoor",h);
   if(!st)add("noSetting",{...h,note:e.venue});
   if(/^(dear |we hope|join us (tomorrow|today|this)|don'?t (miss|forget)|have you|did you know|reminder|save the date|thank you|mark your|calling all|just \d+ days?|maintenance alert|why i love)/i.test(t)||(/ · Instagram$/.test(e.source||"")&&(t.length>80||/\?\s*$/.test(t))))add("captionTitle",h);
   if(/ · Instagram$/.test(e.source||"")&&String(e.venue||"").toLowerCase()===String(e.source).replace(/ · Instagram$/,"").toLowerCase())add("venueIsAccount",{...h,note:e.venue});
   if(f.includes("Kids")){const r=kidAgeRange(e);if(r&&r[1]-r[0]<3&&!e.ageMin)add("kidsNoAgesNarrowed",{...h,note:`${r[0]}–${r[1]}`})}
  }
  // A shared photo is only a problem between different events (the same show at two times rightly shares its photo).
  const related=(a:string,b:string)=>{const fa=a.toLowerCase().replace(/[^a-z0-9]+/g,""),fb=b.toLowerCase().replace(/[^a-z0-9]+/g,"");if(fa.includes(fb)||fb.includes(fa))return true;const wa=words(a),wb=words(b);let h=0;for(const x of wa)if(wb.has(x))h++;return h>=1&&h/Math.max(1,Math.min(wa.size,wb.size))>=0.5};
  for(const [u,titles] of pics){const t=[...new Set(titles)];if(t.some((a,i)=>t.some((b,j)=>j>i&&!related(a,b))))add("sharedPhoto",{area,date:day,title:t.join("  |  "),source:u.slice(0,80)})}
 }
 const summary=Object.fromEntries(Object.entries(found).map(([k,v])=>[k,v.length]));
 // Counted as problems; noSetting / kidsNoAgesNarrowed / venueIsAccount are shown for information only.
 const problems=["freeButPriced","duplicates","sharedPhoto","kidsTitleNotKids","freeTitleNotFree","adultTitleFamily","outdoorTitleIndoor","captionTitle"].reduce((n,k)=>n+(summary[k]||0),0);
 const out={ok:true,checkedAt:new Date().toISOString(),areas:AREAS.length,days:days.length,cards:total,problems,summary,examples:Object.fromEntries(Object.entries(found).map(([k,v])=>[k,v.slice(0,40)]))};
 if(req.nextUrl.searchParams.get("save")){
  await ensureSchema();
  await db.query("create table if not exists quality_audits(id serial primary key,checked_at timestamptz default now(),cards int,summary jsonb,examples jsonb)").catch(()=>{});
  await db.query("insert into quality_audits(cards,summary,examples) values($1,$2,$3)",[total,JSON.stringify(summary),JSON.stringify(Object.fromEntries(Object.entries(found).map(([k,v])=>[k,v.slice(0,8)])))]).catch(()=>{});
  await db.query("delete from quality_audits where checked_at<now()-interval '60 days'").catch(()=>{});
 }
 return NextResponse.json(out);
}
