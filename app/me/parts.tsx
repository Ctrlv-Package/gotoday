"use client";
import {useEffect,useState} from "react";
import {guestSaved,loadMe,onSavedChange,type SavedItem} from "../components/saved";
import SaveButton from "../components/SaveButton";

/** Guests: the events saved in this browser. */
export function GuestSaved(){
 const [list,setList]=useState<SavedItem[]|null>(null);
 useEffect(()=>{const today=new Date().toLocaleDateString("en-CA",{timeZone:"America/New_York"});const f=()=>setList(guestSaved().filter(x=>!x.date||x.date>=today));f();return onSavedChange(f)},[]);
 if(list===null)return null;
 return <section className="meSection">
  <h2>Saved on this device <span className="count">{list.length}</span></h2>
  {list.length===0?<p className="muted">Tap the ♡ on any event to save it here. Saved events stay in this browser; sign in to keep them on all your devices.</p>
  :<ul className="meList">{list.map(x=><li key={x.id}>
    <a href={`/events/${x.id}`}><b>{x.title}</b><span>{x.date?new Date(x.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}):""}{x.venue?` · ${x.venue}`:""}</span></a>
    <SaveButton compact item={x}/>
   </li>)}</ul>}
 </section>;
}

/** Right after signing in: move this browser's saved events into the account, then show the full list. */
export function SignedInNote(){
 const [msg,setMsg]=useState("");
 useEffect(()=>{
  const had=guestSaved().length;
  loadMe(true).then(()=>{
   const u=new URL(location.href);
   if(had&&!guestSaved().length){setMsg(`Moved ${had} saved event${had>1?"s":""} from this device into your account.`);setTimeout(()=>location.reload(),1200)}
   if(u.searchParams.has("signedin")){u.searchParams.delete("signedin");history.replaceState(null,"",u.pathname+(u.search||""))}
  });
 },[]);
 return msg?<p className="okNote" role="status">{msg}</p>:null;
}

/** Subscribe buttons for the personal calendar feed. */
export function CalendarLinks({feed}:{feed:string}){
 const [link,setLink]=useState(feed),[copied,setCopied]=useState(false),[busy,setBusy]=useState(false);
 const https=`https://${link}`,webcal=`webcal://${link}`;
 const google=`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
 const outlook=`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=GoToday`;
 const copy=async()=>{try{await navigator.clipboard.writeText(https);setCopied(true);setTimeout(()=>setCopied(false),2000)}catch{prompt("Copy your calendar link:",https)}};
 const reset=async()=>{
  if(!confirm("Make a new calendar link? The old one stops working, so calendars subscribed with it stop updating. Use this if you shared the link by mistake."))return;
  setBusy(true);const r=await fetch("/api/me/calendar",{method:"POST"}).then(r=>r.json()).catch(()=>null);setBusy(false);
  if(r?.token)setLink(link.replace(/\/cal\/[^/]+\.ics$/,`/cal/${r.token}.ics`));
 };
 return <div className="calSub">
  <div className="calSubBtns">
   <a className="btn ghost" href={google} target="_blank" rel="noreferrer">Add to Google Calendar</a>
   <a className="btn ghost" href={webcal}>Add to Apple Calendar</a>
   <a className="btn ghost" href={outlook} target="_blank" rel="noreferrer">Add to Outlook</a>
  </div>
  <div className="calSubLink"><code>{https}</code><button type="button" className="linkBtn" onClick={copy}>{copied?"Copied ✓":"Copy link"}</button></div>
  <p className="authFine">This link is private to you. Anyone with it can see the events you've saved, so don't post it publicly. <button type="button" className="linkBtn small" disabled={busy} onClick={reset}>Make a new link</button></p>
 </div>;
}

/** Stop following one event family. */
export function Unfollow({series}:{series:number}){
 const [gone,setGone]=useState(false);
 if(gone)return <span className="muted small">Unfollowed</span>;
 return <button type="button" className="linkBtn small" onClick={async()=>{const r=await fetch("/api/me/follow",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({series,on:false})});if(r.ok)setGone(true)}}>Unfollow</button>;
}
