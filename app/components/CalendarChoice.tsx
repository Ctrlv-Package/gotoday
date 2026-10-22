"use client";
import {useEffect,useState} from "react";
import AddToCalendar from "./AddToCalendar";
import {useT} from "./Lang";
import {isSaved,onSavedChange,loadMe} from "./saved";

/** The calendar button. For someone whose GoToday calendar is connected, a saved event is already in their calendar
 *  (and stays up to date), so the button says so instead of offering a second, one-time copy. */
export default function CalendarChoice({base,id,connected:given,compact=false}:{base:string;id:string;connected?:boolean;compact?:boolean}){
 // The event page knows already; cards ask once per page (shared with the Save buttons).
 const [connected,setConnected]=useState(!!given);
 useEffect(()=>{if(given===undefined)loadMe().then(m=>setConnected(!!m.calConnected))},[given]);
 const {t}=useT();
 const [saved,setSaved]=useState(false);
 useEffect(()=>{if(!connected)return;let live=true;const f=()=>isSaved(id).then(v=>{if(live)setSaved(v)});f();const off=onSavedChange(f);return()=>{live=false;off()}},[id,connected]);
 const tip=t("Saved events go to your GoToday calendar automatically and stay up to date. Google Calendar can take up to a day to show new ones; tap to see My GoToday.");
 if(connected&&saved&&compact)return <div className="cal compact"><a className="calBtn inCal" href="/me" title={tip} aria-label={t("In your GoToday calendar")}>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="8.5 15.5 11 18 15.5 13.5"/></svg></a></div>;
 if(connected&&saved)return <a className={`calBtn inCal${compact?" compact":""}`} href="/me" title={t("Saved events go to your GoToday calendar automatically and stay up to date. Google Calendar can take up to a day to show new ones; tap to see My GoToday.")}>✓ <span className="wideOnly">{t("In your GoToday calendar")}</span><span className="narrowOnly">{t("In calendar")}</span></a>;
 return <AddToCalendar base={base} compact={compact}/>;
}
