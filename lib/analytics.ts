/** Fire a GA4 custom event for the actions that matter: save, reminder, share, add to calendar,
 *  create, loved-it. The base tag lives in app/layout.tsx; this only fires when gtag loaded, and
 *  never throws — analytics must never break the page, and a blocked tag just means no event. */
declare global{interface Window{gtag?(...args:unknown[]):void}}
export function trackEvent(name:string){
 try{if(typeof window!=="undefined")window.gtag?.("event",name)}catch{/* analytics never breaks the page */}
}
