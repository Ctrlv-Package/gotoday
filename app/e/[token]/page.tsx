import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import type {Metadata} from "next";
import {eventByShare,startOf,endOf,rsvpCounts,showPhone,type CommunityEvent} from "../../../lib/community";
import {fmtDate,fmtTime} from "../../../lib/event-detail";
import ShareButton from "../../events/[id]/ShareButton";
import AddToCalendar from "../../components/AddToCalendar";
import ExpandableImage from "../../components/ExpandableImage";
import Rsvp from "./Rsvp";
import HostLink from "./HostLink";
import NotifyButton from "../../components/NotifyButton";
import {rsvpsFor} from "../../../lib/community";
import SaveButton from "../../components/SaveButton";
import CalendarChoice from "../../components/CalendarChoice";
import FollowButton from "../../components/FollowButton";
import {currentUser} from "../../../lib/auth";
import {calendarConnected} from "../../../lib/me";
import {followable} from "../../../lib/series";
import {db} from "../../../lib/db";
import {stockPicture} from "../../../lib/stockPhotos";
import {occurrences,nextOccurrence,describe as describeRepeat} from "../../../lib/repeat";
export const dynamic="force-dynamic";

const when=(e:CommunityEvent,date=e.date)=>{const s=startOf(e,date),en=endOf(e,date);return{date:fmtDate(s,undefined,e.tz),time:e.allDay?"All day":fmtTime(s,e.tz)+(en?` – ${fmtTime(en,e.tz)}`:"")}};
function ages(e:CommunityEvent){if(e.ageMin==null&&e.ageMax==null)return"";if(e.ageMax==null)return`Ages ${e.ageMin}+`;return`Ages ${e.ageMin??0}–${e.ageMax}`}

export async function generateMetadata({params}:{params:Promise<{token:string}>}):Promise<Metadata>{
 const e=await eventByShare((await params).token).catch(()=>null);
 if(!e)return{title:"Event · GoToday",robots:{index:false}};
 const w=when(e),description=`${w.date} · ${w.time} · ${e.venue||e.city}`;
 // Private invites never get indexed; the link preview still shows the title and date.
 return{title:`${e.title} · GoToday`,description,robots:e.visibility==="private"||e.status!=="live"?{index:false,follow:false}:undefined,openGraph:{title:e.title,description,siteName:"GoToday",type:"website"}};
}

export default async function CommunityEventPage({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{d?:string}>}){
 const token=(await params).token,e=await eventByShare(token),asked=(await searchParams).d||"";
 const shell=(body:React.ReactNode)=><main className="detail"><SiteHeader extra={<Link href="/create" className="createPill" aria-label="Create event" title="Create event">+<span className="wideOnly"> Create event</span></Link>}/><div className="detailWrap">{body}</div></main>;
 if(!e||e.status==="rejected")return shell(<article className="detailCard"><div className="detailBody"><h1>Event unavailable</h1><p>This link doesn't match an event, or the host removed it.</p><Link href="/">Find something to do →</Link></div></article>);
 // A repeating event: the date the card linked to (?d=), else the next one coming up.
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:e.tz}).format(new Date());
 const repeats=e.repeat.kind!=="none";
 const date=!repeats?e.date:/^\d{4}-\d{2}-\d{2}$/.test(asked)&&occurrences(e.date,e.repeat,asked,asked).length?asked:nextOccurrence(e.date,e.repeat,today)||e.date;
 const upcoming=repeats?occurrences(e.date,e.repeat,today,new Date(Date.parse(today)+400*86400e3).toISOString().slice(0,10),6).filter(d=>d!==date).slice(0,5):[];
 const fmtShort=(d:string)=>new Date(d+"T12:00:00Z").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",timeZone:"UTC"});
 const w=when(e,date),a=ages(e),where=[e.venue,e.address,e.city].filter(Boolean).join(", "),ended=(endOf(e,date)||new Date(startOf(e,date).getTime()+(e.allDay?24:3)*3600e3)).getTime()<Date.now();
 // No photo from the host: a library photo of that kind of event (marked as illustrative).
 const photo=e.image||await stockPicture({title:e.title,desc:e.description,category:e.categories.join(" "),tags:e.categories,ageMax:e.ageMax}).catch(()=>""),stock=!e.image&&!!photo;
 // A public listing has a GoToday entry per date: Save, the calendar check and "Remind me next year" work on it.
 const listed=e.visibility==="public"&&e.status==="live";
 const row=listed?(await db.query("select id,series_id from events where fingerprint=$1 and status='active'",[e.repeat.kind==="none"?`community|${e.id}`:`community|${e.id}|${date}`]).catch(()=>({rows:[]}))).rows[0]:null;
 const dbId=row?Number(row.id):null,user=await currentUser().catch(()=>null);
 const calConnected=!!user&&await calendarConnected(user.id).catch(()=>false);
 const canFollow=!!dbId&&!ended&&(e.repeat.kind==="yearly"||(!!row.series_id&&await followable(Number(row.series_id),e.title).catch(()=>false)));
 const following=!!(user&&row?.series_id&&(await db.query("select 1 from follows where user_id=$1 and series_id=$2",[user.id,row.series_id]).catch(()=>({rowCount:0}))).rowCount);
 const counts=e.rsvp.onSite?await rsvpCounts(e.id):null;
 // The host (signed in) sees who replied right here, with a link to manage the event.
 const own=user?(await db.query("select owner_token from community_events where id=$1 and user_id=$2",[e.id,user.id]).catch(()=>({rows:[]}))).rows[0]:null;
 const guests=own&&e.rsvp.onSite?await rsvpsFor(e.id).catch(()=>[]):[];
 if(own)await db.query("update community_events set rsvp_seen_at=now() where id=$1",[e.id]).catch(()=>{});
 const map=`https://maps.google.com/maps?q=${encodeURIComponent(e.latitude!=null&&e.longitude!=null&&!e.address?`${e.latitude},${e.longitude}`:where)}&z=15&output=embed`;
 const dir=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(where)}`;
 return shell(<article className="detailCard">{photo&&<div className="heroWrap"><ExpandableImage className="detailHero" src={photo} alt=""/>{stock&&<span className="stockNote">Illustrative photo</span>}</div>}<div className="detailBody">
  <div className="badges">
   {e.visibility==="private"?<span className="b private">🔒 Private event</span>:<span className="b">🌎 Public event</span>}
   {e.isFree&&<span className="b free">Free</span>}{a&&<span className="b age">{a}</span>}
   {e.categories.filter(c=>c!=="Community").map(c=><span key={c} className="b">{c}</span>)}
   {ended&&<span className="b past">This date has passed</span>}
  </div>
  <h1>{e.title}</h1>
  {e.hostName&&<p className="host">Hosted by <b>{e.hostName}</b></p>}
  {e.status==="pending"&&<div className="reg"><div><b>Waiting for review</b><span> · the link works, but it isn't listed in search yet.</span></div></div>}
  <div className="facts">
   <div className="fact"><div className="k">When</div><div className="v">{w.date}</div><div className="s">{w.time}{repeats?` · ${describeRepeat(e.date,e.repeat)}`:""}</div>{upcoming.length>0&&<div className="s nextDates">Next: {upcoming.map(fmtShort).join(" · ")}</div>}</div>
   <div className="fact"><div className="k">Where</div><div className="v">{e.venue||e.address||e.city}</div><div className="s">{[e.venue?e.address:"",e.city].filter(Boolean).join(", ")}</div><a className="inline" href={dir} target="_blank" rel="noreferrer">Get directions ↗</a></div>
   {!e.isFree&&e.priceText&&<div className="fact"><div className="k">Cost</div><div className="v">{e.priceText}</div></div>}
  </div>
  {e.link&&<div className="ctaRow"><a className="btn primary" href={e.link} target="_blank" rel="noreferrer nofollow ugc">{e.isFree?"More info ↗":"Tickets & info ↗"}</a></div>}
  <div className={`ctaGrid${dbId&&!ended?"":" two"}`}>
   {dbId&&<SaveButton item={{id:`db-${dbId}`,title:e.title,date,venue:e.venue||e.city}}/>}
   {!ended&&(dbId?<CalendarChoice base={`/e/${token}`} id={`db-${dbId}`} connected={calConnected}/>:<AddToCalendar base={`/e/${token}`}/>)}
   <ShareButton title={e.title} text={`${e.title} · ${w.date}, ${w.time}${e.venue?` at ${e.venue}`:""}`}/>
  </div>
  {canFollow&&<div className="ctaFollow"><FollowButton id={`db-${dbId}`} signedIn={!!user} initial={following} back={`/e/${token}`}/></div>}
  {e.description&&<section className="about"><h2>{e.visibility==="private"?"Details":"About this event"}</h2>{e.description.split(/\n+/).filter(Boolean).map((p,i)=><p key={i}>{p}</p>)}</section>}
  {own?<section className="rsvp hostView"><h2>Your guest list</h2>
    {e.rsvp.onSite?<><p className="muted">{counts?.going||0} going{counts?.maybe?` · ${counts.maybe} maybe`:""}{counts?.no?` · ${counts.no} can't go`:""}</p>
     {guests.length===0?<p className="muted">No replies yet. Share the link with your guests.</p>
     :<ul className="guests">{guests.map(r=><li key={r.id}><b>{r.name}</b><span className={`g ${r.status}`}>{r.status==="going"?"Going":r.status==="maybe"?"Maybe":"Can't go"}{r.guests>0&&r.status!=="no"?` +${r.guests}`:""}</span>{r.note&&<span className="muted">“{r.note}”</span>}</li>)}</ul>}</>
    :<p className="muted">Guests reply to you by {[e.rsvp.phone&&"text or call",e.rsvp.email&&"email"].filter(Boolean).join(" or ")||"the contact you gave"}. Turn on “Guests reply on GoToday” in Manage to keep a guest list here.</p>}
    <div className="hostActions">{e.rsvp.onSite&&<NotifyButton manageToken={own.owner_token||undefined}/>}{own.owner_token&&<a className="btn ghost small" href={`/manage/${own.owner_token}`}>Manage event</a>}</div>
   </section>
  :<>{!ended&&<HostLink share={token}/>}{!ended&&(counts||e.rsvp.phone||e.rsvp.email)&&<RsvpBox e={e} date={w.date} counts={counts} share={token}/>}</>}
  <section className="mapBox"><h2>Location</h2><p className="muted">{where}</p><iframe title={`Map of ${e.venue||e.city}`} src={map} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/></section>
  <p className="sourceNote">{e.visibility==="private"?"Private event created on GoToday. Only people with this link can see it.":"Posted by a GoToday community member. Details can change, so check with the organizer before you go."} <Link href="/create">Create your own →</Link></p>
 </div></article>);
}

/** RSVP: straight to the host by text / call / email (with the message started for them), and/or Going / Maybe on GoToday. */
function RsvpBox({e,date,counts,share}:{e:CommunityEvent;date:string;counts:{going:number;maybe:number;no:number}|null;share:string}){
 const r=e.rsvp,who=r.name||e.hostName||"the host",hi=r.name?`Hi ${r.name}! `:"Hi! ";
 const msg=`${hi}RSVP for ${e.title} (${date}): we'll be there! We are __ people. — `;
 const by=r.by?new Date(r.by+"T12:00:00Z").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",timeZone:"UTC"}):"";
 return <section className="rsvp"><h2>RSVP</h2>
  {by&&<p className="rsvpBy">Please reply by <b>{by}</b></p>}
  {(r.phone||r.email)&&<div className="rsvpContact">
   <p>RSVP to <b>{who}</b>{r.phone?<> · <a href={`tel:${r.phone}`}>{showPhone(r.phone)}</a></>:null}{r.email?<> · <a href={`mailto:${r.email}`}>{r.email}</a></>:null}</p>
   <div className="rsvpBtns">
    {r.phone&&<a className="btn primary" href={`sms:${r.phone}?&body=${encodeURIComponent(msg)}`}>💬 Text RSVP</a>}
    {r.phone&&<a className="btn ghost" href={`tel:${r.phone}`}>📞 Call</a>}
    {r.email&&<a className={`btn ${r.phone?"ghost":"primary"}`} href={`mailto:${r.email}?subject=${encodeURIComponent(`RSVP: ${e.title}`)}&body=${encodeURIComponent(msg)}`}>✉️ Email RSVP</a>}
   </div>
  </div>}
  {counts&&(r.phone||r.email)&&<p className="muted rsvpOr">Or answer here, and {who} sees it on the guest list:</p>}
  {counts&&<Rsvp share={share} counts={counts} embedded/>}
 </section>;
}
