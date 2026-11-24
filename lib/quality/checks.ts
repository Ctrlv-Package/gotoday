// Per-listing checks for the audit script (scripts/quality-audit.ts), over the same shape the
// public /api/events endpoint returns. Each check names a class of listing a visitor would see
// as wrong, not a code rule: the audit is the tripwire for the next silent heuristic failure.
import {BAD_TEXT,BAD_TITLE} from "../ingestion/validate";
import {CITY_SOURCE,FAMILY_SOURCE} from "../facets";
import {hasFamilySignal,looksLikeStreetAddress} from "./signals";

export type ApiEvent={id?:string;title:string;desc?:string;tags?:string[];facets?:string[];image?:string;venue?:string;address?:string;time?:string;url?:string;date?:string;source?:string;stockImage?:boolean};
export type FindingType="family-no-signal"|"venue-is-address"|"missing-time"|"missing-image"|"fails-validation"|"broken-image"|"duplicate-image";
export type AuditFinding={type:FindingType;eventId?:string;title:string;source?:string;detail?:string;image?:string;otherEventId?:string;eventIds?:string[]};

/** Finding codes for one live listing ("" means clean). The family check mirrors the quarantine
 *  gate: city sources grant Family broadly, so only libraries, Ticketmaster and round-ups are
 *  held to "Family must be said so". */
export function auditFindings(e:ApiEvent):AuditFinding[]{
 const out:AuditFinding[]=[];
 const facets=e.facets||[];
 if(!CITY_SOURCE(e.source)&&!FAMILY_SOURCE(e.source)&&(facets.includes("Family")||facets.includes("Kids"))&&!hasFamilySignal(e.title,e.desc,e.tags,e.venue))
  out.push({type:"family-no-signal",eventId:e.id,title:e.title,source:e.source});
 if(looksLikeStreetAddress(e.venue,e.address))
  out.push({type:"venue-is-address",eventId:e.id,title:e.title,source:e.source,detail:e.venue});
 if(!e.time)out.push({type:"missing-time",eventId:e.id,title:e.title,source:e.source});
 if(!e.image)out.push({type:"missing-image",eventId:e.id,title:e.title,source:e.source});
 const bad:string[]=[];
 if(!e.title||e.title.trim().length<4||e.title.length>140||BAD_TEXT.test(e.title)||BAD_TITLE.test(e.title.trim()))bad.push("title");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date||""))bad.push("date");
 if(e.time&&!/^\d{2}:\d{2}(:\d{2})?$/.test(e.time))bad.push("time");
 if(!e.venue||e.venue.length>120||BAD_TEXT.test(e.venue))bad.push("venue");
 if(!e.url||!/^https?:\/\//.test(e.url))bad.push("url");
 if(bad.length)out.push({type:"fails-validation",eventId:e.id,title:e.title,source:e.source,detail:bad.join(",")});
 return out;
}

/** Two different listings on one day's list sharing one photo: a card shows a photo that
 *  belongs to another event. (Library photos are shared on purpose across dates, but never
 *  between two different events on the same list.) The same listing twice — same title and
 *  venue — is not a duplicate. Any photo counts: a stored /img/ key or an external URL —
 *  the route re-picks either, so the audit must flag either, or the two disagree. One
 *  finding per shared photo, carrying the sorted set of ALL events sharing it: the finding's
 *  identity is the whole group, so it stays the same no matter which copy the list puts
 *  first (three events on one photo used to change identity when the order changed). */
export function duplicateImageFindings(events:ApiEvent[]):AuditFinding[]{
 const groups=new Map<string,ApiEvent[]>();
 for(const e of events){
  if(!e.image)continue;
  const g=groups.get(e.image);
  if(g)g.push(e);else groups.set(e.image,[e]);
 }
 const out:AuditFinding[]=[];
 for(const [image,evs] of groups){
  const first=evs[0];
  const others=evs.slice(1).filter(e=>!(e.title.toLowerCase()===first.title.toLowerCase()&&(e.venue||"").toLowerCase()===(first.venue||"").toLowerCase()));
  if(!others.length)continue;
  // Representative is the lowest event ID, not the first in list order, so the finding
  // itself — title, source, eventId — is stable too, not just its identity.
  const sorted=[first,...others].sort((a,b)=>(a.id||"").localeCompare(b.id||""));
  const rep=sorted[0],rest=sorted.slice(1);
  const ids=sorted.map(e=>e.id).filter((x):x is string=>!!x);
  out.push({type:"duplicate-image",eventId:rep.id,title:rep.title,source:rep.source,
   detail:`same photo as ${rest.map(e=>`"${e.title}" (${e.id||"?"})`).join(", ")}`,
   image,otherEventId:rest[0]?.id,eventIds:ids});
 }
 return out;
}

/** Listings whose stored picture is gone: the /img/ URL 404s, so the card falls back to the emoji
 *  tile. `broken` is the set of image URLs the audit fetched and found missing. */
export function brokenImageFindings(events:ApiEvent[],broken:Set<string>):AuditFinding[]{
 return events.filter(e=>e.image&&broken.has(e.image))
  .map(e=>({type:"broken-image",eventId:e.id,title:e.title,source:e.source,detail:e.image,image:e.image}));
}
