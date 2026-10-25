"use client";
import {useEffect,useState} from "react";
const KEY="gotoday:push";
const b64=(s:string)=>{const p="=".repeat((4-s.length%4)%4),r=atob((s+p).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(r,c=>c.charCodeAt(0))};
/** "Notify me when guests reply": turns on phone/browser notifications for this host. On iPhone this only works
 *  once GoToday is added to the Home Screen, so it says that instead of failing silently. */
export default function NotifyButton({manageToken}:{manageToken?:string}){
 const [state,setState]=useState<"idle"|"on"|"busy"|"ios"|"blocked"|"unsupported"|"error">("idle");
 useEffect(()=>{
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent),standalone=(navigator as any).standalone||matchMedia("(display-mode: standalone)").matches;
  if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){setState(ios&&!standalone?"ios":"unsupported");return}
  if(Notification.permission==="denied"){setState("blocked");return}
  // Turned on before on this device: show it as on right away, then confirm with the browser.
  let remembered=false;try{remembered=!!localStorage.getItem(KEY)}catch{}
  if(remembered&&Notification.permission==="granted")setState("on");
  (async()=>{
   const reg=await navigator.serviceWorker.getRegistration("/")||await Promise.race([navigator.serviceWorker.ready,new Promise<undefined>(r=>setTimeout(()=>r(undefined),4000))]);
   const sub=await reg?.pushManager.getSubscription();
   if(sub&&Notification.permission==="granted"){setState("on");try{localStorage.setItem(KEY,sub.endpoint)}catch{};save(sub).catch(()=>{})}   // also links this event's host to the device
   else if(reg){setState(st=>st==="on"?"idle":st);try{localStorage.removeItem(KEY)}catch{}}
  })().catch(()=>{});
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 async function save(sub:PushSubscription){const r=await fetch("/api/push",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({subscription:sub.toJSON(),manageToken})});if(!r.ok)throw new Error("save")}
 async function turnOn(){
  setState("busy");
  try{
   if(await Notification.requestPermission()!=="granted"){setState("blocked");return}
   const reg=await navigator.serviceWorker.register("/sw.js");await navigator.serviceWorker.ready;
   const {publicKey}=await (await fetch("/api/push")).json();
   const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(publicKey)});
   await save(sub);try{localStorage.setItem(KEY,sub.endpoint)}catch{};setState("on");
  }catch{setState("error")}
 }
 async function turnOff(){
  setState("busy");
  try{const reg=await navigator.serviceWorker.getRegistration("/");const sub=await reg?.pushManager.getSubscription();
   if(sub){await fetch("/api/push",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({endpoint:sub.endpoint})}).catch(()=>{});await sub.unsubscribe().catch(()=>{})}
  }finally{try{localStorage.removeItem(KEY)}catch{};setState("idle")}
 }
 if(state==="on")return <p className="notifyNote">🔔 You'll get a notification on this device when someone replies. <button type="button" className="linkBtn" onClick={turnOff}>Turn off</button></p>;
 if(state==="ios")return <p className="notifyNote">🔔 To get a notification when someone replies on iPhone: tap Share → “Add to Home Screen”, open GoToday from there, and turn notifications on.</p>;
 if(state==="blocked")return <p className="notifyNote">🔕 Notifications are blocked for GoToday in this browser's settings. Allow them there to be told about new replies.</p>;
 if(state==="unsupported")return null;
 return <div><button type="button" className="btn ghost small notifyBtn" onClick={turnOn} disabled={state==="busy"}>{state==="busy"?"Turning on…":"🔔 Notify me when guests reply"}</button>{state==="error"&&<p className="notifyNote">Couldn't turn notifications on. Try again.</p>}</div>;
}
