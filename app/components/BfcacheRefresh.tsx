"use client";
import {useEffect} from "react";
// Browser Back can restore a frozen copy of this page (the back-forward cache) without asking the
// server — so a just-deleted event would still show until a manual refresh. Reload when the page
// is restored from that cache, so the list is always what the server has now.
export default function BfcacheRefresh(){
 useEffect(()=>{
  const h=(e:PageTransitionEvent)=>{if(e.persisted)window.location.reload()};
  window.addEventListener("pageshow",h);
  return()=>window.removeEventListener("pageshow",h);
 },[]);
 return null;
}
