"use client";
import {useEffect,useState} from "react";
// Guests say Going / Maybe / Can't go. Remembered per browser so they can change their answer.
export default function Rsvp({share,counts}:{share:string;counts:{going:number;maybe:number;no:number}}){
 const key=`gotoday:rsvp:${share}`;
 const [name,setName]=useState(""),[status,setStatus]=useState<"going"|"maybe"|"no">("going"),[guests,setGuests]=useState(0),[note,setNote]=useState("");
 const [saved,setSaved]=useState<string|null>(null),[err,setErr]=useState(""),[busy,setBusy]=useState(false),[edit,setEdit]=useState(true);
 useEffect(()=>{try{const s=JSON.parse(localStorage.getItem(key)||"null");if(s){setName(s.name);setStatus(s.status);setGuests(s.guests||0);setNote(s.note||"");setSaved(s.status);setEdit(false)}}catch{}},[key]);
 async function send(ev:React.FormEvent){ev.preventDefault();setErr("");setBusy(true);
  try{const r=await fetch("/api/community/rsvp",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({share,name,status,guests,note})});const d=await r.json();
   if(!d.ok){setErr(d.error||"Couldn't save your RSVP.");return}
   try{localStorage.setItem(key,JSON.stringify({name,status,guests,note}))}catch{}setSaved(status);setEdit(false);
  }catch{setErr("Couldn't reach GoToday. Try again.")}finally{setBusy(false)}}
 const label={going:"Going 🎉",maybe:"Maybe 🤔",no:"Can't go 😢"};
 return <section className="rsvp"><h2>RSVP</h2>
  <p className="muted">{counts.going} going{counts.maybe?` · ${counts.maybe} maybe`:""}</p>
  {!edit&&saved?<div className="rsvpDone"><b>{name}, you replied: {label[saved as "going"]}</b>{guests>0&&saved!=="no"&&<span> (+{guests} guest{guests>1?"s":""})</span>}
   <button type="button" className="linkBtn" onClick={()=>setEdit(true)}>Change answer</button></div>
  :<form onSubmit={send} className="rsvpForm">
   <div className="seg">{(["going","maybe","no"] as const).map(s=><button type="button" key={s} className={status===s?"active":""} onClick={()=>setStatus(s)}>{label[s]}</button>)}</div>
   <label className="efField">Your name<input required minLength={2} maxLength={60} value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label>
   {status!=="no"&&<label className="efField">Bringing anyone? <select value={guests} onChange={e=>setGuests(Number(e.target.value))}>{Array.from({length:11},(_,i)=><option key={i} value={i}>{i===0?"Just me":`+${i}`}</option>)}</select></label>}
   <label className="efField"><span>Note for the host <small>(optional)</small></span><input maxLength={280} value={note} onChange={e=>setNote(e.target.value)} placeholder="Allergies, running late…"/></label>
   {err&&<div className="efErrors">{err}</div>}
   <button className="btn primary" disabled={busy}>{busy?"Sending…":"Send RSVP"}</button>
  </form>}
 </section>;
}
