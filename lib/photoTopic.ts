// Which library photo type fits an event, read by AI (Gemini's free tier) from the title, description and ages,
// instead of keyword rules. Decided once per event title and kept in photo_topics; keyword rules (topicFor) are
// only the fallback for titles not read yet. "none" = nothing fits well (the card then uses the closest general type).
import {db} from "./db";
import {TOPICS} from "./stockPhotoData";
import {fetchRetry} from "./http";

// What each photo type shows, in plain words, so the reader can choose well.
const SHOWS:Record<string,string>={
 storytime:"a child or parent reading a picture book (storytime, read-aloud)",baby:"babies/toddlers playing with toys (baby & toddler programs)",
 halloween:"jack-o'-lanterns and Halloween decorations (general Halloween)",kidshalloween:"young children in Halloween costumes (kids' Halloween, trick-or-treat, costume parade, Halloween storytime)",
 halloweenparty:"adults/teens at a Halloween costume party",pumpkin:"pumpkin patch",fallfestival:"autumn/fall festival with pumpkins and families",
 oktoberfest:"Oktoberfest beer and pretzels",christmas:"Christmas tree and ornaments",kidschristmas:"children with Santa / Christmas fun",holidaylights:"holiday lights display / tree lighting at night",
 easter:"Easter eggs / egg hunt",fireworks:"fireworks",parade:"street parade",reading:"books (book club, author talk, reading program for adults)",
 chess:"chess",cardgames:"people playing a card game / trading cards at a table (Pokémon, Magic, Uno, card clubs)",games:"board games / bingo / trivia (adults)",videogames:"video game controllers",lego:"LEGO bricks",stem:"science lab / experiments / robotics / STEM",
 tech:"people using laptops (computer, tech, digital skills class)",farmersmarket:"farmers market produce",market:"outdoor market / bazaar stalls",train:"miniature train ride",
 knitting:"knitting / sewing / crochet",crafts:"arts & crafts supplies (adult crafts, DIY)",painting:"painting class at easels",artfair:"art gallery / art exhibit / art fair",
 photography:"cameras / photography",garden:"gardening / plants",food:"food festival / street food / food trucks",kidscooking:"children cooking or baking",winetasting:"wine tasting",
 blockparty:"street festival / block party crowd",concert:"live concert on stage",dance:"dance performance / social dance (adults)",theater:"theater stage / play / musical",
 movie:"movie night / cinema / popcorn",nature:"nature trail / park walk / wildlife",beach:"beach",boat:"kayak / paddleboard / boating",yoga:"yoga / meditation (adults)",
 fitness:"group fitness / running / walking event",soccer:"soccer",basketball:"basketball",baseball:"baseball / softball",tennis:"tennis / pickleball",swim:"swimming pool",
 shooting:"archery / target shooting",golf:"golf",sports:"general sports",pets:"dogs (dog events, pet adoption, read to a dog)",animals:"farm / petting zoo animals",
 cars:"classic car show",discussion:"adults talking over coffee (discussion group, coffee chat, town hall chat)",history:"historic building / museum / history talk",
 culture:"cultural festival dancers in traditional dress",dayofdead:"Day of the Dead (calaveras, altars)",diwali:"Diwali lamps",health:"doctor / health screening / medical",
 seniors:"older adults together (seniors programs)",teens:"teenagers hanging out (teen programs)",career:"business / job / career workshop",language:"language class / ESL conversation",
 sensory:"children's sensory play",festival:"fairground / festival rides crowd",kids:"children playing outdoors (general kids' activity)",music:"live music",arts:"art class (colorful art)",
 kidsmusic:"young children playing music instruments (music & movement)",kidsdance:"children's dance / ballet class",kidsart:"children painting / kids' art & crafts",
 kidstheater:"children's puppet show / kids' theater",kidsyoga:"kids yoga",kidssports:"children playing sports",kidsgames:"children playing board games",
 library:"inside a public library (library program with no clearer subject)",workshop:"adult class / workshop / seminar in a classroom",community:"people at a community gathering",
};
const KEYS=TOPICS.map(t=>t.key);

export const titleKey=(t:string)=>String(t||"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim().slice(0,140);

let ready:Promise<unknown>|null=null;
const schema=()=>ready??=db.query("create table if not exists photo_topics(key text primary key,topic text not null,at timestamptz default now())");
let mem:{at:number;map:Map<string,string>}|null=null;
/** All decisions (small table), kept in memory for 10 minutes. */
export async function decidedTopics():Promise<Map<string,string>>{
 if(mem&&Date.now()-mem.at<10*60e3)return mem.map;
 await schema();
 const {rows}=await db.query("select key,topic from photo_topics").catch(()=>({rows:[] as any[]}));
 mem={at:Date.now(),map:new Map(rows.map((r:any)=>[r.key,r.topic]))};
 return mem.map;
}

type Item={key:string;title:string;desc:string;ages:string};
async function askGemini(items:Item[],modelOverride?:string):Promise<Map<string,string>>{
 const key=process.env.GEMINI_API_KEY;if(!key)throw new Error("GEMINI_API_KEY not set");
 const list=KEYS.map(k=>`${k}: ${SHOWS[k]||TOPICS.find(t=>t.key===k)!.q}`).join("\n");
 const prompt=`You choose an illustrative stock photo for local event listings. For each event pick the ONE photo type below that best shows what people will actually do or see there, and who it's for (kids vs adults matters: a toddler Halloween storytime is "kidshalloween", not "halloween"; a library computer class is "tech", not "library"). Use "none" only if no type is even roughly right.
Photo types:
${list}

Events:
${items.map((x,i)=>`${i}. ${x.title}${x.ages?` [ages ${x.ages}]`:""} — ${x.desc.replace(/\s+/g," ").slice(0,220)}`).join("\n")}

Reply with JSON only: {"results":[{"i":0,"topic":"type"}]}`;
 const model=modelOverride||process.env.PHOTO_TOPIC_MODEL||"gemini-3.5-flash-lite";   // the lightest model has the most free requests
 const r=await fetchRetry(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:"POST",
  headers:{"content-type":"application/json","x-goog-api-key":key},
  body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",maxOutputTokens:4096,temperature:0}})},2);
 const d:any=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(`Gemini: ${d?.error?.message||`HTTP ${r.status}`}`);
 const text=(d?.candidates?.[0]?.content?.parts||[]).map((p:any)=>p.text||"").join("");
 const out=new Map<string,string>();
 // Read the answer leniently: one JSON object, a bare list, or several objects one after another.
 let answers:any[]=[];
 try{const j=JSON.parse(text);answers=Array.isArray(j)?j:j.results||[]}catch{
  for(const m of text.matchAll(/\{[^{}]*"i"\s*:\s*(\d+)[^{}]*"topic"\s*:\s*"([^"]+)"[^{}]*\}/g))answers.push({i:Number(m[1]),topic:m[2]});
  if(!answers.length)throw new Error(`Gemini answer not readable: ${text.slice(0,160)}`);
 }
 for(const x of answers){
  const it=items[Number(x.i)],tp=String(x.topic||"").trim();
  if(it&&(tp==="none"||KEYS.includes(tp)))out.set(it.key,tp);
 }
 return out;
}

/** Read upcoming events' titles not decided yet (no photo of their own first), up to `calls` AI calls of 40 titles.
 *  Paced for the free tier. Returns how many were decided. */
export async function decidePending(calls=10,model?:string){
 await schema();
 const known=await decidedTopics();
 const {rows}=await db.query(`select distinct on (lower(e.title)) e.title,e.description,e.age_min,e.age_max,(e.image_url is null or e.image_url='') as nopic
   from events e where e.status='active' and e.local_date between current_date and current_date+45 order by lower(e.title),e.start_at`);
 const todo=rows.filter((r:any)=>!known.has(titleKey(r.title))).sort((a:any,b:any)=>Number(b.nopic)-Number(a.nopic));
 let done=0,errors:string[]=[];
 for(let c=0;c<calls&&c*40<todo.length;c++){
  const batch:Item[]=todo.slice(c*40,c*40+40).map((r:any)=>({key:titleKey(r.title),title:r.title,desc:String(r.description||""),ages:r.age_min!=null||r.age_max!=null?`${r.age_min??0}-${r.age_max??"+"}`:""}));
  try{
   const m=await askGemini(batch,model);
   for(const [k,tp] of m){await db.query("insert into photo_topics(key,topic) values($1,$2) on conflict(key) do update set topic=excluded.topic,at=now()",[k,tp]);known.set(k,tp);done++}
  }catch(e:any){errors.push(String(e?.message||e).slice(0,200));if(/quota|rate|429/i.test(String(e?.message)))break}
  await new Promise(r=>setTimeout(r,4500));   // free tier: ~15 requests a minute
 }
 return{decided:done,waiting:Math.max(0,todo.length-done),errors};
}
