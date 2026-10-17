import Link from "next/link";
import type {Metadata} from "next";
export const metadata:Metadata={title:"Privacy Policy — GoToday"};
const CONTACT=process.env.NEXT_PUBLIC_CONTACT_EMAIL||"hello@mygotoday.com";

export default function Privacy(){
 return <main className="detail">
  <header className="detailHeader"><div className="detailWrap row"><Link href="/?fresh=1" className="detailLogo">Go<span>Today</span></Link><Link href="/" className="backLink">Back to events</Link></div></header>
  <div className="detailWrap narrow"><article className="detailCard legal"><div className="detailBody">
   <h1>Privacy Policy</h1>
   <p className="muted">Last updated October 17, 2026</p>
   <p>GoToday (mygotoday.com) helps you find local events. You can use the whole site — searching, event pages, sharing and “Add to calendar” — without an account. This page explains what we collect and why, in plain language.</p>

   <h2>If you don't sign in</h2>
   <ul>
    <li><b>ZIP code or location:</b> used only to show events near you. If you tap “Use my location”, your browser shares an approximate position with the page for that search; we don't store it.</li>
    <li><b>Saved events:</b> kept in your own browser on that device, not on our servers.</li>
    <li><b>Analytics:</b> we use Google Analytics to count visits and see which pages are useful (for example, how many people searched). It uses cookies and doesn't identify you by name.</li>
   </ul>

   <h2>If you create an account</h2>
   <ul>
    <li><b>From Google sign-in:</b> your name, email address and profile picture. That's all we ask Google for. We can't see your Google password, Gmail, Google Calendar or any other Google data.</li>
    <li><b>What you do on GoToday:</b> the events you save and follow, so we can show them on every device, add them to your personal calendar and keep track of events that come back each year.</li>
    <li><b>Your personal calendar link:</b> a private, random web address that calendar apps use to show your saved events. Anyone who has the link can see those events, so keep it to yourself. You can replace it with a new one at any time from My GoToday.</li>
    <li><b>Sign-in cookie:</b> a cookie that keeps you signed in on that browser. We store only a scrambled version of it.</li>
   </ul>

   <h2>What we don't do</h2>
   <ul>
    <li>We don't sell or rent your personal information, and we don't share it with advertisers.</li>
    <li>We don't send you marketing emails. If we add email reminders, they'll be optional, and every email will have a one-click way to stop them.</li>
    <li>We don't post anything anywhere on your behalf.</li>
   </ul>

   <h2>Who helps us run GoToday</h2>
   <p>Like most websites, we rely on a few service providers to operate: Vercel (hosting), Neon (database), Google (sign-in and analytics) and, for reading event flyers posted by cities and venues, Anthropic's AI service (it reads public event posts, never your personal information). They handle data only to provide their service to us.</p>

   <h2>Keeping or deleting your data</h2>
   <p>Your account information stays until you ask us to delete it. To delete your account and everything saved with it, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> from the address you signed in with, and we'll remove it within 30 days. You can stop using your calendar link at any time by unsubscribing in your calendar app or making a new link.</p>

   <h2>Children</h2>
   <p>GoToday lists many family events, but accounts are meant for adults (18+). We don't knowingly create accounts for children under 13.</p>

   <h2>Changes and questions</h2>
   <p>If this policy changes, we'll update the date at the top. Questions? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
  </div></article></div>
 </main>;
}
