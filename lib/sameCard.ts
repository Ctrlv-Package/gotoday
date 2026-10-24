// When two listings are the same real-world event (one card on the home page).
// The same event reaches us from a city calendar, the city's Instagram, round-up accounts and Ticketmaster, under
// slightly different titles ("Boo Bash" / "Boo Bash at ArtsPark", "Trunk-Or-Treat (Residents Only)" / "Villains vs.
// Superheroes Trunk or Treat"). Merging two different events is worse than showing one twice, so every rule needs the
// same day, and the looser rules need more agreement (same start time, same town, no conflicting place).
import {isGenericVenue} from "./places";

export type CardLike={title:string;date:string;time?:string;venue?:string;city?:string;source?:string;distanceMiles?:number;lat?:number|null;lng?:number|null};

const STOP=new Set(["the","and","of","a","at","in","on","for","with","to","annual","city","town","village","free","fl","event","events","day","night",
 "only","residents","resident","presents","present","join","us","our","your","2025","2026","2027","2028","edition","fun","family","community","celebration"]);
export const words=(t:string)=>new Set(t.toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").split(" ").filter(w=>w.length>2&&!STOP.has(w)));
const place=(x?:string)=>String(x||"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g," ").trim();
export const town=(x?:string)=>String(x||"").toLowerCase().replace(/^ft\.?\s/,"fort ").replace(/,.*$/,"").trim();
const flat=(t:string)=>t.toLowerCase().replace(/[^a-z0-9]+/g,"");
export const isIg=(e:{source?:string})=>/ · Instagram$/.test(e.source||"");
const partOf=(t:string)=>/^(opening|closing) reception|^vip\b|\bpreview\b|after ?party|pre-?show|meet (and|&) greet|costume contest/i.test(t);
const organizer=(e:CardLike)=>String(e.source||"").replace(/ · Instagram$/,"").toLowerCase();

const PLACE_WORDS=new Set(["park","parks","center","centre","library","branch","regional","community","recreation","complex","field","fields","stadium","arena","plaza","square","church","school","elementary","middle","high","county","city","town","village","beach","lake","lakes","north","south","east","west","central","memorial","civic","cultural","senior","athletic","sports","hall","theater","theatre","museum","gardens","garden","downtown","street","avenue","boulevard","island","florida"]);
/** Two named places that differ ("Pine Island Park" vs "Central Park") mean two events, whatever the titles say. */
function placesConflict(a:CardLike,b:CardLike){
 const ga=isGenericVenue(a.venue,a.city,a.source),gb=isGenericVenue(b.venue,b.city,b.source);
 if(ga||gb)return false;
 const pa=place(a.venue),pb=place(b.venue);
 if(pa===pb||pa.includes(pb)||pb.includes(pa))return false;
 const fa=pa.replace(/ /g,""),fb=pb.replace(/ /g,"");if(fa.includes(fb)||fb.includes(fa))return false;   // "deHoernle" / "de Hoernle"
 // One place, two names ("Countess de Hoernle Park" / "Countess deHoernle Spanish River Athletic Complex"): a shared
 // distinctive name word is the same place; generic words (park, center, library…) don't count.
 const name=(x:string)=>new Set(x.split(" ").filter(w=>w.length>=5&&!PLACE_WORDS.has(w)));
 const na=name(pa),nb=name(pb);for(const w of na)if(nb.has(w))return false;
 return true;
}

export function sameEventCard(a:CardLike,b:CardLike,W:(e:CardLike)=>Set<string>=e=>words(e.title)){
 if(a.date!==b.date||partOf(a.title)!==partOf(b.title))return false;   // an opening reception isn't a copy of its exhibit
 const wa=W(a),wb=W(b);let hit=0;for(const x of wa)if(wb.has(x))hit++;
 const fa=flat(a.title),fb=flat(b.title),contains=fa.length>=4&&fb.length>=4&&(fa.includes(fb)||fb.includes(fa));
 const timesOk=!a.time||!b.time||a.time===b.time,sameTime=!!a.time&&a.time===b.time;
 // (a) Same start time at the same venue, titles overlapping.
 if(sameTime&&place(a.venue)&&place(a.venue)===place(b.venue)&&(hit>=1||contains))return true;
 // (c) One source, one time, one title cut off ("Halloween Spooktacular Yard Decorating Contest Aw…").
 if(a.source===b.source&&a.time===b.time&&!placesConflict(a,b)&&fa.length>=10&&fb.length>=10&&(fa.startsWith(fb)||fb.startsWith(fa)))return true;
 if(!timesOk)return false;
 const sameTown=!!town(a.city)&&town(a.city)===town(b.city);
 // Near: the same town, or (towns differ or unknown) within a mile and a half of each other on the map.
 // Two towns' events are never "near" just because they're a similar distance from the person searching.
 const miles=a.lat!=null&&a.lng!=null&&b.lat!=null&&b.lng!=null?Math.hypot((a.lat-b.lat)*69,(a.lng-b.lng)*69*Math.cos(a.lat*Math.PI/180)):null;
 const bothTowns=!!town(a.city)&&!!town(b.city);
 const near=sameTown||(miles!=null?miles<1.5:!bothTowns&&typeof a.distanceMiles==="number"&&typeof b.distanceMiles==="number"&&Math.abs(a.distanceMiles-b.distanceMiles)<1);
 if(!near||placesConflict(a,b))return false;
 // (b) A post (Instagram) about an event listed elsewhere: same area, titles mostly match.
 if(isIg(a)||isIg(b)){
  const small=Math.min(wa.size,wb.size);
  if(!small?contains:contains||(hit>=Math.min(2,small)&&hit/small>=0.6))return true;
 }
 // (d) Same town, same start time, from two different listers (one of them a post or a listing without a real
 // place), sharing at least two meaningful title words: "Trunk-Or-Treat (Residents Only)" by the city and
 // "Villains vs. Superheroes Trunk or Treat" by its parks account, both 6 PM.
 const twoListers=organizer(a)!==organizer(b)||isIg(a)!==isIg(b);
 const loose=isIg(a)||isIg(b)||isGenericVenue(a.venue,a.city,a.source)||isGenericVenue(b.venue,b.city,b.source);
 if(sameTown&&sameTime&&hit>=2&&twoListers&&loose)return true;
 return false;
}
