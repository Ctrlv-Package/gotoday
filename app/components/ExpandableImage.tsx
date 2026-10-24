"use client";
import {useEffect,useState} from "react";

/** An event picture that opens full-screen when tapped — flyers carry the details (times, prices, lineups),
 * so the cropped hero view isn't enough. Backdrop tap, ✕, or Escape closes it. */
export default function ExpandableImage({src,className,alt,referrerPolicy,onError}:{src:string;className?:string;alt?:string;referrerPolicy?:React.ImgHTMLAttributes<HTMLImageElement>["referrerPolicy"];onError?:()=>void}){
 const [open,setOpen]=useState(false);
 useEffect(()=>{
  if(!open)return;
  const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false)};
  document.addEventListener("keydown",onKey);
  const prev=document.body.style.overflow;document.body.style.overflow="hidden";
  return()=>{document.removeEventListener("keydown",onKey);document.body.style.overflow=prev};
 },[open]);
 return <>
  <img className={className} src={src} alt={alt||""} referrerPolicy={referrerPolicy} onError={onError}
   onClick={()=>setOpen(true)} title="View full image" style={{cursor:"zoom-in"}}/>
  {open&&<div className="lightboxBack" role="dialog" aria-modal="true" aria-label="Full image" onClick={()=>setOpen(false)}>
   <img className="lightboxImg" src={src} alt={alt||""} onClick={e=>e.stopPropagation()}/>
   <button type="button" className="lightboxX" aria-label="Close full image" onClick={()=>setOpen(false)}>✕</button>
  </div>}
 </>;
}
