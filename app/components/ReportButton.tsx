"use client";
import {useState} from "react";
import {useT} from "./Lang";
import {REPORT_REASONS} from "../../lib/reports";

/** "Report a problem" on an event page. Anonymous: reason + optional note, nothing else. A report never
  * changes the listing — it waits in /admin until a person acts on it. */
export default function ReportButton({kind,id}:{kind:"listing"|"community";id:number}){
 const {t}=useT();
 const [open,setOpen]=useState(false),[reason,setReason]=useState<string>(REPORT_REASONS[0]),[note,setNote]=useState(""),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[err,setErr]=useState("");
 async function send(){
  if(busy)return;setBusy(true);setErr("");
  try{
   const r=await fetch("/api/report",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({kind,id,reason,note})});
   const d=await r.json().catch(()=>({}));
   if(!d.ok)throw new Error("");
   setDone(true);
  }catch{setErr(t("Couldn't send the report. Please try again."))}finally{setBusy(false)}
 }
 if(done)return <p className="muted">{t("Thanks — we'll take a look.")}</p>;
 if(!open)return <button type="button" className="btn ghost small" onClick={()=>setOpen(true)}>{t("Report a problem")}</button>;
 return <div className="reportForm">
  <div className="efField"><label>{t("What's wrong?")}</label><select value={reason} onChange={e=>setReason(e.target.value)}>{REPORT_REASONS.map(x=><option key={x} value={x}>{t(x)}</option>)}</select></div>
  <div className="efField"><label>{t("Details (optional)")}</label><textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={500} rows={3}/></div>
  {err&&<div className="efErrors">{err}</div>}
  <div className="ctaRow"><button type="button" className="btn primary" disabled={busy} onClick={send}>{t("Send report")}</button><button type="button" className="btn ghost" onClick={()=>setOpen(false)}>{t("Cancel")}</button></div>
 </div>;
}
