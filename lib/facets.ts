// One consistent reading of "what is this event" for the filter chips, whatever the source.
// Sources label things very differently (libraries: "Tween (8-12)", "Performances - Dance, Concerts &
// Theater"; city calendars: "Arts & Theatre" on a farmers market; Instagram: "Kids" on a 5K walk), so the
// chips can't trust raw tags. Facets come from the title and description first, then from tags that mean
// something reliable.

export type Facet="Family"|"Kids"|"Adults"|"Music"|"Arts & Theatre"|"Sports"|"Free";
type In={title:string;desc?:string;tags?:string[];category?:string;genre?:string;source?:string;ageMin?:number|null;ageMax?:number|null;isFree?:boolean;priceText?:string};

const has=(re:RegExp,...xs:(string|undefined)[])=>xs.some(x=>!!x&&re.test(x));

const MUSIC=/\b(music(al)?|concerts?|concierto|jazz|blues|band|orchestra|symphony|philharmonic|choir|chorus|choral|sing(ing|-?along)?|songs?|dj|tunes|guitar|piano|ukulele|violin|drums?|drumming|daiko|karaoke|open mic|recital|mariachi|salsa night|hip[- ]hop|reggae|rock|opera)\b/i;
const ARTS=/\b(art|arts|artists?|artwork|paint(ing)?|draw(ing)?|sketch|crafts?|crafting|exhibit(ion)?|gallery|museum|theat(re|er)|musical|ballet|dance|dancing|film|movies?|cinema|screening|poetry|poets?|sculpt\w*|pottery|ceramics?|photograph\w*|perler|beading|knit\w*|crochet|sewing|quilt\w*|mola|alebrije|mural|comedy|improv|puppet\w*|calligraphy|origami|watercolor|creative writing)\b/i;
const ART_TAGS=/^(arts? & cultural|exhibit|crafting\/makers|arts & crafts|performances|art|theat(re|er)|dance)$|^performances/i;
const SPORTS=/\b(sports?|football|soccer|baseball|softball|basketball|volleyball|tennis|pickleball|golf|hockey|lacrosse|rugby|cricket|swim(ming)?|aquatics?|5k|10k|fun run|run|running|race|marathon|triathlon|bike|biking|cycling|ride|yoga|zumba|pilates|fitness|workout|boot ?camp|karate|martial arts|taekwondo|jiu[- ]?jitsu|boxing|kayak\w*|paddle\w*|skate\w*|sluggers|tee[- ]?ball|t-ball|bowling|archery|fishing|walk(ing)? club)\b/i;
const NOT_SPORTS=/\b(board games?|video games?|gaming|minecraft|trivia)\b/i;
const KIDS=/\b(kids?|children'?s?|child|toddlers?|bab(y|ies)|infants?|preschool(ers)?|pre-k|storytimes?|story time|tweens?|teens?|youth|junior|jr\.?|lil|little ones|homeschool|camp|lego|perler|minecraft|sensory (play|bins?|time|story ?time|friendly story\w*))\b/i;
const KID_TAGS=/^(kids|children|toddlers|preschool|babies|tweens?|teens?|young adult|storytime|story time|tween \(|children \(|youth)/i;
const FAMILY=/\b(famil(y|ies)|all ages|everyone|kids|children|parents?|festivals?|fests?|fairs?|parades?|carnivals?|halloween|trunk[- ]or[- ]treat|pumpkin|egg hunt|movie night|movie in the park|open house|celebration|block party|oktoberfest|bow ?wow|ween|boo|costume|dogs?|pets?|petting zoo|pony|zoo|petting|picnic|santa|tree lighting|fireworks)\b/i;
const KID_EVENT=/\b(trunk[- ]or[- ]treat|trick[- ]or[- ]treat\w*|egg hunts?|petting zoo|pony rides?|santa|pumpkin patch|bounce houses?|face painting|kids?'? (zone|area|corner|activities)|children'?s (activities|area)|puppet\w*|story ?time|magic show|character meet)\b/i;
const FAMILY_TAGS=/^(family|families|all ages|everyone)$/i;
const ADULT=/\b(adults?|21\+|18\+|seniors?|older adults|55\+|50\+|wine|beer|brew(ery|ing)?|cocktails?|margarita|happy hour|bar crawl|pub|networking|career|job fair|resume|medicare|retirement|wealth|investing|taxes|estate planning|book club|singles|ladies night|date night)\b/i;
const ADULT_TAGS=/^(adults?|adult \(|new adults|older adults|seniors|21\+|18\+)/i;

/** The listing says it costs money: a "Paid" mark (the flyer reading found a price), a price, or a $ amount. */
export function isPaid(e:In){
 const tags=e.tags||[];
 if(tags.some(t=>/^paid$/i.test(t.trim())))return true;
 // A title that says FREE outweighs a ticketing site's fee field (Ticketmaster lists $1–2 fees on free shows).
 const words=`${e.title||""} ${e.desc||""}`;
 if(/(^|[\s:–-])free\b/i.test(e.title||"")&&!/\$\s?[1-9]/.test(words))return false;
 const txt=`${e.title||""} ${e.priceText||""} ${e.desc||""}`;
 return /\$\s?[1-9]\d*(\.\d\d)?\b/.test(txt)&&!/\$\s?\d+[^.]{0,40}\b(parking|donation|suggested|optional|raffle|food|drinks?|vendors?)\b/i.test(txt)&&!/\bfree (admission|entry|event)\b/i.test(txt);
}

/** Ages inferred only from a bare "Kids" label are a guess (5–11), not information. */
export function cleanAges(e:In):{ageMin?:number;ageMax?:number}{
 const min=e.ageMin??undefined,max=e.ageMax??undefined;
 if(min===5&&max===11&&!has(/\b(ages?|grades?|years? old|school[- ]age|elementary)\b/i,e.title,e.desc)&&!(e.tags||[]).some(t=>/children \(|school/i.test(t)))return{};
 if(min===0&&max===99)return{};
 return{ageMin:min,ageMax:max};
}

/** The kids' age range an event is for, as far as we can tell: stated ages first, then words in the title
 *  ("toddler", "teen"...). null = no age given, so it's for kids of any age (a family festival, chalk art day). */
export function kidAgeRange(e:In):[number,number]|null{
 const {ageMin,ageMax}=cleanAges(e);
 if(ageMin!=null||ageMax!=null)return[ageMin??0,ageMax??17];
 const t=e.title||"";
 if(/\b(bab(y|ies)|infants?|toddlers?|lapsit|lap sit)\b/i.test(t))return[0,3];
 if(/\b(preschool(ers)?|pre-?k|storytimes?|story time)\b/i.test(t))return[0,5];
 if(/\btweens?\b/i.test(t))return[10,12];
 if(/\bteens?\b/i.test(t))return[13,17];
 return null;
}

/** Indoors or outdoors, from what the event is (a 5K, a festival) first, then where it is. undefined = can't tell. */
const OUT_WHAT=/\b(5k|10k|fun run|run(ning)?|walk(athon)?|race|trot|dash|marathon|triathlon|parade|fireworks|festival|fest|fair|carnival|farmers market|market|pumpkin patch|hayrides?|trunk[- ]or[- ]treat|block party|egg hunt|food trucks?|movie (in|at) the park|moonlight movie|kayak\w*|paddle\w*|bike ride|fishing|camping|hike|hiking|nature walk|outdoors?|picnic|beach clean ?up|car show|golf|soccer|baseball|softball|flag football|regatta|boat parade)\b/i;
const OUT_WHERE=/\b(park|parks|beach|trail|garden|gardens|farm|stables|lake|nature (area|center|preserve)|natural area|preserve|amphithea\w*|pier|marina|campground|field|fields|plaza|promenade|boulevard|blvd|street|stadium|ranch|ranches|sanctuary|pool|splash pad|zoo|outdoors?)\b/i;
const IN_WHERE=/\b(library|branch|museum|theat(re|er)|gallery|auditorium|room|indoors?|studio|mall|arena|hall|center|centre|church|school|cinema|bowling|skating rink|ice rink)\b/i;
export function settingFor(e:{title?:string;venue?:string;source?:string;desc?:string}):"Indoor"|"Outdoor"|undefined{
 const t=e.title||"",v=e.venue||"";
 if(/\bindoors?\b/i.test(t))return"Indoor";
 if(/\b(in the park|at the park|outdoors?)\b/i.test(t))return"Outdoor";
 const lib=!/\bpark\b/i.test(v)&&(/library/i.test(e.source||"")||/\b(library|branch)\b/i.test(v));
 if(OUT_WHAT.test(t)&&!(lib&&!/\b(outdoors?|garden|nature walk|in the park)\b/i.test(t)))return"Outdoor";
 if(lib)return"Indoor";
 if(OUT_WHERE.test(v)&&!/\b(arena|theat(re|er)|museum|mall)\b/i.test(v))return"Outdoor";
 if(/\b(in the park|at the park|outdoors?)\b/i.test(t))return"Outdoor";
 if(IN_WHERE.test(v)||IN_WHERE.test(t))return"Indoor";
 return undefined;
}

// City, town and parks sources (not libraries, Ticketmaster or round-up accounts that repost anyone's events).
const CITY_SOURCE=(s?:string)=>!!s&&s!=="Ticketmaster"&&!/library/i.test(s)&&!/^(Miami Residents|Weekend Broward|The Broward Scene|To Do with Kids (Broward|Miami)) · Instagram$/.test(s);

// Ticket/admission rules ("Children 2 and older must have a ticket", "Kids under 3 free on a lap") say who needs a
// ticket, not who the event is for, so they never make an event a Kids or Family event.
const POLICY=/\b(tickets?|admission|admitted|on (a|an adult'?s?|their parent'?s?) lap|regardless of age|must (be accompanied|have|purchase)|accompanied by)\b/i;
// "No one under 18 admitted", "Children under 13 are not admitted", "Adults only": not for kids, wherever it's listed.
// ("No children under 3" still welcomes older kids, so the cut-off has to be 13 or more.)
const noKids=(d:string)=>/\badults only\b|\b(guests|attendees|patrons|everyone) must be (18|21)\b/i.test(d)||
 [...d.matchAll(/\b(?:no (?:one|children|kids|minors) under (?:the age of )?(\d+)|(?:children|kids|minors|guests|patrons)[^.]{0,30}under (?:the age of )?(\d+)[^.]{0,20}(?:not|won'?t be) (?:be )?(?:admitted|allowed|permitted))/gi)].some(m=>Number(m[1]||m[2])>=13);
const aboutText=(d:string)=>d.split(/(?<=[.!?])\s+/).filter(x=>!(POLICY.test(x)&&/\b(child(ren)?|kids?|infants?|bab(y|ies)|ages?|minors?|everyone|all patrons)\b/i.test(x))).join(" ");
export function facetsFor(e:In):Facet[]{
 // Ticketmaster's text is the venue's notes (parking, memberships, ticket rules), not about the show: its own
 // category, the title and stated ages decide there.
 const tags=e.tags||[],t=e.title||"",d=e.source==="Ticketmaster"?"":aboutText((e.desc||"").slice(0,600)),text=`${t} ${d}`;
 const {ageMin,ageMax}=cleanAges(e);
 const tagHas=(re:RegExp)=>tags.some(x=>re.test(x.trim()));
 const out=new Set<Facet>();

 // Music / Arts / Sports: title first, then description, then trustworthy tags.
 if(has(MUSIC,t)||(has(MUSIC,d)&&!has(/\b(no music|music (is )?not)\b/i,d))||tagHas(/concerts|music/i))out.add("Music");
 const marketish=/\b(market|bazaar|sale|garage|fair|expo|walk|run|5k|giveaway|food distribution|drive)\b/i.test(t);
 if(has(ARTS,t)||tagHas(ART_TAGS)||(e.category==="Arts & Theatre"&&!marketish&&(e.source==="Ticketmaster"||out.has("Music")||has(ARTS,d))))out.add("Arts & Theatre");
 if(out.has("Music")&&e.source==="Ticketmaster")out.add("Arts & Theatre");
 if(!has(NOT_SPORTS,t)&&(has(SPORTS,t)||tagHas(/^sports$/i)||e.category==="Sports"))out.add("Sports");

 // Who it's for.
 const adultOnly=(ageMin!=null&&ageMin>=18)||noKids(e.desc||"");
 const kidAges=ageMax!=null&&ageMax<=17;
 const kids=!adultOnly&&(kidAges||/^to do with kids/i.test(e.source||"")||has(KIDS,t)||tagHas(KID_TAGS)&&!tagHas(/^local$/i)||(has(KIDS,d)&&!has(ADULT,t)));
 // Big family events (festivals, open houses, Halloween, "all ages") are great for kids too.
 // Kids = made for children, or built around things children come for (trick-or-treating, egg hunt, petting zoo,
 // Santa…). A market, plant sale, exhibit or block party that families may attend is Family, not Kids.
 const kidEvent=!adultOnly&&!has(ADULT,t)&&(has(KID_EVENT,t)||has(KID_EVENT,d)||(e.source==="Ticketmaster"&&e.category==="Family"));
 if(kids||kidEvent)out.add("Kids");
 // Family = fine to bring the kids. Adult-themed titles never count; city and parks events count
 // unless they say otherwise; libraries and Ticketmaster have to say so.
 const adultish=has(ADULT,t);
 if(!adultOnly&&!adultish&&(kids||has(FAMILY,t)||tagHas(FAMILY_TAGS)&&!tagHas(ADULT_TAGS)||tagHas(/^families$|^everyone$|^all ages$/i)||has(/\b(famil(y|ies)|all ages|kids|children)\b/i,d)||(CITY_SOURCE(e.source)&&!has(ADULT,d)&&!out.has("Music")&&!/\b(meeting|commission|board|council|workshop|seminar|class)\b/i.test(t))))out.add("Family");
 if(adultOnly||has(ADULT,t)||tagHas(ADULT_TAGS)||(ageMin!=null&&ageMin>=13&&!kidAges))out.add("Adults");

 // Free: said so, or a public community event from a city, county, parks department or library that
 // mentions no price, tickets or fees (those are free in practice). Ticketed venues never count.
 const gov=/^(city|town|village) of\b|county\b|\bparks\b|parks & rec|library|libraries|nyc parks/i.test(e.source||"");
 const priced=/\$\s?\d|\btickets?\b|\badmission\b|\bfees?\b|\bcost\b|\bprice\b|\bpurchase\b|\bpaid\b|\bper person\b/i.test(`${t} ${e.desc||""}`);
 // The title says so ("FREE Record release show", "Free Family Movie Night") — not "gluten-free" or "kids eat free".
 const freeTitle=/(^|[\s:–-])free\b(?![- ](style|agent|form|lance|dom|range|play\b))/i.test(t)&&!/\b(gluten|sugar|dairy|alcohol|smoke|tax|fee|cruelty|hands)[- ]free\b|\beat(s)? free\b|\bfree (with|for kids with) (purchase|paid|adult)/i.test(t);
 // A listing that shows a price isn't free, whatever a "no price mentioned" guess would say.
 // A stated cost that isn't "free" ("Varies", "Fees apply", "See website") means it isn't free, even without a $ amount.
 const pt=(e.priceText||"").trim(),costNotFree=!!pt&&!/\bfree\b|no (cost|charge)/i.test(pt)&&!/(^|[\s:–-])free\b/i.test(t);
 const paid=isPaid(e)||costNotFree;
 const freeSaid=/\bfree (admission|entry|to attend|and open to (the|all)|for (all|everyone|the public|families|kids|children))\b|\b(admission|entry) is free\b|\bno (cost|charge|admission)\b|\bat no cost\b/i.test(`${t} ${e.desc||""}`);
 if(!paid&&(e.isFree||tagHas(/^free$/i)||freeTitle||freeSaid)||!paid&&(gov&&e.source!=="Ticketmaster"&&!priced&&!tagHas(/^tickets$/i)))out.add("Free");
 return[...out];
}

/** Placeholder or empty labels some calendars send ("Event Category Here", "Uncategorized"): never shown or kept. */
export const junkTag=(t:string)=>/^\s*(event category( here)?|category( here)?|uncategorized|no category|default|tbd|tba|n\/a|none|null|undefined|test|tag ?\d*|select( a)? category)\s*$/i.test(t||"");

/** Tags worth showing on a card: no audience labels, no source plumbing, no duplicates. */
const HIDE=/^(local|library|parks|tickets|free|drop-in|in-person|indoor|outdoor|family|families|everyone|all ages|kids|seniors|adults?|new adults|older adults.*|adult \(.*|young adult.*|tweens?.*|teens?|children.*|toddlers|preschool|babies.*|special populations|event category here|special events?|outreach|information table.*)$/i;
export function displayTags(e:In,facets:Facet[]){
 const seen=new Set<string>(),out:string[]=[];
 const SHORT:Record<string,string>={"Arts & Theatre":"Arts"};
 for(const f of facets)if(f!=="Free"&&f!=="Family"&&f!=="Kids"&&f!=="Adults"&&!(f==="Arts & Theatre"&&facets.includes("Music"))){const x=SHORT[f]||f;if(!seen.has(x)){seen.add(x);out.push(x)}}
 for(const raw of e.tags||[]){const x=raw.trim();if(!x||x.length>22||HIDE.test(x)||/\(/.test(x)||seen.has(x)||/^(arts & theatre|sports|music|arts? & cultural|crafting\/makers|clubs & groups)$/i.test(x))continue;seen.add(x);out.push(x)}
 return out;
}
