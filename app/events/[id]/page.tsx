import Link from "next/link";
import type {Metadata} from "next";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import BackLink from "./BackLink";
import ShareButton from "./ShareButton";
import AddToCalendar from "../../components/AddToCalendar";
import {loadEvent,loadRelated,fmtDate,fmtTime,timeRange,isAllDay,directionsUrl,mapEmbedUrl,whereText,type EventDetail} from "../../../lib/event-detail";

export const dynamic="force-dynamic";

function agesText(e:EventDetail){if(e.ageMin==null||e.ageMax==null)return"";if(e.ageMin===0&&e.ageMax>=99)return"All ages";if(e.ageMax>=99)return`Ages ${e.ageMin}+`;return e.ageMax<=1?"Babies (0–1)":`Ages ${e.ageMin}–${e.ageMax}`}
function costText(e:EventDetail){if(e.isFree)return"Free";const p=(e.priceText||"").trim();return p&&p.length<=140?p:""}
function sourceLabel(e:EventDetail){return e.source==="Ticketmaster"?"Ticketmaster":e.source}

export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
 const {id}=await params;const e=await loadEvent(id).catch(()=>null);
 if(!e)return{title:"Event · GoToday"};
 const description=`${fmtDate(e.start,undefined,e.tz)} · ${timeRange(e)} · ${e.venue||e.city}${e.isFree?" · Free":""}`;
 return{title:`${e.title} · GoToday`,description,openGraph:{title:e.title,description,siteName:"GoToday",type:"website",images:e.image?[{url:e.image}]:undefined},twitter:{card:e.image?"summary_large_image":"summary",title:e.title,description}};
}

export default async function EventPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const e=await loadEvent(id);
 if(!e)return <main className="detail"><div className="detailWrap"><Link href="/" className="detailLogo">Go<span>Today</span></Link><h1>Event unavailable</h1><p>This event may have ended or been removed.</p><Link href="/">Find something else to do →</Link></div></main>;
 // Events people created on GoToday live on their own page (RSVPs, host details).
 if(e.source==="GoToday Community"&&/\/e\/[\w-]+$/.test(e.officialUrl))redirect(new URL(e.officialUrl).pathname);
 const h=await headers(),origin=`${h.get("x-forwarded-proto")||"https"}://${h.get("host")}`,pageUrl=`${origin}/events/${encodeURIComponent(id)}`;
 const {otherDates,atVenue}=await loadRelated(e);
 // All-day events run until the end of their day; timed events count as over 3 hours after they end/start.
 const ended=isAllDay(e.start,e.tz)?e.start.getTime()+24*3600e3<Date.now():((e.end&&e.end>e.start?e.end:e.start).getTime()<Date.now()-3*3600e3);
 const ages=agesText(e),cost=costText(e),map=mapEmbedUrl(e),where=whereText(e);
 const regFull=/full/i.test(e.registrationText||"");
 // A separate sign-up link (Eventbrite etc.) gets its own button; otherwise registration happens on the event page itself.
 const directReg=!!e.registrationUrl&&e.registrationUrl!==e.officialUrl;
 const regWhere=/library/i.test(e.source)?"library":/parks/i.test(e.source)?"parks":"event";
 const paras=e.description.split(/\n+/).map(x=>x.trim()).filter(Boolean);
 const tags=e.tags.filter(t=>!["Local","Library","Parks","Free","Tickets","Kids","Family"].includes(t)&&!/\(\d/.test(t)).slice(0,5);

 return <main className="detail">
  <header className="detailHeader"><div className="detailWrap row"><Link href="/" className="detailLogo">Go<span>Today</span></Link><BackLink/></div></header>
  <div className="detailWrap">
   <article className="detailCard">
    {e.image?<img className="detailHero" src={e.image} alt="" referrerPolicy="no-referrer"/>:null}
    <div className="detailBody">
     <div className="badges">
      {e.isFree&&<span className="b free">Free</span>}
      {ages&&<span className="b age">{ages}</span>}
      {e.tags.includes("Kids")&&!ages&&<span className="b age">Kids</span>}
      {e.category&&e.category!=="Local"&&<span className="b">{e.category}</span>}
      {ended&&<span className="b past">This date has passed</span>}
     </div>
     <h1>{e.title}</h1>

     <div className="facts">
      <div className="fact"><div className="k">When</div><div className="v">{fmtDate(e.start,undefined,e.tz)}</div><div className="s">{timeRange(e)}{e.recurrence?` · Repeats ${e.recurrence.toLowerCase()}`:""}</div></div>
      <div className="fact"><div className="k">Where</div><div className="v">{e.venue||e.city}</div><div className="s">{e.address||e.city}</div><a className="inline" href={directionsUrl(e)} target="_blank" rel="noreferrer">Get directions ↗</a></div>
      {(cost||ages)&&<div className="fact"><div className="k">Cost{ages?" & ages":""}</div><div className="v">{cost||"See event page"}</div>{ages&&<div className="s">{ages}</div>}</div>}
     </div>

     {e.registrationText&&<div className={`reg${regFull?" full":""}`}>
      <div><b>{e.registrationText.split(" · ")[0]}</b>{e.registrationText.includes(" · ")&&<span> · {e.registrationText.split(" · ").slice(1).join(" · ")}</span>}
       {!directReg&&e.source!=="Ticketmaster"&&<div className="regHow">Tap <b>Register</b> on the {regWhere} page to sign up.</div>}</div>
      {directReg&&<a href={e.registrationUrl!} target="_blank" rel="noreferrer">Register ↗</a>}
     </div>}

     <div className="ctaRow">
      <a className="btn primary" href={e.officialUrl} target="_blank" rel="noreferrer">{e.source==="Ticketmaster"?"Tickets & details ↗":e.registrationText&&!directReg&&!regFull?`Register on ${regWhere} page ↗`:"Official event page ↗"}</a>
      {!ended&&<AddToCalendar base={`/events/${encodeURIComponent(id)}`}/>}
      <ShareButton title={e.title} text={`${e.title} — ${fmtDate(e.start,undefined,e.tz)}${isAllDay(e.start,e.tz)?"":`, ${fmtTime(e.start,e.tz)}`} at ${e.venue||e.city}`}/>
     </div>

     {paras.length>0&&<section className="about"><h2>About this event</h2>{paras.map((p,i)=><p key={i}>{p}</p>)}</section>}
     {tags.length>0&&<div className="tagRow">{tags.map(t=><span key={t}>{t}</span>)}</div>}

     {map&&<section className="mapBox"><h2>Location</h2><p className="muted">{where}</p><iframe title={`Map of ${e.venue||e.city}`} src={map} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/></section>}

     {otherDates.length>0&&<section className="related"><h2>{otherDates.some(o=>o.venue!==e.venue)?"Other dates & locations":"Other dates"}</h2>
      <ul>{otherDates.map(o=><li key={o.id}><Link href={`/events/db-${o.id}`}><b>{fmtDate(o.start,{weekday:"short",month:"short",day:"numeric"},e.tz)}</b><span>{isAllDay(o.start,e.tz)?"All day":fmtTime(o.start,e.tz)}</span>{o.venue!==e.venue&&<span className="muted">{o.venue||o.city}</span>}</Link></li>)}</ul>
     </section>}

     {atVenue.length>0&&<section className="related"><h2>More at {e.venue}</h2>
      <ul>{atVenue.map(o=><li key={o.id}><Link href={`/events/db-${o.id}`}><b>{o.title}</b><span>{fmtDate(o.start,{weekday:"short",month:"short",day:"numeric"},e.tz)}{isAllDay(o.start,e.tz)?"":" · "+fmtTime(o.start,e.tz)}</span></Link></li>)}</ul>
     </section>}

     <p className="sourceNote">Listed by <b>{sourceLabel(e)}</b>. Details can change — check the official page before you go.</p>
    </div>
   </article>
  </div>
 </main>;
}
