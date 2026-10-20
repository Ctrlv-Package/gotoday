"use client";
import {useEffect} from "react";
import {usePathname} from "next/navigation";

/** Remembers the GoToday page before this one in this tab, so "Back" buttons can say where they go. */
let cur:string|undefined,prev:string|undefined;
/** The GoToday page you came from, or undefined (opened from a link, a bookmark, or another site). */
export function cameFrom(path:string):string|undefined{
 if(cur===undefined||cur===path&&prev===undefined){
  // First page of this load: the browser's referrer says whether you came from GoToday.
  try{const r=document.referrer?new URL(document.referrer):null;if(r&&r.origin===location.origin&&r.pathname!==path)return r.pathname}catch{}
  return undefined;
 }
 return cur===path?prev:cur;   // the tracker may not have recorded this page yet
}
export default function NavTracker(){
 const path=usePathname();
 useEffect(()=>{if(cur!==path){if(cur!==undefined)prev=cur;cur=path}},[path]);
 return null;
}
