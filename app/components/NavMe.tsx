"use client";
import {useEffect,useState} from "react";
import {useT} from "./Lang";
import {loadMe} from "./saved";

/** Top-bar link to My GoToday. Signed in: their Google photo and first name, so it's obvious they're logged in.
 *  Signed out: a person icon and "Sign in" (goes to sign-in, then My GoToday). */
export default function NavMe(){
 const {t}=useT();
 const [me,setMe]=useState<{signedIn:boolean;name?:string|null;image?:string|null;email?:string;newReplies?:number}|null>(null);
 useEffect(()=>{loadMe().then(setMe)},[]);
 if(me?.signedIn){
  const first=(me.name||me.email||"").split(/[\s@]/)[0]||"Me";
  return <a className="meLink signed" href="/me" title={`${me.email?t("Signed in as {email}",{email:me.email}):t("Signed in")} — ${t("My GoToday")}`}>
   {me.image?<img src={me.image} alt="" width={24} height={24} referrerPolicy="no-referrer"/>:<span className="initial" aria-hidden>{first[0]?.toUpperCase()}</span>}
   <span>{first}</span>{(me.newReplies||0)>0&&<span className="replyDot" title={t("New replies to your events")}>{me.newReplies}</span>}
  </a>;
 }
 return <a className="meLink" href="/signin?next=/me" title={t("Sign in or create an account")}>
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="M4.5 20.5c1.2-3.7 4.1-5.5 7.5-5.5s6.3 1.8 7.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
  <span className="wideOnly">{t("Sign in|nav")}</span><span className="narrowOnly">{t("Sign in|nav")}</span>
 </a>;
}
