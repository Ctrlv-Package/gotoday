"use client";
import {useEffect,useState} from "react";
import {isSaved,setSaved,onSavedChange,type SavedItem} from "./saved";

/** Heart button: save an event (in this browser for guests, to the account when signed in). */
export default function SaveButton({item,compact=false}:{item:SavedItem;compact?:boolean}){
 const [on,setOn]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;const check=()=>isSaved(item.id).then(v=>{if(live)setOn(v)});check();const off=onSavedChange(check);return()=>{live=false;off()}},[item.id]);
 const toggle=async()=>{
  if(busy)return;setBusy(true);const next=!on;setOn(next);
  try{await setSaved(item,next)}catch{setOn(!next)}finally{setBusy(false)}
 };
 const label=on?"Saved":"Save";
 return <button type="button" className={`saveBtn${compact?" compact":""}${on?" on":""}`} aria-pressed={on} aria-label={on?"Remove from saved":"Save this event"} title={on?"Saved — tap to remove":"Save this event"} onClick={toggle}>
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.1 3.4 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.6 0 5.5 3.6 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" fill={on?"currentColor":"none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
  {!compact&&<span>{label}</span>}
 </button>;
}
