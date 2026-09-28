"use client";
import {useState} from "react";
export default function CopyLink({url,label}:{url:string;label?:string}){
 const [done,setDone]=useState(false);
 return <div className="copyLink"><input readOnly value={url} onFocus={e=>e.currentTarget.select()} aria-label={label||"Link"}/>
  <button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(url);setDone(true);setTimeout(()=>setDone(false),1800)}catch{}}}>{done?"Copied ✓":"Copy"}</button></div>;
}
