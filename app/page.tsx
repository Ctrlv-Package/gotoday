"use client";
import {kidAgeRange} from "../lib/facets";
import {useEffect,useMemo,useRef,useState} from "react";
import SaveButton from "./components/SaveButton";
import NavMe from "./components/NavMe";
import ReplyBanner from "./components/ReplyBanner";
import Dropdown from "./components/Dropdown";
import CalendarChoice from "./components/CalendarChoice";
import {useT,LangPicker} from "./components/Lang";
import {type T, type EventItem, AGE_BANDS, CHIPS, SETTINGS, AREAS, RANGES, TIMES, DEFAULT_ZIP, ageLabel, fmt, norm, upcomingDays, dayLabel, nextWeekendLabel, detailHref, fitPic, artFor, store} from "./components/homeShared";
export default function Home(){
 const {t,locale}=useT();
 const[zipErr,setZipErr]=useState(""),lastGood=useRef(""),[zip,setZip]=useState(""),[searchedZip,setSearchedZip]=useState(""),[coords,setCoords]=useState<{lat:number;lng:number}|null>(null);
 const[radius,setRadius]=useState("25"),[range,setRange]=useState("today"),[selected,setSelected]=useState<string[]>([]),[ageBands,setAgeBands]=useState<string[]>([]),[moreOpen,setMoreOpen]=useState(false),[setting,setSetting]=useState("Any"),[dropIn,setDropIn]=useState(false),[spanish,setSpanish]=useState(false),[seniors,setSeniors]=useState(false);
 const[timeFilter,setTimeFilter]=useState("Any time"),[view,setView]=useState<"all"|"big"|"fav">("all"),[bigRange,setBigRange]=useState("today"),[bigRadius,setBigRadius]=useState("25"),[sort,setSort]=useState("Nearest"),[query,setQuery]=useState("");
 const[soon,setSoon]=useState<{place:string|null}|null>(null),[events,setEvents]=useState<EventItem[]>([]),[loading,setLoading]=useState(false),[message,setMessage]=useState(""),[toast,setToast]=useState("");

 // Big events have their own span (next 7 / 30 days) and distance; load() uses them while that view is on.
 const bigOnly=view!=="all";   // "Coming up" and "Favorites" share the 7/30-day span and their own distance
 const big=useRef({view:"all",range:"today",radius:"25"});
 big.current={view,range:bigRange,radius:bigRadius};
 async function load(z:string,r:string,c:{lat:number;lng:number}|null,rad:string){
  if(big.current.view!=="all"){r=big.current.range;rad=big.current.radius}
  setLoading(true);setMessage("");setSoon(null);
  try{
   const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
   const q=new URLSearchParams({postalCode:z||DEFAULT_ZIP,radius:rad,range:r,today});
   if(c){q.set("lat",String(c.lat));q.set("lng",String(c.lng))}
   if(big.current.view==="big")q.set("hot","1");   // Popular: ranked by real interest signals
   if(big.current.view==="fav")q.set("popular","1");
   const d=await (await fetch("/api/events?"+q,{cache:"no-store"})).json();
   // A ZIP that doesn't exist: explain it under the search box and keep whatever was showing before.
   if(d.invalidZip){setZipErr(t("We couldn't find ZIP code {zip}. Please check the number and try again.",{zip:z}));setSearchedZip(lastGood.current);return false}
   if(!c&&z)lastGood.current=z;
   setEvents(d.events||[]);
   setSoon(d.coverage&&d.coverage.covered===false?{place:d.coverage.place||null}:null);
   if(d.coverage?.covered===false)return;
   if(!d.events?.length&&big.current.view==="fav"){setMessage("No favorites near you yet. Tap ♡ on events you like: the ones people save the most show up here.");return}
   if(!d.events?.length&&big.current.view==="big"){setMessage("Nothing popular nearby yet for this day. Try This weekend or a bigger distance.");return}
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
  // Coming BACK to the page restores the view (search, filters, scroll). A refresh, the logo, or a new visit starts fresh.
  const nav=(performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming|undefined)?.type;
  let realReload=false;try{const seen=sessionStorage.getItem("gotoday:load");realReload=nav==="reload"&&seen!==String(performance.timeOrigin);sessionStorage.setItem("gotoday:load",String(performance.timeOrigin))}catch{}
  const freshParam=new URLSearchParams(location.search).has("fresh");
  // Returning = coming back from any other GoToday page (an event, My GoToday, sign-in…), by link or the browser's Back.
  let returning=nav==="back_forward";try{returning=returning||sessionStorage.getItem("gotoday:openedEvent")==="1";sessionStorage.removeItem("gotoday:openedEvent")}catch{}
  if(freshParam||realReload||!returning){try{sessionStorage.removeItem(VIEW)}catch{};v=null}
  if(freshParam)history.replaceState(null,"",location.pathname+(fromUrl?`?zip=${fromUrl}`:""));
  // Coming back restores what you were looking at even if the address still has an older ?zip= (you then used your location).
  if(v&&v.day===today&&Date.now()-v.savedAt<45*60e3&&(returning||!fromUrl||fromUrl===v.searchedZip)){
   setZip(v.zip);setSearchedZip(v.searchedZip);setCoords(v.coords);setRadius(v.radius);setRange(v.range);setSelected(v.selected);setAgeBands(v.ageBands);
   setMoreOpen(v.moreOpen);setSetting(v.setting);setDropIn(v.dropIn);setSpanish(v.spanish);setSeniors(v.seniors);setTimeFilter(v.timeFilter);setView(v.view==="big"||v.view==="fav"?v.view:"all");if(v.bigRange)setBigRange(v.bigRange==="today"||v.bigRange==="weekend"||v.view!=="big"?v.bigRange:"today");if(v.bigRadius)setBigRadius(v.bigRadius);setSort(v.sort);setQuery(v.query);
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
  const save=()=>{try{sessionStorage.setItem(VIEW,JSON.stringify({view,bigRange,bigRadius,zip,searchedZip,coords,radius,range,selected,ageBands,moreOpen,setting,dropIn,spanish,seniors,timeFilter,sort,query,
   events,message,soon,scrollY:window.scrollY,savedAt:Date.now(),day:new Date().toDateString()}))}catch{}};
  save();
  let t:any=null;const onScroll=()=>{clearTimeout(t);t=setTimeout(save,150)};
  // Leaving for another GoToday page (an event, My GoToday, Create…) — but not the logo, which means "start over".
  const onClick=(e:MouseEvent)=>{const a=(e.target as HTMLElement)?.closest?.("a") as HTMLAnchorElement|null;
   if(a){try{const u=new URL(a.href,location.href);if(u.origin===location.origin&&!u.searchParams.has("fresh"))sessionStorage.setItem("gotoday:openedEvent","1")}catch{}}
   save()};
  window.addEventListener("scroll",onScroll,{passive:true});window.addEventListener("pagehide",save);document.addEventListener("click",onClick,true);
  return()=>{clearTimeout(t);window.removeEventListener("scroll",onScroll);window.removeEventListener("pagehide",save);document.removeEventListener("click",onClick,true)};
 },[restored,view,bigRange,bigRadius,zip,searchedZip,coords,radius,range,selected,ageBands,moreOpen,setting,dropIn,spanish,seniors,timeFilter,sort,query,events,message,soon]);

 function searchZip(z:string){setZipErr("");if(!/^\d{5}$/.test(z)){setZipErr(z?t("A ZIP code has 5 digits, like 33326."):t("Enter a ZIP code to search."));return}store.set("gotoday:zip",z);setCoords(null);setSearchedZip(z);try{history.replaceState(null,"",`${location.pathname}?zip=${z}`)}catch{}load(z,range,null,radius).then(ok=>{if(ok!==false)document.getElementById("results")?.scrollIntoView({behavior:"smooth"})})}
 function submitZip(){searchZip(zip.trim())}
 // "Use my location": the button itself shows progress (finding you → loading events) and can't be pressed twice;
 // problems are explained right under it, where the person is looking.
 const[locating,setLocating]=useState(false),[locErr,setLocErr]=useState("");
 function useLocation(){
  if(locating)return;setLocErr("");
  if(!navigator.geolocation)return setLocErr(t("Your browser can't share its location. Enter a ZIP code instead."));
  setLocating(true);
  // If the browser's permission prompt is ignored, don't spin forever.
  const guard=setTimeout(()=>{setLocating(false);setLocErr(t("Waiting for permission — tap Allow in your browser's location prompt, or enter a ZIP code."))},20000);
  navigator.geolocation.getCurrentPosition(async p=>{clearTimeout(guard);setLocErr("");const c={lat:p.coords.latitude,lng:p.coords.longitude};setCoords(c);setSearchedZip("");setZip("");setLocating(false);
    setTimeout(()=>document.getElementById("results")?.scrollIntoView({behavior:"smooth"}),50);try{history.replaceState(null,"",location.pathname)}catch{};await load("",range,c,radius)},
   e=>{clearTimeout(guard);setLocating(false);setLocErr(t(e.code===1?"Location is turned off for this site. Allow it in your browser settings, or enter a ZIP code.":e.code===3?"Finding your location took too long. Try again, or enter a ZIP code.":"Couldn't find your location. Try again, or enter a ZIP code."))},
   {timeout:15000,maximumAge:600000});
 }
 function switchMode(v:"all"|"big"|"fav"){if(v===view)return;const ok=v==="big"?["today","weekend"]:["next7","next30"];const br=v==="all"||ok.includes(big.current.range)?big.current.range:ok[v==="big"?0:1];if(br!==bigRange)setBigRange(br);big.current={...big.current,view:v,range:br};setView(v);setSort(v==="all"?"Nearest":v==="big"?"Popular":"Soonest");load(searchedZip,range,coords,radius)}
 function chooseBigRange(r:string){setBigRange(r);big.current={...big.current,range:r};load(searchedZip,range,coords,radius)}
 function chooseBigRadius(rad:string){setBigRadius(rad);big.current={...big.current,radius:rad};load(searchedZip,range,coords,radius)}
 function chooseRange(r:string){setRange(r);load(searchedZip,r,coords,radius)}
 function chooseRadius(rad:string){setRadius(rad);store.set("gotoday:radius",rad);load(searchedZip,range,coords,rad)}
 function toggleChip(c:string){if(c==="All"){setSelected([]);setAgeBands([]);setSetting("Any");setDropIn(false);setSpanish(false);setSeniors(false);return}setSelected(s=>s.includes(c)?s.filter(x=>x!==c):[...s,c])}

 async function share(e:EventItem){
  if(e.id?.startsWith("db-"))fetch("/api/track",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:e.id,action:"share"}),keepalive:true}).catch(()=>{});
  const url=!e.id?(e.url||location.origin):`${location.origin}/events/${encodeURIComponent(e.id||"")}`;
  const text=`${e.title} — ${fmt(e.date,e.time,t,locale)} · ${e.venue||e.city}`;
  try{if(navigator.share){await navigator.share({title:e.title,text,url});return}}catch(err:any){if(err?.name==="AbortError")return}
  try{await navigator.clipboard.writeText(`${text}\n${url}`);setToast(t("Link copied"))}catch{setToast(t("Couldn't copy link"))}
  setTimeout(()=>setToast(""),2200);
 }

 const filtered=useMemo(()=>{
  const qWords=norm(query).split(" ").filter(w=>w.length>1),interests=selected.filter(x=>x!=="Free"),big=view==="big";
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
   if(view==="fav"&&((b as any).saves||0)!==((a as any).saves||0))return((b as any).saves||0)-((a as any).saves||0);   // most-loved first
   if(view==="big"&&sort==="Popular")return((b as any).popularity||0)-((a as any).popularity||0)||when;
   if(sort!=="Nearest")return when;
   return (a.date||"").localeCompare(b.date||"")||(a.distanceMiles??999)-(b.distanceMiles??999)||when;
  });
 },[events,view,selected,timeFilter,sort,query,ageBands,setting,dropIn,spanish,seniors]);

 // Big events: a festival on several days is one card ("+2 more days"), soonest date first.
 const shown=useMemo<EventItem[]>(()=>{if(!bigOnly)return filtered;const m=new Map<string,EventItem&{moreDates:string[]}>();
  for(const e of filtered){const k=`${norm(e.title)}|${norm(e.venue||e.city||"")}`,x=m.get(k);if(!x)m.set(k,{...e,moreDates:[] as string[]});else if(e.date&&x.date!==e.date&&!x.moreDates.includes(e.date))x.moreDates.push(e.date)}
  return[...m.values()]},[filtered,bigOnly]);
 const moreCount=(setting!=="Any"?1:0)+(dropIn?1:0)+(spanish?1:0)+(seniors?1:0);
 const where=coords?t("your location"):searchedZip||t("your area"),hasPlace=!!(coords||searchedZip);
 return <main className="page">
  <section className="hero">
   <nav><a className="logo" href="/?fresh=1">Go<span>Today</span></a><span className="navRight"><LangPicker/><NavMe/><a className="createBtn" href="/create" aria-label={t("Create event")}><span aria-hidden>+</span><span className="createTxt">{t("Create")}</span><span className="hideXs">{t(" event")}</span></a></span></nav>
   <ReplyBanner/>
   <div className="heroContent">
    <div className="eyebrow">{t("EXPLORE MORE. TODAY.")}</div>
    <h1>{t("Find your")} <span>{t("next thing.")}</span></h1>
    <p className="heroLead">{t("Free and local things happening near you — from library storytimes to park concerts.")}</p>
    <form className="searchRow" onSubmit={ev=>{ev.preventDefault();submitZip()}}>
     <input inputMode="numeric" autoComplete="postal-code" maxLength={5} aria-label={t("ZIP code")} data-zip value={zip} onChange={e=>{setZip(e.target.value.replace(/\D/g,""));if(zipErr)setZipErr("")}} aria-invalid={!!zipErr} aria-describedby="zipErr" placeholder={t("ZIP code")}/>
     <button type="submit" className="go">{loading?"…":t("Search")}</button>
    </form>
    {zipErr&&<p className="locErr zipErr" id="zipErr" role="alert">{zipErr}</p>}
    <button type="button" className={`locate${locating||(loading&&coords)?" busy":""}`} onClick={useLocation} disabled={locating||(loading&&!!coords)} aria-live="polite">
     {locating?<><span className="spin" aria-hidden/>{t("Finding your location…")}</>:loading&&coords?<><span className="spin" aria-hidden/>{t("Finding events near you…")}</>:"📍 "+t("Use my location")}
    </button>
    {locErr&&<p className="locErr" role="alert">{locErr}</p>}
   </div>
  </section>

  {!hasPlace&&<section className="content start" id="results">
   <div className="startIcon">📍</div>
   <h2>{t("Where are you exploring?")}</h2>
   <p>{t("Enter a ZIP code above or tap")} <b>{t("Use my location")}</b> {t("to see what's happening near you today.")}</p>
   <div className="label">{t("OR PICK AN AREA")}</div>
   <div className="chips startAreas">{AREAS.map(([l,z])=><button key={z} type="button" onClick={()=>{setZip(z);searchZip(z)}}>{l}</button>)}</div>
  </section>}
  {hasPlace&&<section className="content" id="results">
   <div className="toolbar">
    <div className="where"><b>📍 {where}</b><span className="rangeLabel">{t("within {n} mi",{n:bigOnly?bigRadius:radius})}</span></div>
    <input type="search" placeholder={t("Search events")} value={query} onChange={e=>setQuery(e.target.value)}/>
   </div>

   {/* All filters live in one card: when + sort controls, interests, then optional extras. */}
   <div className="filterCard">
    {/* Two ways to look: everything nearby, or just the big ones (festivals, fairs, yearly favorites) from farther away. */}
    <div className="modeTabs" role="tablist">
     <button type="button" role="tab" aria-selected={view==="all"} className={view==="all"?"active":""} onClick={()=>switchMode("all")}><span className="wideOnly">{t("All events")}</span><span className="narrowOnly">{t("All")}</span></button>
     <button type="button" role="tab" aria-selected={view==="big"} className={view==="big"?"active":""} onClick={()=>switchMode("big")}>🔥 {t("Popular")}</button>
     <button type="button" role="tab" aria-selected={view==="fav"} className={view==="fav"?"active":""} onClick={()=>switchMode("fav")}>❤️ {t("Favorites")}</button>
    </div>
    {view==="big"&&<p className="modeNote">{t("What people near you are into: the most-loved, most-shared and biggest events.")}</p>}
    {view==="fav"&&<p className="modeNote">{t("What people near you are saving the most.")}</p>}
    <div className="fcTop">
     <div className="fcWhen">
      <div className="label">{t("When")}</div>
      {bigOnly?<div className="seg when two">{(view==="big"?[["today","Today"],["weekend","This weekend"]]:[["next7","Next 7 days"],["next30","Next 30 days"]]).map(([k,l])=><button key={k} className={bigRange===k?"active":""} onClick={()=>chooseBigRange(k)}>{t(l)}</button>)}</div>:
      <div className="seg when four">{RANGES.map(([k,l])=><button key={k} className={range===k?"active":""} onClick={()=>chooseRange(k)}>{k==="weekend"?t("Weekend"):t(l)}{k==="weekend"&&<small>{nextWeekendLabel(locale)}</small>}</button>)}
       {/* Any other day in the next three weeks */}
       <Dropdown value={/^\d{4}/.test(range)?range:""} ariaLabel={t("Pick a day")} align="right" triggerClass={`pickDay${/^\d{4}/.test(range)?" active":""}`}
        trigger={<><span>{/^\d{4}/.test(range)?dayLabel(range,"weekday",locale):t("Pick day")}</span><small>{/^\d{4}/.test(range)?dayLabel(range,"date",locale):"▾"}</small></>}
        options={upcomingDays().map(d=>({value:d,label:dayLabel(d,"full",locale)}))} onChange={v=>chooseRange(v)}/>
      </div>}
     </div>
     <div className={`filters${bigOnly?" two":""}`}>
      {bigOnly?<Dropdown label={t("Distance")} value={bigRadius} options={["10","15","25","50"].map(r=>({value:r,label:t("{n} mi",{n:r})}))} onChange={chooseBigRadius}/>
      :<Dropdown label={t("Distance")} value={radius} options={["10","15","25","50"].map(r=>({value:r,label:t("{n} mi",{n:r})}))} onChange={chooseRadius}/>}
      {!bigOnly&&<Dropdown label={t("Time")} value={timeFilter} options={TIMES.map(x=>({value:x,label:x==="Any time"?t("Any"):t(x)}))} onChange={setTimeFilter}/>}
      <Dropdown label={t("Sort")} value={sort} align="right" options={[...(view==="big"?[{value:"Popular",label:t("Most popular")}]:[]),{value:"Nearest",label:t("Nearest")},{value:"Soonest",label:t("Soonest")}]} onChange={setSort}/>
     </div>
    </div>
    <div className="fcSection">
     <div className="label">{t("What are you into?")}</div>
     <div className="chips wrap even4">{CHIPS.map(c=><button key={c} className={((c==="All"?selected.length===0&&moreCount===0:selected.includes(c))?"active":"")+(t(c==="Arts & Theatre"?"Arts":c).length>=8?" long":"")} onClick={()=>toggleChip(c)}>{c==="Arts & Theatre"?<><span className="lg">{t("Arts & Theatre")}</span><span className="sm">{t("Arts")}</span></>:t(c)}</button>)}</div>
    </div>
    {selected.includes("Kids")&&<div className="fcSection">
     <div className="label">{t("Kids' ages")}</div>
     <div className="chips wrap even6">{AGE_BANDS.map(([l,a,b])=><button key={l} title={t(l)} className={ageBands.includes(l)?"active":""} onClick={()=>setAgeBands(x=>x.includes(l)?x.filter(y=>y!==l):[...x,l])}><span className="lg">{t(l)}</span><span className="sm">{l==="All ages"?t("All ages|short"):`${a}–${b}`}</span></button>)}</div>
    </div>}
    <button className={`moreBtn${moreOpen||moreCount?" on":""}`} onClick={()=>setMoreOpen(o=>!o)} aria-expanded={moreOpen}><span>⚙ {t("More filters")}{moreCount?` (${moreCount})`:""}</span><span aria-hidden>{moreOpen?"▴":"▾"}</span></button>
    {moreOpen&&<div className="morePanel">
     <div className="moreRow"><span>{t("Setting")}</span><div className="seg setting">{SETTINGS.map(x=><button key={x} className={setting===x?"active":""} onClick={()=>setSetting(x)}>{t(x)}</button>)}</div></div>
     <label className="toggle"><input type="checkbox" checked={dropIn} onChange={e=>setDropIn(e.target.checked)}/> {t("Drop-in")} <small>{t("no registration needed")}</small></label>
     <label className="toggle"><input type="checkbox" checked={spanish} onChange={e=>setSpanish(e.target.checked)}/> En Español</label>
     <label className="toggle"><input type="checkbox" checked={seniors} onChange={e=>setSeniors(e.target.checked)}/> {t("Seniors")} <small>{t("50+ programs")}</small></label>
    </div>}
   </div>

   {message&&<p className="notice">{t(message)}</p>}
   {soon&&!loading&&<div className="soon">
    <div className="soonIcon">📍</div>
    <h3>{t("GoToday is coming to {place} soon",{place:soon.place||t("your area")})}</h3>
    <p>{t("We're bringing local events to new cities every week: festivals, library programs, park activities, markets and more. We're not showing events here yet, but your area is on our list.")}</p>
    <p className="muted">{t("Right now GoToday covers South Florida (Miami-Dade, Broward and Palm Beach), Greater Orlando, Tampa Bay and New York City.")}</p>
    <div className="soonActions"><a className="btn primary" href="/create">{t("Post an event in your area")}</a><button type="button" className="btn ghost" onClick={()=>{setZip("");document.querySelector<HTMLInputElement>('input[data-zip]')?.focus();window.scrollTo({top:0,behavior:"smooth"})}}>{t("Try another ZIP")}</button></div>
   </div>}
   {!soon&&<div className="resultsHead"><div className="kicker">{t("NEAR {place}",{place:where}).toUpperCase()}</div><h2>{loading?t("Searching…"):view==="fav"?(shown.length===1?t("1 favorite near you"):t("{n} favorites near you",{n:shown.length})):view==="big"?(shown.length===1?t("1 popular event"):t("{n} popular events",{n:shown.length})):filtered.length===1?t("1 thing to do"):t("{n} things to do",{n:filtered.length})}</h2></div>}

   <div className="grid">{shown.map((e,i)=><article className="card" key={e.id||e.title+i}>
    <a className={e.image?"pic":"pic noimg"} style={e.image?undefined:{background:artFor(e).bg}} href={detailHref(e)} aria-hidden tabIndex={-1}>
     {e.image?<><img className="picBlur" src={e.image} alt="" loading="lazy" referrerPolicy="no-referrer"/>
      <img className="picMain" src={e.image} alt="" loading="lazy" referrerPolicy="no-referrer" onLoad={x=>fitPic(x.currentTarget)} onError={x=>{const a=x.currentTarget.parentElement as HTMLElement;const b=(e as any).backupImage as string|undefined;if(b&&!x.currentTarget.src.endsWith(b)){a.querySelectorAll("img").forEach(i=>{i.src=b});return}a.classList.add("noimg");a.style.background=artFor(e).bg;a.querySelectorAll("img").forEach(i=>i.remove());const n=a.querySelector("span") as HTMLElement|null;if(n)n.style.display="flex"}}/></>:null}
     <span style={e.image?{display:"none"}:undefined}><i>{artFor(e).icon}</i></span>
     {(e.isFree||e.facets?.includes("Free"))&&<em className="freeBadge">{t("Free")}</em>}
    </a>
    <div className="cardBody">
     <h3><a href={detailHref(e)}>{e.title}</a></h3>
     <div className="meta">🗓 {fmt(e.date,e.time,t,locale)}{e.live&&<b className="liveNow"> · {t("Happening now")}</b>}{view==="fav"&&(e as any).saves>0&&<span className="moreDates"> · ❤️ {(e as any).saves===1?t("1 save"):t("{n} saves",{n:String((e as any).saves)})}</span>}{(e as any).moreDates?.length>0&&<span className="moreDates"> · {(e as any).moreDates.length===1?t("+1 more day"):t("+{n} more days",{n:String((e as any).moreDates.length)})}</span>}</div>
     <div className="meta locLine"><span className="locV" title={e.venue||e.city}>📍 {e.venue||e.city}</span><span className="locD">{typeof e.distanceMiles==="number"?`\u00a0· ${e.distanceMiles.toFixed(1)} mi`:""}{e.moreLocations?<b title={(e.otherVenues||[]).join(", ")}>{`\u00a0· `+t("+{n} more",{n:e.moreLocations})}</b>:null}</span></div>
     {e.desc&&<p className="desc">{e.desc}</p>}
     {(e.tags||[]).includes("Drop-in")?<div className="hint ok">✓ {t("Drop-in, no registration")}</div>:e.registration&&e.source!=="Ticketmaster"?<div className="hint">{e.registration.split(" · ").map(x=>t(x)).join(" · ")}</div>:null}
     <div className="tags">{ageLabel(e,t)&&<span className="age">{ageLabel(e,t)}</span>}{(e.labels||(e.tags||[]).filter(t=>!["Local","Library","Free","Parks","Tickets","Drop-in"].includes(t)&&!/\(/.test(t))).slice(0,3).map(x=><span key={x}>{t(x)}</span>)}</div>
     <div className="actions">
      <a className="primary" href={detailHref(e)}>{t("View details")}</a>
      {e.id?.startsWith("db-")&&<SaveButton compact item={{id:e.id,title:e.title,date:e.date,venue:e.venue||e.city}}/>}
      {e.id&&<CalendarChoice compact id={e.id} base={`/events/${encodeURIComponent(e.id)}`}/>}
      <button type="button" className="share" title={t("Share")} onClick={()=>share(e)} aria-label={`${t("Share")}: ${e.title}`}>
       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg><span className="shareTxt">{t("Share")}</span>
      </button>
     </div>
    </div>
   </article>)}</div>
  </section>}
  {toast&&<div className="toast" role="status">{toast}</div>}
  <footer className="siteFoot"><a href="/me">{t("My GoToday")}</a><a href="/privacy">{t("Privacy")}</a><a href="/terms">{t("Terms")}</a></footer>
 </main>
}
