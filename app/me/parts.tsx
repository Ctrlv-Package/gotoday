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
export function SignedInNote({name}:{name?:string|null}){
 const [msg,setMsg]=useState("");
 useEffect(()=>{
  const had=guestSaved().length;
  loadMe(true).then(()=>{
   const u=new URL(location.href);
   if(had&&!guestSaved().length){setMsg(`Moved ${had} saved event${had>1?"s":""} from this device into your account.`);setTimeout(()=>location.reload(),1200)}
   if(u.searchParams.has("signedin")){if(!had)setMsg(`You're signed in${name?`, ${name.split(" ")[0]}`:""}! Your saved events, follows and calendar are now on every device you sign in on.`);u.searchParams.delete("signedin");history.replaceState(null,"",u.pathname+(u.search||""))}
  });
 },[]);
 return msg?<p className="okNote" role="status">{msg}</p>:null;
}

/** Subscribe buttons for the personal calendar feed, with a clear status: nothing yet → waiting for the calendar app
 *  (with what to do there) → "Connected to Google Calendar" once that app actually reads the calendar. */
type CalStatus={clickedAt?:string|null;clicked?:string|null;fetchedAt?:string|null;client?:string|null};
const HOW:Record<string,string>={
 "Google Calendar":"In the Google Calendar tab that opened, click “Add” to confirm. GoToday then appears on the left under “Other calendars”. Google can take a few minutes to show the events.",
 "Apple Calendar":"Your device should ask “Subscribe to this calendar?” — tap Subscribe. GoToday then appears in your Calendars list.",
 "Outlook":"In the Outlook tab that opened, click “Import” to confirm. GoToday then appears under “Other calendars”."};
const ago=(t:string)=>{const m=Math.round((Date.now()-new Date(t).getTime())/60000);return m<1?"just now":m<60?`${m} min ago`:m<1440?`${Math.round(m/60)} h ago`:`${Math.round(m/1440)} days ago`};
export function CalendarLinks({feed,initial}:{feed:string;initial:CalStatus}){
 const [link,setLink]=useState(feed),[copied,setCopied]=useState(false),[busy,setBusy]=useState(false),[st,setSt]=useState<CalStatus>(initial);
 const https=`https://${link}`,webcal=`webcal://${link}`;
 const google=`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
 const outlook=`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=GoToday`;
 const connected=!!st.fetchedAt&&(!st.clickedAt||new Date(st.fetchedAt)>=new Date(new Date(st.clickedAt).getTime()-60000)||st.client===st.clicked);
 const waiting=!!st.clickedAt&&!connected&&Date.now()-new Date(st.clickedAt).getTime()<6*3600e3;
 // While waiting, check every 15 seconds (for up to 15 minutes) whether the calendar app has started reading it.
 useEffect(()=>{if(!waiting)return;const start=Date.now();const t=setInterval(async()=>{
  if(Date.now()-start>15*60e3){clearInterval(t);return}
  const r=await fetch("/api/me/calendar",{cache:"no-store"}).then(r=>r.json()).catch(()=>null);if(r?.ok)setSt(r);
 },15000);return()=>clearInterval(t)},[waiting]);
 const clicked=(app:string)=>{setSt(s=>({...s,clickedAt:new Date().toISOString(),clicked:app}));fetch("/api/me/calendar",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clicked:app})}).catch(()=>{})};
 const copy=async()=>{try{await navigator.clipboard.writeText(https);setCopied(true);setTimeout(()=>setCopied(false),2000)}catch{prompt("Copy your calendar link:",https)}};
 const reset=async()=>{
  if(!confirm("Make a new calendar link? The old one stops working, so calendars subscribed with it stop updating. Use this if you shared the link by mistake."))return;
  setBusy(true);const r=await fetch("/api/me/calendar",{method:"POST"}).then(r=>r.json()).catch(()=>null);setBusy(false);
  if(r?.token){setLink(link.replace(/\/cal\/[^/]+\.ics$/,`/cal/${r.token}.ics`));setSt({})}
 };
 return <div className="calSub">
  {connected?<div className="calStatus ok" role="status"><b>✓ Connected to {st.client}</b><span>Last updated {ago(st.fetchedAt!)}. Everything you save or follow will show up there automatically.</span></div>
  :waiting?<div className="calStatus wait" role="status"><b><span className="spin" aria-hidden/> Waiting for {st.clicked}…</b><span>{HOW[st.clicked||""]||"Confirm in your calendar app."} This page will say “Connected” as soon as it starts reading your GoToday calendar.</span></div>
  :<p className="calHint">Already added GoToday to your calendar? This will say “✓ Connected” the next time your calendar app checks for updates (Google Calendar: within about a day).</p>}
  <div className="calSubBtns">
   <a className="btn ghost" href={google} target="_blank" rel="noreferrer" onClick={()=>clicked("Google Calendar")}>{connected&&st.client==="Google Calendar"?"✓ ":""}Add to Google Calendar</a>
   <a className="btn ghost" href={webcal} onClick={()=>clicked("Apple Calendar")}>{connected&&st.client==="Apple Calendar"?"✓ ":""}Add to Apple Calendar</a>
   <a className="btn ghost" href={outlook} target="_blank" rel="noreferrer" onClick={()=>clicked("Outlook")}>{connected&&st.client==="Outlook"?"✓ ":""}Add to Outlook</a>
  </div>
  <div className="calSubLink"><code>{https}</code><button type="button" className="linkBtn" onClick={copy}>{copied?"Copied ✓":"Copy link"}</button></div>
  <p className="authFine">This link is private to you. Anyone with it can see the events you've saved, so don't post it publicly. <button type="button" className="linkBtn small" disabled={busy} onClick={reset}>Make a new link</button></p>
 </div>;
}

/** Stop following one event family. */
export function Unfollow({series}:{series:number}){
 const [gone,setGone]=useState(false);
 if(gone)return <span className="muted small">Removed</span>;
 return <button type="button" className="linkBtn small" onClick={async()=>{const r=await fetch("/api/me/follow",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({series,on:false})});if(r.ok)setGone(true)}}>Remove</button>;
}
