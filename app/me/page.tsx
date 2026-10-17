import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import type {Metadata} from "next";
import {currentUser,calendarToken} from "../../lib/auth";
import {db} from "../../lib/db";
import {savedEvents,followedSeries,type MyEventRow} from "../../lib/me";
import {fmtDate,fmtTime,isAllDay} from "../../lib/event-detail";
import SaveButton from "../components/SaveButton";
import {GuestSaved,CalendarLinks,Unfollow,SignedInNote} from "./parts";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"My GoToday",robots:{index:false}};

const SITE=process.env.NEXT_PUBLIC_SITE_URL||"https://www.mygotoday.com";
const when=(r:MyEventRow)=>`${fmtDate(r.start,{weekday:"short",month:"short",day:"numeric"},r.tz)}${isAllDay(r.start,r.tz)?"":` · ${fmtTime(r.start,r.tz)}`}`;
const longDate=(d:string)=>new Date(d+"T12:00:00Z").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric",timeZone:"UTC"});

export default async function Me(){
 const user=await currentUser().catch(()=>null);
 const head=<SiteHeader me={false}/>;

 if(!user)return <main className="detail">{head}
  <div className="detailWrap">
   <section className="detailCard"><div className="detailBody">
    <h1>My GoToday</h1>
    <GuestSaved/>
    <div className="perk">
     <h2>Get more with a free account</h2>
     <ul>
      <li><b>Saved events on every device</b> — your phone and computer stay in sync.</li>
      <li><b>Follow events you love</b> — when a festival or fair comes back next year, its new date shows up for you as soon as it's announced.</li>
      <li><b>Your own GoToday calendar</b> — subscribe once in Google or Apple Calendar and everything you save appears there by itself.</li>
     </ul>
     <Link className="btn primary" href="/signin">Sign in or create an account</Link>
    </div>
   </div></section>
  </div></main>;

 const [saved,following,token]=await Promise.all([savedEvents(user.id,30),followedSeries(user.id),calendarToken(user)]);
 const c=(await db.query("select cal_clicked_at,cal_clicked,cal_fetched_at,cal_client from users where id=$1",[user.id])).rows[0]||{};
 const cal={clickedAt:c.cal_clicked_at?.toISOString?.()||null,clicked:c.cal_clicked,fetchedAt:c.cal_fetched_at?.toISOString?.()||null,client:c.cal_client};
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York"}).format(new Date());
 const upcoming=saved.filter(r=>r.date>=today),past=saved.filter(r=>r.date<today).reverse();
 const feed=`${SITE.replace(/^https?:\/\//,"")}/cal/${token}.ics`;

 return <main className="detail">{head}
  <div className="detailWrap">
   <section className="detailCard"><div className="detailBody">
    <SignedInNote name={user.name}/>
    <h1>My GoToday</h1>
    <p className="lead">Hi{user.name?` ${user.name.split(" ")[0]}`:""}! Here's what you've saved and follow.</p>

    <section className="meSection">
     <h2>Your GoToday calendar</h2>
     <p className="muted">Subscribe once and every event you save or follow shows up in your calendar by itself, including next year's dates for events you follow. Changes and cancellations update too (Google Calendar checks for updates a few times a day; Apple Calendar more often).</p>
     <CalendarLinks feed={feed} initial={cal}/>
    </section>

    <section className="meSection">
     <h2>Saved <span className="count">{upcoming.length}</span></h2>
     {upcoming.length===0?<p className="muted">Nothing saved yet. Tap the ♡ on any event to save it here.</p>
     :<ul className="meList">{upcoming.map(r=><li key={r.id} className={r.cancelled?"cancelled":""}>
       <Link href={`/events/db-${r.id}`}><b>{r.cancelled?"Cancelled: ":""}{r.title}</b><span>{when(r)} · {r.venue||r.city}</span></Link>
       <SaveButton compact item={{id:`db-${r.id}`,title:r.title,date:r.date}}/>
      </li>)}</ul>}
     {past.length>0&&<details className="mePast"><summary>Recently passed ({past.length})</summary><ul className="meList">{past.map(r=><li key={r.id}>
       <Link href={`/events/db-${r.id}`}><b>{r.title}</b><span>{when(r)} · {r.venue||r.city}</span></Link></li>)}</ul></details>}
    </section>

    <section className="meSection">
     <h2>Following <span className="count">{following.length}</span></h2>
     {following.length===0?<p className="muted">Follow a festival, fair or yearly event from its page (the 🔔 Follow button) and we'll keep track of it for you, year after year.</p>
     :<ul className="meList">{following.map(f=><li key={f.seriesId}>
       {f.next?<Link href={`/events/db-${f.next.id}`}><b>{f.title}</b><span>Next: {when(f.next)} · {f.next.venue||f.next.city}</span></Link>
        :<div className="meNo"><b>{f.title}</b><span>Next date not announced yet{f.last?` · last time ${longDate(f.last.date)}`:""}. We'll add it as soon as it's listed.</span></div>}
       <Unfollow series={f.seriesId}/>
      </li>)}</ul>}
    </section>

    <div className="meFoot"><span>Signed in as <b>{user.email}</b></span><form action="/api/auth/signout" method="post"><button className="btn ghost small" type="submit">Sign out</button></form></div>
    <p className="authFine"><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></p>
   </div></section>
  </div></main>;
}
