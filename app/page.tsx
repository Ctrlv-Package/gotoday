"use client";
import {kidAgeRange} from "../lib/facets";
import {useEffect,useMemo,useRef,useState} from "react";
import AddToCalendar from "./components/AddToCalendar";

type EventItem={id?:string;title:string;city:string;venue?:string;date?:string;time?:string;image?:string;url?:string;category?:string;genre?:string;minPrice?:number|null;desc?:string;tags?:string[];emoji?:string;source?:string;distanceMiles?:number;distanceAccuracy?:string;ageMin?:number;ageMax?:number;registration?:string;moreLocations?:number;otherVenues?:string[];isFree?:boolean;facets?:string[];labels?:string[];live?:boolean};

const AGE_BANDS:[string,number,number][]=[["All ages",0,99],["Babies & toddlers",0,2],["Preschool 3–5",3,5],["Ages 6–9",6,9],["Tweens 10–12",10,12],["Teens 13–17",13,17]];
// Interest chips combine with OR; "Free" and the More-filters options always narrow the results.
const CHIPS=["All","Family","Kids","Adults","Free","Music","Arts & Theatre","Sports"];
const SETTINGS=["Any","Indoor","Outdoor"];
const AREAS:[string,string][]=[["Fort Lauderdale","33301"],["Weston","33326"],["Miami","33130"],["Boca Raton","33432"],["West Palm Beach","33401"],["Orlando","32801"],["Tampa","33602"],["St. Petersburg","33701"],["Manhattan","10001"],["Brooklyn","11201"]];
const RANGES=[["today","Today"],["tomorrow","Tomorrow"],["weekend","Next Weekend"]] as const;
const TIMES=["Any time","Morning","Afternoon","Evening"];
const DEFAULT_ZIP="33326";

function ageLabel(e:EventItem){if(e.ageMin==null||e.ageMax==null||e.ageMax>18)return"";return e.ageMax<=1?"Babies":`Ages ${e.ageMin}–${e.ageMax}`}
function fmt(d?:string,t?:string){if(!d)return"Date TBA";const day=new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric"}).format(new Date(d+"T12:00:00"));if(!t)return day+" · All day";return day+" · "+new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"}).format(new Date(d+"T"+t))}
// Search text: lowercase, no punctuation, and simple word endings dropped, so "chilling" finds "Chillin'"
// and "festivals" finds "Festival".
function norm(t:string){return t.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/['’]/g,"").replace(/[^a-z0-9]+/g," ").split(" ").map(w=>w.length>4?w.replace(/ing$/,"in").replace(/(?<!s)s$/,""):w).join(" ").trim()}
// Days for the "Pick a day" menu: the 21 days after tomorrow, in Eastern time.
function upcomingDays(){
 const p=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const g=(t:string)=>p.find(x=>x.type===t)?.value||"",base=new Date(`${g("year")}-${g("month")}-${g("day")}T12:00:00Z`);
 return Array.from({length:21},(_,i)=>{const d=new Date(base);d.setUTCDate(d.getUTCDate()+i+2);return d.toISOString().slice(0,10)});
}
function dayLabel(d:string,kind:"weekday"|"date"|"full"){const x=new Date(d+"T12:00:00Z");
 return kind==="weekday"?x.toLocaleDateString("en-US",{weekday:"short",timeZone:"UTC"}):kind==="date"?x.toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"}):x.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric",timeZone:"UTC"})}
function nextWeekendLabel(){
 const p=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const g=(t:string)=>p.find(x=>x.type===t)?.value||"",base=new Date(`${g("year")}-${g("month")}-${g("day")}T12:00:00Z`);
 const day=base.getUTCDay(),n=day===6?7:(6-day+7)%7||7,sat=new Date(base);sat.setUTCDate(sat.getUTCDate()+n);const sun=new Date(sat);sun.setUTCDate(sun.getUTCDate()+1);

 const m=(d:Date)=>d.toLocaleDateString("en-US",{month:"short",timeZone:"UTC"});
 return m(sat)===m(sun)?`${m(sat)} ${sat.getUTCDate()}–${sun.getUTCDate()}`:`${m(sat)} ${sat.getUTCDate()} – ${m(sun)} ${sun.getUTCDate()}`;
}
function detailHref(e:EventItem){return e.source==="Ticketmaster"?(e.url||"#"):e.source==="GoToday Community"&&e.url?e.url:"/events/"+encodeURIComponent(e.id||"")}
// Card art. Photos close to the card's shape fill it; flyers, posters and odd crops are shown whole
// over a blurred copy of themselves, so nothing important (faces, text) gets cut off.
function fitPic(img:HTMLImageElement){const r=img.naturalWidth/(img.naturalHeight||1);img.parentElement?.classList.toggle("whole",!(r>1.45&&r<2.1))}
// No image: a themed tile picked from what the event is about, same size as a photo.
const ART:[RegExp,string,string][]=[
 [/story ?time|book|librar|read|author|poet|writ/i,"📚","linear-gradient(135deg,#e0e7ff,#ede9fe)"],
 [/music|concert|jazz|band|orchestra|sing|choir|dj|piano|guitar/i,"🎵","linear-gradient(135deg,#fce7f3,#ede9fe)"],
 [/art|paint|craft|draw|exhibit|museum|gallery|photo/i,"🎨","linear-gradient(135deg,#fef3c7,#fce7f3)"],
 [/lego|stem|science|code|coding|robot|tech|computer|maker/i,"🧪","linear-gradient(135deg,#cffafe,#e0e7ff)"],
 [/yoga|fitness|run|5k|walk|sport|soccer|basket|swim|tennis|pickle|golf/i,"🏃","linear-gradient(135deg,#dcfce7,#cffafe)"],
 [/market|farmer|food|cook|bake|taste|wine|beer|brunch/i,"🧺","linear-gradient(135deg,#ffedd5,#fef3c7)"],
 [/movie|film|cinema|screening/i,"🎬","linear-gradient(135deg,#e5e7eb,#e0e7ff)"],
 [/game|chess|trivia|bingo|puzzle|video ?game/i,"🎲","linear-gradient(135deg,#ede9fe,#cffafe)"],
 [/garden|nature|park|hike|bird|beach|outdoor|eco|plant/i,"🌿","linear-gradient(135deg,#dcfce7,#fef9c3)"],
 [/baby|toddler|kid|child|family|teen|tween/i,"🧸","linear-gradient(135deg,#fef3c7,#dcfce7)"],
 [/dance|ballet|salsa|zumba/i,"💃","linear-gradient(135deg,#fce7f3,#ffedd5)"],
 [/history|civic|scavenger|tour|heritage|lecture|class|workshop|learn/i,"🏛️","linear-gradient(135deg,#e0e7ff,#dcfce7)"],
 [/halloween|pumpkin|trick|costume/i,"🎃","linear-gradient(135deg,#ffedd5,#ede9fe)"],
 [/festival|party|celebrat|parade|fair|oktoberfest/i,"🎉","linear-gradient(135deg,#fce7f3,#fef3c7)"],
];
function artFor(e:EventItem){const t=`${e.title} ${e.category||""} ${e.genre||""} ${(e.tags||[]).join(" ")}`;
 const hit=ART.find(([re])=>re.test(t));return hit?{icon:hit[1],bg:hit[2]}:{icon:"📍",bg:"linear-gradient(135deg,#ede9fe,#fce7f3)"}}
const store={get:(k:string)=>{try{return localStorage.getItem(k)}catch{return null}},set:(k:string,v:string)=>{try{localStorage.setItem(k,v)}catch{}}};

export default function Home(){
 const[zipErr,setZipErr]=useState(""),lastGood=useRef(""),[zip,setZip]=useState(""),[searchedZip,setSearchedZip]=useState(""),[coords,setCoords]=useState<{lat:number;lng:number}|null>(null);
 const[radius,setRadius]=useState("25"),[range,setRange]=useState("today"),[selected,setSelected]=useState<string[]>([]),[ageBands,setAgeBands]=useState<string[]>([]),[moreOpen,setMoreOpen]=useState(false),[setting,setSetting]=useState("Any"),[dropIn,setDropIn]=useState(false),[spanish,setSpanish]=useState(false),[seniors,setSeniors]=useState(false);
 const[timeFilter,setTimeFilter]=useState("Any time"),[sort,setSort]=useState("Nearest"),[query,setQuery]=useState("");
 const[soon,setSoon]=useState<{place:string|null}|null>(null),[events,setEvents]=useState<EventItem[]>([]),[loading,setLoading]=useState(false),[message,setMessage]=useState(""),[toast,setToast]=useState("");

 async function load(z:string,r:string,c:{lat:number;lng:number}|null,rad:string){
  setLoading(true);setMessage("");setSoon(null);
  try{
   const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
   const q=new URLSearchParams({postalCode:z||DEFAULT_ZIP,radius:rad,range:r,today});
   if(c){q.set("lat",String(c.lat));q.set("lng",String(c.lng))}
   const d=await (await fetch("/api/events?"+q,{cache:"no-store"})).json();
   // A ZIP that doesn't exist: explain it under the search box and keep whatever was showing before.
   if(d.invalidZip){setZipErr(`We couldn't find ZIP code ${z}. Please check the number and try again.`);setSearchedZip(lastGood.current);return false}
   if(!c&&z)lastGood.current=z;
   setEvents(d.events||[]);
   setSoon(d.coverage&&d.coverage.covered===false?{place:d.coverage.place||null}:null);
   if(d.coverage?.covered===false)return;
   if(!d.events?.length)setMessage(r==="today"?"Nothing else found for today nearby. Try Tomorrow, Next Weekend, or a bigger distance.":"Nothing found for this period yet. Try a bigger distance.");
  }catch{setEvents([]);setMessage("Events are temporarily unavailable.")}
  finally{setLoading(false)}
 }

 // Coming back from an event page: restore the exact view (results, filters, scroll) saved in this tab.
 // Otherwise start from ?zip= in the link, else the last ZIP used on this device, else the default.
 const VIEW="gotoday:view";
 const [restored,setRestored]=useState(false);
 useEffect(()=>{
  const fromUrl=new URLSearchParams(location.search).get("zip");
  let v:any=null;try{v=JSON.parse(sessionStorage.getItem(VIEW)||"null")}catch{}
  const today=new Date().toDateString();
  // Only coming BACK from an event restores the view. A refresh, the logo, or a new visit starts fresh.
  const nav=(performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming|undefined)?.type;
  let realReload=false;try{const seen=sessionStorage.getItem("gotoday:load");realReload=nav==="reload"&&seen!==String(performance.timeOrigin);sessionStorage.setItem("gotoday:load",String(performance.timeOrigin))}catch{}
  const freshParam=new URLSearchParams(location.search).has("fresh");
  let returning=false;try{returning=sessionStorage.getItem("gotoday:openedEvent")==="1";sessionStorage.removeItem("gotoday:openedEvent")}catch{}
  if(freshParam||realReload||!returning){try{sessionStorage.removeItem(VIEW)}catch{};v=null}
  if(freshParam)history.replaceState(null,"",location.pathname+(fromUrl?`?zip=${fromUrl}`:""));
  if(v&&v.day===today&&Date.now()-v.savedAt<45*60e3&&(!fromUrl||fromUrl===v.searchedZip)){
   setZip(v.zip);setSearchedZip(v.searchedZip);setCoords(v.coords);setRadius(v.radius);setRange(v.range);setSelected(v.selected);setAgeBands(v.ageBands);
   setMoreOpen(v.moreOpen);setSetting(v.setting);setDropIn(v.dropIn);setSpanish(v.spanish);setSeniors(v.seniors);setTimeFilter(v.timeFilter);setSort(v.sort);setQuery(v.query);
   setEvents(v.events||[]);setMessage(v.message||"");setSoon(v.soon||null);setRestored(true);
   try{history.scrollRestoration="manual"}catch{}
   const y=v.scrollY||0;requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo(0,y)));
   return;
  }
  // Fresh page: nothing searched yet. Empty ZIP box, default filters, no results until the person
  // enters a ZIP or uses their location. A ?zip= link searches that ZIP right away.
  const z=fromUrl&&/^\d{5}$/.test(fromUrl)?fromUrl:"";
  setZip(z);setSearchedZip(z);setCoords(null);setRadius("25");setEvents([]);setRestored(true);
  if(z)load(z,"today",null,"25");
 },[]);
 // Keep the saved view current (filters, results and scroll position) so "Back" lands where you were.
 useEffect(()=>{
  if(!restored)return;
  const save=()=>{try{sessionStorage.setItem(VIEW,JSON.stringify({zip,searchedZip,coords,radius,range,selected,ageBands,moreOpen,setting,dropIn,spanish,seniors,timeFilter,sort,query,
   events,message,soon,scrollY:window.scrollY,savedAt:Date.now(),day:new Date().toDateString()}))}catch{}};
  save();
  let t:any=null;const onScroll=()=>{clearTimeout(t);t=setTimeout(save,150)};
  const onClick=(e:MouseEvent)=>{if((e.target as HTMLElement)?.closest?.(".card a"))try{sessionStorage.setItem("gotoday:openedEvent","1")}catch{};save()};
  window.addEventListener("scroll",onScroll,{passive:true});window.addEventListener("pagehide",save);document.addEventListener("click",onClick,true);
  return()=>{clearTimeout(t);window.removeEventListener("scroll",onScroll);window.removeEventListener("pagehide",save);document.removeEventListener("click",onClick,true)};
 },[restored,zip,searchedZip,coords,radius,range,selected,ageBands,moreOpen,setting,dropIn,spanish,seniors,timeFilter,sort,query,events,message,soon]);

 function searchZip(z:string){setZipErr("");if(!/^\d{5}$/.test(z)){setZipErr(z?"A ZIP code has 5 digits, like 33326.":"Enter a ZIP code to search.");return}store.set("gotoday:zip",z);setCoords(null);setSearchedZip(z);load(z,range,null,radius).then(ok=>{if(ok!==false)document.getElementById("results")?.scrollIntoView({behavior:"smooth"})})}
 function submitZip(){searchZip(zip.trim())}
 // "Use my location": the button itself shows progress (finding you → loading events) and can't be pressed twice;
 // problems are explained right under it, where the person is looking.
 const[locating,setLocating]=useState(false),[locErr,setLocErr]=useState("");
 function useLocation(){
  if(locating)return;setLocErr("");
  if(!navigator.geolocation)return setLocErr("Your browser can't share its location. Enter a ZIP code instead.");
  setLocating(true);
  // If the browser's permission prompt is ignored, don't spin forever.
  const guard=setTimeout(()=>{setLocating(false);setLocErr("Waiting for permission — tap Allow in your browser's location prompt, or enter a ZIP code.")},20000);
  navigator.geolocation.getCurrentPosition(async p=>{clearTimeout(guard);setLocErr("");const c={lat:p.coords.latitude,lng:p.coords.longitude};setCoords(c);setSearchedZip("");setZip("");setLocating(false);
    setTimeout(()=>document.getElementById("results")?.scrollIntoView({behavior:"smooth"}),50);await load("",range,c,radius)},
   e=>{clearTimeout(guard);setLocating(false);setLocErr(e.code===1?"Location is turned off for this site. Allow it in your browser settings, or enter a ZIP code.":e.code===3?"Finding your location took too long. Try again, or enter a ZIP code.":"Couldn't find your location. Try again, or enter a ZIP code.")},
   {timeout:15000,maximumAge:600000});
 }
 function chooseRange(r:string){setRange(r);load(searchedZip,r,coords,radius)}
 function chooseRadius(rad:string){setRadius(rad);store.set("gotoday:radius",rad);load(searchedZip,range,coords,rad)}
 function toggleChip(c:string){if(c==="All"){setSelected([]);setAgeBands([]);setSetting("Any");setDropIn(false);setSpanish(false);setSeniors(false);return}setSelected(s=>s.includes(c)?s.filter(x=>x!==c):[...s,c])}

 async function share(e:EventItem){
  const url=e.source==="Ticketmaster"?(e.url||location.origin):`${location.origin}/events/${encodeURIComponent(e.id||"")}`;
  const text=`${e.title} — ${fmt(e.date,e.time)} at ${e.venue||e.city}`;
  try{if(navigator.share){await navigator.share({title:e.title,text,url});return}}catch(err:any){if(err?.name==="AbortError")return}
  try{await navigator.clipboard.writeText(`${text}\n${url}`);setToast("Link copied")}catch{setToast("Couldn't copy link")}
  setTimeout(()=>setToast(""),2200);
 }

 const filtered=useMemo(()=>{
  const qWords=norm(query).split(" ").filter(w=>w.length>1),interests=selected.filter(x=>x!=="Free");
  return events.filter(e=>{
   const tags=new Set([e.category,...(e.tags||[])]);
   // Interests come from the server's facets (one consistent reading of every source); chips combine with OR.
   const facets=new Set(e.facets||[...tags].filter(Boolean) as string[]);
   const cm=(interests.length===0||interests.some(x=>facets.has(x)))&&(!selected.includes("Free")||facets.has("Free")||!!e.isFree);
   const more=(setting==="Any"||tags.has(setting))&&(!dropIn||tags.has("Drop-in"))&&(!spanish||tags.has("En Español"))&&(!seniors||tags.has("Seniors")||(e.ageMin!=null&&e.ageMin>=50));
   // Kids' ages: an event counts when its range overlaps a chosen band; a kids event that gives no ages is for any age.
   const kr=kidAgeRange(e as any);
   const am=!selected.includes("Kids")||ageBands.length===0||!facets.has("Kids")||kr==null||AGE_BANDS.some(([l,lo,hi])=>ageBands.includes(l)&&(l==="All ages"?kr[0]<=2&&kr[1]>=17:kr[0]<=hi&&kr[1]>=lo));
   const h=e.time?Number(e.time.slice(0,2)):-1;
   const tm=timeFilter==="Any time"||h<0||(timeFilter==="Morning"&&h<12)||(timeFilter==="Afternoon"&&h>=12&&h<17)||(timeFilter==="Evening"&&h>=17);
   return cm&&am&&more&&tm&&(!qWords.length||(t=>qWords.every(w=>t.includes(w)))(norm([e.title,e.city,e.venue,e.desc,e.category,e.genre,...(e.labels||[])].filter(Boolean).join(" "))));
  }).sort((a,b)=>{
   // Nearest (default): day by day, closest first within each day. Soonest: by start time.
   const when=((a.date||"")+(a.time||"")).localeCompare((b.date||"")+(b.time||""));
   if(sort!=="Nearest")return when;
   return (a.date||"").localeCompare(b.date||"")||(a.distanceMiles??999)-(b.distanceMiles??999)||when;
  });
 },[events,selected,timeFilter,sort,query,ageBands,setting,dropIn,spanish,seniors]);

 const moreCount=(setting!=="Any"?1:0)+(dropIn?1:0)+(spanish?1:0)+(seniors?1:0);
 const where=coords?"your location":searchedZip||"your area",hasPlace=!!(coords||searchedZip);
 return <main className="page">
  <section className="hero">
   <nav><a className="logo" href="/?fresh=1">Go<span>Today</span></a><a className="createBtn" href="/create">+ Create event</a></nav>
   <div className="heroContent">
    <div className="eyebrow">EXPLORE MORE. TODAY.</div>
    <h1>Find your <span>next thing.</span></h1>
    <p className="heroLead">Free and local things happening near you&nbsp;— from library storytimes to park concerts.</p>
    <form className="searchRow" onSubmit={ev=>{ev.preventDefault();submitZip()}}>
     <input inputMode="numeric" autoComplete="postal-code" maxLength={5} aria-label="ZIP code" value={zip} onChange={e=>{setZip(e.target.value.replace(/\D/g,""));if(zipErr)setZipErr("")}} aria-invalid={!!zipErr} aria-describedby="zipErr" placeholder="ZIP code"/>
     <button type="submit" className="go">{loading?"…":"Search"}</button>
    </form>
    {zipErr&&<p className="locErr zipErr" id="zipErr" role="alert">{zipErr}</p>}
    <button type="button" className={`locate${locating||(loading&&coords)?" busy":""}`} onClick={useLocation} disabled={locating||(loading&&!!coords)} aria-live="polite">
     {locating?<><span className="spin" aria-hidden/>Finding your location…</>:loading&&coords?<><span className="spin" aria-hidden/>Finding events near you…</>:"📍 Use my location"}
    </button>
    {locErr&&<p className="locErr" role="alert">{locErr}</p>}
   </div>
  </section>

  {!hasPlace&&<section className="content start" id="results">
   <div className="startIcon">📍</div>
   <h2>Where are you exploring?</h2>
   <p>Enter a ZIP code above or tap <b>Use my location</b> to see what's happening near you today.</p>
   <div className="label">OR PICK AN AREA</div>
   <div className="chips startAreas">{AREAS.map(([l,z])=><button key={z} type="button" onClick={()=>{setZip(z);searchZip(z)}}>{l}</button>)}</div>
  </section>}
  {hasPlace&&<section className="content" id="results">
   <div className="toolbar">
    <div className="where"><b>📍 {where}</b><span className="rangeLabel">within {radius} mi</span></div>
    <input type="search" placeholder="Search events" value={query} onChange={e=>setQuery(e.target.value)}/>
   </div>

   {/* All filters live in one card: when + sort controls, interests, then optional extras. */}
   <div className="filterCard">
    <div className="fcTop">
     <div className="fcWhen">
      <div className="label">When</div>
      <div className="seg when four">{RANGES.map(([k,l])=><button key={k} className={range===k?"active":""} onClick={()=>chooseRange(k)}>{k==="weekend"?"Weekend":l}{k==="weekend"&&<small>{nextWeekendLabel()}</small>}</button>)}
       {/* Any other day in the next three weeks */}
       <label className={`pickDay${/^\d{4}/.test(range)?" active":""}`}>
        <span>{/^\d{4}/.test(range)?dayLabel(range,"weekday"):"Pick day"}</span><small>{/^\d{4}/.test(range)?dayLabel(range,"date"):"▾"}</small>
        <select aria-label="Pick a day" value={/^\d{4}/.test(range)?range:""} onChange={e=>e.target.value&&chooseRange(e.target.value)}>
         <option value="" disabled>Pick a day</option>
         {upcomingDays().map(d=><option key={d} value={d}>{dayLabel(d,"full")}</option>)}
        </select>
       </label>
      </div>
     </div>
     <div className="filters">
      <label>Distance<select value={radius} onChange={e=>chooseRadius(e.target.value)}>{["10","15","25","50"].map(r=><option key={r} value={r}>{r} mi</option>)}</select></label>
      <label>Time<select value={timeFilter} onChange={e=>setTimeFilter(e.target.value)}>{TIMES.map(t=><option key={t} value={t}>{t==="Any time"?"Any":t}</option>)}</select></label>
      <label>Sort<select value={sort} onChange={e=>setSort(e.target.value)}><option>Nearest</option><option>Soonest</option></select></label>
     </div>
    </div>
    <div className="fcSection">
     <div className="label">What are you into?</div>
     <div className="chips wrap even4">{CHIPS.map(c=><button key={c} className={(c==="All"?selected.length===0&&moreCount===0:selected.includes(c))?"active":""} onClick={()=>toggleChip(c)}>{c==="Arts & Theatre"?<><span className="lg">Arts & Theatre</span><span className="sm">Arts</span></>:c}</button>)}</div>
    </div>
    {selected.includes("Kids")&&<div className="fcSection">
     <div className="label">Kids' ages</div>
     <div className="chips wrap even6">{AGE_BANDS.map(([l,a,b])=><button key={l} title={l} className={ageBands.includes(l)?"active":""} onClick={()=>setAgeBands(x=>x.includes(l)?x.filter(y=>y!==l):[...x,l])}><span className="lg">{l}</span><span className="sm">{l==="All ages"?"All ages":`${a}–${b}`}</span></button>)}</div>
    </div>}
    <button className={`moreBtn${moreOpen||moreCount?" on":""}`} onClick={()=>setMoreOpen(o=>!o)} aria-expanded={moreOpen}><span>⚙ More filters{moreCount?` (${moreCount})`:""}</span><span aria-hidden>{moreOpen?"▴":"▾"}</span></button>
    {moreOpen&&<div className="morePanel">
     <div className="moreRow"><span>Setting</span><div className="seg setting">{SETTINGS.map(x=><button key={x} className={setting===x?"active":""} onClick={()=>setSetting(x)}>{x}</button>)}</div></div>
     <label className="toggle"><input type="checkbox" checked={dropIn} onChange={e=>setDropIn(e.target.checked)}/> Drop-in <small>no registration needed</small></label>
     <label className="toggle"><input type="checkbox" checked={spanish} onChange={e=>setSpanish(e.target.checked)}/> En Español</label>
     <label className="toggle"><input type="checkbox" checked={seniors} onChange={e=>setSeniors(e.target.checked)}/> Seniors <small>50+ programs</small></label>
    </div>}
   </div>

   {message&&<p className="notice">{message}</p>}
   {soon&&!loading&&<div className="soon">
    <div className="soonIcon">📍</div>
    <h3>GoToday is coming to {soon.place||"your area"} soon</h3>
    <p>We're bringing local events to new cities every week: festivals, library programs, park activities, markets and more. We're not showing events here yet, but your area is on our list.</p>
    <p className="muted">Right now GoToday covers South Florida (Miami-Dade, Broward and Palm Beach), Greater Orlando, Tampa Bay and New York City.</p>
    <div className="soonActions"><a className="btn primary" href="/create">Post an event in your area</a><button type="button" className="btn ghost" onClick={()=>{setZip("");document.querySelector<HTMLInputElement>('input[aria-label="ZIP code"]')?.focus();window.scrollTo({top:0,behavior:"smooth"})}}>Try another ZIP</button></div>
   </div>}
   {!soon&&<div className="resultsHead"><div className="kicker">NEAR {where.toUpperCase()}</div><h2>{loading?"Searching…":`${filtered.length} thing${filtered.length===1?"":"s"} to do`}</h2></div>}

   <div className="grid">{filtered.map((e,i)=><article className="card" key={e.id||e.title+i}>
    <a className={e.image?"pic":"pic noimg"} style={e.image?undefined:{background:artFor(e).bg}} href={detailHref(e)} target={e.source==="Ticketmaster"?"_blank":undefined} rel="noreferrer" aria-hidden tabIndex={-1}>
     {e.image?<><img className="picBlur" src={e.image} alt="" loading="lazy" referrerPolicy="no-referrer"/>
      <img className="picMain" src={e.image} alt="" loading="lazy" referrerPolicy="no-referrer" onLoad={x=>fitPic(x.currentTarget)} onError={x=>{const a=x.currentTarget.parentElement as HTMLElement;a.classList.add("noimg");a.style.background=artFor(e).bg;a.querySelectorAll("img").forEach(i=>i.remove());const n=a.querySelector("span") as HTMLElement|null;if(n)n.style.display="flex"}}/></>:null}
     <span style={e.image?{display:"none"}:undefined}><i>{artFor(e).icon}</i></span>
     {(e.isFree||e.facets?.includes("Free"))&&<em className="freeBadge">Free</em>}
    </a>
    <div className="cardBody">
     <h3><a href={detailHref(e)} target={e.source==="Ticketmaster"?"_blank":undefined} rel="noreferrer">{e.title}</a></h3>
     <div className="meta">🗓 {fmt(e.date,e.time)}{e.live&&<b className="liveNow"> · Happening now</b>}</div>
     <div className="meta locLine"><span className="locV" title={e.venue||e.city}>📍 {e.venue||e.city}</span><span className="locD">{typeof e.distanceMiles==="number"?`\u00a0· ${e.distanceMiles.toFixed(1)} mi`:""}{e.moreLocations?<b title={(e.otherVenues||[]).join(", ")}>{`\u00a0· +${e.moreLocations} more`}</b>:null}</span></div>
     {e.desc&&<p className="desc">{e.desc}</p>}
     {(e.tags||[]).includes("Drop-in")?<div className="hint ok">✓ Drop-in, no registration</div>:e.registration&&e.source!=="Ticketmaster"?<div className="hint">{e.registration}</div>:null}
     <div className="tags">{ageLabel(e)&&<span className="age">{ageLabel(e)}</span>}{(e.labels||(e.tags||[]).filter(t=>!["Local","Library","Free","Parks","Tickets","Drop-in"].includes(t)&&!/\(/.test(t))).slice(0,3).map(t=><span key={t}>{t}</span>)}</div>
     <div className="actions">
      <a className="primary" href={detailHref(e)} target={e.source==="Ticketmaster"?"_blank":undefined} rel="noreferrer">{e.source==="Ticketmaster"?"Tickets ↗":"View details"}</a>
      {e.id&&<AddToCalendar compact base={`/events/${encodeURIComponent(e.id)}`}/>}
      <button type="button" className="share" onClick={()=>share(e)} aria-label={`Share ${e.title}`}>
       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>Share
      </button>
     </div>
    </div>
   </article>)}</div>
  </section>}
  {toast&&<div className="toast" role="status">{toast}</div>}
 </main>
}
