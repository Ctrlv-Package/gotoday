import type { EventRecord } from "./types";
export const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
export const stripHtml=(s:string)=>s.replace(new RegExp("<script[^>]*>[\\s\\S]*?</script>","gi")," ").replace(new RegExp("<style[^>]*>[\\s\\S]*?</style>","gi")," ").replace(new RegExp("<[^>]+>","g")," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'\"').replace(/\s+/g," ").trim();
export const dedupeKey=(e:EventRecord)=>[slug(e.title),slug(e.venue),e.date].join("|");
export function dedupe(events:EventRecord[]){const seen=new Set<string>();return events.filter(e=>{const k=dedupeKey(e);if(seen.has(k))return false;seen.add(k);return true})}
export function normalize(e:EventRecord):EventRecord{const free=e.isFree===true||/\bfree\b/i.test([e.priceText,e.desc,...e.tags].filter(Boolean).join(" "));const tags=Array.from(new Set([...(e.tags||[]),...(free?["Free"]:[])]));return{...e,title:e.title.trim(),venue:e.venue.trim(),city:e.city.trim(),tags,isFree:free,lastVerified:e.lastVerified||new Date().toISOString()}}
