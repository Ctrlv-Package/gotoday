"use client";
import {useEffect,useState} from "react";
import AddToCalendar from "./AddToCalendar";
import {isSaved,onSavedChange} from "./saved";

/** The calendar button. For someone whose GoToday calendar is connected, a saved event is already in their calendar
 *  (and stays up to date), so the button says so instead of offering a second, one-time copy. */
export default function CalendarChoice({base,id,connected,compact=false}:{base:string;id:string;connected:boolean;compact?:boolean}){
 const [saved,setSaved]=useState(false);
 useEffect(()=>{if(!connected)return;let live=true;const f=()=>isSaved(id).then(v=>{if(live)setSaved(v)});f();const off=onSavedChange(f);return()=>{live=false;off()}},[id,connected]);
 if(connected&&saved)return <a className={`calBtn inCal${compact?" compact":""}`} href="/me" title="Saved events appear in your GoToday calendar automatically and stay up to date">✓ In your GoToday calendar</a>;
 return <AddToCalendar base={base} compact={compact}/>;
}
