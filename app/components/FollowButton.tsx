"use client";
import {useEffect,useState} from "react";
import {setFollowing} from "./saved";

/** "Remind me next year" (following the event's family): be told when this event comes around again (next year's date, whenever it's announced).
 *  Needs an account, so guests are sent to sign in first and the follow happens when they come back. */
export default function FollowButton({id,signedIn,initial}:{id:string;signedIn:boolean;initial:boolean}){
 const [on,setOn]=useState(initial),[busy,setBusy]=useState(false),[note,setNote]=useState("");
 const act=async(next:boolean)=>{
  setBusy(true);setOn(next);setNote("");
  try{await setFollowing(id,next);if(next)setNote("Done! When next year's date is announced, it'll show up in My GoToday and your GoToday calendar.")}
  catch{setOn(!next);setNote("Couldn't update. Please try again.")}finally{setBusy(false)}
 };
 // Came back from signing in after tapping Follow: finish the follow.
 useEffect(()=>{
  if(!signedIn)return;const u=new URL(location.href);
  if(u.searchParams.get("follow")==="1"){u.searchParams.delete("follow");u.searchParams.delete("signedin");history.replaceState(null,"",u.pathname+(u.search||""));if(!initial)act(true)}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 if(!signedIn)return <a className="btn ghost followBtn" href={`/signin?next=${encodeURIComponent(`/events/${id}?follow=1`)}&why=follow`}>
  <Bell/> Remind me next year</a>;
 return <>
  <button type="button" className={`btn ghost followBtn${on?" on":""}`} aria-pressed={on} disabled={busy} onClick={()=>act(!on)} title={on?"You'll be reminded next year — tap to stop":"Get next year's date as soon as it's announced"}>
   <Bell filled={on}/> {on?"Reminding you next year":"Remind me next year"}
  </button>
  {note&&<p className="followNote" role="status">{note}</p>}
 </>;
}
function Bell({filled=false}:{filled?:boolean}){return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9z" fill={filled?"currentColor":"none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>}
