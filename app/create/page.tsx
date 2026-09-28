"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import EventForm,{EMPTY,type FormValues} from "../components/EventForm";
import CopyLink from "../components/CopyLink";
import {myEvents,rememberEvent,type MyEvent} from "../components/myEvents";

type Done={status:string;visibility:string;shareUrl:string;manageUrl:string;title:string;reviewReason:string|null};

export default function CreatePage(){
 const [busy,setBusy]=useState(false),[done,setDone]=useState<Done|null>(null),[mine,setMine]=useState<MyEvent[]>([]),[initial,setInitial]=useState<FormValues|null>(null);
 useEffect(()=>{setMine(myEvents());const vis=new URLSearchParams(location.search).get("type")==="private"?"private":"public";setInitial({...EMPTY,visibility:vis})},[]);
 async function create(v:FormValues){
  setBusy(true);
  try{const r=await fetch("/api/community",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(v)});const d=await r.json().catch(()=>({}));
   if(!d.ok)return d.errors||["Something went wrong. Please try again."];
   rememberEvent({title:d.title,date:d.date,shareUrl:d.shareUrl,manageUrl:d.manageUrl,visibility:d.visibility});setDone(d);window.scrollTo({top:0});return null;
  }catch{return["Couldn't reach GoToday. Check your connection and try again."]}finally{setBusy(false)}
 }
 return <main className="detail">
  <header className="detailHeader"><div className="detailWrap row"><Link href="/" className="detailLogo">Go<span>Today</span></Link><Link href="/" className="navLink">Find events</Link></div></header>
  <div className="detailWrap">
   <article className="detailCard"><div className="detailBody">
    {done?<div className="created">
     <div className="createdIcon">{done.status==="pending"?"⏳":"🎉"}</div>
     <h1>{done.status==="pending"?"Almost there":done.visibility==="private"?"Your private event is ready":"Your event is live"}</h1>
     <p className="lead">{done.visibility==="private"?"Only people you send this link to can see it. They can RSVP right on the page."
      :done.status==="pending"?"It's waiting for a quick review before it shows up in search. The page link already works for you to share.":"People searching near you can now find it on GoToday."}</p>
     <div className="linkBox"><div className="k">{done.visibility==="private"?"Invite link: send this to your guests":"Event link: share it anywhere"}</div><CopyLink url={done.shareUrl}/>
      <div className="linkActions"><a className="btn primary" href={done.shareUrl}>Open event page</a>
       <a className="btn ghost" href={`https://wa.me/?text=${encodeURIComponent(`${done.title} ${done.shareUrl}`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
       <a className="btn ghost" href={`sms:?&body=${encodeURIComponent(`${done.title} ${done.shareUrl}`)}`}>Text</a></div></div>
     <div className="linkBox secret"><div className="k">🔑 Your private manage link. Don't share it</div><CopyLink url={done.manageUrl}/>
      <p className="muted small">Use it to edit or delete the event{done.visibility==="private"?" and see who's coming":""}. It's saved in this browser too, but copy it somewhere safe (like your notes). There's no account to recover it.</p>
      <a className="inline" href={done.manageUrl}>Manage event →</a></div>
     <button type="button" className="linkBtn" onClick={()=>{setDone(null);setInitial({...EMPTY});setMine(myEvents())}}>Create another event</button>
    </div>:<>
     <h1>Create an event</h1>
     <p className="lead">Share something happening near you, or set up a private invite for friends and family. No account needed.</p>
     {initial&&<EventForm initial={initial} submitLabel="Create event" busy={busy} onSubmit={create}/>}
    </>}
    {mine.length>0&&!done&&<section className="related"><h2>Events you created on this device</h2>
     <ul>{mine.map(m=><li key={m.manageUrl}><a href={m.manageUrl}><b>{m.title}</b><span>{m.date}</span><span className="muted">{m.visibility==="private"?"🔒 Private":"🌎 Public"} · Manage</span></a></li>)}</ul></section>}
   </div></article>
  </div>
 </main>;
}
