import {settingFor,junkTag} from "../facets";
import {isGenericPicture} from "../pictures";
import type { EventRecord } from "./types";
export const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
export const stripHtml=(s:string)=>s.replace(new RegExp("<script[^>]*>[\\s\\S]*?</script>","gi")," ").replace(new RegExp("<style[^>]*>[\\s\\S]*?</style>","gi")," ").replace(new RegExp("<[^>]+>","g")," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'\"').replace(/\s+/g," ").trim();
/** HTML -> plain text that keeps paragraph breaks (stripHtml collapses all whitespace). */
export function richText(html:string){
 const marked=String(html||"").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/<\/(p|div|li|h\d)>|<br\s*\/?>/gi," \u00a7\u00a7 ");
 return stripHtml(marked).split("\u00a7\u00a7").map(x=>x.trim()).filter(Boolean).join("\n");
}
export const dedupeKey=(e:EventRecord)=>[slug(e.title),slug(e.venue),e.date].join("|");
export function dedupe(events:EventRecord[]){const seen=new Set<string>();return events.filter(e=>{const k=dedupeKey(e);if(seen.has(k))return false;seen.add(k);return true})}

// ---------- Age ranges ----------
// Audience labels from library feeds ("Preschool", "Tween (8-12)", "Older Adults (55+)") and
// phrases in text ("Ages 3-5", "ages 5 & up", "12-36 months", "grades K-5").
const LABEL_AGES:[RegExp,[number,number]][]=[
 [/\b(bab(y|ies)|infants?|lapsit)\b/i,[0,1]],[/\btoddlers?\b/i,[1,3]],[/\bpre-?school(ers)?\b/i,[3,5]],
 [/\b(school[- ]age|kids|children|youth|elementary)\b/i,[5,11]],[/\btweens?\b/i,[8,12]],[/\bteens?\b/i,[13,17]],
 [/\byoung adults?\b/i,[12,18]],[/\bnew adults?\b/i,[18,25]],[/\b(older adults?|seniors?|55\+)/i,[55,99]],
 [/\badults?\b/i,[18,99]],[/\b(everyone|all ages|famil(y|ies))\b/i,[0,99]]
];
export function textAgeRange(s:string):[number,number]|null{
 let m=s.match(/\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*months?\b/i);if(m)return[0,Math.max(1,Math.ceil(+m[2]/12))];
 m=s.match(/\bages?\s*(\d{1,2})\s*(?:-|–|to|through)\s*(\d{1,2})\b/i);if(m&&+m[1]<=+m[2])return[+m[1],+m[2]];
 m=s.match(/\bages?\s*(\d{1,2})\s*(?:\+|&\s*up|and up|and older|or older)/i);if(m)return[+m[1],99];
 m=s.match(/\bages?\s*(\d{1,2})\s*(?:and|&)\s*under\b/i);if(m)return[0,+m[1]];
 m=s.match(/\bgrades?\s*(k|\d{1,2})\s*(?:-|–|to|through)\s*(\d{1,2})\b/i);if(m)return[m[1].toLowerCase()==="k"?5:+m[1]+5,+m[2]+6];
 return null;
}
export function ageRange(e:EventRecord):[number,number]|null{
 const fromText=textAgeRange(e.title)||textAgeRange(e.desc||"");
 if(fromText)return fromText;
 // Labels: explicit "(8-12)" / "(55+)" inside a label wins over the generic label meaning.
 let lo=99,hi=-1,allAges=false;
 for(const t of e.tags||[]){
  if(/\b(everyone|all ages|famil(y|ies))\b/i.test(t)&&!/\(\d/.test(t)){allAges=true;continue} // "Families" = kids welcome, not an age
  const n=t.match(/\((\d{1,2})\s*[-–]\s*(\d{1,2})\)/),p=t.match(/\((\d{1,2})\+\)/);
  let r:[number,number]|undefined=n?[+n[1],+n[2]]:p?[+p[1],99]:LABEL_AGES.find(([rx])=>rx.test(t))?.[1];
  if(r){lo=Math.min(lo,r[0]);hi=Math.max(hi,r[1])}
 }
 if(hi<0&&/\b(story ?time|toddler|preschool)\b/i.test(e.title))return[0,5];
 if(hi<0)return allAges?[0,99]:null;
 return[lo,hi];
}
export const isAllAges=(e:EventRecord)=>(e.tags||[]).some(t=>/\b(everyone|all ages|famil(y|ies))\b/i.test(t))||/\ball ages\b/i.test(e.desc||"");

// ---------- Discovery rules ----------
// "Is this something a normal person might decide to go do?" Rules look at the TITLE and TAGS,
// not boilerplate descriptions ("registration required", "ages 3-5" are not reasons to reject).
const EVENT_TITLE=/\b(festival|fest|fair|concert|show|performance|celebration|celebrate|heritage|holiday|halloween|trunk[- ]or[- ]treat|parade|carnival|market|movie|film|screening|exhibit(ion)?|author|story ?time|storytelling|open house|block party|fireworks|jazz|symphony|orchestra|comedy|theat(re|er)|puppet|magic|dance party|tournament|game night)\b/i;
// Post text or notices read as an event title ("Dear Neighbors", "We hope you will join us TOMORROW…",
// "Maintenance Alert", "Shop Local. Play Along. Win!").
const CAPTION=/^(dear |we hope|we('re| are) (so )?(excited|thrilled|happy)|join us (tomorrow|today|this)|don'?t (miss|forget)|did you know|have you (signed|registered|heard)|reminder|friendly reminder|save the date\b|thank you\b|thanks to|happy (birthday|anniversary|friday|monday|holidays?)\b|mark your calendars?|calling all\b|attention\b|just \d+ (more )?days?|only \d+ (more )?days?|\d+ days? (until|left)|maintenance alert|road (work|closure)|traffic (alert|advisory)|service alert|weather (alert|update)|why i love|meet (our|the) (new|team|staff)|now hiring|we'?re hiring|apply now|congratulations)|\b(shop local\. play along|giveaway|survey|government week|proclamation)\b|!\s*$(?<=win!\s*)/i;
const ANNOUNCEMENT=/^(labor day|patriot day|memorial day|veterans'? day|thanksgiving( day)?|christmas( day| eve)?|new year'?s( day| eve)?|independence day|martin luther king.*day|presidents'? day|juneteenth|columbus day|indigenous peoples'? day|good friday|election day|rosh hashanah|yom kippur)$|\b(closed|closure|office hours|registration (opens|closes|deadline)|deadline|applications? (due|open)|no school|early release|contest registration)\b/i;
const MEETING=/\b(board|commission|committee|council|hearings?|advisory|code enforcement|magistrate|zoning|budget|bargaining|public meeting|town hall|pre-?bid|special meeting|workshop session)\b/i;
const PASSIVE=/\b(grab[- ](?:and|&|n)[- ]go|information table|take (?:it )?(?:and|&) make|take[- ]home craft|photo op|word search|display (?:case|table)|coloring station|self[- ]guided|seed library|month$)\b/i;
// Tags that mark a real happening even when a Grab & Go / Class tag is also present.
const STRONG_TAG=/\b(fair\/festival|performances|exhibit|speaker|author events|movie|story time)\b/i;
const SERVICE=/\b(esl|english (?:cafe|café|conversation|class(?:es)?|lessons?|practice)|(?:beginners?|intermediate|advanced|spanish|french)\s+(?:english\s+)?caf[eé]|caf[eé]\s*[-–]?\s*(?:beginner|intermediate|advanced)|as a second language|conversation (?:group|club|practice)|citizenship|naturalization|vita\b|tax (?:help|assistance|prep)|ged\b|test prep|sat\/act|tutor(?:ing)?|homework help|reading practice|resume|job (?:prep|search|help|seekers?)|career (?:coach|help|counsel|assistance)|tech help|device help|mobile device|ask us anything|one[- ]on[- ]one|1 on 1|support (?:group|meeting)|nami\b|al-?anon|alcoholics|narcotics|grief|caregiver|blood pressure|health screening|medicare|legal (?:aid|help|clinic)|notary|passport|dmv\b|exemption|proctor|meeting room|study room|early voting|voting site|election site|polling|volunteer orientation|mentoring program|rentals?|reservations?|permits?|for non-?profit groups|primitive camping|shelter rental)\b/i;
const FITNESS=/\b(zumba|yoga|tai chi|pilates|hiit|insanity|fitness|aerobics|cardio|chair exercise|strength (?:and|&) balance|strength training|boot ?camp|meditation|mindfulness|stretch(ing)?|ageless grace|pickleball lessons?)\b/i;
// Skill-building courses (languages, computers, office software, finance, test prep) and
// multi-session courses. One-off arts/crafts/kids classes are NOT rejected.
const SKILL_COURSE=/\b(english|spanish|french|italian|german|portuguese|mandarin|grammar|conversational|computer|microsoft|excel|powerpoint|word processing|android|iphone|ipad|internet|browser|windows \d|cyber ?security|coding|artificial intelligence|\bai\b|digital (?:literacy|journey)|budget(ing)?|financial|parliamentar\w*|college prep|brainfuse)\b/i;
const MULTI_SESSION=/\b(\d+[- ](?:week|part|session)s?|sessions|course)\b/i;
const INSTRUCTION=/\b(academy|league|practice|open gym|after[- ]school|orientation|certification|training|clinic|lessons?|instructional|registration|enrollment)\b/i;

const CAMPUS=/\b(advising|advisors? (hours|drop-?in)|drop-?in (advising|hours|tutoring)|tutoring|study (strategies|skills|session|hall)|honou?r cords?|cord distribution|commencement rehearsal|(university|campus|student|off-campus) housing|housing (selection|fair|application)|dissertation|thesis|prospectus|(oral|final) defen[cs]e|qualifying exam|faculty senate|faculty (and|&) staff|staff (training|development|appreciation)|for (faculty|staff|employees)|(students|employees|faculty|staff) only|info(rmation)? session|financial aid|registrar|transcripts?|syllabus|course registration|ledger|payroll|procurement|purchasing card|onboarding|new employee|supervisor training|compliance training|campus connect|canvas (training|basics)|lab safety|research (compliance|administration)|grant writing for faculty|recruit(ing|ment) (event|session|table)|tabling|classroom speaker|get to know)\b|\([A-Z]{2,6}\d{2,4}\)/i;
const CAMPUS_TAG=/(^|\|)\s*(academic\/registrar|training and development|professional development|tabling|career development|faculty|staff|graduate school|advising|orientation)\s*(\||$)/i;
export type DiscoveryReason="announcement"|"meeting"|"passive-display"|"service-or-support"|"fitness-class"|"recurring-instruction"|"marked-ineligible";
export function discoveryRejection(e:EventRecord):DiscoveryReason|null{
 if(e.isDiscoveryEligible===false)return"marked-ineligible";
 const title=e.title.replace(/\bboard[- ]?games?\b/gi,"games");
 const tagText=(e.tags||[]).join(" | ");
 // A title that is only a status message (the organizer renamed a full program "Event Full. No longer accepting…").
 if(/^\W*(event (is )?full|(this )?(event|program|class) is full|no longer accepting|registration (is )?(closed|full)|sold out|waitlist (only|full)|full\b)\W*([.!]|$|no longer|\s*-)/i.test(title.trim()))return"announcement";
 if(ANNOUNCEMENT.test(title.trim())||CAPTION.test(title.trim()))return"announcement";
 if(MEETING.test(title))return"meeting";
 // Election notices ("West Regional Library serves as a general election site") aren't events.
 if(/\b(general|primary|special|municipal|presidential|midterm|run-?off) election\b|\bearly voting\b|\bpolling (place|site|location)\b|\belection day\b|\bvote here\b/i.test(`${title} ${String(e.desc||"").slice(0,200)}`)&&!/\b(watch party|forum|debate|candidate|registration drive)\b/i.test(title))return"announcement";
 // A "meeting" is administrative (negotiation, staff, general meeting) unless it's a club or group people join.
 if(/\bmeetings?\b/i.test(title)&&!/\b(club|group|circle|society|guild|support|social|meetup|families|parents|kids|teens|knitters|writers|readers|gardeners|chess|anime|lego)\b/i.test(title))return"meeting";
 if(/\bnegotiat\w*|\bcollective bargaining\b|\bunion (meeting|session)\b/i.test(title))return"meeting";
 // Regular religious services (from church and temple accounts): their festivals, trunk-or-treats and trivia nights stay.
 if(/\b(worship( service)?|sunday service|church service|holy (mass|communion|eucharist)|mass\b|sermon|bible (study|class)|prayer (service|meeting|group|night)|vespers|rosary|devotional|chapel( service)?|confirmation class|sunday school|youth group meeting|choir rehearsal)\b/i.test(title)&&!/\b(festival|fair|concert|carnival|trunk|trivia|fiesta|market|movie|picnic|block party)\b/i.test(title))return"announcement";
 // Not things to go to: bar drink specials, health services and information tables, constituent office hours.
 if(/\b(half[- ]price|happy hour|drink specials?|bogo|\$\d+ (drinks|margaritas|beers|wings|tacos))\b/i.test(title)&&!/\b(festival|crawl|party|tasting|music|trivia)\b/i.test(title))return"announcement";
 if(/\b(mammogra\w*|mobile (clinic|health|mammography)|flu shots?|vaccination clinic|blood pressure check|information table|info table|resource table|outreach table|rape treatment|constituent (tuesdays?|hours|meetings?|services)|hours of operation|adjusted hours|social worker|book[- ]a[- ]librarian)\b/i.test(title))return"announcement";
 if(e.isDiscoveryEligible===true)return null; // curated sources (Ticketmaster) skip the rest
 const strong=STRONG_TAG.test(tagText);
 const classTag=/(^|\|)\s*(class|workshop|technology)\s*(\||$)/i.test(tagText);
 if(PASSIVE.test(title)||(!strong&&/grab (?:and|&) go|information table/i.test(tagText)))return"passive-display";
 if(SERVICE.test(title)||(!strong&&/career\/business/i.test(tagText)))return"service-or-support";
 // University calendars list their internal business next to public concerts and lectures: advising, staff
 // trainings with course codes, housing selection, defenses, student-only sessions. Those aren't for the public.
 if(CAMPUS.test(title)||(!strong&&CAMPUS_TAG.test(tagText)&&!EVENT_TITLE.test(title)))return"service-or-support";
 if(EVENT_TITLE.test(title))return null;
 if(FITNESS.test(title))return"fitness-class";
 if(SKILL_COURSE.test(title)&&(classTag||/\b(class|course|caf[eé]|workshop|essentials|basics|literacy|training|level)\b/i.test(title)))return"recurring-instruction";
 if(MULTI_SESSION.test(title)||INSTRUCTION.test(title))return"recurring-instruction";
 return null;
}
export function isDiscoveryEvent(e:EventRecord){return discoveryRejection(e)===null}
export function classifyEventType(e:EventRecord):EventRecord["eventType"]{
 const r=discoveryRejection(e);
 return r==="meeting"?"meeting":r==="fitness-class"||r==="recurring-instruction"?"class":r==="service-or-support"?"program":r==="passive-display"?"attraction":"event";
}

// ---------- Normalization ----------
export function normalize(e:EventRecord):EventRecord{
 const paid=/\$\s*[1-9]/.test(e.priceText||"")||e.source==="Ticketmaster";
 const free=e.isFree===true||(!paid&&/\bfree\b/i.test([e.priceText,e.desc,...(e.tags||[])].filter(Boolean).join(" ")));
 const ages=e.ageMin!=null&&e.ageMax!=null?[e.ageMin,e.ageMax] as [number,number]:ageRange(e);
 let tags=[...(e.tags||[])].filter(t=>!junkTag(t));
 if(ages){
  // Kids = the audience is children/teens. Family = kids can come (all-ages).
  const kids=ages[1]<=18;
  tags=tags.filter(t=>t!=="Kids");
  if(kids)tags.push("Kids");
  if(kids||ages[0]===0||isAllAges(e))tags.push("Family");
 }
 if(free)tags.push("Free");
 // Setting (Indoor/Outdoor): see settingFor in lib/facets.ts (also re-applied when results are served).
 const st=settingFor({title:e.title,venue:e.venue,source:e.source,desc:e.desc});if(st)tags.push(st);
 // In Spanish (not Spanish-learning classes, which the discovery rules drop).
 if(/\b(en espa[ñn]ol|espa[ñn]ol|in spanish|bilingual|biling[üu]e)\b/i.test(`${e.title} ${(e.tags||[]).join(" ")}`))tags.push("En Español");
 // Seniors: audience starts at 50+ or is labeled for older adults.
 if((ages&&ages[0]>=50)||/\b(seniors?|older adults|55\+|50\+|60\+|active adults?)\b/i.test(`${e.title} ${(e.tags||[]).join(" ")}`))tags.push("Seniors");
 return{...e,title:e.title.trim(),venue:e.venue.trim(),city:e.city.trim(),tags:Array.from(new Set(tags)),isFree:free,
  ageMin:ages?.[0],ageMax:ages?.[1],lastVerified:e.lastVerified||new Date().toISOString()};
}

/** The cost an event page states in a labeled field ("Cost: $5 (pre-purchase) $8 (day of event)", "Admission: Free",
 *  a sidebar "Event Snapshot → Cost"). City sites often keep the price there and not in the description, so a missing
 *  price in the text must not be read as "free". Returns the stated cost text, or undefined if the page has none. */
/** The event's own photo from its page (og:image / twitter:image), as a full link. Site logos, icons and stock
 *  "share" images are skipped; a picture many different events share is hidden later anyway (shared-photo rule). */
export function pictureFromPage(html:string,pageUrl:string):string|undefined{
 const m=html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["']/i)||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i);
 const raw=m?.[1]?.replace(/&amp;/g,"&").trim();if(!raw)return;
 let u:string;try{u=new URL(raw,pageUrl).toString()}catch{return}
 if(!/^https?:/.test(u)||/icon|banner[-_]?default/i.test(u)||isGenericPicture(u))return;
 return u;
}
export function costFromPage(html:string):string|undefined{
 const text=html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi," ")
  .replace(/<\/(h\d|dt|th|strong|b|label|span|div|p|li|td|dd)>/gi,"$&\n").replace(/<br\s*\/?>/gi,"\n");
 const lines=stripLines(text);
 for(let i=0;i<lines.length;i++){
  const l=lines[i],m=l.match(/^(cost|costs|admission|price|prices|fees?|tickets?|entry|registration fee|ticket prices?)\s*:?\s*(.*)$/i);
  if(!m)continue;
  // "Cost" on its own line (a heading) → the value is on the next line(s).
  let v=m[2].trim();if(!v)v=(lines[i+1]||"")+(/\$|free/i.test(lines[i+2]||"")?" "+lines[i+2]:"");
  v=v.replace(/\s+/g," ").trim().slice(0,140);
  if(v&&(/\$\s?\d|\bfree\b|no (cost|charge)|\d+\s*dollars/i.test(v)))return v;
 }
 return undefined;
}
function stripLines(s:string){return s.split("\n").map(x=>x.replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim()).filter(Boolean)}
