"use client";
import {useEffect,useState} from "react";
import AddToCalendar from "./AddToCalendar";
import {useT} from "./Lang";
import {isSaved,onSavedChange} from "./saved";

/** The calendar button. For someone whose GoToday calendar is connected, a saved event is already in their calendar
 *  (and stays up to date), so the button says so instead of offering a second, one-time copy. */
export default function CalendarChoice({base,id,connected,compact=false}:{base:string;id:string;connected:boolean;compact?:boolean}){
 const {t}=useT();
 const [saved,setSaved]=useState(false);
 useEffect(()=>{if(!connected)return;let live=true;const f=()=>isSaved(id).then(v=>{if(live)setSaved(v)});f();const off=onSavedChange(f);return()=>{live=false;off()}},[id,connected]);
 if(connected&&saved)return <a className={`calBtn inCal${compact?" compact":""}`} href="/me" title={t("Saved events go to your GoToday calendar automatically and stay up to date. Google Calendar can take up to a day to show new ones; tap to see My GoToday.")}>✓ <span className="wideOnly">{t("In your GoToday calendar")}</span><span className="narrowOnly">{t("In calendar")}</span></a>;
 return <AddToCalendar base={base} compact={compact}/>;
}
