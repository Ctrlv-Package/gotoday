import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import HeroImage from "../../components/HeroImage";
import {junkTag} from "../../../lib/facets";
import {calendarConnected} from "../../../lib/me";
import SaveButton from "../../components/SaveButton";
import CalendarChoice from "../../components/CalendarChoice";
import FollowButton from "../../components/FollowButton";
import {currentUser} from "../../../lib/auth";
import {db} from "../../../lib/db";
import {seriesOf,followable} from "../../../lib/series";
import {cleanAges} from "../../../lib/facets";
import {localParts} from "../../../lib/time";
import type {Metadata} from "next";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import ShareButton from "./ShareButton";
import {placeScore} from "../../../lib/places";
import {getLang} from "../../../lib/lang-server";
import {tFor,LOCALE} from "../../../lib/i18n";
type T=(s:string,v?:Record<string,string|number>)=>string;
import {loadEvent,loadRelated,fmtDate,fmtTime,timeRange,isAllDay,directionsUrl,mapEmbedUrl,whereText,type EventDetail} from "../../../lib/event-detail";

export const dynamic="force-dynamic";

// Same reading as the cards: a 5–11 guessed from a bare "Kids" label isn't shown as if the event said it.
function agesText(d:EventDetail,t:T){const c=cleanAges({title:d.title,desc:d.description,tags:d.tags,ageMin:d.ageMin,ageMax:d.ageMax});const e={ageMin:c.ageMin??null,ageMax:c.ageMax??null};if(e.ageMin==null||e.ageMax==null)return"";if(e.ageMin===0&&e.ageMax>=99)return t("All ages");if(e.ageMax>=99)return t("Ages {a}+",{a:e.ageMin});return e.ageMax<=1?t("Babies (0–1)"):t("Ages {a}–{b}",{a:e.ageMin,b:e.ageMax})}
function costText(e:EventDetail,t:T){if(e.isFree)return t("Free");const p=(e.priceText||"").trim();return p&&p.length<=140?p:""}
function sourceLabel(e:EventDetail){return e.source==="Ticketmaster"?"Ticketmaster":e.source}

export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
 const {id}=await params;const e=await loadEvent(id).catch(()=>null);
 if(!e)return{title:"Event · GoToday"};
 const description=`${fmtDate(e.start,undefined,e.tz)} · ${timeRange(e)} · ${e.venue||e.city}${e.isFree?" · Free":""}`;
 return{title:`${e.title} · GoToday`,description,alternates:{canonical:`/events/${encodeURIComponent(id)}`},openGraph:{title:e.title,description,siteName:"GoToday",type:"website",images:e.image?[{url:e.image}]:undefined},twitter:{card:e.image?"summary_large_image":"summary",title:e.title,description}};
}

export default async function EventPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const lang=await getLang(),t=tFor(lang),loc=LOCALE[lang];
 const e=await loadEvent(id);
 if(!e)return <main className="detail"><div className="detailWrap"><Link href="/?fresh=1" className="detailLogo">Go<span>Today</span></Link><h1>{t("Event unavailable")}</h1><p>{t("This event may have ended or been removed.")}</p><Link href="/">{t("Find something else to do →")}</Link></div></main>;
 // Events people created on GoToday live on their own page (RSVPs, host details).
 if(e.source==="GoToday Community"&&/\/e\/[\w-]+$/.test(e.officialUrl))redirect(new URL(e.officialUrl).pathname);
 const h=await headers(),origin=`${h.get("x-forwarded-proto")||"https"}://${h.get("host")}`,pageUrl=`${origin}/events/${encodeURIComponent(id)}`;
 const {otherDates,atVenue}=await loadRelated(e);
 // "Passed" means the event's day (its last day, if it runs several) is over in local time. On the day itself,
 // it only says it ended when the listing gives an end time that has gone by.
 const lastDay=localParts(e.end&&e.end>e.start?e.end:e.start,e.tz).date,todayLocal=localParts(new Date(),e.tz).date;
 const dayPassed=lastDay<todayLocal,endedToday=!dayPassed&&!!e.end&&e.end>e.start&&e.end.getTime()<Date.now();
 const ended=dayPassed||endedToday;
 // Only the town (or the organizer's own default, like its city hall) is known: don't send people there.
 const exactPlace=placeScore({venue:e.venue,address:e.address,city:e.city,source:e.source})>0||(!!e.address&&/\d/.test(e.address));
 const ages=agesText(e,t),cost=costText(e,t),map=exactPlace?mapEmbedUrl(e):null,where=whereText(e);
 // Follow (be told when it's back next year) is offered for events that come around now and then, not weekly ones.
 const user=await currentUser().catch(()=>null);
 const series=await seriesOf(e.id).catch(()=>null);
 const canFollow=!!series&&e.source!=="Ticketmaster"&&await followable(series).catch(()=>false);
 // Their GoToday calendar is connected (a calendar app reads it, or they just added it): saved = already in their calendar.
 const calConnected=!!user&&await calendarConnected(user.id);
 const following=!!(user&&series&&(await db.query("select 1 from follows where user_id=$1 and series_id=$2",[user.id,series]).catch(()=>({rowCount:0}))).rowCount);
 const regFull=/full/i.test(e.registrationText||"");
 // A separate sign-up link (Eventbrite etc.) gets its own button; otherwise registration happens on the event page itself.
 const directReg=!!e.registrationUrl&&e.registrationUrl!==e.officialUrl;
 const regWhere=/library/i.test(e.source)?"library":/parks/i.test(e.source)?"parks":"event";
 const paras=e.description.split(/\n+/).map(x=>x.trim()).filter(Boolean);
 const tags=e.tags.filter(t=>!junkTag(t)&&!["Local","Library","Parks","Free","Tickets","Kids","Family"].includes(t)&&!/\(\d/.test(t)).slice(0,5);

 // Event details in Google's format (schema.org Event): lets the listing show in Google's event results.
 const jsonLd={"@context":"https://schema.org","@type":"Event",name:e.title,startDate:(isAllDay(e.start,e.tz)?localParts(e.start,e.tz).date:e.start.toISOString()),
  ...(e.end&&e.end>e.start?{endDate:isAllDay(e.start,e.tz)?localParts(e.end,e.tz).date:e.end.toISOString()}:{}),
  eventStatus:"https://schema.org/EventScheduled",eventAttendanceMode:"https://schema.org/OfflineEventAttendanceMode",
  location:{"@type":"Place",name:e.venue||e.city,address:e.address||e.city,...(e.lat!=null&&e.lng!=null?{geo:{"@type":"GeoCoordinates",latitude:e.lat,longitude:e.lng}}:{})},
  ...(e.image&&!e.stockImage?{image:[e.image]}:{}),description:e.description.slice(0,500),url:`https://www.mygotoday.com/events/${encodeURIComponent(id)}`,
  organizer:{"@type":"Organization",name:sourceLabel(e),url:e.officialUrl},
  ...(e.isFree?{isAccessibleForFree:true,offers:{"@type":"Offer",price:0,priceCurrency:"USD",availability:"https://schema.org/InStock",url:e.officialUrl}}:{})};
 return <main className="detail">
  {!ended&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd).replace(/</g,"\\u003c")}}/>}
  <SiteHeader/>
  <div className="detailWrap">
   <article className="detailCard">
    {e.image?<HeroImage src={e.image} backup={e.backupImage} stock={!!e.stockImage} note={t("Illustrative photo")}/>:null}
    <div className="detailBody">
     <div className="badges">
      {e.isFree&&<span className="b free">{t("Free")}</span>}
      {ages&&<span className="b age">{ages}</span>}
      {e.tags.includes("Kids")&&!ages&&<span className="b age">{t("Kids")}</span>}
      {e.category&&e.category!=="Local"&&<span className="b">{t(e.category)}</span>}
      {ended&&<span className="b past">{dayPassed?t("This date has passed"):t("Ended earlier today")}</span>}
     </div>
     <h1>{e.title}</h1>

     <div className="facts">
      <div className="fact"><div className="k">{t("When")}</div><div className="v">{fmtDate(e.start,undefined,e.tz,loc)}</div><div className="s">{timeRange(e,loc,t("All day"))}{e.recurrence?` · ${t("Repeats")} ${t(e.recurrence.toLowerCase())}`:""}</div></div>
      <div className="fact"><div className="k">{t("Where")}</div>{exactPlace
       ?<><div className="v">{e.venue||e.city}</div><div className="s">{e.address||e.city}</div><a className="inline" href={directionsUrl(e)} target="_blank" rel="noreferrer">{t("Get directions")} ↗</a></>
       :<><div className="v">{e.city.replace(/,\s*[A-Z]{2}$/,"")||e.venue}</div><div className="s">{t("Exact location not listed. Check the official event page.")}</div></>}</div>
      {(cost||ages)&&<div className="fact"><div className="k">{ages?t("Cost & ages"):t("Cost")}</div><div className="v">{cost||t("See event page")}</div>{ages&&<div className="s">{ages}</div>}</div>}
     </div>

     {e.registrationText&&<div className={`reg${regFull?" full":""}`}>
      <div><b>{t(e.registrationText.split(" · ")[0])}</b>{e.registrationText.includes(" · ")&&<span> · {e.registrationText.split(" · ").slice(1).map(x=>t(x)).join(" · ")}</span>}
       {!directReg&&e.source!=="Ticketmaster"&&<div className="regHow">{t(regWhere==="library"?"Tap Register on the library page to sign up.":regWhere==="parks"?"Tap Register on the parks page to sign up.":"Tap Register on the event page to sign up.")}</div>}</div>
      {directReg&&<a href={e.registrationUrl!} target="_blank" rel="noreferrer">{t("Register")} ↗</a>}
     </div>}

     <div className="ctaRow">
      <a className="btn primary" href={e.officialUrl} target="_blank" rel="noreferrer">{e.source==="Ticketmaster"?t("Tickets & details")+" ↗":e.registrationText&&!directReg&&!regFull?t(regWhere==="library"?"Register on library page":regWhere==="parks"?"Register on parks page":"Register on event page")+" ↗":t("Official event page")+" ↗"}</a>
     </div>
     <div className="ctaGrid">
      <SaveButton item={{id:`db-${e.id}`,title:e.title,date:new Intl.DateTimeFormat("en-CA",{timeZone:e.tz}).format(e.start),venue:e.venue||e.city}}/>
      {!ended&&<CalendarChoice base={`/events/${encodeURIComponent(id)}`} id={`db-${e.id}`} connected={calConnected}/>}
      <ShareButton title={e.title} text={`${e.title} — ${fmtDate(e.start,undefined,e.tz,loc)}${isAllDay(e.start,e.tz)?"":`, ${fmtTime(e.start,e.tz,loc)}`} · ${e.venue||e.city}`}/>
     </div>
     {canFollow&&<div className="ctaFollow">
 {canFollow&&<FollowButton id={`db-${e.id}`} signedIn={!!user} initial={following}/>}
     </div>}
     <p className="ctaHelp">♡ <b>{t("Save")}</b> {calConnected?t("keeps it in My GoToday and adds it to your GoToday calendar (Google Calendar can take up to a day to show new events)"):t("keeps it in My GoToday")}{!ended&&!calConnected?<> · 📅 <b>{t("Calendar")}</b> {t("adds this date to your calendar")}</>:null}{canFollow?<> · 🔔 <b>{t("Remind me next year")}</b> {t("gets you next year's date as soon as it's announced")}</>:null}</p>

     {paras.length>0&&<section className="about"><h2>{t("About this event")}</h2>{paras.map((p,i)=><p key={i}>{p}</p>)}</section>}
     {tags.length>0&&<div className="tagRow">{tags.map(x=><span key={x}>{t(x)}</span>)}</div>}

     {map&&<section className="mapBox"><h2>{t("Location")}</h2><p className="muted">{where}</p><iframe title={`${t("Map")}: ${e.venue||e.city}`} src={map} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/></section>}

     {otherDates.length>0&&<section className="related"><h2>{otherDates.some(o=>o.venue!==e.venue)?t("Other dates & locations"):t("Other dates")}</h2>
      <ul>{otherDates.map(o=><li key={o.id}><Link href={`/events/db-${o.id}`}><b>{fmtDate(o.start,{weekday:"short",month:"short",day:"numeric"},e.tz,loc)}</b><span>{isAllDay(o.start,e.tz)?t("All day"):fmtTime(o.start,e.tz,loc)}</span>{o.venue!==e.venue&&<span className="muted">{o.venue||o.city}</span>}</Link></li>)}</ul>
     </section>}

     {atVenue.length>0&&<section className="related"><h2>{t("More at {place}",{place:e.venue||""})}</h2>
      <ul>{atVenue.map(o=><li key={o.id}><Link href={`/events/db-${o.id}`}><b>{o.title}</b><span>{fmtDate(o.start,{weekday:"short",month:"short",day:"numeric"},e.tz,loc)}{isAllDay(o.start,e.tz)?"":" · "+fmtTime(o.start,e.tz,loc)}</span></Link></li>)}</ul>
     </section>}

     <p className="sourceNote">{t("Listed by")} <b>{sourceLabel(e)}</b>. {t("Details can change — check the official page before you go.")}</p>
    </div>
   </article>
  </div>
 </main>;
}
