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
/** The street part of a venue address: venues often store the full address ("1675 Market St,
 *  Weston, FL 33326") next to the town, so the street box and the suggestion line strip the
 *  town/state/zip tail instead of showing it twice. A clean street address passes through. */
export function streetOnly(address:string,city:string){
 const town=String(city||"").split(",")[0].trim(),full=String(city||"").trim();
 const parts=String(address||"").split(",").map(s=>s.trim()).filter(Boolean);
 const GEO=/^([A-Z]{2}(\s+\d{5}(-\d{4})?)?|\d{5}(-\d{4})?)$/; // "FL", "FL 33326", "33326"
 while(parts.length>1&&GEO.test(parts[parts.length-1]))parts.pop();
 while(parts.length>1&&!/\d/.test(parts[parts.length-1]))parts.pop(); // a trailing town name (even a different town)
 const out=parts.join(", ");
 if(out.toLowerCase()===full.toLowerCase()||(town&&out.toLowerCase()===town.toLowerCase()))return ""; // the address is just the town
 return out;
}
export type PlaceSuggestion={name:string;address:string;city:string};
const STREET_NAME=/^\d{2,6}\s+\S+.*\b(St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Ln|Lane|Dr|Drive|Way|Ct|Court|Pl|Place|Hwy|Highway|Ter|Terrace)\b/i;
/** Rank venue rows for the create form's place suggestions: the user's town first, then a
 *  name that starts with what they typed, then a name that contains it, then an address match.
 *  A bare street address ranks last (it's a place without a name). Dedupes by name+town. */
export function rankPlaceSuggestions(q:string,city:string,rows:PlaceSuggestion[]):PlaceSuggestion[]{
 const query=q.trim().toLowerCase();if(query.length<2)return[];
 const town=city.trim().toLowerCase().split(",")[0];
 // Only rows that actually match the typed text rank at all; the town is a bonus, not a pass.
 const matching=rows.filter(r=>{const name=r.name.trim().toLowerCase(),addr=(r.address||"").trim().toLowerCase();return name.includes(query)||addr.includes(query)});
 const scored=matching.filter(r=>r.name.trim()).map(r=>{
  const name=r.name.trim().toLowerCase(),addr=(r.address||"").trim().toLowerCase();
  let sc=name.startsWith(query)?5:name.includes(query)?3:1;
  if(town&&r.city.trim().toLowerCase().startsWith(town))sc+=10;
  if(STREET_NAME.test(r.name.trim()))sc-=2;
  return{...r,sc,hasAddr:!!r.address.trim()};
 }).sort((a,b)=>b.sc-a.sc||(b.hasAddr?1:0)-(a.hasAddr?1:0)||a.name.length-b.name.length);
 const seen=new Set<string>(),out:PlaceSuggestion[]=[];
 for(const r of scored){const k=`${r.name.trim().toLowerCase()}|${r.city.trim().toLowerCase()}`;if(seen.has(k))continue;seen.add(k);out.push({name:r.name,address:r.address,city:r.city});if(out.length>=8)break}
 return out;
}
/** The place an event shows, from all its listings (cards and event pages use this same choice): the most specific
 *  (street address > named place > town only), ties to the oldest listing; a bare street address takes the place name
 *  another listing gives ("Sanctuary Park" + "16290 Griffin Road"). */
export function choosePlace(list:Place[]):Place|null{
 const scored=list.filter(Boolean).map(p=>({p,sc:placeScore(p)})).sort((a,b)=>b.sc-a.sc||a.p.id-b.p.id);
 if(!scored.length)return null;
 const best={...scored[0].p};
 // "City of Boca Raton" + "1801 North Ocean Blvd": the street is the place; the city's own name isn't.
 if(isGenericVenue(best.venue,best.city,best.source)&&hasStreet(best.address))best.venue=String(best.address).split(",")[0].trim();
 if(/^\s*\d{2,6}\s/.test(best.venue||"")){
  const named=scored.find(x=>x.sc===2&&!/^\s*\d/.test(x.p.venue||""));
  if(named){best.address=best.address||best.venue;best.venue=named.p.venue}
 }
 return best;
}
