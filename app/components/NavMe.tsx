"use client";
import {useEffect,useState} from "react";
import {useT} from "./Lang";
import {loadMe} from "./saved";

/** Top-bar link to My GoToday. Signed in: their Google photo and first name, so it's obvious they're logged in.
 *  Signed out: a heart and "My GoToday" (saved events on this device + sign in). */
export default function NavMe(){
 const {t}=useT();
 const [me,setMe]=useState<{signedIn:boolean;name?:string|null;image?:string|null;email?:string}|null>(null);
 useEffect(()=>{loadMe().then(setMe)},[]);
 if(me?.signedIn){
  const first=(me.name||me.email||"").split(/[\s@]/)[0]||"Me";
  return <a className="meLink signed" href="/me" title={`${me.email?t("Signed in as {email}",{email:me.email}):t("Signed in")} — ${t("My GoToday")}`}>
   {me.image?<img src={me.image} alt="" width={24} height={24} referrerPolicy="no-referrer"/>:<span className="initial" aria-hidden>{first[0]?.toUpperCase()}</span>}
   <span>{first}</span>
  </a>;
 }
 return <a className="meLink" href="/me" title={t("My GoToday — saved events, following, your calendar")}>
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.1 3.4 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.6 0 5.5 3.6 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
  <span className="wideOnly">{t("My GoToday")}</span><span className="narrowOnly">{t("Saved|list")}</span>
 </a>;
}
