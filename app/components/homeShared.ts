// Shared pieces of the home page: event shape, filter constants and the small
// pure helpers the card list uses. Split out of app/page.tsx (2026-10-20, #5)
// so the page component itself is readable top to bottom.
export type T=(s:string,v?:Record<string,string|number>)=>string;

export type EventItem={id?:string;title:string;city:string;venue?:string;date?:string;time?:string;image?:string;url?:string;category?:string;genre?:string;minPrice?:number|null;desc?:string;tags?:string[];emoji?:string;source?:string;distanceMiles?:number;distanceAccuracy?:string;ageMin?:number;ageMax?:number;registration?:string;moreLocations?:number;otherVenues?:string[];isFree?:boolean;facets?:string[];labels?:string[];live?:boolean};

export const AGE_BANDS:[string,number,number][]=[["All ages",0,99],["Babies & toddlers",0,2],["Preschool 3–5",3,5],["Ages 6–9",6,9],["Tweens 10–12",10,12],["Teens 13–17",13,17]];
// Interest chips combine with OR; "Free" and the More-filters options always narrow the results.
export const CHIPS=["All","Family","Kids","Adults","Free","Music","Arts & Theatre","Sports"];
export const SETTINGS=["Any","Indoor","Outdoor"];
export const AREAS:[string,string][]=[["Fort Lauderdale","33301"],["Weston","33326"],["Miami","33130"],["Boca Raton","33432"],["West Palm Beach","33401"],["Orlando","32801"],["Tampa","33602"],["St. Petersburg","33701"],["Manhattan","10001"],["Brooklyn","11201"]];
export const RANGES=[["today","Today"],["tomorrow","Tomorrow"],["weekend","Next Weekend"]] as const;
export const TIMES=["Any time","Morning","Afternoon","Evening"];
export const DEFAULT_ZIP="33326";

export function ageLabel(e:EventItem,t:T){if(e.ageMin==null||e.ageMax==null||e.ageMax>18)return"";return e.ageMax<=1?t("Babies"):t("Ages {a}–{b}",{a:e.ageMin,b:e.ageMax})}
export function fmt(d:string|undefined,t:string|undefined,tr:T,loc:string){if(!d)return tr("Date TBA");const day=new Intl.DateTimeFormat(loc,{weekday:"short",month:"short",day:"numeric"}).format(new Date(d+"T12:00:00"));if(!t)return day+" · "+tr("All day");return day+" · "+new Intl.DateTimeFormat(loc,{hour:"numeric",minute:"2-digit"}).format(new Date(d+"T"+t))}
// Search text: lowercase, no punctuation, and simple word endings dropped, so "chilling" finds "Chillin'"
// and "festivals" finds "Festival".
export function norm(t:string){return t.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/['’]/g,"").replace(/[^a-z0-9]+/g," ").split(" ").map(w=>w.length>4?w.replace(/ing$/,"in").replace(/(?<!s)s$/,""):w).join(" ").trim()}
// Days for the "Pick a day" menu: the 21 days after tomorrow, in Eastern time.
export function upcomingDays(){
 const p=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const g=(t:string)=>p.find(x=>x.type===t)?.value||"",base=new Date(`${g("year")}-${g("month")}-${g("day")}T12:00:00Z`);
 return Array.from({length:21},(_,i)=>{const d=new Date(base);d.setUTCDate(d.getUTCDate()+i+2);return d.toISOString().slice(0,10)});
}
export function dayLabel(d:string,kind:"weekday"|"date"|"full",loc:string){const x=new Date(d+"T12:00:00Z");
 const s=kind==="weekday"?x.toLocaleDateString(loc,{weekday:"short",timeZone:"UTC"}):kind==="date"?x.toLocaleDateString(loc,{month:"short",day:"numeric",timeZone:"UTC"}):x.toLocaleDateString(loc,{weekday:"long",month:"short",day:"numeric",timeZone:"UTC"});
 return s.charAt(0).toUpperCase()+s.slice(1)}
export function nextWeekendLabel(loc:string){
 const p=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const g=(t:string)=>p.find(x=>x.type===t)?.value||"",base=new Date(`${g("year")}-${g("month")}-${g("day")}T12:00:00Z`);
 const day=base.getUTCDay(),n=day===6?7:(6-day+7)%7||7,sat=new Date(base);sat.setUTCDate(sat.getUTCDate()+n);const sun=new Date(sat);sun.setUTCDate(sun.getUTCDate()+1);

 const m=(d:Date)=>d.toLocaleDateString(loc,{month:"short",timeZone:"UTC"}).replace(/\.$/,"");
 return m(sat)===m(sun)?`${m(sat)} ${sat.getUTCDate()}–${sun.getUTCDate()}`:`${m(sat)} ${sat.getUTCDate()} – ${m(sun)} ${sun.getUTCDate()}`;
}
// Every event opens its GoToday page (Ticketmaster ones too); the card's Tickets button still goes straight to Ticketmaster.
export function detailHref(e:EventItem){return e.source==="GoToday Community"&&e.url?e.url:e.id?"/events/"+encodeURIComponent(e.id):(e.url||"#")}
// Card art. Photos close to the card's shape fill it; flyers, posters and odd crops are shown whole
// over a blurred copy of themselves, so nothing important (faces, text) gets cut off.
export function fitPic(img:HTMLImageElement){const r=img.naturalWidth/(img.naturalHeight||1);img.parentElement?.classList.toggle("whole",!(r>1.45&&r<2.1))}
// No image: a themed tile picked from what the event is about, same size as a photo.
export const ART:[RegExp,string,string][]=[
 [/story ?time|book|librar|read|author|poet|writ/i,"📚","linear-gradient(135deg,#e0e7ff,#ede9fe)"],
 [/music|concert|jazz|band|orchestra|sing|choir|dj|piano|guitar/i,"🎵","linear-gradient(135deg,#fce7f3,#ede9fe)"],
 [/art|paint|craft|draw|exhibit|museum|gallery|photo/i,"🎨","linear-gradient(135deg,#fef3c7,#fce7f3)"],
 [/lego|stem|science|code|coding|robot|tech|computer|maker/i,"🧪","linear-gradient(135deg,#cffafe,#e0e7ff)"],
 [/yoga|fitness|run|5k|walk|sport|soccer|basket|swim|tennis|pickle|golf/i,"🏃","linear-gradient(135deg,#dcfce7,#cffafe)"],
 [/market|farmer|food|cook|bake|taste|wine|beer|brunch/i,"🧺","linear-gradient(135deg,#ffedd5,#fef3c7)"],
 [/movie|film|cinema|screening/i,"🎬","linear-gradient(135deg,#e5e7eb,#e0e7ff)"],
 [/game|chess|trivia|bingo|puzzle|video ?game/i,"🎲","linear-gradient(135deg,#ede9fe,#cffafe)"],
 [/garden|nature|park|hike|bird|beach|outdoor|eco|plant/i,"🌿","linear-gradient(135deg,#dcfce7,#fef9c3)"],
 [/baby|toddler|kid|child|family|teen|tween/i,"🧸","linear-gradient(135deg,#fef3c7,#dcfce7)"],
 [/dance|ballet|salsa|zumba/i,"💃","linear-gradient(135deg,#fce7f3,#ffedd5)"],
 [/history|civic|scavenger|tour|heritage|lecture|class|workshop|learn/i,"🏛️","linear-gradient(135deg,#e0e7ff,#dcfce7)"],
 [/halloween|pumpkin|trick|costume/i,"🎃","linear-gradient(135deg,#ffedd5,#ede9fe)"],
 [/festival|party|celebrat|parade|fair|oktoberfest/i,"🎉","linear-gradient(135deg,#fce7f3,#fef3c7)"],
];
export function artFor(e:EventItem){const t=`${e.title} ${e.category||""} ${e.genre||""} ${(e.tags||[]).join(" ")}`;
 const hit=ART.find(([re])=>re.test(t));return hit?{icon:hit[1],bg:hit[2]}:{icon:"📍",bg:"linear-gradient(135deg,#ede9fe,#fce7f3)"}}
export const store={get:(k:string)=>{try{return localStorage.getItem(k)}catch{return null}},set:(k:string,v:string)=>{try{localStorage.setItem(k,v)}catch{}}};
