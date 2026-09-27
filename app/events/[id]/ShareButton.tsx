"use client";
import {useState} from "react";
export default function ShareButton({title,text}:{title:string;text:string}){
 const [msg,setMsg]=useState("");
 async function share(){
  const url=location.href;
  try{if(navigator.share){await navigator.share({title,text,url});return}}catch(e:any){if(e?.name==="AbortError")return}
  try{await navigator.clipboard.writeText(`${text}\n${url}`);setMsg("Link copied")}catch{setMsg("Couldn't copy")}
  setTimeout(()=>setMsg(""),2000);
 }
 return <button type="button" onClick={share} style={{display:"inline-flex",alignItems:"center",gap:8,border:"1px solid #e4e4e7",background:"#fff",padding:"13px 18px",borderRadius:12,fontWeight:700,fontSize:15,cursor:"pointer"}}>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
  {msg||"Share"}
 </button>
}
