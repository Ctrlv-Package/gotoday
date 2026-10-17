import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {currentUser,safeNext,googleConfigured} from "../../lib/auth";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Sign in — GoToday",robots:{index:false}};

export default async function SignIn({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const p=await searchParams,next=safeNext(p.next);
 if(await currentUser().catch(()=>null))redirect(next);
 const why=p.why==="follow"?"Sign in so we can remind you when this event is back next year. We'll add next year's date to My GoToday and your GoToday calendar as soon as it's announced."
  :"Keep your saved events on all your devices, get reminded when your favorite events come back next year, and get a personal calendar that fills itself.";
 return <main className="detail">
  <SiteHeader me={false}/>
  <div className="detailWrap narrow">
   <section className="detailCard authCard">
    <div className="detailBody">
     <h1>Sign in to GoToday</h1>
     <p className="lead">{why}</p>
     {p.error&&<p className="authErr" role="alert">{p.error}</p>}
     {googleConfigured()
      ?<a className="googleBtn" href={`/api/auth/google?next=${encodeURIComponent(next)}`}>
        <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        Continue with Google</a>
      :<p className="authErr">Sign-in is being set up. Please check back soon.</p>}
     <p className="authFine">We only get your name, email and profile picture from Google. GoToday can't see your Google Calendar, email or anything else, and we never post or send anything without asking.</p>
     <p className="authFine">Signing in is optional: searching, event pages and “Add to calendar” all work without an account. By continuing you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
    </div>
   </section>
  </div>
 </main>;
}
