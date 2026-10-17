"use client";
import {useEffect,useRef,useState} from "react";

/** GoToday's own dropdown (the phone's built-in one can't be closed by tapping the box again).
 *  Tap the box to open, tap it again, tap outside, or press Escape to close; picking an option closes it too. */
export type Option={value:string;label:string;sub?:string;disabled?:boolean};
export default function Dropdown({label,value,options,onChange,trigger,triggerClass="ddBtn",align="left",ariaLabel}:{
 label?:string;value:string;options:Option[];onChange:(v:string)=>void;
 trigger?:React.ReactNode;triggerClass?:string;align?:"left"|"right";ariaLabel?:string}){
 const [open,setOpen]=useState(false),box=useRef<HTMLDivElement>(null),list=useRef<HTMLUListElement>(null);
 useEffect(()=>{
  if(!open)return;
  const out=(e:Event)=>{if(!box.current?.contains(e.target as Node))setOpen(false)};
  const key=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false)};
  document.addEventListener("pointerdown",out);document.addEventListener("keydown",key);
  // Show the current choice when the list opens.
  requestAnimationFrame(()=>list.current?.querySelector<HTMLElement>("[aria-selected=true]")?.scrollIntoView({block:"nearest"}));
  return()=>{document.removeEventListener("pointerdown",out);document.removeEventListener("keydown",key)};
 },[open]);
 const current=options.find(o=>o.value===value);
 const pick=(v:string)=>{setOpen(false);if(v!==value)onChange(v)};
 return <div className={`dd${open?" open":""}`} ref={box}>
  {label&&<span className="ddLabel">{label}</span>}
  <button type="button" className={triggerClass} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel||label}
   onClick={()=>setOpen(o=>!o)}>
   {trigger??<><span className="ddVal">{current?.label??"Choose"}</span><svg className="ddChev" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></>}
  </button>
  {open&&<ul className={`ddMenu ${align}`} role="listbox" ref={list}>
   {options.map(o=><li key={o.value}><button type="button" role="option" aria-selected={o.value===value} disabled={o.disabled} onClick={()=>pick(o.value)}>
    <span>{o.label}</span>{o.sub&&<small>{o.sub}</small>}{o.value===value&&<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m5 12 5 5 9-10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
   </button></li>)}
  </ul>}
 </div>;
}
