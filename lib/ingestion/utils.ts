import type { EventRecord } from "./types";
export const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
export const stripHtml=(s:string)=>s.replace(new RegExp("<script[^>]*>[\\s\\S]*?</script>","gi")," ").replace(new RegExp("<style[^>]*>[\\s\\S]*?</style>","gi")," ").replace(new RegExp("<[^>]+>","g")," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'\"').replace(/\s+/g," ").trim();
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
const MEETING=/\b(board|commission|committee|council|hearing|advisory|magistrate|zoning|budget|bargaining|public meeting|town hall|pre-?bid|special meeting|workshop session)\b/i;
const PASSIVE=/\b(grab (?:and|&) go|information table|take (?:it )?(?:and|&) make|take[- ]home craft|photo op|word search|display case|coloring station|self[- ]guided|seed library)\b/i;
const SERVICE=/\b(esl|english (?:cafe|café|conversation|class(?:es)?|lessons?|practice)|as a second language|conversation (?:group|club|practice)|citizenship|naturalization|vita\b|tax (?:help|assistance|prep)|ged\b|test prep|sat\/act|tutor(?:ing)?|homework help|resume|job (?:search|help|seekers?)|career (?:coach|help|counsel)|computer (?:class|basics|help|lab)|tech help|one[- ]on[- ]one|support group|nami\b|al-?anon|alcoholics|narcotics|grief|caregiver|blood pressure|health screening|medicare|legal (?:aid|help|clinic)|notary|passport|proctor|meeting room|study room|early voting|voting site|election site|polling|career\/business|mental health)\b/i;
const FITNESS=/\b(zumba|yoga|tai chi|pilates|hiit|insanity|fitness|aerobics|cardio|chair exercise|strength training|boot ?camp|meditation|stretch(ing)?|line dancing class|pickleball lessons?)\b/i;
const INSTRUCTION=/\b(class(es)?|course|lessons?|clinic|academy|practice|league|open gym|after[- ]school|registration|enrollment|orientation|certification|training|intermediate|beginners?)\b/i;

export type DiscoveryReason="meeting"|"passive-display"|"service-or-support"|"fitness-class"|"recurring-instruction"|"marked-ineligible";
export function discoveryRejection(e:EventRecord):DiscoveryReason|null{
 if(e.isDiscoveryEligible===false)return"marked-ineligible";
 const title=e.title.replace(/\bboard[- ]?games?\b/gi,"games");
 const tagText=(e.tags||[]).join(" | ");
 if(MEETING.test(title))return"meeting";
 if(e.isDiscoveryEligible===true)return null; // curated sources (Ticketmaster) skip the rest
 if(PASSIVE.test(title)||PASSIVE.test(tagText))return"passive-display";
 if(SERVICE.test(title)||/career\/business/i.test(tagText))return"service-or-support";
 if(EVENT_TITLE.test(title))return null;
 if(FITNESS.test(title))return"fitness-class";
 if(INSTRUCTION.test(title)||/(^|\|)\s*class\s*(\||$)/i.test(tagText))return"recurring-instruction";
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
 let tags=[...(e.tags||[])];
 if(ages){
  // Kids = the audience is children/teens. Family = kids can come (all-ages).
  const kids=ages[1]<=18;
  tags=tags.filter(t=>t!=="Kids");
  if(kids)tags.push("Kids");
  if(kids||ages[0]===0||isAllAges(e))tags.push("Family");
 }
 if(free)tags.push("Free");
 return{...e,title:e.title.trim(),venue:e.venue.trim(),city:e.city.trim(),tags:Array.from(new Set(tags)),isFree:free,
  ageMin:ages?.[0],ageMax:ages?.[1],lastVerified:e.lastVerified||new Date().toISOString()};
}
