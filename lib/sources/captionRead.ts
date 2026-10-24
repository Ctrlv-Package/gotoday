// Reading an event from an Instagram caption alone (used when the AI reading isn't available yet).
// Captions open with chatter ("Beautiful weather is in the forecast for this weekend's Largo Evening Market!"),
// so the event's name is looked for, not just the first sentence; the place comes from 📍 / "Location:" lines.

const EVENT_WORD="Market|Markets|Festival|Fest|Fair|Night|Nights|Party|Parade|Bash|Concert|Concerts|Show|Carnival|Celebration|Expo|Tournament|Run|5K|Walk|Gala|Social|Brunch|Jam|Series|Showcase|Trunk[- ]or[- ]Treat|Egg Hunt|Fiesta|Block Party|Open House|Storytime|Story Time|Movie Night|Cleanup|Clean-Up|Workshop|Class|Camp|Crawl|Hunt|Spooktacular|Boo Bash|Tree Lighting|Lighting|Jamboree|Hoedown|Picnic|Cookout|Swap|Sale|Drive|Classic|Cup|Games|Day";
const SMALL="of|the|and|&|at|in|on|for|a|de|del|la|el|y|by";
const CAP=`[A-Z0-9][\\p{L}\\p{N}'’&.-]*`;
// "Largo Evening Market", "Fall Festival at Ulmer Park" (a Title Case run ending in an event word)
const NAMED=new RegExp(`(${CAP}(?:\\s+(?:${CAP}|(?:${SMALL})(?=\\s+[A-Z0-9])))*?\\s+(?:${EVENT_WORD}))(?![\\p{L}])`,"gu");
// "this weekend's X", "join us for X", "don't miss X", "X is back"
const LEAD=/(?:this (?:weekend|week|saturday|sunday|friday|month)['’]s|join us (?:for|at)(?: the| our)?|don['’]?t miss(?: the| our)?|it['’]?s time for(?: the| our)?|get ready for(?: the| our)?|welcome to(?: the)?|come (?:out )?(?:to|for)(?: the| our)?)\s+([A-Z0-9][^.!?\n]{2,70})/i;
const CHATTER=/^(beautiful|great|perfect|gorgeous|amazing) weather\b|^(happy|good) (morning|friday|saturday|monday|weekend)\b|^(hey|hi|hello)\b|^(we('| a)re|we have|thank you|thanks)\b/i;

const tidy=(t:string)=>t.replace(/[^\p{L}\p{N}&'’ -]/gu," ").replace(/\s+/g," ").replace(/\b(is|are|was|will be)\b.*$/i,"").replace(/[\s'’-]+$/,"").trim();
const cutTail=(t:string)=>{const w=t.split(" ");while(w.length>1&&new RegExp(`^(${SMALL})$`,"i").test(w[w.length-1]))w.pop();return w.join(" ")};

export function captionTitle(caption:string):string{
 const c=(caption||"").replace(/\r/g,"");
 const first=(c.split(/\n/).find(l=>l.trim())||"").trim();
 // A first line that is already a name ("LARGO EVENING MARKET", "Fall Festival 2026") wins.
 const firstSentence=first.split(/[.!?]/)[0].trim();
 if(firstSentence&&firstSentence.split(/\s+/).length<=7&&!CHATTER.test(firstSentence)&&!/^(join|come|don|get|it|this|we|our|mark|save|reminder)\b/i.test(firstSentence))return cutTail(tidy(firstSentence)).slice(0,80)||"Event";
 const head=c.slice(0,400);
 const lead=head.match(LEAD)?.[1];
 if(lead){
  // "Movie Night in the Park this Saturday" → up to the when-words; a short result is the name itself.
  const short=cutTail(tidy(lead.split(/[,;:]| - | – /)[0].split(/\s+(?:this|tomorrow|today|tonight|next|every|on (?:mon|tue|wed|thu|fri|sat|sun)\w*|at \d|from \d|with)\b/i)[0]));
  const named=[...lead.matchAll(NAMED)].map(m=>cutTail(tidy(m[1])))[0];
  const t=short&&short.split(" ").length<=7?short:named||short;if(t&&t.length>=4)return t.slice(0,80)}
 const named=[...head.matchAll(NAMED)].map(m=>cutTail(tidy(m[1]))).filter(x=>x.split(" ").length>=2).sort((a,b)=>b.length-a.length)[0];
 if(named)return named.slice(0,80);
 return cutTail(tidy(firstSentence)).slice(0,80)||"Event";
}

/** "📍 Ulmer Park (301 West Bay Drive)" / "Location: Vista Park, 4001 SW 142nd Ave" → place name + street address. */
export function captionPlace(caption:string):{place?:string;address?:string}{
 const c=caption||"";
 const line=c.match(/(?:📍|📌|🗺️?|(?:^|\n)\s*(?:location|where|place|venue)\s*[:\-–])\s*([^\n]{3,140})/iu)?.[1]?.trim();
 if(!line)return{};
 const paren=line.match(/^(.*?)\s*\(([^)]*\d[^)]*)\)\s*$/);
 if(paren)return{place:paren[1].replace(/[,\s]+$/,"").trim()||undefined,address:paren[2].trim()};
 const parts=line.split(/\s*[,|•·]\s*/);
 if(/^\d/.test(parts[0]))return{address:line};
 const addrAt=parts.findIndex(p=>/^\d+\s+\S/.test(p));
 return{place:parts[0].replace(/[!.]+$/,"").trim()||undefined,address:addrAt>0?parts.slice(addrAt).join(", "):undefined};
}
