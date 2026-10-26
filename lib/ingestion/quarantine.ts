// Quarantine: low-confidence ingested listings that must not publish on a guess. The gate checks
// the OUTPUT (what the card would show), not the rule that produced it, so it also catches a
// regression in a rule that was previously fixed (a Family label with no family signal behind it
// trips here even if facets.ts ever grants it again). Quarantined rows sit in events with
// status='quarantine' (public queries only read status='active') until an admin approves them.
import {facetsFor,CITY_SOURCE} from "../facets";
import {hasFamilySignal} from "../quality/signals";
import type {EventRecord} from "./types";

export const QUARANTINE_LABELS:Record<string,string>={
 "borrowed-image":"Picture borrowed from another post",
 "family-no-signal":"Family/Kids label with no family signal in the listing",
 // Retained only so rows held before the rule change still render: no new row gets this reason.
 "new-source":"First successful run of a new source",
};

/** Reason codes for holding this record, or [] to publish normally. Only flagged records hold:
 *  a new source's first events publish unless something is actually wrong with them, so the
 *  venue layer's first batches show up right away instead of waiting for a second read.
 *  City sources grant Family broadly by design ("fine to bring the kids"), so the
 *  family-signal check only applies to libraries, Ticketmaster and round-up accounts, where
 *  Family has to be said so. */
export function quarantineReasons(e:EventRecord):string[]{
 const out:string[]=[];
 if(e.imageBorrowed)out.push("borrowed-image");
 const f=facetsFor(e);
 if(!CITY_SOURCE(e.source)&&(f.includes("Family")||f.includes("Kids"))&&!hasFamilySignal(e.title,e.desc,e.tags,e.venue))out.push("family-no-signal");
 return out;
}
