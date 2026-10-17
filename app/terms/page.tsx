import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import type {Metadata} from "next";
export const metadata:Metadata={title:"Terms of Use — GoToday"};
const CONTACT=process.env.NEXT_PUBLIC_CONTACT_EMAIL||"hello@mygotoday.com";

export default function Terms(){
 return <main className="detail">
  <SiteHeader/>
  <div className="detailWrap narrow"><article className="detailCard legal"><div className="detailBody">
   <h1>Terms of Use</h1>
   <p className="muted">Last updated October 17, 2026</p>
   <p>By using GoToday (mygotoday.com) you agree to these terms. They're short on purpose.</p>

   <h2>What GoToday is</h2>
   <p>GoToday is a free guide to local events. Listings come from public sources such as city and county calendars, libraries, parks departments, venues' social media posts and ticketing sites, and from people who post their own events. We're not the organizer of the events listed.</p>

   <h2>Check before you go</h2>
   <p>We work hard to keep listings accurate, but dates, times, prices, ages and availability can change or be wrong, and events can be cancelled. Always confirm with the organizer's official page (linked on every event) before you go. GoToday isn't responsible for events themselves, for anything that happens at them, or for decisions made based on a listing.</p>

   <h2>Your account</h2>
   <ul>
    <li>Accounts are optional and free. Keep your sign-in to yourself; you're responsible for activity on your account.</li>
    <li>Your personal calendar link is private: don't publish it.</li>
    <li>We may suspend accounts that misuse the site (for example, automated scraping, spam or attempts to break it).</li>
   </ul>

   <h2>Events you post</h2>
   <p>If you post an event, it must be real, lawful and yours to share, with accurate details. We may edit or remove listings that are misleading, spam or inappropriate.</p>

   <h2>The service</h2>
   <p>GoToday is provided “as is”. We may change, pause or stop features at any time. To the extent the law allows, GoToday isn't liable for indirect or incidental damages arising from use of the site.</p>

   <h2>Contact</h2>
   <p>Questions or a listing that needs fixing? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. See also our <Link href="/privacy">Privacy Policy</Link>.</p>
  </div></article></div>
 </main>;
}
