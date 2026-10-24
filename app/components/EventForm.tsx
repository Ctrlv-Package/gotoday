"use client";
import {useState} from "react";
import {byOptions,describe,type Repeat,NO_REPEAT} from "../../lib/repeat";

export type FormValues={title:string;description:string;date:string;startTime:string;endTime:string;allDay:boolean;venue:string;address:string;city:string;
 visibility:"public"|"private";isFree:boolean;priceText:string;ageMin:number|null;ageMax:number|null;category:string;categories?:string[];link:string;hostName:string;image?:string;repeat?:Repeat};
export const EMPTY:FormValues={title:"",description:"",date:"",startTime:"",endTime:"",allDay:false,venue:"",address:"",city:"",visibility:"public",isFree:true,priceText:"",
 ageMin:null,ageMax:null,category:"Community",categories:["Community"],link:"",hostName:"",image:""};
const CATEGORIES=["Community","Family","Kids","Music","Arts & Theatre","Sports","Food & Drink","Market","Party","Outdoors","Other"];
const AGES:[string,number|null,number|null][]=[["All ages",null,null],["Kids (0–12)",0,12],["Teens (13–17)",13,17],["Adults 18+",18,null],["21+",21,null]];

export default function EventForm({initial,submitLabel,onSubmit,busy}:{initial:FormValues;submitLabel:string;busy?:boolean;onSubmit:(v:FormValues)=>Promise<string[]|null>}){
 const [v,setV]=useState<FormValues>(initial),[errors,setErrors]=useState<string[]>([]);
 const set=<K extends keyof FormValues>(k:K,x:FormValues[K])=>setV(o=>({...o,[k]:x}));
 const ageKey=AGES.find(([,a,b])=>a===v.ageMin&&b===v.ageMax)?.[0]||"custom";
 const today=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
 async function submit(ev:React.FormEvent){ev.preventDefault();setErrors([]);const errs=await onSubmit(v);if(errs?.length){setErrors(errs);window.scrollTo({top:0,behavior:"smooth"})}}

 return <form className="ef" onSubmit={submit}>
  {errors.length>0&&<div className="efErrors" role="alert">{errors.map(e=><div key={e}>• {e}</div>)}</div>}

  <fieldset className="efVis">
   <legend>Who can see it?</legend>
   <label className={v.visibility==="public"?"on":""}><input type="radio" name="vis" checked={v.visibility==="public"} onChange={()=>set("visibility","public")}/>
    <b>🌎 Public</b><span>Listed on GoToday for everyone nearby. Markets, concerts, meetups, fundraisers.</span></label>
   <label className={v.visibility==="private"?"on":""}><input type="radio" name="vis" checked={v.visibility==="private"} onChange={()=>set("visibility","private")}/>
    <b>🔒 Private</b><span>Only people you send the link to. Birthday parties, get-togethers. Guests can RSVP.</span></label>
  </fieldset>

  <label className="efField">Event name<input required maxLength={120} value={v.title} onChange={e=>set("title",e.target.value)} placeholder={v.visibility==="private"?"Sofia's 7th Birthday Party":"Fall Artisan Market"}/></label>

  <div className="efRow">
   <label className="efField">Date<input type="date" required min={today} value={v.date} onChange={e=>set("date",e.target.value)}/></label>
   {!v.allDay&&<label className="efField">Starts<input type="time" required value={v.startTime} onChange={e=>set("startTime",e.target.value)}/></label>}
   {!v.allDay&&<label className="efField"><span>Ends <small>(optional)</small></span><input type="time" value={v.endTime} onChange={e=>set("endTime",e.target.value)}/></label>}
  </div>
  <label className="efCheck"><input type="checkbox" checked={v.allDay} onChange={e=>set("allDay",e.target.checked)}/> All day</label>
  <RepeatField date={v.date} value={v.repeat||NO_REPEAT} onChange={x=>set("repeat",x)}/>

  <label className="efField">Place name<input maxLength={120} value={v.venue} onChange={e=>set("venue",e.target.value)} placeholder="Weston Town Center, Vista Park, our house…"/></label>
  <div className="efRow">
   <label className="efField grow"><span>Street address {v.visibility==="private"?<small>(only guests with the link see it)</small>:<small>(helps people find it)</small>}</span><input maxLength={200} value={v.address} onChange={e=>set("address",e.target.value)} placeholder="1675 Market St" autoComplete="street-address"/></label>
   <label className="efField">City<input required maxLength={80} value={v.city} onChange={e=>set("city",e.target.value)} placeholder="Weston, FL"/></label>
  </div>

  <PhotoField value={v.image||""} onChange={x=>set("image",x)}/>

  <label className="efField">What's happening?<textarea rows={5} maxLength={4000} value={v.description} onChange={e=>set("description",e.target.value)} placeholder={v.visibility==="private"?"Pizza, cake and a bounce house! Bring a swimsuit.":"Local artisans, live music and food trucks by the bell tower."}/></label>

  <fieldset className="efField efCats"><legend>Categories <small>(pick up to 4)</small></legend>
   <div className="efCatChips">{CATEGORIES.map(c=>{const cats=v.categories?.length?v.categories:[v.category],on=cats.includes(c);
    return <button type="button" key={c} className={on?"on":""} aria-pressed={on} onClick={()=>{let n=on?cats.filter(x=>x!==c):[...cats,c].slice(-4);if(!n.length)n=["Community"];setV(o=>({...o,categories:n,category:n[0]}))}}>{on?"✓ ":""}{c}</button>})}</div>
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

/** Optional event photo or flyer: pick, preview, replace, remove. Shown on the event page and its card. */
function PhotoField({value,onChange}:{value:string;onChange:(url:string)=>void}){
 const [busy,setBusy]=useState(false),[err,setErr]=useState("");
 async function pick(f?:File|null){
  if(!f)return;setErr("");
  if(!/^image\//.test(f.type)){setErr("Please choose a photo (JPG, PNG or WebP).");return}
  setBusy(true);
  try{
   const body=await shrink(f).catch(()=>f);
   const r=await fetch("/api/community/photo",{method:"POST",headers:{"content-type":body.type||"image/jpeg"},body});
   const d=await r.json().catch(()=>({}));
   if(d.ok)onChange(d.url);else setErr(d.error||"Couldn't upload that photo. Please try another.");
  }catch{setErr("Couldn't upload the photo. Check your connection and try again.")}finally{setBusy(false)}
 }
 return <div className="efField efPhoto">
  <span>Photo or flyer <small>(optional)</small></span>
  {value?<div className="efPhotoPrev"><img src={value} alt=""/>
    <div className="efPhotoBtns"><label className="btn ghost">{busy?"Uploading…":"Replace"}<input type="file" accept="image/*" hidden disabled={busy} onChange={e=>pick(e.target.files?.[0])}/></label>
     <button type="button" className="btn ghost" onClick={()=>onChange("")}>Remove</button></div></div>
   :<label className={`efPhotoDrop${busy?" busy":""}`} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();pick(e.dataTransfer.files?.[0])}}>
    <input type="file" accept="image/*" hidden disabled={busy} onChange={e=>pick(e.target.files?.[0])}/>
    <b>{busy?"Uploading…":"📷 Add a photo"}</b><small>A picture of the place, last year's event, or your flyer. Events with a photo get noticed.</small></label>}
  {err&&<small className="efPhotoErr" role="alert">{err}</small>}
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
