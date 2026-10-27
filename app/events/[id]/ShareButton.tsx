"use client";
import {useT} from "../../components/Lang";
import {useState} from "react";
export default function ShareButton({title,text}:{title:string;text:string}){
 const [msg,setMsg]=useState("");
 const {t}=useT();
 async function share(){
  const url=location.href;
  {const m=location.pathname.match(/\/events\/(db-\d+)/);if(m)fetch("/api/track",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:m[1],action:"share"}),keepalive:true}).catch(()=>{})}
  try{if(navigator.share){await navigator.share({title,text,url});return}}catch(e:any){if(e?.name==="AbortError")return}
  try{await navigator.clipboard.writeText(`${text}\n${url}`);setMsg(t("Link copied"))}catch{setMsg(t("Couldn't copy link"))}
  setTimeout(()=>setMsg(""),2000);
 }
 return <button type="button" className="shareDetail" onClick={share} style={{display:"inline-flex",alignItems:"center",gap:8,border:"1px solid #e4e4e7",background:"#fff",padding:"13px 18px",borderRadius:12,fontWeight:700,fontSize:15,cursor:"pointer"}}>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
  {msg||t("Share")}
 </button>
}
