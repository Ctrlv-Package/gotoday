import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import type {Metadata} from "next";
import {currentUser,calendarToken} from "../../lib/auth";
import {db} from "../../lib/db";
import {savedEvents,followedSeries,type MyEventRow} from "../../lib/me";
import {fmtDate,fmtTime,isAllDay} from "../../lib/event-detail";
import SaveButton from "../components/SaveButton";
import {GuestSaved,GuestCreated,CalendarLinks,Unfollow,SignedInNote} from "./parts";
import {eventsOfUser} from "../../lib/community";
import {getLang} from "../../lib/lang-server";
import {tFor,LOCALE} from "../../lib/i18n";
import {LangSetting} from "../components/Lang";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"My GoToday",robots:{index:false}};

const SITE=process.env.NEXT_PUBLIC_SITE_URL||"https://www.mygotoday.com";
const when=(r:MyEventRow,loc:string)=>`${fmtDate(r.start,{weekday:"short",month:"short",day:"numeric"},r.tz,loc)}${isAllDay(r.start,r.tz)?"":` · ${fmtTime(r.start,r.tz,loc)}`}`;
const longDate=(d:string,loc:string)=>new Date(d+"T12:00:00Z").toLocaleDateString(loc,{month:"long",day:"numeric",year:"numeric",timeZone:"UTC"});

export default async function Me(){
 const user=await currentUser().catch(()=>null);
 const lang=await getLang(),t=tFor(lang),loc=LOCALE[lang];
 const head=<SiteHeader me={false}/>;

 if(!user)return <main className="detail">{head}
  <div className="detailWrap">
   <section className="detailCard"><div className="detailBody">
    <h1>{t("My GoToday")}</h1>
    <GuestSaved/>
    <GuestCreated/>
    <div className="perk">
     <h2>{t("Get more with a free account")}</h2>
     <ul>
      <li><b>{t("Saved events on every device")}</b> — {t("your phone and computer stay in sync.")}</li>
      <li><b>{t("Your events in one place")}</b> — {t("events you create are listed here with their share and manage links, on any device.")}</li>
      <li><b>{t("Remind me next year")}</b> — {t("when a festival or fair you liked comes back, its new date shows up for you as soon as it's announced.")}</li>
      <li><b>{t("Your own GoToday calendar")}</b> — {t("subscribe once in Google or Apple Calendar and everything you save appears there by itself.")}</li>
      <li><b>{t("Your language everywhere")}</b> — {t("pick English, Español or Русский once and GoToday uses it on all your devices.")}</li>
     </ul>
     <Link className="btn primary" href="/signin">{t("Sign in or create an account")}</Link>
    </div>
   </div></section>
  </div></main>;

 const [saved,following,token,created]=await Promise.all([savedEvents(user.id,30),followedSeries(user.id),calendarToken(user),eventsOfUser(user.id)]);
 const c=(await db.query("select cal_clicked_at,cal_clicked,cal_fetched_at,cal_client from users where id=$1",[user.id])).rows[0]||{};
 const cal={clickedAt:c.cal_clicked_at?.toISOString?.()||null,clicked:c.cal_clicked,fetchedAt:c.cal_fetched_at?.toISOString?.()||null,client:c.cal_client};
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York"}).format(new Date());
 const upcoming=saved.filter(r=>r.date>=today),past=saved.filter(r=>r.date<today).reverse();
 const feed=`${SITE.replace(/^https?:\/\//,"")}/cal/${token}.ics`;

 return <main className="detail">{head}
  <div className="detailWrap">
   <section className="detailCard"><div className="detailBody">
    <SignedInNote name={user.name}/>
    <h1>{t("My GoToday")}</h1>
    <p className="lead">{user.name?t("Hi {name}!",{name:user.name.split(" ")[0]}):t("Hi!")} {t("Here's what you've saved and your next-year reminders.")}</p>

    <section className="meSection">
     <h2>{t("Your GoToday calendar")}</h2>
     <p className="muted">{t("Subscribe once and every event you save shows up in your calendar by itself, including next year's dates for your reminders. Changes and cancellations update too. Note: Google Calendar only checks for new events every several hours (sometimes up to a day), so a new save can take a while to appear there; Apple Calendar checks more often. Need it on your calendar right now? Use the 📅 button on the event.")}</p>
     <CalendarLinks feed={feed} initial={cal}/>
    </section>

    <section className="meSection">
     <h2>{t("Saved|list")} <span className="count">{upcoming.length}</span></h2>
     {upcoming.length===0?<p className="muted">{t("Nothing saved yet. Tap the ♡ on any event to save it here.")}</p>
     :<ul className="meList">{upcoming.map(r=><li key={r.id} className={r.cancelled?"cancelled":""}>
       <Link href={`/events/db-${r.id}`}><b>{r.cancelled?t("Cancelled")+": ":""}{r.title}</b><span>{when(r,loc)} · {r.venue||r.city}</span></Link>
       <SaveButton compact item={{id:`db-${r.id}`,title:r.title,date:r.date}}/>
      </li>)}</ul>}
     {past.length>0&&<details className="mePast"><summary>{t("Recently passed")} ({past.length})</summary><ul className="meList">{past.map(r=><li key={r.id}>
       <Link href={`/events/db-${r.id}`}><b>{r.title}</b><span>{when(r,loc)} · {r.venue||r.city}</span></Link></li>)}</ul></details>}
    </section>

    <section className="meSection">
     <h2>{t("My events")} <span className="count">{created.length}</span></h2>
     {created.length===0?<p className="muted">{t("Events you create on GoToday show up here, with links to share and manage them.")} <Link href="/create" className="inlineLink">{t("Create an event →")}</Link></p>
     :<><ul className="meList">{created.map(c=><li key={c.id}>
       <a href={`/e/${c.shareToken}`}><b>{c.title}</b><span>{longDate(c.date,loc)}{c.startTime?` · ${c.startTime}`:""}{c.venue?` · ${c.venue}`:""}</span>
        <span className={`stat ${c.status}`}>{c.visibility==="private"?t("Private · link only"):c.status==="live"?t("Live on GoToday"):c.status==="pending"?t("Waiting for review"):c.status==="rejected"?t("Not approved"):c.status}</span></a>
       {c.ownerToken&&<Link className="btn ghost small" href={`/manage/${c.ownerToken}`}>{t("Manage")}</Link>}
      </li>)}</ul>
      <p className="muted small" style={{marginTop:8}}><Link href="/create" className="inlineLink">{t("+ Create another event")}</Link></p></>}
    </section>

    <section className="meSection">
     <h2>{t("Remind me next year")} <span className="count">{following.length}</span></h2>
     {following.length===0?<p className="muted">{t("On a festival, fair or other yearly event, tap 🔔 “Remind me next year” and we'll keep track of it for you, year after year.")}</p>
     :<ul className="meList">{following.map(f=><li key={f.seriesId}>
       {f.next?<Link href={`/events/db-${f.next.id}`}><b>{f.title}</b><span>{t("Next")}: {when(f.next,loc)} · {f.next.venue||f.next.city}</span></Link>
        :<div className="meNo"><b>{f.title}</b><span>{t("Next date not announced yet")}{f.last?` · ${t("last time")} ${longDate(f.last.date,loc)}`:""}. {t("We'll add it as soon as it's listed.")}</span></div>}
       <Unfollow series={f.seriesId}/>
      </li>)}</ul>}
    </section>

    <section className="meSection">
     <h2>{t("Language")}</h2>
     <p className="muted">{t("GoToday uses this language on every device where you're signed in.")}</p>
     <LangSetting/>
    </section>

    <div className="meFoot"><span>{t("Signed in as")} <b>{user.email}</b></span><form action="/api/auth/signout" method="post"><button className="btn ghost small" type="submit">{t("Sign out")}</button></form></div>
    <p className="authFine"><Link href="/privacy">{t("Privacy")}</Link> · <Link href="/terms">{t("Terms")}</Link></p>
   </div></section>
  </div></main>;
}
