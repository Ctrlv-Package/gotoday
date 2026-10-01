"use client";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import Link from "next/link";
import EventForm,{type FormValues} from "../../components/EventForm";
import CopyLink from "../../components/CopyLink";
import {rememberEvent,forgetEvent} from "../../components/myEvents";

type Data={event:FormValues&{status:string;reviewReason:string|null;shareToken:string;date:string};rsvps:{id:number;name:string;status:string;guests:number;note:string}[];counts:{going:number;maybe:number;no:number};shareUrl:string};

export default function ManagePage(){
 const token=String(useParams().token||"");
 const [data,setData]=useState<Data|null>(null),[err,setErr]=useState(""),[busy,setBusy]=useState(false),[msg,setMsg]=useState(""),[confirmDel,setConfirmDel]=useState(false),[deleted,setDeleted]=useState(false),[formKey,setFormKey]=useState(0);
 const auth={authorization:`Bearer ${token}`};
 async function load(){try{const r=await fetch("/api/community/manage",{headers:auth,cache:"no-store"});const d=await r.json();if(!d.ok){setErr(d.errors?.[0]||"Not found");return}setData(d);
  rememberEvent({title:d.event.title,date:d.event.date,shareUrl:d.shareUrl,manageUrl:location.href,visibility:d.event.visibility})}catch{setErr("Couldn't reach GoToday.")}}
 useEffect(()=>{load()},[token]);
 async function save(v:FormValues){setBusy(true);setMsg("");
  try{const r=await fetch("/api/community/manage",{method:"PUT",headers:{...auth,"content-type":"application/json"},body:JSON.stringify(v)});const d=await r.json();
   if(!d.ok)return d.errors||["Couldn't save."];
   setMsg(d.status==="pending"?"Saved. The changes are waiting for a quick review before they show in search.":"Saved ✓");await load();setFormKey(k=>k+1);window.scrollTo({top:0,behavior:"smooth"});return null;
  }catch{return["Couldn't reach GoToday."]}finally{setBusy(false)}}
 async function del(){setBusy(true);try{const r=await fetch("/api/community/manage",{method:"DELETE",headers:auth});if((await r.json()).ok){forgetEvent(location.href);setDeleted(true)}}finally{setBusy(false)}}

 const e=data?.event;
 return <main className="detail">
  <header className="detailHeader"><div className="detailWrap row"><Link href="/?fresh=1" className="detailLogo">Go<span>Today</span></Link><Link href="/create" className="navLink">+ Create event</Link></div></header>
  <div className="detailWrap"><article className="detailCard"><div className="detailBody">
   {deleted?<><h1>Event deleted</h1><p>The event page and its link no longer work.</p><Link href="/create">Create another event →</Link></>
   :err?<><h1>Manage link not found</h1><p>{err}</p><Link href="/">Back to GoToday →</Link></>
   :!data||!e?<p>Loading…</p>:<>
    <div className="badges">{e.visibility==="private"?<span className="b private">🔒 Private</span>:<span className="b">🌎 Public</span>}
     {e.status==="live"&&e.visibility==="public"&&<span className="b free">Listed in search</span>}
     {e.status==="pending"&&<span className="b past">Waiting for review</span>}{e.status==="rejected"&&<span className="b past">Not approved for search</span>}</div>
    <h1>Manage: {e.title}</h1>
    {msg&&<div className="okMsg">{msg}</div>}
    {e.status==="rejected"&&<p className="muted">This event wasn't approved to be listed publicly{e.reviewReason?` (${e.reviewReason})`:""}. Its link still works if you switch it to private.</p>}
    <div className="linkBox"><div className="k">{e.visibility==="private"?"Invite link for your guests":"Event link"}</div><CopyLink url={data.shareUrl}/>
     <div className="linkActions"><a className="btn primary" href={data.shareUrl}>View event page</a></div></div>

    {e.visibility==="private"&&<section className="related"><h2>Guest list · {data.counts.going} going{data.counts.maybe?` · ${data.counts.maybe} maybe`:""}{data.counts.no?` · ${data.counts.no} can't go`:""}</h2>
     {data.rsvps.length===0?<p className="muted">No RSVPs yet. Send your invite link to guests.</p>
     :<ul className="guests">{data.rsvps.map(r=><li key={r.id}><b>{r.name}</b><span className={`g ${r.status}`}>{r.status==="going"?"Going":r.status==="maybe"?"Maybe":"Can't go"}{r.guests>0&&r.status!=="no"?` +${r.guests}`:""}</span>{r.note&&<span className="muted">“{r.note}”</span>}</li>)}</ul>}
    </section>}

    <section className="related"><h2>Edit details</h2>
     <EventForm key={formKey} initial={{...e,date:e.date}} submitLabel="Save changes" busy={busy} onSubmit={save}/></section>

    <section className="danger"><h2>Delete event</h2>
     {confirmDel?<div className="ctaRow"><button className="btn dangerBtn" disabled={busy} onClick={del}>Yes, delete it</button><button className="btn ghost" onClick={()=>setConfirmDel(false)}>Cancel</button></div>
     :<button className="btn ghost" onClick={()=>setConfirmDel(true)}>Delete this event…</button>}
    </section>
   </>}
  </div></article></div>
 </main>;
}
