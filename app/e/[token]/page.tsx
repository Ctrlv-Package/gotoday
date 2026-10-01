import Link from "next/link";
import type {Metadata} from "next";
import {eventByShare,startOf,endOf,rsvpCounts,type CommunityEvent} from "../../../lib/community";
import {fmtDate,fmtTime} from "../../../lib/event-detail";
import ShareButton from "../../events/[id]/ShareButton";
import AddToCalendar from "../../components/AddToCalendar";
import Rsvp from "./Rsvp";
export const dynamic="force-dynamic";

const when=(e:CommunityEvent)=>{const s=startOf(e),en=endOf(e);return{date:fmtDate(s,undefined,e.tz),time:e.allDay?"All day":fmtTime(s,e.tz)+(en?` – ${fmtTime(en,e.tz)}`:"")}};
function ages(e:CommunityEvent){if(e.ageMin==null&&e.ageMax==null)return"";if(e.ageMax==null)return`Ages ${e.ageMin}+`;return`Ages ${e.ageMin??0}–${e.ageMax}`}

export async function generateMetadata({params}:{params:Promise<{token:string}>}):Promise<Metadata>{
 const e=await eventByShare((await params).token).catch(()=>null);
 if(!e)return{title:"Event · GoToday",robots:{index:false}};
 const w=when(e),description=`${w.date} · ${w.time} · ${e.venue||e.city}`;
 // Private invites never get indexed; the link preview still shows the title and date.
 return{title:`${e.title} · GoToday`,description,robots:e.visibility==="private"||e.status!=="live"?{index:false,follow:false}:undefined,openGraph:{title:e.title,description,siteName:"GoToday",type:"website"}};
}

export default async function CommunityEventPage({params}:{params:Promise<{token:string}>}){
 const token=(await params).token,e=await eventByShare(token);
 const shell=(body:React.ReactNode)=><main className="detail"><header className="detailHeader"><div className="detailWrap row"><Link href="/?fresh=1" className="detailLogo">Go<span>Today</span></Link><Link href="/create" className="navLink">+ Create event</Link></div></header><div className="detailWrap">{body}</div></main>;
 if(!e||e.status==="rejected")return shell(<article className="detailCard"><div className="detailBody"><h1>Event unavailable</h1><p>This link doesn't match an event, or the host removed it.</p><Link href="/">Find something to do →</Link></div></article>);
 const w=when(e),a=ages(e),where=[e.venue,e.address,e.city].filter(Boolean).join(", "),ended=(endOf(e)||new Date(startOf(e).getTime()+(e.allDay?24:3)*3600e3)).getTime()<Date.now();
 const counts=e.visibility==="private"?await rsvpCounts(e.id):null;
 const map=`https://maps.google.com/maps?q=${encodeURIComponent(e.latitude!=null&&e.longitude!=null&&!e.address?`${e.latitude},${e.longitude}`:where)}&z=15&output=embed`;
 const dir=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(where)}`;
 return shell(<article className="detailCard"><div className="detailBody">
  <div className="badges">
   {e.visibility==="private"?<span className="b private">🔒 Private event</span>:<span className="b">🌎 Public event</span>}
   {e.isFree&&<span className="b free">Free</span>}{a&&<span className="b age">{a}</span>}
   {e.category&&e.category!=="Community"&&<span className="b">{e.category}</span>}
   {ended&&<span className="b past">This date has passed</span>}
  </div>
  <h1>{e.title}</h1>
  {e.hostName&&<p className="host">Hosted by <b>{e.hostName}</b></p>}
  {e.status==="pending"&&<div className="reg"><div><b>Waiting for review</b><span> · the link works, but it isn't listed in search yet.</span></div></div>}
  <div className="facts">
   <div className="fact"><div className="k">When</div><div className="v">{w.date}</div><div className="s">{w.time}</div></div>
   <div className="fact"><div className="k">Where</div><div className="v">{e.venue||e.address||e.city}</div><div className="s">{[e.venue?e.address:"",e.city].filter(Boolean).join(", ")}</div><a className="inline" href={dir} target="_blank" rel="noreferrer">Get directions ↗</a></div>
   {!e.isFree&&e.priceText&&<div className="fact"><div className="k">Cost</div><div className="v">{e.priceText}</div></div>}
  </div>
  <div className="ctaRow">
   {e.link&&<a className="btn primary" href={e.link} target="_blank" rel="noreferrer nofollow ugc">{e.isFree?"More info ↗":"Tickets & info ↗"}</a>}
   {!ended&&<AddToCalendar base={`/e/${token}`}/>}
   <ShareButton title={e.title} text={`${e.title} · ${w.date}, ${w.time}${e.venue?` at ${e.venue}`:""}`}/>
  </div>
  {e.description&&<section className="about"><h2>{e.visibility==="private"?"Details":"About this event"}</h2>{e.description.split(/\n+/).filter(Boolean).map((p,i)=><p key={i}>{p}</p>)}</section>}
  {counts&&!ended&&<Rsvp share={token} counts={counts}/>}
  <section className="mapBox"><h2>Location</h2><p className="muted">{where}</p><iframe title={`Map of ${e.venue||e.city}`} src={map} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/></section>
  <p className="sourceNote">{e.visibility==="private"?"Private event created on GoToday. Only people with this link can see it.":"Posted by a GoToday community member. Details can change, so check with the organizer before you go."} <Link href="/create">Create your own →</Link></p>
 </div></article>);
}
