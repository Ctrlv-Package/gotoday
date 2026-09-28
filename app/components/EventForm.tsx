"use client";
import {useState} from "react";

export type FormValues={title:string;description:string;date:string;startTime:string;endTime:string;allDay:boolean;venue:string;address:string;city:string;
 visibility:"public"|"private";isFree:boolean;priceText:string;ageMin:number|null;ageMax:number|null;category:string;link:string;hostName:string};
export const EMPTY:FormValues={title:"",description:"",date:"",startTime:"",endTime:"",allDay:false,venue:"",address:"",city:"",visibility:"public",isFree:true,priceText:"",
 ageMin:null,ageMax:null,category:"Community",link:"",hostName:""};
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
   {!v.allDay&&<label className="efField">Ends <small>(optional)</small><input type="time" value={v.endTime} onChange={e=>set("endTime",e.target.value)}/></label>}
  </div>
  <label className="efCheck"><input type="checkbox" checked={v.allDay} onChange={e=>set("allDay",e.target.checked)}/> All day</label>

  <label className="efField">Place name<input maxLength={120} value={v.venue} onChange={e=>set("venue",e.target.value)} placeholder="Weston Town Center, Vista Park, our house…"/></label>
  <div className="efRow">
   <label className="efField grow">Street address {v.visibility==="private"?<small>(only guests with the link see it)</small>:<small>(helps people find it)</small>}<input maxLength={200} value={v.address} onChange={e=>set("address",e.target.value)} placeholder="1675 Market St" autoComplete="street-address"/></label>
   <label className="efField">City<input required maxLength={80} value={v.city} onChange={e=>set("city",e.target.value)} placeholder="Weston, FL"/></label>
  </div>

  <label className="efField">What's happening?<textarea rows={5} maxLength={4000} value={v.description} onChange={e=>set("description",e.target.value)} placeholder={v.visibility==="private"?"Pizza, cake and a bounce house! Bring a swimsuit.":"Local artisans, live music and food trucks by the bell tower."}/></label>

  <div className="efRow">
   <label className="efField">Category<select value={v.category} onChange={e=>set("category",e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label>
   <label className="efField">Ages<select value={ageKey} onChange={e=>{const a=AGES.find(x=>x[0]===e.target.value);if(a){set("ageMin",a[1]);set("ageMax",a[2])}}}>{AGES.map(([l])=><option key={l}>{l}</option>)}{ageKey==="custom"&&<option value="custom">Ages {v.ageMin??0}–{v.ageMax??"+"}</option>}</select></label>
  </div>

  <div className="efRow">
   <label className="efField">Cost<select value={v.isFree?"free":"paid"} onChange={e=>set("isFree",e.target.value==="free")}><option value="free">Free</option><option value="paid">Paid / tickets</option></select></label>
   {!v.isFree&&<label className="efField grow">Price<input maxLength={120} value={v.priceText} onChange={e=>set("priceText",e.target.value)} placeholder="$10 adults, kids free"/></label>}
  </div>

  <div className="efRow">
   <label className="efField grow">Link <small>(optional: tickets, sign-up, more info)</small><input type="url" maxLength={500} value={v.link} onChange={e=>set("link",e.target.value)} placeholder="https://"/></label>
   <label className="efField">{v.visibility==="private"?"Hosted by":"Organizer"} <small>(optional)</small><input maxLength={80} value={v.hostName} onChange={e=>set("hostName",e.target.value)} placeholder={v.visibility==="private"?"The Garcias":"Weston Town Center"}/></label>
  </div>

  <input className="efTrap" tabIndex={-1} autoComplete="off" name="website" aria-hidden onChange={e=>(v as any).website=e.target.value}/>
  <button className="btn primary efSubmit" type="submit" disabled={busy}>{busy?"Saving…":submitLabel}</button>
  {v.visibility==="public"&&<p className="efNote">Public events get a quick automatic check before they're listed. Please only post real, in-person events.</p>}
 </form>;
}
