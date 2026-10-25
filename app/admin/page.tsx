"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
// Review public events the automatic check flagged. Uses the INGESTION_SECRET (kept only in this tab).
type P={id:number;title:string;description:string;date:string;startTime:string;venue:string;address:string;city:string;hostName:string;link:string;reviewReason:string|null;shareUrl:string};
type Q={id:number;title:string;city:string;venue:string;date:string;source:string;reasons:string[]};
export default function Admin(){
 const [secret,setSecret]=useState(""),[list,setList]=useState<P[]|null>(null),[err,setErr]=useState("");
 const [held,setHeld]=useState<Q[]|null>(null),[flagged,setFlagged]=useState<Q[]>([]);
 useEffect(()=>{try{const s=sessionStorage.getItem("gotoday:admin");if(s){setSecret(s);load(s)}}catch{}},[]);
 async function load(s=secret){setErr("");const r=await fetch("/api/admin/community",{headers:{authorization:`Bearer ${s}`},cache:"no-store"});const d=await r.json().catch(()=>({}));
  if(!d.ok){setErr(d.error||"Couldn't load");setList(null);return}try{sessionStorage.setItem("gotoday:admin",s)}catch{}setList(d.pending);
  const q=await fetch("/api/admin/quarantine",{headers:{authorization:`Bearer ${s}`},cache:"no-store"}).then(r=>r.json()).catch(()=>({}));
  if(q.ok){setHeld(q.held);setFlagged(q.flagged)}}
 async function decide(id:number,approve:boolean){await fetch("/api/admin/community",{method:"POST",headers:{authorization:`Bearer ${secret}`,"content-type":"application/json"},body:JSON.stringify({id,approve})});load()}
 async function decideQ(id:number,approve:boolean){await fetch("/api/admin/quarantine",{method:"POST",headers:{authorization:`Bearer ${secret}`,"content-type":"application/json"},body:JSON.stringify({id,approve})});load()}
 async function approveAllQ(){await fetch("/api/admin/quarantine",{method:"POST",headers:{authorization:`Bearer ${secret}`,"content-type":"application/json"},body:JSON.stringify({approveAll:true})});load()}
 return <main className="detail"><header className="detailHeader"><div className="detailWrap row"><Link href="/?fresh=1" className="detailLogo">Go<span>Today</span></Link><a href="/admin/status" className="navLink">Source status</a></div></header>
  <div className="detailWrap"><article className="detailCard"><div className="detailBody">
   <h1>Events waiting for review</h1>
   {list===null?<form className="ef" onSubmit={e=>{e.preventDefault();load()}}><label className="efField">Ingestion secret<input type="password" value={secret} onChange={e=>setSecret(e.target.value)} autoComplete="off"/></label>{err&&<div className="efErrors">{err}</div>}<button className="btn primary">Open</button></form>
   :list.length===0?<p>Nothing waiting. 🎉</p>
   :<ul className="review">{list.map(p=><li key={p.id}><b>{p.title}</b><span>{p.date} {p.startTime} · {[p.venue,p.address,p.city].filter(Boolean).join(", ")}{p.hostName?` · by ${p.hostName}`:""}</span>
     {p.description&&<p>{p.description.slice(0,400)}</p>}{p.link&&<a href={p.link} target="_blank" rel="noreferrer nofollow">{p.link}</a>}
     <span className="muted">Check said: {p.reviewReason||"—"}</span>
     <div className="ctaRow"><button className="btn primary" onClick={()=>decide(p.id,true)}>Approve</button><button className="btn ghost" onClick={()=>decide(p.id,false)}>Reject</button><a className="btn ghost" href={p.shareUrl} target="_blank" rel="noreferrer">Preview</a></div></li>)}</ul>}
   {list!==null&&<><h2 style={{marginTop:28}}>Held for quality review</h2>
    <p className="muted">Ingested listings the quality gate held instead of publishing: borrowed pictures, Family/Kids labels with no family signal, and every new source's first batch.</p>
    {held===null?<p className="muted">Loading…</p>:held.length===0?<p>Nothing held. 🎉</p>
    :<><div className="ctaRow"><button className="btn primary" onClick={approveAllQ}>Approve all</button></div>
     <ul className="review">{held.map(q=><li key={q.id}><b>{q.title}</b><span>{String(q.date||"").slice(0,10)} · {[q.venue,q.city].filter(Boolean).join(", ")}{q.source?` · ${q.source}`:""}</span>
      <span className="muted">Held for: {q.reasons.join(", ")}</span>
      <div className="ctaRow"><button className="btn primary" onClick={()=>decideQ(q.id,true)}>Approve</button><button className="btn ghost" onClick={()=>decideQ(q.id,false)}>Reject</button></div></li>)}</ul></>}
    {flagged.length>0&&<><h3>Live, but flagged</h3><p className="muted">Already published listings carrying a flag (a flag never pulls a live listing; clearing it just drops the note).</p>
     <ul className="review">{flagged.map(q=><li key={q.id}><b>{q.title}</b><span>{String(q.date||"").slice(0,10)} · {[q.venue,q.city].filter(Boolean).join(", ")}{q.source?` · ${q.source}`:""}</span>
      <span className="muted">Flagged for: {q.reasons.join(", ")}</span>
      <div className="ctaRow"><button className="btn ghost" onClick={()=>decideQ(q.id,true)}>Clear flag</button></div></li>)}</ul></>}</>}
  </div></article></div></main>;
}
