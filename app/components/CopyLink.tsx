"use client";
import {useT} from "./Lang";
import {useState} from "react";
export default function CopyLink({url,label}:{url:string;label?:string}){
 const {t}=useT();
 const [done,setDone]=useState(false);
 return <div className="copyLink"><input readOnly value={url} onFocus={e=>e.currentTarget.select()} aria-label={label||t("Link")}/>
  <button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(url);setDone(true);setTimeout(()=>setDone(false),1800)}catch{}}}>{done?t("Copied ✓"):t("Copy")}</button></div>;
}
