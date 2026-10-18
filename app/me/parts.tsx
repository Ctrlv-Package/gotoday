"use client";
import {useEffect,useState} from "react";
import {guestSaved,loadMe,onSavedChange,type SavedItem} from "../components/saved";
import {myEvents,type MyEvent} from "../components/myEvents";
import SaveButton from "../components/SaveButton";
import {useT} from "../components/Lang";

/** Guests: the events saved in this browser. */
export function GuestSaved(){
 const {t,locale}=useT();
 const [list,setList]=useState<SavedItem[]|null>(null);
 useEffect(()=>{const today=new Date().toLocaleDateString("en-CA",{timeZone:"America/New_York"});const f=()=>setList(guestSaved().filter(x=>!x.date||x.date>=today));f();return onSavedChange(f)},[]);
 if(list===null)return null;
 return <section className="meSection">
  <h2>{t("Saved on this device")} <span className="count">{list.length}</span></h2>
  {list.length===0?<p className="muted">{t("Tap the ♡ on any event to save it here. Saved events stay in this browser; sign in to keep them on all your devices.")}</p>
  :<ul className="meList">{list.map(x=><li key={x.id}>
    <a href={`/events/${x.id}`}><b>{x.title}</b><span>{x.date?new Date(x.date+"T12:00:00").toLocaleDateString(locale,{weekday:"short",month:"short",day:"numeric"}):""}{x.venue?` · ${x.venue}`:""}</span></a>
    <SaveButton compact item={x}/>
   </li>)}</ul>}
 </section>;
}

/** Guests: events created on this device (the create page remembers their links here). */
export function GuestCreated(){
 const {t,locale}=useT();
 const [list,setList]=useState<MyEvent[]|null>(null);
 useEffect(()=>{setList(myEvents())},[]);
 if(!list)return null;
 return <section className="meSection">
  <h2>{t("My events")} <span className="count">{list.length}</span></h2>
  {list.length===0?<p className="muted">{t("Events you create show up here.")} <a href="/create" className="inlineLink">{t("Create an event →")}</a></p>
  :<ul className="meList">{list.map(x=><li key={x.manageUrl}>
    <a href={x.shareUrl}><b>{x.title}</b><span>{x.date?new Date(x.date+"T12:00:00").toLocaleDateString(locale,{weekday:"short",month:"short",day:"numeric"}):""}{x.visibility==="private"?" · "+t("Private"):""}</span></a>
    <a className="btn ghost small" href={x.manageUrl}>{t("Manage")}</a>
   </li>)}</ul>}
  {list.length>0&&<p className="muted small" style={{marginTop:8}}>{t("Saved on this device only. Sign in to see them on any device.")}</p>}
 </section>;
}

/** Right after signing in: move this browser's saved events into the account, then show the full list. */
export function SignedInNote({name}:{name?:string|null}){
 const {t}=useT();
 const [msg,setMsg]=useState("");
 useEffect(()=>{
  const had=guestSaved().length;
  // Events created on this device before signing in join the account (once).
  const made=myEvents().map(x=>x.manageUrl);
  let claimKey="gotoday:claimed";let done:string[]=[];try{done=JSON.parse(localStorage.getItem(claimKey)||"[]")}catch{}
  const todo=made.filter(u=>!done.includes(u));
  if(todo.length)fetch("/api/me/events",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({manageUrls:todo})}).then(r=>r.json()).then(d=>{
   try{localStorage.setItem(claimKey,JSON.stringify([...done,...todo].slice(-100)))}catch{}
   if(d?.claimed>0){setMsg(t("Added events you created on this device to My events: {n}",{n:d.claimed}));setTimeout(()=>location.reload(),1400)}
  }).catch(()=>{});
  loadMe(true).then(()=>{
   const u=new URL(location.href);
   if(had&&!guestSaved().length){setMsg(t("Moved saved events from this device into your account: {n}",{n:had}));setTimeout(()=>location.reload(),1200)}
   if(u.searchParams.has("signedin")){if(!had)setMsg((name?t("You're signed in, {name}!",{name:name.split(" ")[0]}):t("You're signed in!"))+" "+t("Your saved events, follows and calendar are now on every device you sign in on."));u.searchParams.delete("signedin");history.replaceState(null,"",u.pathname+(u.search||""))}
  });
 },[]);
 return msg?<p className="okNote" role="status">{msg}</p>:null;
}

/** Subscribe buttons for the personal calendar feed, with a clear status: nothing yet → waiting for the calendar app
 *  (with what to do there) → "Connected to Google Calendar" once that app actually reads the calendar. */
type CalStatus={clickedAt?:string|null;clicked?:string|null;apps?:{client:string;lastSeen:string}[]};
const HOW:Record<string,string>={
 "Google Calendar":"In the Google Calendar tab that opened, click “Add” to confirm. GoToday then appears on the left under “Other calendars”. Google can take a few minutes to show the events.",
 "Apple Calendar":"Your device should ask “Subscribe to this calendar?” — tap Subscribe. GoToday then appears in your Calendars list.",
 "Outlook":"In the Outlook tab that opened, click “Import” to confirm. GoToday then appears under “Other calendars”."};
const ago=(x:string,t:(s:string,v?:Record<string,string|number>)=>string)=>{const m=Math.round((Date.now()-new Date(x).getTime())/60000);return m<1?t("just now"):m<60?t("{n} min ago",{n:m}):m<1440?t("{n} h ago",{n:Math.round(m/60)}):t("{n} days ago",{n:Math.round(m/1440)})};
export function CalendarLinks({feed,initial}:{feed:string;initial:CalStatus}){
 const {t}=useT();
 const [link,setLink]=useState(feed),[copied,setCopied]=useState(false),[busy,setBusy]=useState(false),[st,setSt]=useState<CalStatus>(initial);
 const https=`https://${link}`,webcal=`webcal://${link}`;
 const google=`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
 const outlook=`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=GoToday`;
 // Each calendar app is tracked on its own: someone can have GoToday in Google Calendar and Apple Calendar at once.
 const apps=st.apps||[],isOn=(app:string)=>apps.some(a=>a.client===app);
 const waiting=!!st.clickedAt&&!!st.clicked&&!isOn(st.clicked)&&Date.now()-new Date(st.clickedAt).getTime()<6*3600e3;
 // While waiting, check every 15 seconds (for up to 15 minutes) whether the calendar app has started reading it.
 useEffect(()=>{if(!waiting)return;const start=Date.now();const t=setInterval(async()=>{
  if(Date.now()-start>15*60e3){clearInterval(t);return}
  const r=await fetch("/api/me/calendar",{cache:"no-store"}).then(r=>r.json()).catch(()=>null);if(r?.ok)setSt(r);
 },15000);return()=>clearInterval(t)},[waiting]);
 const clicked=(app:string)=>{if(isOn(app))return;setSt(s=>({...s,clickedAt:new Date().toISOString(),clicked:app}));fetch("/api/me/calendar",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clicked:app})}).catch(()=>{})};
 const copy=async()=>{try{await navigator.clipboard.writeText(https);setCopied(true);setTimeout(()=>setCopied(false),2000)}catch{prompt(t("Copy your calendar link:"),https)}};
 const reset=async()=>{
  if(!confirm(t("Make a new calendar link? The old one stops working, so calendars subscribed with it stop updating. Use this if you shared the link by mistake.")))return;
  setBusy(true);const r=await fetch("/api/me/calendar",{method:"POST"}).then(r=>r.json()).catch(()=>null);setBusy(false);
  if(r?.token){setLink(link.replace(/\/cal\/[^/]+\.ics$/,`/cal/${r.token}.ics`));setSt({apps:[]})}
 };
 return <div className="calSub">
  {apps.length>0&&<div className="calStatus ok" role="status">
   {apps.map(a=><b key={a.client}>✓ {t("Connected to {app}",{app:t(a.client)})} <small>· {t("updated {when}",{when:ago(a.lastSeen,t)})}</small></b>)}
   <span>{t("Everything you save or follow will show up there automatically.")}</span></div>}
  {waiting&&<div className="calStatus wait" role="status"><b><span className="spin" aria-hidden/> {t("Waiting for {app}…",{app:t(st.clicked||"")})}</b><span>{t(HOW[st.clicked||""]||"Confirm in your calendar app.")} {t("This page will say “Connected” as soon as it starts reading your GoToday calendar.")}</span></div>}
  {!apps.length&&!waiting&&<p className="calHint">{t("Already added GoToday to your calendar? This will say “✓ Connected” the next time your calendar app checks for updates (Google Calendar: within about a day).")}</p>}
  <div className="calSubBtns">
   <a className="btn ghost" href={google} target="_blank" rel="noreferrer" onClick={()=>clicked("Google Calendar")}>{isOn("Google Calendar")?"✓ ":""}{t("Add to Google Calendar")}</a>
   <a className="btn ghost" href={webcal} onClick={()=>clicked("Apple Calendar")}>{isOn("Apple Calendar")?"✓ ":""}{t("Add to Apple Calendar")}</a>
   <a className="btn ghost" href={outlook} target="_blank" rel="noreferrer" onClick={()=>clicked("Outlook")}>{isOn("Outlook")?"✓ ":""}{t("Add to Outlook")}</a>
  </div>
  <div className="calSubLink"><code>{https}</code><button type="button" className="linkBtn" onClick={copy}>{copied?t("Copied ✓"):t("Copy link")}</button></div>
  <p className="authFine">{t("This link is private to you. Anyone with it can see the events you've saved, so don't post it publicly.")} <button type="button" className="linkBtn small" disabled={busy} onClick={reset}>{t("Make a new link")}</button></p>
 </div>;
}

/** Stop following one event family. */
export function Unfollow({series}:{series:number}){
 const {t}=useT();
 const [gone,setGone]=useState(false);
 if(gone)return <span className="muted small">{t("Removed")}</span>;
 return <button type="button" className="linkBtn small" onClick={async()=>{const r=await fetch("/api/me/follow",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({series,on:false})});if(r.ok)setGone(true)}}>{t("Remove")}</button>;
}
