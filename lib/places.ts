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
export type PlaceSuggestion={name:string;address:string;city:string;lat?:number|null;lon?:number|null};
const STREET_NAME=/^\d{2,6}\s+\S+.*\b(St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Ln|Lane|Dr|Drive|Way|Ct|Court|Pl|Place|Hwy|Highway|Ter|Terrace)\b/i;
/** Rank venue rows for the create form's place suggestions. Every word the user typed must
 *  appear somewhere in the row's name, address or town ("flying squirrel weston" matches
 *  "Flying Squirrel Trampoline Park" in Weston, where a whole-phrase search never would).
 *  The user's town ranks first, then a name that starts with the first word, then a name
 *  that contains it, then an address/town match. A bare street address ranks last (it's a
 *  place without a name). Dedupes by name+town. */
export function rankPlaceSuggestions(q:string,city:string,rows:PlaceSuggestion[],limit=8):PlaceSuggestion[]{
 const query=q.trim().toLowerCase();if(query.length<2)return[];
 const words=query.split(/\s+/).filter(Boolean),town=city.trim().toLowerCase().split(",")[0];
 const matching=rows.filter(r=>{
  const hay=`${r.name} ${r.address||""} ${r.city}`.toLowerCase();
  return words.every(w=>hay.includes(w));
 });
 const scored=matching.filter(r=>r.name.trim()).map(r=>{
  const name=r.name.trim().toLowerCase(),first=words[0];
  let sc=name.startsWith(first)?5:name.includes(first)?3:1;
  if(town&&r.city.trim().toLowerCase().startsWith(town))sc+=10;
  if(STREET_NAME.test(r.name.trim()))sc-=2;
  return{...r,sc,hasAddr:!!r.address.trim()};
 }).sort((a,b)=>b.sc-a.sc||(b.hasAddr?1:0)-(a.hasAddr?1:0)||a.name.length-b.name.length);
 const seen=new Set<string>(),out:PlaceSuggestion[]=[];
 for(const r of scored){const k=`${r.name.trim().toLowerCase()}|${r.city.trim().toLowerCase()}`;if(seen.has(k))continue;seen.add(k);out.push({name:r.name,address:r.address,city:r.city,...(r.lat!=null?{lat:r.lat}:{}),...(r.lon!=null?{lon:r.lon}:{})});if(out.length>=limit)break}
 return out;
}
// US state names -> abbreviations, so an outside result's "Weston, Florida" fills the City
// field in the site's "Weston, FL" form (the time-zone lookup reads the abbreviation).
const US_STATE_ABBR:Record<string,string>={Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",Colorado:"CO",Connecticut:"CT",Delaware:"DE","District of Columbia":"DC",Florida:"FL",Georgia:"GA",Hawaii:"HI",Idaho:"ID",Illinois:"IL",Indiana:"IN",Iowa:"IA",Kansas:"KS",Kentucky:"KY",Louisiana:"LA",Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",Minnesota:"MN",Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND",Ohio:"OH",Oklahoma:"OK",Oregon:"OR",Pennsylvania:"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",Virginia:"VA",Washington:"WA","West Virginia":"WV",Wisconsin:"WI",Wyoming:"WY"};
/** Outside (Photon) suggestions, cleaned up for the create form: drops results that are
 *  neither a street nor a town (a creek, a rock formation), and — when the form's City
 *  field names a town — keeps only results from that town, so a bare "Flying sq" doesn't
 *  bury the user's own town under Chicago and China. No town given: no town filter. */
export function filterOutsideSuggestions(rows:PlaceSuggestion[],city:string):PlaceSuggestion[]{
 const town=city.trim().toLowerCase().split(",")[0];
 return rows.filter(r=>{
  if(!r.address.trim()&&!r.city.trim())return false;
  if(!town)return true;
  return r.city.trim().toLowerCase().split(",")[0]===town;
 });
}
/** The query sent to Photon: the typed text plus the form's town, when one is given and not
 *  already typed. Photon ranks globally, and a bare "Flying" never returns the user's town
 *  even in 50 candidates — while "Flying Weston" puts its trampoline park first. */
export function photonQuery(q:string,city:string){
 const town=city.trim().split(",")[0].trim();
 if(!town||q.toLowerCase().includes(town.toLowerCase()))return q;
 return `${q} ${town}`;
}
/** A Photon (OpenStreetMap) feature -> the suggestion shape the create form fills. Null when
 *  the feature has no usable name. Outside the US the state name is kept as-is. */
export function photonSuggestion(f:any):PlaceSuggestion|null{
 const p=f?.properties;if(!p||!String(p.name||"").trim())return null;
 const street=[p.housenumber,p.street].filter(Boolean).join(" ").trim();
 const town=String(p.city||p.town||p.village||"").trim();
 const state=String(p.state||"").trim();
 const suffix=p.countrycode==="US"&&state?(US_STATE_ABBR[state]||state):state;
 const s:PlaceSuggestion={name:String(p.name).trim(),address:street,city:town&&suffix?`${town}, ${suffix}`:town};
 const gc=f?.geometry?.coordinates,glon=Array.isArray(gc)?Number(gc[0]):NaN,glat=Array.isArray(gc)?Number(gc[1]):NaN;
 if(Number.isFinite(glat)&&Number.isFinite(glon)){s.lat=glat;s.lon=glon}
 return s;
}
/** Great-circle distance in km between two points. */
export function haversineKm(aLat:number,aLon:number,bLat:number,bLon:number){
 const r=6371,dLa=(bLat-aLat)*Math.PI/180,dLo=(bLon-aLon)*Math.PI/180;
 const h=Math.sin(dLa/2)**2+Math.cos(aLat*Math.PI/180)*Math.cos(bLat*Math.PI/180)*Math.sin(dLo/2)**2;
 return 2*r*Math.asin(Math.sqrt(h));
}
/** Nearby ranking: rows with coordinates nearest-first; rows without coordinates keep
 *  their order at the end (they're never dropped — a venue without coordinates can still
 *  be the right pick). Stable: equal distances keep their input order. */
export function distanceRank(rows:PlaceSuggestion[],lat:number,lon:number):PlaceSuggestion[]{
 const withD=rows.map((r,i)=>({r,i,d:r.lat!=null&&r.lon!=null?haversineKm(lat,lon,r.lat,r.lon):null}));
 return withD.sort((a,b)=>(a.d==null?1:0)-(b.d==null?1:0)||(a.d??0)-(b.d??0)||a.i-b.i).map(x=>x.r);
}
/** "Near you" radius: 80 km covers the tri-county area (Weston to Miami is ~55 km, to
 *  Palm Beach ~70 km) while keeping Kissimmee, the Panhandle and Cuba out of a nearby list. */
export const NEARBY_RADIUS_KM=80;
/** The rows within km of a point, in input order. Rows without coordinates never qualify. */
export function withinRadiusKm(rows:PlaceSuggestion[],lat:number,lon:number,km:number):PlaceSuggestion[]{
 return rows.filter(r=>r.lat!=null&&r.lon!=null&&haversineKm(lat,lon,r.lat,r.lon)<=km);
}
/** Strict nearby list: distance-ranked, then only rows within km survive. When none
 *  qualify the list is empty — a far result must never pose as a nearby one. */
export function nearbyRank(rows:PlaceSuggestion[],lat:number,lon:number,km=NEARBY_RADIUS_KM):PlaceSuggestion[]{
 return withinRadiusKm(distanceRank(rows,lat,lon),lat,lon,km);
}
/** Merge suggestion lists from several sources, first source wins on duplicates
 *  (same place name in the same town, case-insensitive). */
export function mergeSuggestions(lists:PlaceSuggestion[][]):PlaceSuggestion[]{
 const seen=new Set<string>(),out:PlaceSuggestion[]=[];
 for(const list of lists)for(const s of list){
  const k=`${s.name.trim().toLowerCase()}|${s.city.trim().toLowerCase()}`;if(seen.has(k))continue;seen.add(k);out.push(s);
 }
 return out;
}
/** A TomTom Fuzzy Search result -> the suggestion shape. Only real POIs (type POI):
 *  streets, geographies and bare addresses are what the form's own Street box is for.
 *  The state name maps to its abbreviation through the same table Photon uses. */
export function tomtomSuggestion(r:any):PlaceSuggestion|null{
 if(!r||r.type!=="POI")return null;
 const name=String(r.poi?.name||"").trim();if(!name)return null;
 const a=r.address||{};
 const street=[a.streetNumber,a.streetName].filter(Boolean).join(" ").trim()||String(a.freeformAddress||"").trim();
 const town=String(a.municipality||"").trim();
 const stateRaw=String(a.countrySubdivision||"").trim();
 const suffix=stateRaw?(US_STATE_ABBR[stateRaw]||stateRaw):"";
 const s:PlaceSuggestion={name,address:street,city:town&&suffix?`${town}, ${suffix}`:town};
 const la=Number(r.position?.lat),lo=Number(r.position?.lon);
 if(Number.isFinite(la)&&Number.isFinite(lo)){s.lat=la;s.lon=lo}
 return s;
}
/** A Mapbox Geocoding v5 feature -> the suggestion shape. Only the name, street and
 *  town/state are used. The street comes from properties.address when present, else the
 *  first place_name segment after the name itself (place_name runs name, street, town,
 *  state, country). The town/state come from the context's place and region entries. */
export function mapboxSuggestion(f:any):PlaceSuggestion|null{
 const name=String(f?.text||"").trim();if(!name)return null;
 const props=f?.properties||{};
 let street=String(props.address||"").trim();
 const ctx=Array.isArray(f?.context)?f.context:[];
 const place=ctx.find((c:any)=>String(c?.id||"").startsWith("place."));
 const region=ctx.find((c:any)=>String(c?.id||"").startsWith("region."));
 const town=String(place?.text||"").trim();
 if(!street){
  const parts=String(f?.place_name||"").split(",").map((s:string)=>s.trim()).filter(Boolean);
  if(parts.length>1&&parts[0].toLowerCase()===name.toLowerCase())parts.shift();
  street=parts.length&&parts[0].toLowerCase()!==town.toLowerCase()?parts[0]:"";
 }
 const regCode=String(region?.short_code||"").trim();
 const suffix=regCode?regCode.split("-").pop()!:String(region?.text||"").trim();
 const s:PlaceSuggestion={name,address:street,city:town&&suffix?`${town}, ${suffix}`:town};
 const c=f?.center||f?.geometry?.coordinates;
 const lo=Array.isArray(c)?Number(c[0]):NaN,la=Array.isArray(c)?Number(c[1]):NaN;
 if(Number.isFinite(la)&&Number.isFinite(lo)){s.lat=la;s.lon=lo}
 return s;
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
