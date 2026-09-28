"use client";
import {useEffect,useMemo,useState} from "react";
import AddToCalendar from "./components/AddToCalendar";

type EventItem={id?:string;title:string;city:string;venue?:string;date?:string;time?:string;image?:string;url?:string;category?:string;genre?:string;minPrice?:number|null;desc?:string;tags?:string[];emoji?:string;source?:string;distanceMiles?:number;distanceAccuracy?:string;ageMin?:number;ageMax?:number;registration?:string;moreLocations?:number;otherVenues?:string[];isFree?:boolean};

const AGE_BANDS:[string,number,number][]=[["Babies & toddlers",0,2],["Preschool 3–5",3,5],["Ages 6–9",6,9],["Tweens 10–12",10,12],["Teens 13–17",13,17]];
// Interest chips combine with OR; "Free" and the More-filters options always narrow the results.
const CHIPS=["All","Family","Kids","Adults","Free","Music","Arts & Theatre","Sports"];
const SETTINGS=["Any","Indoor","Outdoor"];
const RANGES=[["today","Today"],["tomorrow","Tomorrow"],["weekend","Next Weekend"]] as const;
const TIMES=["Any time","Morning","Afternoon","Evening"];
const DEFAULT_ZIP="33326";

function ageLabel(e:EventItem){if(e.ageMin==null||e.ageMax==null||e.ageMax>18)return"";return e.ageMax<=1?"Babies":`Ages ${e.ageMin}–${e.ageMax}`}
function fmt(d?:string,t?:string){if(!d)return"Date TBA";const day=new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric"}).format(new Date(d+"T12:00:00"));if(!t)return day+" · All day";return day+" · "+new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"}).format(new Date(d+"T"+t))}
function nextWeekendLabel(){
 const p=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const g=(t:string)=>p.find(x=>x.type===t)?.value||"",base=new Date(`${g("year")}-${g("month")}-${g("day")}T12:00:00Z`);
 const day=base.getUTCDay(),n=day===6?7:(6-day+7)%7||7,sat=new Date(base);sat.setUTCDate(sat.getUTCDate()+n);const sun=new Date(sat);sun.setUTCDate(sun.getUTCDate()+1);
 const m=(d:Date)=>d.toLocaleDateString("en-US",{month:"short",timeZone:"UTC"});
 return m(sat)===m(sun)?`${m(sat)} ${sat.getUTCDate()}–${sun.getUTCDate()}`:`${m(sat)} ${sat.getUTCDate()} – ${m(sun)} ${sun.getUTCDate()}`;
}
function detailHref(e:EventItem){return e.source==="Ticketmaster"?(e.url||"#"):e.source==="GoToday Community"&&e.url?e.url:"/events/"+encodeURIComponent(e.id||"")}
const store={get:(k:string)=>{try{return localStorage.getItem(k)}catch{return null}},set:(k:string,v:string)=>{try{localStorage.setItem(k,v)}catch{}}};

export default function Home(){
 const[zip,setZip]=useState(DEFAULT_ZIP),[searchedZip,setSearchedZip]=useState(DEFAULT_ZIP),[coords,setCoords]=useState<{lat:number;lng:number}|null>(null);
 const[radius,setRadius]=useState("25"),[range,setRange]=useState("today"),[selected,setSelected]=useState<string[]>([]),[ageBands,setAgeBands]=useState<string[]>([]),[moreOpen,setMoreOpen]=useState(false),[setting,setSetting]=useState("Any"),[dropIn,setDropIn]=useState(false),[spanish,setSpanish]=useState(false),[seniors,setSeniors]=useState(false);
 const[timeFilter,setTimeFilter]=useState("Any time"),[sort,setSort]=useState("Soonest"),[query,setQuery]=useState("");
 const[events,setEvents]=useState<EventItem[]>([]),[loading,setLoading]=useState(false),[message,setMessage]=useState(""),[toast,setToast]=useState("");

 async function load(z:string,r:string,c:{lat:number;lng:number}|null,rad:string){
  setLoading(true);setMessage("");
  try{
   const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
   const q=new URLSearchParams({postalCode:z||DEFAULT_ZIP,radius:rad,range:r,today});
   if(c){q.set("lat",String(c.lat));q.set("lng",String(c.lng))}
   const d=await (await fetch("/api/events?"+q,{cache:"no-store"})).json();
   setEvents(d.events||[]);
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
  if(v&&v.day===today&&Date.now()-v.savedAt<45*60e3&&(!fromUrl||fromUrl===v.searchedZip)){
   setZip(v.zip);setSearchedZip(v.searchedZip);setCoords(v.coords);setRadius(v.radius);setRange(v.range);setSelected(v.selected);setAgeBands(v.ageBands);
   setMoreOpen(v.moreOpen);setSetting(v.setting);setDropIn(v.dropIn);setSpanish(v.spanish);setSeniors(v.seniors);setTimeFilter(v.timeFilter);setSort(v.sort);setQuery(v.query);
   setEvents(v.events||[]);setMessage(v.message||"");setRestored(true);
   try{history.scrollRestoration="manual"}catch{}
   // Jump back to the card you opened only when returning from an event (not on a fresh visit).
   let back=false;try{back=sessionStorage.getItem("gotoday:openedEvent")==="1";sessionStorage.removeItem("gotoday:openedEvent")}catch{}
   const y=back?v.scrollY||0:0;requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo(0,y)));
   return;
  }
  const saved=store.get("gotoday:zip"),savedRadius=store.get("gotoday:radius");
  const z=[fromUrl,saved].find(x=>x&&/^\d{5}$/.test(x))||DEFAULT_ZIP,rad=savedRadius&&["10","15","25","50"].includes(savedRadius)?savedRadius:"25";
  setZip(z);setSearchedZip(z);setRadius(rad);load(z,"today",null,rad);setRestored(true);
 },[]);
 // Keep the saved view current (filters, results and scroll position) so "Back" lands where you were.
 useEffect(()=>{
  if(!restored)return;
  const save=()=>{try{sessionStorage.setItem(VIEW,JSON.stringify({zip,searchedZip,coords,radius,range,selected,ageBands,moreOpen,setting,dropIn,spanish,seniors,timeFilter,sort,query,
   events,message,scrollY:window.scrollY,savedAt:Date.now(),day:new Date().toDateString()}))}catch{}};
  save();
  let t:any=null;const onScroll=()=>{clearTimeout(t);t=setTimeout(save,150)};
  const onClick=(e:MouseEvent)=>{if((e.target as HTMLElement)?.closest?.(".card a"))try{sessionStorage.setItem("gotoday:openedEvent","1")}catch{};save()};
  window.addEventListener("scroll",onScroll,{passive:true});window.addEventListener("pagehide",save);document.addEventListener("click",onClick,true);
  return()=>{clearTimeout(t);window.removeEventListener("scroll",onScroll);window.removeEventListener("pagehide",save);document.removeEventListener("click",onClick,true)};
 },[restored,zip,searchedZip,coords,radius,range,selected,ageBands,moreOpen,setting,dropIn,spanish,seniors,timeFilter,sort,query,events,message]);

 function submitZip(){const z=zip.trim();if(!/^\d{5}$/.test(z)){setMessage("Enter a valid 5-digit ZIP code.");return}store.set("gotoday:zip",z);setCoords(null);setSearchedZip(z);load(z,range,null,radius);document.getElementById("results")?.scrollIntoView({behavior:"smooth"})}
 function useLocation(){if(!navigator.geolocation)return setMessage("Location is not supported by this browser.");setMessage("Finding your location…");navigator.geolocation.getCurrentPosition(p=>{const c={lat:p.coords.latitude,lng:p.coords.longitude};setCoords(c);setSearchedZip("");setZip("");load("",range,c,radius);document.getElementById("results")?.scrollIntoView({behavior:"smooth"})},()=>setMessage("Location permission was not granted. Enter a ZIP code instead."),{timeout:10000,maximumAge:600000})}
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
  const q=query.trim().toLowerCase(),interests=selected.filter(x=>x!=="Free");
  return events.filter(e=>{
   const tags=new Set([e.category,...(e.tags||[])]);
   const adultsOnly=e.ageMin!=null&&e.ageMin>=18;
   const cm=(interests.length===0||interests.some(x=>x==="Adults"?adultsOnly:tags.has(x)||(x==="Family"&&tags.has("Kids"))))&&(!selected.includes("Free")||tags.has("Free")||!!e.isFree);
   const more=(setting==="Any"||tags.has(setting))&&(!dropIn||tags.has("Drop-in"))&&(!spanish||tags.has("En Español"))&&(!seniors||tags.has("Seniors")||(e.ageMin!=null&&e.ageMin>=50));
   const am=!selected.includes("Kids")||ageBands.length===0||!tags.has("Kids")||e.ageMin==null||e.ageMax==null||AGE_BANDS.some(([l,lo,hi])=>ageBands.includes(l)&&e.ageMin!<=hi&&e.ageMax!>=lo);
   const h=e.time?Number(e.time.slice(0,2)):-1;
   const tm=timeFilter==="Any time"||h<0||(timeFilter==="Morning"&&h<12)||(timeFilter==="Afternoon"&&h>=12&&h<17)||(timeFilter==="Evening"&&h>=17);
   return cm&&am&&more&&tm&&(!q||[e.title,e.city,e.venue,e.desc,e.category,e.genre].filter(Boolean).join(" ").toLowerCase().includes(q));
  }).sort((a,b)=>sort==="Nearest"?(a.distanceMiles??999)-(b.distanceMiles??999):((a.date||"")+(a.time||"")).localeCompare((b.date||"")+(b.time||"")));
 },[events,selected,timeFilter,sort,query,ageBands,setting,dropIn,spanish,seniors]);

 const moreCount=(setting!=="Any"?1:0)+(dropIn?1:0)+(spanish?1:0)+(seniors?1:0);
 const where=coords?"your location":searchedZip||"your area";
 return <main className="page">
  <section className="hero">
   <nav><div className="logo">Go<span>Today</span></div><a className="createBtn" href="/create">+ Create event</a></nav>
   <div className="heroContent">
    <div className="eyebrow">EXPLORE MORE. TODAY.</div>
    <h1>Find your <span>next thing.</span></h1>
    <p className="heroLead">Free and local things happening near you — from library storytimes to park concerts.</p>
    <form className="searchRow" onSubmit={ev=>{ev.preventDefault();submitZip()}}>
     <input inputMode="numeric" autoComplete="postal-code" maxLength={5} aria-label="ZIP code" value={zip} onChange={e=>setZip(e.target.value.replace(/\D/g,""))} placeholder="ZIP code"/>
     <button type="submit" className="go">{loading?"…":"Search"}</button>
    </form>
    <button type="button" className="locate" onClick={useLocation}>📍 Use my location</button>
   </div>
  </section>

  <section className="content" id="results">
   <div className="toolbar">
    <div className="where"><b>📍 {where}</b><span className="rangeLabel">within {radius} mi</span></div>
    <input type="search" placeholder="Search events" value={query} onChange={e=>setQuery(e.target.value)}/>
   </div>

   <div className="label">WHEN</div>
   <div className="chips">{RANGES.map(([k,l])=><button key={k} className={range===k?"active":""} onClick={()=>chooseRange(k)}>{l}{k==="weekend"&&<small className="chipDates"> · {nextWeekendLabel()}</small>}</button>)}</div>

   <div className="label">WHAT ARE YOU INTO?</div>
   <div className="chips">{CHIPS.map(c=><button key={c} className={(c==="All"?selected.length===0&&moreCount===0:selected.includes(c))?"active":""} onClick={()=>toggleChip(c)}>{c}</button>)}</div>
   <button className={`moreBtn${moreOpen||moreCount?" on":""}`} onClick={()=>setMoreOpen(o=>!o)} aria-expanded={moreOpen}>⚙ More filters{moreCount?` (${moreCount})`:""} {moreOpen?"▴":"▾"}</button>
   {moreOpen&&<div className="morePanel">
    <div className="moreRow"><span>Setting</span><div className="seg">{SETTINGS.map(x=><button key={x} className={setting===x?"active":""} onClick={()=>setSetting(x)}>{x==="Indoor"?"🏠 Indoor":x==="Outdoor"?"🌳 Outdoor":x}</button>)}</div></div>
    <label className="toggle"><input type="checkbox" checked={dropIn} onChange={e=>setDropIn(e.target.checked)}/> Drop-in <small>no registration needed</small></label>
    <label className="toggle"><input type="checkbox" checked={spanish} onChange={e=>setSpanish(e.target.checked)}/> En Español</label>
    <label className="toggle"><input type="checkbox" checked={seniors} onChange={e=>setSeniors(e.target.checked)}/> Seniors <small>50+ programs</small></label>
   </div>}
   {selected.includes("Kids")&&<><div className="label">KIDS' AGES</div><div className="chips">{AGE_BANDS.map(([l])=><button key={l} className={ageBands.includes(l)?"active":""} onClick={()=>setAgeBands(b=>b.includes(l)?b.filter(x=>x!==l):[...b,l])}>{l}</button>)}</div></>}

   <div className="filters">
    <label>Distance<select value={radius} onChange={e=>chooseRadius(e.target.value)}>{["10","15","25","50"].map(r=><option key={r} value={r}>{r} miles</option>)}</select></label>
    <label>Time<select value={timeFilter} onChange={e=>setTimeFilter(e.target.value)}>{TIMES.map(t=><option key={t}>{t}</option>)}</select></label>
    <label>Sort<select value={sort} onChange={e=>setSort(e.target.value)}><option>Soonest</option><option>Nearest</option></select></label>
   </div>

   {message&&<p className="notice">{message}</p>}
   <div className="resultsHead"><div className="kicker">NEAR {where.toUpperCase()}</div><h2>{loading?"Searching…":`${filtered.length} thing${filtered.length===1?"":"s"} to do`}</h2></div>

   <div className="grid">{filtered.map((e,i)=><article className="card" key={e.id||e.title+i}>
    <a className={e.image?"pic":"pic noimg"} href={detailHref(e)} target={e.source==="Ticketmaster"?"_blank":undefined} rel="noreferrer" aria-hidden tabIndex={-1}>
     {e.image?<img src={e.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={x=>{x.currentTarget.style.display="none";const n=x.currentTarget.nextElementSibling as HTMLElement|null;if(n)n.style.display="flex"}}/>:null}
     <span style={e.image?{display:"none"}:undefined}>{e.emoji||"🎟️"}</span>
     {e.isFree&&<em className="freeBadge">Free</em>}
    </a>
    <div className="cardBody">
     <h3><a href={detailHref(e)} target={e.source==="Ticketmaster"?"_blank":undefined} rel="noreferrer">{e.title}</a></h3>
     <div className="meta">🗓 {fmt(e.date,e.time)}</div>
     <div className="meta">📍 {e.venue||e.city}{typeof e.distanceMiles==="number"?` · ${e.distanceMiles.toFixed(1)} mi`:""}{e.moreLocations?<b title={(e.otherVenues||[]).join(", ")}>{` · +${e.moreLocations} more location${e.moreLocations>1?"s":""}`}</b>:null}</div>
     {e.desc&&<p className="desc">{e.desc}</p>}
     {(e.tags||[]).includes("Drop-in")?<div className="hint ok">✓ Drop-in, no registration</div>:e.registration&&e.source!=="Ticketmaster"?<div className="hint">{e.registration}</div>:null}
     <div className="tags">{ageLabel(e)&&<span className="age">{ageLabel(e)}</span>}{(e.tags||[]).filter(t=>!["Local","Library","Free","Parks","Tickets","Drop-in"].includes(t)&&!/\(/.test(t)).slice(0,3).map(t=><span key={t}>{t}</span>)}</div>
     <div className="actions">
      <a className="primary" href={detailHref(e)} target={e.source==="Ticketmaster"?"_blank":undefined} rel="noreferrer">{e.source==="Ticketmaster"?"Tickets ↗":"View details"}</a>
      {e.id&&<AddToCalendar compact base={`/events/${encodeURIComponent(e.id)}`}/>}
      <button type="button" className="share" onClick={()=>share(e)} aria-label={`Share ${e.title}`}>
       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>Share
      </button>
     </div>
    </div>
   </article>)}</div>
  </section>
  {toast&&<div className="toast" role="status">{toast}</div>}
 </main>
}
