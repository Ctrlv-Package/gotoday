"use client";
import {useT} from "./Lang";
import {useRouter} from "next/navigation";

/** "← Back to events": returns to the previous GoToday page when there is one (keeps your scroll and filters),
 *  otherwise to the home page with your last search restored — never back to Google's sign-in screen. */
export default function BackToEvents({label}:{label?:string}){
 const router=useRouter();
 const {t}=useT();
 const go=()=>{
  let ref:URL|null=null;try{ref=document.referrer?new URL(document.referrer):null}catch{}
  const fromUs=!!ref&&ref.origin===location.origin&&!/^\/(signin|api\/auth|me)\b/.test(ref.pathname)&&ref.pathname!==location.pathname;
  if(fromUs&&history.length>1){router.back();return}
  try{sessionStorage.setItem("gotoday:openedEvent","1")}catch{}   // home page: bring back the last search
  router.push("/");
 };
 return <button type="button" className="backBtn" onClick={go}>
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  <span>{label||t("Back to events")}</span></button>;
}
