import type {Metadata} from "next";

export const metadata: Metadata = {title: "You're offline — GoToday"};

// Shown by the service worker when a page can't be reached and no saved copy exists.
export default function Offline() {
  return (
    <main className="content" style={{paddingTop: 48}}>
      <div className="notice">
        <h1 style={{marginTop: 0}}>You&rsquo;re offline</h1>
        <p>GoToday needs a connection to find what&rsquo;s happening near you today. Check your signal and try again — pages you already opened may still be saved on this device.</p>
        <p><a href="/">Back to GoToday</a></p>
      </div>
    </main>
  );
}
