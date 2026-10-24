"use client";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import EventForm,{type FormValues} from "../../components/EventForm";
import CopyLink from "../../components/CopyLink";
import {rememberEvent,forgetEvent} from "../../components/myEvents";

type Data={event:FormValues&{status:string;reviewReason:string|null;shareToken:string;date:string};rsvps:{id:number;name:string;status:string;guests:number;note:string}[];counts:{going:number;maybe:number;no:number};shareUrl:string};

export default function ManagePage(){
 const token=String(useParams().token||"");
 const [data,setData]=useState<Data|null>(null),[err,setErr]=useState(""),[busy,setBusy]=useState(false),[msg,setMsg]=useState(""),[confirmDel,setConfirmDel]=useState(false),[formKey,setFormKey]=useState(0);
 const [transferEmail,setTransferEmail]=useState(""),[confirmTransfer,setConfirmTransfer]=useState(false),[transferErr,setTransferErr]=useState(""),[transferred,setTransferred]=useState("");
 const auth={authorization:`Bearer ${token}`};
 async function load(){try{const r=await fetch("/api/community/manage",{headers:auth,cache:"no-store"});const d=await r.json();if(!d.ok){setErr(d.errors?.[0]||"Not found");return}setData(d);
  rememberEvent({title:d.event.title,date:d.event.date,shareUrl:d.shareUrl,manageUrl:location.href,visibility:d.event.visibility})}catch{setErr("Couldn't reach GoToday.")}}
 useEffect(()=>{load()},[token]);
 async function save(v:FormValues){setBusy(true);setMsg("");
  try{const r=await fetch("/api/community/manage",{method:"PUT",headers:{...auth,"content-type":"application/json"},body:JSON.stringify(v)});const d=await r.json();
   if(!d.ok)return d.errors||["Couldn't save."];
   setMsg(d.status==="pending"?"Saved. The changes are waiting for a quick review before they show in search.":"Saved ✓");await load();setFormKey(k=>k+1);window.scrollTo({top:0,behavior:"smooth"});return null;
  }catch{return["Couldn't reach GoToday."]}finally{setBusy(false)}}
 // After a delete, go to My GoToday with a full page load (not a client-side back step): browser Back
 // can restore a frozen copy of /me that still lists the event, which reads as if the delete failed.
 async function del(){setBusy(true);try{const r=await fetch("/api/community/manage",{method:"DELETE",headers:auth});if((await r.json()).ok){forgetEvent(location.href);window.location.href="/me?deleted=1"}}finally{setBusy(false)}}
 async function doTransfer(){setBusy(true);setTransferErr("");try{const r=await fetch("/api/community/manage",{method:"POST",headers:{...auth,"content-type":"application/json"},body:JSON.stringify({recipientEmail:transferEmail})});const d=await r.json();
  if(!d.ok){setTransferErr(d.errors?.[0]||"Couldn't transfer.");setConfirmTransfer(false)}else{forgetEvent(location.href);setTransferred(d.recipientEmail)}
 }catch{setTransferErr("Couldn't reach GoToday.");setConfirmTransfer(false)}finally{setBusy(false)}}

 const e=data?.event;
 return <main className="detail">
  <SiteHeader extra={<Link href="/create" className="createPill" aria-label="Create event" title="Create event">+<span className="wideOnly"> Create event</span></Link>}/>
  <div className="detailWrap"><article className="detailCard"><div className="detailBody">
   {err?<><h1>Manage link not found</h1><p>{err}</p><Link href="/">Back to GoToday →</Link></>
   :!data||!e?<p>Loading…</p>:<>
    <div className="badges">{e.visibility==="private"?<span className="b private">🔒 Private</span>:<span className="b">🌎 Public</span>}
     {e.status==="live"&&e.visibility==="public"&&<span className="b free">Listed in search</span>}
     {e.status==="pending"&&<span className="b past">Waiting for review</span>}{e.status==="rejected"&&<span className="b past">Not approved for search</span>}</div>
    <h1>Manage: {e.title}</h1>
    {msg&&<div className="okMsg">{msg}</div>}
    {e.status==="rejected"&&<p className="muted">This event wasn't approved to be listed publicly{e.reviewReason?` (${e.reviewReason})`:""}. Its link still works if you switch it to private.</p>}
    <div className="linkBox"><div className="k">{e.visibility==="private"?"Invite link for your guests":"Event link"}</div><CopyLink url={data.shareUrl}/>
     <div className="linkActions"><a className="btn primary" href={data.shareUrl}>View event page</a></div></div>

    {(e.rsvp?e.rsvp.onSite:e.visibility==="private")&&<section className="related"><h2>Guest list · {data.counts.going} going{data.counts.maybe?` · ${data.counts.maybe} maybe`:""}{data.counts.no?` · ${data.counts.no} can't go`:""}</h2>
     {data.rsvps.length===0?<p className="muted">No RSVPs yet. Send your invite link to guests.</p>
     :<ul className="guests">{data.rsvps.map(r=><li key={r.id}><b>{r.name}</b><span className={`g ${r.status}`}>{r.status==="going"?"Going":r.status==="maybe"?"Maybe":"Can't go"}{r.guests>0&&r.status!=="no"?` +${r.guests}`:""}</span>{r.note&&<span className="muted">“{r.note}”</span>}</li>)}</ul>}
    </section>}

    <section className="related"><h2>Edit details</h2>
     <EventForm key={formKey} initial={{...e,date:e.date}} submitLabel="Save changes" busy={busy} onSubmit={save}/></section>

    <section className="related"><h2>Transfer to another user</h2>
     {transferred?<><div className="okMsg">Transferred to <b>{transferred}</b>. This manage link no longer works — the new owner will find the event in My GoToday.</div><Link href="/create">Create another event →</Link></>
     :<><p className="muted">Hand this event to someone else's GoToday account. They must already have signed in to GoToday with that email. Your manage link will stop working once it moves.</p>
     {transferErr&&<div className="efErrors" role="alert"><div>• {transferErr}</div></div>}
     {confirmTransfer?<div className="ctaRow"><button className="btn dangerBtn" disabled={busy} onClick={doTransfer}>Yes, transfer it to {transferEmail}</button><button className="btn ghost" onClick={()=>setConfirmTransfer(false)}>Cancel</button></div>
     :<div className="ctaRow"><label className="efField grow"><span>New owner's email</span><input type="email" value={transferEmail} onChange={e=>setTransferEmail(e.target.value)} placeholder="them@example.com"/></label><button className="btn ghost" disabled={busy||!transferEmail.trim()} onClick={()=>setConfirmTransfer(true)}>Transfer…</button></div>}</>}
    </section>

    <section className="danger"><h2>Delete event</h2>
     {confirmDel?<div className="ctaRow"><button className="btn dangerBtn" disabled={busy} onClick={del}>Yes, delete it</button><button className="btn ghost" onClick={()=>setConfirmDel(false)}>Cancel</button></div>
     :<button className="btn ghost" onClick={()=>setConfirmDel(true)}>Delete this event…</button>}
    </section>
   </>}
  </div></article></div>
 </main>;
}
