"use client";
import {useEffect,useRef,useState} from "react";
import {byOptions,describe,type Repeat,NO_REPEAT} from "../../lib/repeat";
import {streetOnly} from "../../lib/places";
import {applyFlyerDraft,type FlyerDraft} from "../../lib/flyerDraft";

export type FormValues={title:string;description:string;date:string;startTime:string;endTime:string;allDay:boolean;venue:string;address:string;city:string;
 visibility:"public"|"private";isFree:boolean;priceText:string;ageMin:number|null;ageMax:number|null;category:string;categories?:string[];link:string;hostName:string;image?:string;repeat?:Repeat;rsvp?:RsvpValues};
export type RsvpValues={onSite:boolean;name:string;phone:string;email:string;by:string};
export const EMPTY:FormValues={title:"",description:"",date:"",startTime:"",endTime:"",allDay:false,venue:"",address:"",city:"",visibility:"public",isFree:true,priceText:"",
 ageMin:null,ageMax:null,category:"",categories:[],link:"",hostName:"",image:""};
const CATEGORIES=["Community","Family","Kids","Music","Arts & Theatre","Sports","Food & Drink","Market","Party","Outdoors","Other"];
const AGES:[string,number|null,number|null][]=[["All ages",null,null],["Kids (0–12)",0,12],["Teens (13–17)",13,17],["Adults 18+",18,null],["21+",21,null]];

export default function EventForm({initial,submitLabel,onSubmit,busy}:{initial:FormValues;submitLabel:string;busy?:boolean;onSubmit:(v:FormValues)=>Promise<string[]|null>}){
 const [v,setV]=useState<FormValues>(initial),[errors,setErrors]=useState<string[]>([]);
 const set=<K extends keyof FormValues>(k:K,x:FormValues[K])=>setV(o=>({...o,[k]:x}));
 // Place suggestions: real venues from GoToday's own list, as the user types the place name.
 // No external API or key: the venues table already holds every public listing's place.
 type PlaceSug={name:string;address:string;city:string};
 const [placeSug,setPlaceSug]=useState<PlaceSug[]>([]),[placeOpen,setPlaceOpen]=useState(false),placePicked=useRef(false),placeBox=useRef<HTMLDivElement>(null);
 // "Use my location": one tap shares the device's coordinates for this search only — they
 // rank the suggestions by distance and are never saved to the event. Tapping again turns it off.
 const [loc,setLoc]=useState<{lat:number;lon:number}|null>(null),[locating,setLocating]=useState(false),[locDenied,setLocDenied]=useState(false);
 const useMyLocation=()=>{
  if(loc){setLoc(null);return}
  if(!("geolocation" in navigator)){setLocDenied(true);return}
  setLocating(true);
  navigator.geolocation.getCurrentPosition(
   p=>{setLoc({lat:p.coords.latitude,lon:p.coords.longitude});setLocDenied(false);setLocating(false)},
   ()=>{setLocDenied(true);setLocating(false)},
   {timeout:10000,maximumAge:60000});
 };
 useEffect(()=>{
  const q=v.venue.trim();
  if(placePicked.current){placePicked.current=false;return}
  if(q.length<2){setPlaceSug([]);setPlaceOpen(false);return}
  const ctl=new AbortController(),t=setTimeout(async()=>{
   try{const qs=loc?`&lat=${loc.lat}&lon=${loc.lon}`:"";
    const r=await fetch(`/api/places/suggest?q=${encodeURIComponent(q)}&city=${encodeURIComponent(v.city)}${qs}`,{signal:ctl.signal});
    const d=await r.json().catch(()=>({}));if(Array.isArray(d.suggestions)){setPlaceSug(d.suggestions);setPlaceOpen(true)}}catch{}
  },250);
  return()=>{clearTimeout(t);ctl.abort()};
 },[v.venue,v.city,loc]);
 const pickPlace=(s:PlaceSug)=>{placePicked.current=true;setV(o=>({...o,venue:s.name,address:streetOnly(s.address,s.city)||o.address,city:s.city||o.city}));setPlaceSug([]);setPlaceOpen(false)};
 // The list stays open while the user scrolls it: it closes on a tap outside it or on
 // Escape, not on losing focus (which used to shut it mid-scroll).
 useEffect(()=>{
  if(!placeOpen)return;
  const out=(e:Event)=>{if(!placeBox.current?.contains(e.target as Node))setPlaceOpen(false)};
  const key=(e:KeyboardEvent)=>{if(e.key==="Escape")setPlaceOpen(false)};
  document.addEventListener("pointerdown",out);document.addEventListener("keydown",key);
  return()=>{document.removeEventListener("pointerdown",out);document.removeEventListener("keydown",key)};
 },[placeOpen]);
 const ageKey=AGES.find(([,a,b])=>a===v.ageMin&&b===v.ageMax)?.[0]||"custom";
 const today=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
 async function submit(ev:React.FormEvent){ev.preventDefault();setErrors([]);
  if(!v.categories?.length&&!v.category){setErrors(["Pick at least one category."]);window.scrollTo({top:0,behavior:"smooth"});return}
  const errs=await onSubmit(v);if(errs?.length){setErrors(errs);window.scrollTo({top:0,behavior:"smooth"})}}

 return <form className="ef" onSubmit={submit}>
  {errors.length>0&&<div className="efErrors" role="alert">{errors.map(e=><div key={e}>• {e}</div>)}</div>}

  <fieldset className="efVis">
   <legend>Who can see it?</legend>
   <label className={v.visibility==="public"?"on":""}><input type="radio" name="vis" checked={v.visibility==="public"} onChange={()=>set("visibility","public")}/>
    <b>🌎 Public</b><span>Listed on GoToday for everyone nearby. Markets, concerts, meetups, fundraisers.</span></label>
   <label className={v.visibility==="private"?"on":""}><input type="radio" name="vis" checked={v.visibility==="private"} onChange={()=>set("visibility","private")}/>
    <b>🔒 Private</b><span>Only people you send the link to. Birthday parties, get-togethers. Guests can RSVP.</span></label>
  </fieldset>

  <PhotoField value={v.image||""} onChange={x=>set("image",x)} onFlyer={d=>setV(o=>applyFlyerDraft(o,d))}/>

  <label className="efField">Event name<input required maxLength={120} value={v.title} onChange={e=>set("title",e.target.value)} placeholder={v.visibility==="private"?"Sofia's 7th Birthday Party":"Fall Artisan Market"}/></label>

  <div className="efRow">
   <label className="efField">Date<input type="date" required min={today} value={v.date} onChange={e=>set("date",e.target.value)}/></label>
   {!v.allDay&&<label className="efField">Starts<input type="time" required value={v.startTime} onChange={e=>set("startTime",e.target.value)}/></label>}
   {!v.allDay&&<label className="efField"><span>Ends <small>(optional)</small></span><input type="time" value={v.endTime} onChange={e=>set("endTime",e.target.value)}/></label>}
  </div>
  <label className="efCheck"><input type="checkbox" checked={v.allDay} onChange={e=>set("allDay",e.target.checked)}/> All day</label>
  <RepeatField date={v.date} value={v.repeat||NO_REPEAT} onChange={x=>set("repeat",x)}/>

  <div className="placeSuggest" ref={placeBox}>
   <label className="efField">Place name<input maxLength={120} value={v.venue} onChange={e=>set("venue",e.target.value)} placeholder="Weston Town Center, Vista Park, our house…" autoComplete="off" onFocus={()=>{if(placeSug.length)setPlaceOpen(true)}} onKeyDown={e=>{if(e.key==="Escape")setPlaceOpen(false)}}/></label>
   <button type="button" className="placeLocBtn" onClick={useMyLocation} title={loc?"Stop ranking by distance":"Rank suggestions by distance from you"}>{locating?"Locating…":loc?"✓ Near you":locDenied?"Location unavailable — try again":"Use my location"}</button>
   {placeOpen&&(placeSug.length>0?<ul className="placeSuggestList">{placeSug.map((s,i)=><li key={`${s.name}|${s.address}|${s.city}|${i}`}><button type="button" onMouseDown={e=>{e.preventDefault();pickPlace(s)}}><b>{s.name}</b>{(streetOnly(s.address,s.city)||s.city)&&<span>{[streetOnly(s.address,s.city),s.city].filter(Boolean).join(", ")}</span>}</button></li>)}</ul>:loc?<ul className="placeSuggestList"><li><span>No places within 50 miles of you. Tap “Near you” again to search everywhere.</span></li></ul>:null)}
  </div>
  <div className="efRow">
   <label className="efField grow"><span>Street address {v.visibility==="private"?<small>(only guests with the link see it)</small>:<small>(helps people find it)</small>}</span><input maxLength={200} value={v.address} onChange={e=>set("address",e.target.value)} placeholder="1675 Market St" autoComplete="street-address"/></label>
   <label className="efField">City<input required maxLength={80} value={v.city} onChange={e=>set("city",e.target.value)} placeholder="Weston, FL"/></label>
  </div>

  <label className="efField">What's happening?<textarea rows={5} maxLength={4000} value={v.description} onChange={e=>set("description",e.target.value)} placeholder={v.visibility==="private"?"Pizza, cake and a bounce house! Bring a swimsuit.":"Local artisans, live music and food trucks by the bell tower."}/></label>

  <fieldset className="efField efCats"><legend>Categories <small>(pick up to 4)</small></legend>
   <div className="efCatChips">{CATEGORIES.map(c=>{const cats=v.categories?.length?v.categories:(v.category?[v.category]:[]),on=cats.includes(c);
    return <button type="button" key={c} className={on?"on":""} aria-pressed={on} onClick={()=>{let n=on?cats.filter(x=>x!==c):[...cats,c].slice(-4);setV(o=>({...o,categories:n,category:n[0]||""}))}}>{on?"✓ ":""}{c}</button>})}</div>
  </fieldset>

  <div className="efRow">
   <label className="efField">Ages<select value={ageKey} onChange={e=>{const a=AGES.find(x=>x[0]===e.target.value);if(a){set("ageMin",a[1]);set("ageMax",a[2])}}}>{AGES.map(([l])=><option key={l}>{l}</option>)}{ageKey==="custom"&&<option value="custom">Ages {v.ageMin??0}–{v.ageMax??"+"}</option>}</select></label>
  </div>

  <div className="efRow">
   <label className="efField">Cost<select value={v.isFree?"free":"paid"} onChange={e=>set("isFree",e.target.value==="free")}><option value="free">Free</option><option value="paid">Paid / tickets</option></select></label>
   {!v.isFree&&<label className="efField grow">Price<input maxLength={120} value={v.priceText} onChange={e=>set("priceText",e.target.value)} placeholder="$10 adults, kids free"/></label>}
  </div>

  <div className="efRow">
   <label className="efField grow"><span>Link <small>(optional: tickets, sign-up, more info)</small></span><input type="url" maxLength={500} value={v.link} onChange={e=>set("link",e.target.value)} placeholder="https://"/></label>
   <label className="efField"><span>{v.visibility==="private"?"Hosted by":"Organizer"} <small>(optional)</small></span><input maxLength={80} value={v.hostName} onChange={e=>set("hostName",e.target.value)} placeholder={v.visibility==="private"?"The Garcias":"Weston Town Center"}/></label>
  </div>

  <RsvpField visibility={v.visibility} date={v.date} value={v.rsvp} onChange={x=>set("rsvp",x)}/>

  <input className="efTrap" tabIndex={-1} autoComplete="off" name="website" aria-hidden onChange={e=>(v as any).website=e.target.value}/>
  <button className="btn primary efSubmit" type="submit" disabled={busy}>{busy?"Saving…":submitLabel}</button>
  {v.visibility==="public"&&<p className="efNote">Public events get a quick automatic check before they're listed. Please only post real, in-person events.</p>}
 </form>;
}

/** Shrinks a phone photo in the browser (max 1600px, JPEG) so uploads are quick and small. */
async function shrink(f:File):Promise<Blob>{
 const url=URL.createObjectURL(f);
 try{
  const img=await new Promise<HTMLImageElement>((ok,bad)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=bad;i.src=url});
  const k=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
  const c=document.createElement("canvas");c.width=Math.round(img.naturalWidth*k);c.height=Math.round(img.naturalHeight*k);
  c.getContext("2d")!.drawImage(img,0,0,c.width,c.height);
  return await new Promise<Blob>((ok,bad)=>c.toBlob(b=>b?ok(b):bad(new Error("encode")),"image/jpeg",0.85));
 }finally{URL.revokeObjectURL(url)}
}

/** Optional event photo or flyer: pick, preview, replace, remove. Shown on the event page and its card.
 *  A flyer is also read (Gemini, no paid fallback) and its stated fields prefill the form — only fields the
 *  user hasn't typed into yet. A failed read just leaves the fields for the user. */
function PhotoField({value,onChange,onFlyer}:{value:string;onChange:(url:string)=>void;onFlyer?:(d:FlyerDraft)=>void}){
 const [busy,setBusy]=useState(false),[err,setErr]=useState(""),[reading,setReading]=useState(false),[readMsg,setReadMsg]=useState("");
 const urlRef=useRef(value);urlRef.current=value;
 async function pick(f?:File|null){
  if(!f)return;setErr("");setReadMsg("");
  if(!/^image\//.test(f.type)){setErr("Please choose a photo (JPG, PNG or WebP).");return}
  setBusy(true);
  try{
   const body=await shrink(f).catch(()=>f);
   const r=await fetch("/api/community/photo",{method:"POST",headers:{"content-type":body.type||"image/jpeg"},body});
   const d=await r.json().catch(()=>({}));
   if(!d.ok){setErr(d.error||"Couldn't upload that photo. Please try another.");return}
   onChange(d.url);
   if(!onFlyer)return;
   setReading(true);
   try{
    const rr=await fetch("/api/community/photo/read",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({imageUrl:d.url})});
    const rd=await rr.json().catch(()=>({}));
    if(rd.ok&&rd.draft&&urlRef.current===d.url)onFlyer(rd.draft);
    else if(urlRef.current===d.url)setReadMsg("Couldn't read the flyer — fill in the fields below.");
   }catch{if(urlRef.current===d.url)setReadMsg("Couldn't read the flyer — fill in the fields below.");
   }finally{setReading(false)}
  }catch{setErr("Couldn't upload the photo. Check your connection and try again.")}finally{setBusy(false)}
 }
 return <div className="efField efPhoto">
  <span>Photo or flyer <small>(optional)</small></span>
  {value?<div className="efPhotoPrev"><img src={value} alt=""/>
    <div className="efPhotoBtns"><label className="btn ghost">{busy?"Uploading…":"Replace"}<input type="file" accept="image/*" hidden disabled={busy} onChange={e=>pick(e.target.files?.[0])}/></label>
     <button type="button" className="btn ghost" onClick={()=>{onChange("");setReadMsg("")}}>Remove</button></div></div>
   :<label className={`efPhotoDrop${busy?" busy":""}`} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();pick(e.dataTransfer.files?.[0])}}>
    <input type="file" accept="image/*" hidden disabled={busy} onChange={e=>pick(e.target.files?.[0])}/>
    <b>{busy?"Uploading…":"📷 Add a photo"}</b><small>A picture of the place, last year's event, or your flyer. If it's a flyer, we'll read it and fill in what we can.</small></label>}
  {err&&<small className="efPhotoErr" role="alert">{err}</small>}
  {reading&&<small>Reading your flyer…</small>}
  {readMsg&&<small className="efPhotoErr" role="alert">{readMsg}</small>}
 </div>;
}

const WD=["S","M","T","W","T","F","S"],WDN=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
/** Repeats: never / every week (pick days) / every month / every year. Monthly and yearly can follow the date or the
 *  weekday ("the 4th Saturday of October"), so a yearly Saturday event lands on a Saturday every year. */
function RepeatField({date,value,onChange}:{date:string;value:Repeat;onChange:(r:Repeat)=>void}){
 const ok=/^\d{4}-\d{2}-\d{2}$/.test(date),dow=ok?new Date(date+"T12:00:00Z").getUTCDay():-1;
 const set=(p:Partial<Repeat>)=>onChange({...value,...p});
 const opts=value.kind==="monthly"||value.kind==="yearly"?byOptions(date,value.kind):[];
 // Saturday-type events most often mean "the same weekday": suggest it when switching to monthly/yearly.
 const pickKind=(kind:Repeat["kind"])=>{
  if(kind==="none")return onChange({...NO_REPEAT});
  if(kind==="weekly")return onChange({kind,days:ok?[dow]:[],by:"date",until:value.until});
  const o=ok?byOptions(date,kind):[];onChange({kind,days:[],by:(o.find(x=>x.by==="nth")||o.find(x=>x.by==="last")||{by:"date" as const}).by,until:value.until});
 };
 return <div className="efField efRepeat">
  <label className="efField">Repeats<select value={value.kind} onChange={e=>pickKind(e.target.value as Repeat["kind"])}>
   <option value="none">Doesn't repeat</option><option value="weekly">Every week</option><option value="monthly">Every month</option><option value="yearly">Every year</option></select></label>
  {value.kind==="weekly"&&<div className="efDays" role="group" aria-label="On these days">{WD.map((d,i)=>{const on=value.days.includes(i);
   return <button key={i} type="button" className={on?"on":""} aria-pressed={on} aria-label={WDN[i]} title={WDN[i]} onClick={()=>{const n=on?value.days.filter(x=>x!==i):[...value.days,i].sort();set({days:n.length?n:value.days})}}>{d}</button>})}</div>}
  {opts.length>1&&<div className="efBy">{opts.map(o=><label key={o.by} className={value.by===o.by?"on":""}><input type="radio" name="repeatBy" checked={value.by===o.by} onChange={()=>set({by:o.by})}/>{o.label}</label>)}</div>}
  {value.kind!=="none"&&!ok&&<small className="muted">Pick the first date above.</small>}
  {value.kind!=="none"&&ok&&<div className="efUntil">
   <label className="efCheck"><input type="checkbox" checked={!!value.until} onChange={e=>set({until:e.target.checked?new Date(Date.parse(date)+(value.kind==="weekly"?90:value.kind==="monthly"?365:730)*86400e3).toISOString().slice(0,10):""})}/> Ends on a date</label>
   {value.until&&<input type="date" min={date} value={value.until} onChange={e=>set({until:e.target.value})}/>}
  </div>}
  {value.kind!=="none"&&ok&&<p className="efRepeatSum">🔁 {describe(date,value)}{value.kind==="yearly"&&value.by!=="date"?" (the date moves so it's always that weekday)":""}</p>}
 </div>;
}

/** How guests answer: on GoToday (Going / Maybe / Can't go, with a guest list for the host), and/or straight to a
 *  person by text, call or email ("RSVP to Jordan at 754-555-0123"). Either or both. */
function RsvpField({visibility,date,value,onChange}:{visibility:"public"|"private";date:string;value?:RsvpValues;onChange:(r:RsvpValues)=>void}){
 const r:RsvpValues=value||{onSite:visibility==="private",name:"",phone:"",email:"",by:""};
 const set=(p:Partial<RsvpValues>)=>onChange({...r,...p});
 const [open,setOpen]=useState(!!(r.phone||r.email||r.name||r.by));
 return <fieldset className="efField efRsvp"><legend>RSVP <small>(optional)</small></legend>
  <label className="efCheck"><input type="checkbox" checked={r.onSite} onChange={e=>set({onSite:e.target.checked})}/> Guests reply on GoToday (Going / Maybe / Can't go) and you see the guest list</label>
  <label className="efCheck"><input type="checkbox" checked={open} onChange={e=>{setOpen(e.target.checked);if(!e.target.checked)set({name:"",phone:"",email:""})}}/> Guests RSVP to someone by text, call or email</label>
  {open&&<div className="efRsvpWho">
   <label className="efField"><span>RSVP to <small>(name)</small></span><input maxLength={60} value={r.name} onChange={e=>set({name:e.target.value})} placeholder="Name" autoComplete="off"/></label>
   <div className="efRow">
    <label className="efField grow"><span>Phone <small>(text or call)</small></span><input type="tel" inputMode="tel" maxLength={40} value={r.phone} onChange={e=>set({phone:e.target.value})} placeholder="754-555-0123" autoComplete="off"/></label>
    <label className="efField grow">Email<input type="email" maxLength={120} value={r.email} onChange={e=>set({email:e.target.value})} placeholder="name@email.com" autoComplete="off"/></label>
   </div>
   <small className="muted">{visibility==="private"?"Only guests with your link see this.":"Shown on the public event page, so anyone who finds the event can see it."}</small>
  </div>}
  {(r.onSite||open)&&<label className="efField efRsvpBy"><span>Please reply by <small>(optional)</small></span><input type="date" max={date||undefined} value={r.by} onChange={e=>set({by:e.target.value})}/></label>}
 </fieldset>;
}
