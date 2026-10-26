// Per-listing checks for the audit script (scripts/quality-audit.ts), over the same shape the
// public /api/events endpoint returns. Each check names a class of listing a visitor would see
// as wrong, not a code rule: the audit is the tripwire for the next silent heuristic failure.
import {BAD_TEXT,BAD_TITLE} from "../ingestion/validate";
import {CITY_SOURCE} from "../facets";
import {hasFamilySignal,looksLikeStreetAddress} from "./signals";

export type ApiEvent={id?:string;title:string;desc?:string;tags?:string[];facets?:string[];image?:string;venue?:string;address?:string;time?:string;url?:string;date?:string;source?:string;stockImage?:boolean};
export type FindingType="family-no-signal"|"venue-is-address"|"missing-time"|"missing-image"|"fails-validation";
export type AuditFinding={type:FindingType;eventId?:string;title:string;source?:string;detail?:string};

/** Finding codes for one live listing ("" means clean). The family check mirrors the quarantine
 *  gate: city sources grant Family broadly, so only libraries, Ticketmaster and round-ups are
 *  held to "Family must be said so". */
export function auditFindings(e:ApiEvent):AuditFinding[]{
 const out:AuditFinding[]=[];
 const facets=e.facets||[];
 if(!CITY_SOURCE(e.source)&&(facets.includes("Family")||facets.includes("Kids"))&&!hasFamilySignal(e.title,e.desc,e.tags,e.venue))
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
