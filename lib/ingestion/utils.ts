import type { EventRecord } from "./types";
export const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
export const stripHtml=(s:string)=>s.replace(new RegExp("<script[^>]*>[\\s\\S]*?</script>","gi")," ").replace(new RegExp("<style[^>]*>[\\s\\S]*?</style>","gi")," ").replace(new RegExp("<[^>]+>","g")," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'\"').replace(/\s+/g," ").trim();
export const dedupeKey=(e:EventRecord)=>[slug(e.title),slug(e.venue),e.date].join("|");
export function dedupe(events:EventRecord[]){const seen=new Set<string>();return events.filter(e=>{const k=dedupeKey(e);if(seen.has(k))return false;seen.add(k);return true})}
export function normalize(e:EventRecord):EventRecord{const free=e.isFree===true||/\bfree\b/i.test([e.priceText,e.desc,...e.tags].filter(Boolean).join(" "));const tags=Array.from(new Set([...(e.tags||[]),...(free?["Free"]:[])]));return{...e,title:e.title.trim(),venue:e.venue.trim(),city:e.city.trim(),tags,isFree:free,lastVerified:e.lastVerified||new Date().toISOString()}}

const ROUTINE=/\b(after[- ]school|out[- ]of[- ]school|academy|league|season registration|open gym|fitness class|weekly class|practice|training session|club meeting|advisory board|commission meeting|gymnastics|cheerleading|cartwheel|ballet|dance class|swim lessons?|martial arts|karate|taekwondo|soccer skills|tennis lessons?|pickleball lessons?|instructional|class|course|lessons?|clinic|camp)\b/i;
const PROGRAM_SIGNAL=/\b(registration|register|enroll|enrollment|tuition|standard fee|per session|session fee|minimum of \w+ students?|ages? \d|eligibility|sections?|activity #|days?: (mon|tue|wed|thu|fri|sat|sun))\b/i;
const EVENTISH=/\b(festival|fest|fair|concert|show|performance|story ?time|storytelling|open house|field day|celebration|market|movie|screening|special event|exhibit|parade|carnival|holiday|family fun|nature walk|guided hike)\b/i;
export function isDiscoveryEvent(e:EventRecord){const s=[e.title,e.genre,e.desc,e.priceText,...(e.tags||[])].filter(Boolean).join(" ");if(EVENTISH.test(s))return true;if(ROUTINE.test(s)||PROGRAM_SIGNAL.test(s))return false;return true}
