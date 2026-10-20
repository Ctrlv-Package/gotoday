"use client";
import {useEffect,useState} from "react";
import {useT} from "./Lang";
import {useRouter,usePathname} from "next/navigation";
import {cameFrom} from "./NavTracker";

type Where="events"|"me"|"event"|"page";
const kind=(p?:string):Where|null=>!p?null:p==="/"?"events":/^\/me\b/.test(p)?"me":/^\/(events|e)\//.test(p)?"event":/^\/(signin|api)\b/.test(p)?null:"page";

/** "← Back": returns to the GoToday page you came from and says which (My GoToday, the event, events) —
 *  keeps your scroll and filters. With no GoToday page before this one (opened from a link, or after Google
 *  sign-in), goes to the home page with your last search restored. */
export default function BackToEvents({label}:{label?:string}){
 const router=useRouter(),path=usePathname();
 const {t}=useT();
 const [from,setFrom]=useState<Where|null>(null);
 useEffect(()=>{
  setFrom(kind(cameFrom(path)));
 },[path]);
 const go=()=>{
  if(from&&history.length>1){router.back();return}
  try{sessionStorage.setItem("gotoday:openedEvent","1")}catch{}   // home page: bring back the last search
  router.push("/");
 };
 const text=label||(from==="me"?t("Back to My GoToday"):from==="event"?t("Back to event"):from==="page"?t("Back"):t("Back to events"));
 return <button type="button" className="backBtn" onClick={go}>
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  <span>{text}</span></button>;
}
