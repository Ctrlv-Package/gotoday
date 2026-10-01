"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
// Review public events the automatic check flagged. Uses the INGESTION_SECRET (kept only in this tab).
type P={id:number;title:string;description:string;date:string;startTime:string;venue:string;address:string;city:string;hostName:string;link:string;reviewReason:string|null;shareUrl:string};
export default function Admin(){
 const [secret,setSecret]=useState(""),[list,setList]=useState<P[]|null>(null),[err,setErr]=useState("");
 useEffect(()=>{try{const s=sessionStorage.getItem("gotoday:admin");if(s){setSecret(s);load(s)}}catch{}},[]);
 async function load(s=secret){setErr("");const r=await fetch("/api/admin/community",{headers:{authorization:`Bearer ${s}`},cache:"no-store"});const d=await r.json().catch(()=>({}));
  if(!d.ok){setErr(d.error||"Couldn't load");setList(null);return}try{sessionStorage.setItem("gotoday:admin",s)}catch{}setList(d.pending)}
 async function decide(id:number,approve:boolean){await fetch("/api/admin/community",{method:"POST",headers:{authorization:`Bearer ${secret}`,"content-type":"application/json"},body:JSON.stringify({id,approve})});load()}
 return <main className="detail"><header className="detailHeader"><div className="detailWrap row"><Link href="/?fresh=1" className="detailLogo">Go<span>Today</span></Link><a href="/admin/status" className="navLink">Source status</a></div></header>
  <div className="detailWrap"><article className="detailCard"><div className="detailBody">
   <h1>Events waiting for review</h1>
   {list===null?<form className="ef" onSubmit={e=>{e.preventDefault();load()}}><label className="efField">Ingestion secret<input type="password" value={secret} onChange={e=>setSecret(e.target.value)} autoComplete="off"/></label>{err&&<div className="efErrors">{err}</div>}<button className="btn primary">Open</button></form>
   :list.length===0?<p>Nothing waiting. 🎉</p>
   :<ul className="review">{list.map(p=><li key={p.id}><b>{p.title}</b><span>{p.date} {p.startTime} · {[p.venue,p.address,p.city].filter(Boolean).join(", ")}{p.hostName?` · by ${p.hostName}`:""}</span>
     {p.description&&<p>{p.description.slice(0,400)}</p>}{p.link&&<a href={p.link} target="_blank" rel="noreferrer nofollow">{p.link}</a>}
     <span className="muted">Check said: {p.reviewReason||"—"}</span>
     <div className="ctaRow"><button className="btn primary" onClick={()=>decide(p.id,true)}>Approve</button><button className="btn ghost" onClick={()=>decide(p.id,false)}>Reject</button><a className="btn ghost" href={p.shareUrl} target="_blank" rel="noreferrer">Preview</a></div></li>)}</ul>}
  </div></article></div></main>;
}
