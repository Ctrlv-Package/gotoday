"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
// Health of every event source: when it last updated, how many events it has, and any error.
type S={name:string;platform:string;region?:string;enabled?:boolean;remote?:boolean;status:{last_success_at:string|null;last_error_at:string|null;last_error:string|null;active_events:number}|null};
const ago=(t:string|null)=>{if(!t)return"never";const h=(Date.now()-new Date(t).getTime())/36e5;return h<1?`${Math.max(1,Math.round(h*60))} min ago`:h<48?`${Math.round(h)} h ago`:`${Math.round(h/24)} days ago`};
function state(s:S){
 if(s.enabled===false)return"paused";
 const ok=s.status?.last_success_at?new Date(s.status.last_success_at).getTime():0,err=s.status?.last_error_at?new Date(s.status.last_error_at).getTime():0;
 if(!ok&&!err)return"new";
 if(err>ok)return"failing";
 return Date.now()-ok>36*36e5?"late":"ok";
}
const LABEL:Record<string,string>={ok:"✅ Updated",late:"⏰ Late",failing:"❌ Failing",paused:"⏸ Paused",new:"🆕 Not run yet"};
export default function Status(){
 const [secret,setSecret]=useState(""),[run,setRun]=useState<any>(null),[gh,setGh]=useState<any>(null),[det,setDet]=useState<any>(null),[qa,setQa]=useState<any>(null),[list,setList]=useState<S[]|null>(null),[err,setErr]=useState(""),[filter,setFilter]=useState("problems"),[q,setQ]=useState("");
 useEffect(()=>{try{const s=sessionStorage.getItem("gotoday:admin");if(s){setSecret(s);load(s)}}catch{}},[]);
 // A tab left open shows old numbers: reload whenever the page comes back into view.
 useEffect(()=>{const on=()=>{if(document.visibilityState==="visible"&&secret&&list)load()};document.addEventListener("visibilitychange",on);return()=>document.removeEventListener("visibilitychange",on)},[secret,list]);
 const[loadedAt,setLoadedAt]=useState<number|null>(null);
 async function load(s=secret){setErr("");const r=await fetch("/api/admin/sources",{headers:{authorization:`Bearer ${s}`},cache:"no-store"});const d=await r.json().catch(()=>({}));
  if(!d.ok){setErr(d.error||"Couldn't load");setList(null);return}try{sessionStorage.setItem("gotoday:admin",s)}catch{}setList(d.sources);setRun(d.lastRun);setGh(d.lastGithub||null);setDet(d.details||null);setQa(d.quality||null);setLoadedAt(Date.now())}
 const rows=useMemo(()=>(list||[]).map(s=>({...s,st:state(s)})),[list]);
 const counts=useMemo(()=>{const c:Record<string,number>={ok:0,late:0,failing:0,paused:0,new:0};for(const r of rows)c[r.st]++;return c},[rows]);
 const lastRun=useMemo(()=>rows.map(r=>r.status?.last_success_at).filter(Boolean).sort().pop()||null,[rows]);
 const events=rows.reduce((n,r)=>n+(r.status?.active_events||0),0);
 const shown=rows.filter(r=>(filter==="all"||(filter==="problems"?["failing","late"].includes(r.st):filter==="instagram"?r.platform==="instagram":r.st===filter))&&(!q||r.name.toLowerCase().includes(q.toLowerCase())))
  .sort((a,b)=>["failing","late","new","paused","ok"].indexOf(a.st)-["failing","late","new","paused","ok"].indexOf(b.st)||a.name.localeCompare(b.name));
 return <main className="detail"><header className="detailHeader"><div className="detailWrap row"><Link href="/?fresh=1" className="detailLogo">Go<span>Today</span></Link><Link href="/admin" className="navLink">Review queue</Link></div></header>
  <div className="detailWrap"><article className="detailCard"><div className="detailBody">
   <h1>Source status</h1>
   {list===null?<form className="ef" onSubmit={e=>{e.preventDefault();load()}}><label className="efField">Ingestion secret<input type="password" value={secret} onChange={e=>setSecret(e.target.value)} autoComplete="off"/></label>{err&&<div className="efErrors">{err}</div>}<button className="btn primary">Open</button></form>
   :<>
    <div className="facts">
     <div className="fact"><div className="k">Last update</div><div className="v">{ago(lastRun)}</div><div className="s">{events.toLocaleString()} upcoming events</div></div>
     <div className="fact"><div className="k">Last full website update</div><div className="v">{run?ago(run.started_at):"not logged yet"}</div><div className="s">{run?`${run.trigger==="schedule"?"Automatic (6 AM)":"Run by hand"} · ${run.finished_at?`${run.succeeded} ok, ${run.failed} failed`:"still running or cut off"}`:"Logged from the next run on"}</div></div>
     <div className="fact"><div className="k">Last GitHub job</div><div className="v">{gh?ago(gh.finished_at||gh.started_at):"not logged yet"}</div><div className="s">{gh?`City sites + Instagram · ${gh.succeeded} ok, ${gh.failed} failed`:"Logged from the next run on"}</div></div>
     <div className="fact"><div className="k">Sources</div><div className="v">{counts.ok} updated</div><div className="s">{counts.failing} failing · {counts.late} late · {counts.paused} paused · {counts.new} not run yet</div></div>
    </div>
    {gh?.failed>0&&gh.notes&&<details className="ghNotes"><summary>What failed in the last GitHub job ({gh.failed})</summary><pre>{gh.notes}</pre></details>}
    {qa&&(()=>{const L:Record<string,string>={freeButPriced:"Marked Free but shows a price",duplicates:"Same event shown twice",sharedPhoto:"Photo shared by different events",kidsTitleNotKids:"Kids/family title but no Kids label",freeTitleNotFree:"\"Free\" in title but no Free label",adultTitleFamily:"Adult title labeled Family",outdoorTitleIndoor:"Outdoor event labeled Indoor",captionTitle:"Post text shown as an event"};
     const rows=Object.keys(L).map(k=>[k,qa.summary?.[k]||0] as [string,number]),n=rows.reduce((a,[,v])=>a+v,0);
     return <details className="ghNotes"><summary>Quality check ({ago(qa.checked_at)}, {qa.cards} event cards across all areas, next 7 days): {n===0?"no problems found 🎉":`${n} to look at`}</summary>
      <ul className="qaList">{rows.map(([k,v])=><li key={k}><b>{v}</b> {L[k]}{v>0&&qa.examples?.[k]?.length?<ul>{qa.examples[k].slice(0,5).map((x:any,i:number)=><li key={i} className="muted small">{x.date} · {x.title.slice(0,140)} <i>({String(x.source).slice(0,60)})</i></li>)}</ul>:null}</li>)}</ul></details>})()}
    {det&&<p className="muted small">Event details found on the web for Instagram posts that only name the event (free: the post's links and the account's website): {det.found} of {det.tried} looked up.{det.error&&<b style={{color:"#b91c1c"}}> Web search isn't working: {String(det.error).slice(0,200)}</b>}</p>}
    <p className="muted small">Automatic runs: website sources daily ~6:00 AM; city sites + Instagram from the GitHub job about 3 times a day (GitHub often starts it an hour or more late). "Late" = no successful update in 36 hours.</p>
    <div className="statusBar"><div className="seg">{[["problems","Problems"],["all","All"],["instagram","Instagram"],["paused","Paused"],["new","Not run"]].map(([k,l])=><button key={k} className={filter===k?"active":""} onClick={()=>setFilter(k)}>{l}</button>)}</div>
     <input type="search" placeholder="Find a source" value={q} onChange={e=>setQ(e.target.value)}/><button className="linkBtn" onClick={()=>load()}>Refresh</button>{loadedAt&&<span className="muted small"> · checked {new Date(loadedAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</span>}</div>
    {shown.length===0?<p>{filter==="problems"?"No problems. Everything updated recently. 🎉":"Nothing here."}</p>
    :<ul className="statusList">{shown.map(r=><li key={r.name} className={r.st}>
      <div><b>{r.name}</b><span className="muted"> · {r.platform}{r.remote?" (GitHub job)":""}</span></div>
      <div className="row2"><span>{LABEL[r.st]}</span><span>last success {ago(r.status?.last_success_at||null)}</span><span>{r.status?.active_events??0} events</span></div>
      {(r.st==="failing"||r.st==="paused")&&r.status?.last_error&&<div className="errText">{r.status.last_error.slice(0,300)}</div>}
     </li>)}</ul>}
   </>}
  </div></article></div></main>;
}
