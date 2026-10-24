"use client";
import {useEffect,useState} from "react";
import {useT} from "./Lang";
import {isSaved,setSaved,onSavedChange,loadMe,type SavedItem} from "./saved";

/** Heart button: save an event (in this browser for guests, to the account when signed in). */
export default function SaveButton({item,compact=false}:{item:SavedItem;compact?:boolean}){
 const {t}=useT();
 const [on,setOn]=useState(false),[busy,setBusy]=useState(false),[mine,setMine]=useState(false);
 useEffect(()=>{let live=true;const check=()=>Promise.all([isSaved(item.id),loadMe()]).then(([v,m])=>{if(live){const own=!!m.mine?.includes(item.id);setMine(own);setOn(v||own)}});check();const off=onSavedChange(check);return()=>{live=false;off()}},[item.id]);
 const toggle=async()=>{
  if(busy)return;setBusy(true);const next=!on;setOn(next);
  try{await setSaved(item,next)}catch{setOn(!next)}finally{setBusy(false)}
 };
 const label=on?t("Saved"):t("Save");
 // An event you created is already yours (in My GoToday and your calendar): the heart shows it, and leads to My events.
 if(mine)return <a href="/me" className={`saveBtn${compact?" compact":""} on`} aria-label={t("You created this event")} title={t("You created this event: it's in My GoToday and your calendar")}>
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.1 3.4 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.6 0 5.5 3.6 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" fill="currentColor" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
  {!compact&&<span>{label}</span>}
 </a>;
 return <button type="button" className={`saveBtn${compact?" compact":""}${on?" on":""}`} aria-pressed={on} aria-label={on?t("Remove from saved"):t("Save this event")} title={on?t("Saved — tap to remove"):t("Save this event")} onClick={toggle}>
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.1 3.4 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.6 0 5.5 3.6 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" fill={on?"currentColor":"none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
  {!compact&&<span>{label}</span>}
 </button>;
}
