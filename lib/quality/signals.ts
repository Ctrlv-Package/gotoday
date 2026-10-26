// Shared "does this listing actually signal X" patterns, used by the quarantine gate (at ingest),
// the audit script (over live listings) and the tests. The family list intentionally mirrors the
// family-type list in lib/facets.ts (FAMILY_OUTING): if that list changes, this one must change too,
// because the point of the check is to catch a listing whose Family/Kids label has no such signal
// behind it (the "Yiddish Songs and Stories" class: open to everyone is not a family outing).

// What makes an "open to everyone" listing a family outing: a festival, Halloween, movie night,
// crafts, games, bingo, parade and so on (FAMILY_OUTING in lib/facets.ts, plus the remaining
// FAMILY words that still indicate a family outing: dogs, costumes, story time and the like).
// The list is deliberately aligned with facets.ts: the check fires on DIVERGENCE (a Family/Kids
// label granted some other way, e.g. by a round-up source's name), not on volume.
const FAMILY_OUTING=/\b(festivals?|fests?|fairs?|parades?|carnivals?|halloween|trunk[- ]or[- ]treat|pumpkins?|egg hunt|movie|movies|picnic|open house|block party|celebration|holiday|tree lighting|santa|games?|bingo|crafts?|lego|magic|puppets?|circus|zoo|animals?|nature|garden|beach|park|play|music in the park|concert in the park|fireworks|dogs?|pets?|pony|costume|boo|ween|oktoberfest|bow ?wow|bounce houses?|face painting|story ?time|playtime)\b/i;
const FAMILY_WORD=/\b(famil(y|ies)|kids|children|parents?|teens?|tweens?|youth|bab(y|ies)|toddlers?|preschool(ers)?|pre-k|homeschool|infants?)\b/i;

/** True when the listing itself says it's family-type: an outing word in title/desc, a
 *  family/kids/children tag (an age-based Kids tag counts: a kids' audience is a real signal),
 *  a kid word in the title/desc, or a kid word in the venue. The venue counts because the
 *  room/place is part of what the listing says: a program in a Children's Area is a family
 *  listing even when its title and description never say so. Only kid words count from the
 *  venue — a "park" or "garden" in a place name is not a family signal, so the outing list
 *  is deliberately not applied there. */
export function hasFamilySignal(title:string,desc?:string,tags?:string[],venue?:string){
 const text=`${title||""} ${desc||""}`;
 if(FAMILY_OUTING.test(text)||FAMILY_WORD.test(text))return true;
 if(venue&&FAMILY_WORD.test(venue))return true;
 return (tags||[]).some(t=>/^(family|families|kids|children)$/i.test(t.trim())||FAMILY_WORD.test(t));
}

const STREET_SUFFIX=/\b(St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Ln|Lane|Dr|Drive|Way|Ct|Court|Pl|Place|Hwy|Highway|Ter|Terrace|Cir|Circle|Trail|Blvd)\b/i;
/** True when the "venue" is a street address, not a place name ("2100 SW 154th Ave" as the venue
 *  means the place name was lost and only the address survived). */
export function looksLikeStreetAddress(venue?:string,address?:string){
 const v=(venue||"").trim();
 if(!v)return false;
 if(address&&v.toLowerCase()===address.trim().toLowerCase())return true;
 return /^\d{1,6}\s+\S/.test(v)&&STREET_SUFFIX.test(v);
}
