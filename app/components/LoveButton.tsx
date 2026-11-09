"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {useT} from "./Lang";

/** "I went, it was great": one tap per signed-in person, after the event is over.
 *  No save needed — saving adds the event to your calendar, and plenty of people don't want that.
 *  Guests are sent to sign in first and the tap happens when they come back. */
export default function LoveButton({id,signedIn,initial}:{id:string;signedIn:boolean;initial:boolean}){
 const {t}=useT();const router=useRouter();
 const [on,setOn]=useState(initial),[busy,setBusy]=useState(false),[note,setNote]=useState("");
 const act=async(next:boolean)=>{
  setBusy(true);const wasOn=on;setOn(next);setNote("");
  try{
   const r=await fetch("/api/me/love",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id,on:next})});
   const d=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(d.error||"love failed");
   router.refresh();
  }catch{setOn(wasOn);setNote(t("Couldn't update. Please try again."))}finally{setBusy(false)}
 };
 // Came back from signing in after tapping Loved it: finish the tap.
 useEffect(()=>{
  if(!signedIn)return;const u=new URL(location.href);
  if(u.searchParams.get("love")==="1"){u.searchParams.delete("love");u.searchParams.delete("signedin");history.replaceState(null,"",u.pathname+(u.search||""));if(!initial)act(true)}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 if(!signedIn)return <a className="btn ghost loveBtn" href={`/signin?next=${encodeURIComponent(`/events/${id}?love=1`)}&why=love`}>
  ♥ {t("Loved it")}</a>;
 return <>
  <button type="button" className={`btn ghost loveBtn${on?" on":""}`} aria-pressed={on} disabled={busy} onClick={()=>act(!on)} title={on?t("You loved this event — tap to take it back"):t("I went, it was great")}>
   ♥ {on?t("Loved"):t("Loved it")}
  </button>
  {note&&<p className="followNote" role="status">{note}</p>}
 </>;
}
