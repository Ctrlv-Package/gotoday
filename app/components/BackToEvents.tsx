"use client";
import {useRouter} from "next/navigation";

/** "← Back to events": returns to the previous GoToday page when there is one (keeps your scroll and filters),
 *  otherwise to the home page with your last search restored — never back to Google's sign-in screen. */
export default function BackToEvents({label="Back to events"}:{label?:string}){
 const router=useRouter();
 const go=()=>{
  let ref:URL|null=null;try{ref=document.referrer?new URL(document.referrer):null}catch{}
  const fromUs=!!ref&&ref.origin===location.origin&&!/^\/(signin|api\/auth|me)\b/.test(ref.pathname)&&ref.pathname!==location.pathname;
  if(fromUs&&history.length>1){router.back();return}
  try{sessionStorage.setItem("gotoday:openedEvent","1")}catch{}   // home page: bring back the last search
  router.push("/");
 };
 return <button type="button" className="backBtn" onClick={go}><span aria-hidden>←</span> {label}</button>;
}
