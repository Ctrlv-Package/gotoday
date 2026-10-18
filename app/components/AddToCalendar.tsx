"use client";
import {useT} from "./Lang";
import {useEffect,useRef,useState} from "react";

// One "Add to calendar" button for every phone and computer. `base` is the event's page path
// (/events/db-123 or /e/<link>); calendar files and links hang off it.
type Opt={key:string;label:string;sub:string;href:string;newTab?:boolean};
function device(){if(typeof navigator==="undefined")return"";const u=navigator.userAgent;return/iPhone|iPad|iPod/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1)?"ios":/Android/.test(u)?"android":/Macintosh/.test(u)?"mac":"other"}

export default function AddToCalendar({base,compact=false}:{base:string;compact?:boolean}){
 const {t}=useT();
 const [open,setOpen]=useState(false),[dev,setDev]=useState(""),box=useRef<HTMLDivElement>(null);
 useEffect(()=>setDev(device()),[]);
 useEffect(()=>{if(!open)return;const close=(e:MouseEvent)=>{if(box.current&&!box.current.contains(e.target as Node))setOpen(false)};const esc=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false)};document.addEventListener("mousedown",close);document.addEventListener("keydown",esc);return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",esc)}},[open]);
 const opts:Opt[]=[
  {key:"apple",label:"Apple Calendar",sub:"iPhone, iPad, Mac",href:`${base}/calendar.ics`},
  {key:"google",label:"Google Calendar",sub:"Android, Gmail",href:`${base}/add?to=google`,newTab:true},
  {key:"outlook",label:"Outlook.com",sub:"Hotmail, Live",href:`${base}/add?to=outlook`,newTab:true},
  {key:"office",label:"Outlook 365",sub:t("Work or school"),href:`${base}/add?to=office`,newTab:true},
  {key:"ics",label:t("Other calendar"),sub:t("Download .ics file"),href:`${base}/calendar.ics`},
 ];
 const best=dev==="ios"||dev==="mac"?"apple":dev==="android"?"google":"";
 const sorted=best?[...opts.filter(o=>o.key===best),...opts.filter(o=>o.key!==best)]:opts;
 return <div className={`cal${compact?" compact":""}`} ref={box}>
  <button type="button" className="calBtn" onClick={()=>setOpen(o=>!o)} aria-expanded={open} aria-haspopup="menu" aria-label={t("Add to calendar")} title={t("Add to calendar")}>
   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>
   {compact?null:<span><span className="wideOnly">{t("Add to calendar")}</span><span className="narrowOnly">{t("Calendar")}</span></span>}
  </button>
  {open&&<div className="calBackdrop" onClick={()=>setOpen(false)} aria-hidden/>}
  {open&&<div className="calMenu" role="menu">
   <div className="calHead"><b>{t("Add to calendar")}</b><button type="button" onClick={()=>setOpen(false)}>{t("Cancel")}</button></div>
   {sorted.map(o=><a key={o.key} role="menuitem" href={o.href} target={o.newTab?"_blank":undefined} rel="noreferrer" onClick={()=>setOpen(false)}>
    <b>{o.label}{o.key===best&&<em>{t("This device")}</em>}</b><span>{o.sub}</span>
   </a>)}
  </div>}
 </div>;
}
