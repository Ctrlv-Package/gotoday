// One rule for an event's location, used by the cards and the event pages (like lib/pictures for photos).
// Listings of the same event disagree: an Instagram post may name the park and its street address, a round-up only the
// park, and another post nothing at all (then it falls back to the account's own default, often its town hall).
// The most specific wins: a street address, then a named place, then just the town / the account itself.
const TOWNISH=/^(the\s+)?(town|city|village)\s+of\s+|^downtown\s*$|^(online|tba|tbd|various locations?|multiple locations)$/i;
const norm=(x:string)=>String(x||"").toLowerCase().replace(/&/g,"and").replace(/,.*$/,"").replace(/[^a-z0-9]+/g," ").trim();
export function isGenericVenue(venue:string|null|undefined,city:string|null|undefined,source?:string|null){
 // The account's own name only counts as "no place" for town/city/parks accounts (a venue's own account is a place).
 const src=String(source||"").replace(/ · Instagram$/,""),v=norm(venue||""),c=norm(city||""),acct=norm(src);
 const civic=TOWNISH.test(src)||/\b(parks|recreation|rec)\b/i.test(src);
 return !v||TOWNISH.test(String(venue||"").trim())||v===c||v===c.replace(/^fort /,"ft ")||(civic&&!!acct&&v===acct);
}
export const hasStreet=(x?:string|null)=>/\b\d{2,6}\s+[a-z]/i.test(String(x||""));
/** 3 = street address, 2 = a named place, 0 = only the town or the account's default. */
export function placeScore(p:{venue?:string|null;address?:string|null;city?:string|null;source?:string|null}){
 if(hasStreet(p.address)||hasStreet(p.venue))return 3;
 return isGenericVenue(p.venue,p.city,p.source)?0:2;
}

export type Place={id:number;venue?:string|null;address?:string|null;city?:string|null;source?:string|null;lat?:number|null;lng?:number|null};
/** The place an event shows, from all its listings (cards and event pages use this same choice): the most specific
 *  (street address > named place > town only), ties to the oldest listing; a bare street address takes the place name
 *  another listing gives ("Sanctuary Park" + "16290 Griffin Road"). */
export function choosePlace(list:Place[]):Place|null{
 const scored=list.filter(Boolean).map(p=>({p,sc:placeScore(p)})).sort((a,b)=>b.sc-a.sc||a.p.id-b.p.id);
 if(!scored.length)return null;
 const best={...scored[0].p};
 if(/^\s*\d{2,6}\s/.test(best.venue||"")){
  const named=scored.find(x=>x.sc===2&&!/^\s*\d/.test(x.p.venue||""));
  if(named){best.address=best.address||best.venue;best.venue=named.p.venue}
 }
 return best;
}
