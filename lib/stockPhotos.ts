import {db} from "./db";
import {storeImage} from "./images";
import * as images from "./images";

// Events with no picture of their own (a library program, a city class) get a real photo of that kind of event from
// Pixabay (free; copies may be kept). A small library is built once: several photos per event type, saved on our side.
// Which photo an event gets depends only on its title, so its card and its page (and every date of a recurring
// event) show the same one, while different events of the same type rotate through different photos.
// Real event photos always come first; these only replace the plain emoji tiles.
// must: the photo's own tags on Pixabay have to name the subject (a train ride's photo must be tagged train).
type Topic={key:string;re:RegExp;q:string;must:RegExp};
const MUST:Record<string,string>={"halloween": "halloween|pumpkin|jack-o|costume|spooky|witch|skull", "pumpkin": "pumpkin", "oktoberfest": "beer|oktoberfest|pretzel|bavaria", "christmas": "christmas|xmas|santa", "easter": "easter", "fireworks": "firework", "parade": "parade|carnival|procession|marching", "storytime": "^(?=.*(book|reading|story|read))(?=.*(child|kid|girl|boy|toddler|family|mother|father))", "baby": "baby|toddler|infant", "reading": "book|reading|library|literature", "chess": "chess", "games": "board game|game|dice|playing cards|puzzle|bingo", "videogames": "video game|gaming|controller|console|gamer", "lego": "lego", "stem": "science|experiment|laboratory|chemistry|robot|microscope|test tube", "tech": "computer|laptop|technology|keyboard", "farmersmarket": "market|vegetable|produce|farmers", "market": "market|stall|bazaar|flea|vendor", "train": "train|railway|locomotive|railroad|steam engine", "knitting": "knit|yarn|wool|crochet|sewing|quilt|thread|needle", "crafts": "craft|handmade|diy|origami|scissors|glue|paper", "painting": "paint|brush|canvas|watercolor|easel|drawing", "artfair": "art|gallery|painting|exhibition|artist|sculpture", "photography": "camera|photograph", "garden": "garden|plant|seedling|flower|pot|sprout", "nature": "nature|forest|trail|bird|wildlife|swamp|everglades|wetland|heron", "beach": "beach|ocean|sand|coast", "boat": "kayak|boat|canoe|paddl|sail", "food": "food|meal|dish|cooking|grill|barbecue|brunch|restaurant|breakfast", "blockparty": "party|crowd|street|festival|concert|celebration", "concert": "concert|music|band|guitar|singer|stage|musician|piano|orchestra", "dance": "danc|ballet", "theater": "theater|theatre|stage|curtain|performance|audience", "movie": "movie|cinema|film|popcorn|projector", "yoga": "yoga|meditation", "fitness": "run|marathon|race|fitness|jogging|athlete", "soccer": "soccer|football", "basketball": "basketball", "baseball": "baseball|softball", "tennis": "tennis|pickleball|racket", "swim": "swim|pool", "golf": "golf", "sports": "sport|ball|team|athlet|playing field", "pets": "dog|puppy", "animals": "animal|goat|horse|pony|farm|zoo|sheep|rabbit|alpaca", "cars": "car|automobile|vintage|classic|vehicle|oldtimer", "history": "history|historic|museum|monument|architecture", "culture": "culture|festival|tradition|folk|costume|dance|carnival", "health": "health|doctor|medical|wellness|nurse|stethoscope", "seniors": "senior|elderly|old|grandparent|retire", "teens": "teen|young|friends|students|youth", "career": "business|meeting|office|work|presentation|workshop|conference", "language": "conversation|talk|class|students|language|learning|teacher", "sensory": "child|toy|play|sensory|kid", "festival": "festival|fair|crowd|carnival|celebration|ferris", "kids": "child|kid|children|playground", "music": "music|concert|guitar|musician", "arts": "art|paint|craft", "community": "people|crowd|community|group|volunteer|together"};
const T=(key:string,re:RegExp,q:string):Topic=>({key,re,q,must:new RegExp(MUST[key]||key,"i")});
// Most specific first. Matched against the title, then the description, then the category.
export const TOPICS:Topic[]=[
 T("storytime",/\b(story ?time|storytime|lapsit|lap sit|cuentos|bedtime stories|stories)\b/i,"child reading book"),
 T("baby",/\b(bab(y|ies)|toddler|infant|little ones|tots)\b/i,"toddler playing toys"),
 T("halloween",/\b(halloween|trick[- ]or[- ]treat|trunk[- ]or[- ]treat|boo bash|spooky|haunted|ghost|ghoul|monster bash|costume)\b/i,"halloween pumpkins decoration"),
 T("pumpkin",/\b(pumpkin|harvest|hay ?ride|corn maze|fall festival|fall fest)\b/i,"pumpkin patch autumn"),
 T("oktoberfest",/\b(oktoberfest|beer fest|brew fest|beer garden)\b/i,"oktoberfest beer festival"),
 T("christmas",/\b(christmas|holiday lights|tree lighting|santa|winter wonderland|menorah|hanukkah|kwanzaa)\b/i,"christmas lights festive"),
 T("easter",/\b(easter|egg hunt)\b/i,"easter egg hunt"),
 T("fireworks",/\b(fireworks|fourth of july|july 4|independence day|new year'?s eve)\b/i,"fireworks night sky"),
 T("parade",/\bparade\b/i,"street parade celebration"),
 T("reading",/\b(book club|reading buddies|book discussion|author talk|author visit|poetry|writers?|writing group|book sale)\b/i,"books reading library"),
 T("chess",/\b(chess)\b/i,"chess board game"),
 T("games",/\b(game night|board games?|bingo|trivia|mahjong|dungeons|card games?|scrabble|puzzle)\b/i,"board games friends table"),
 T("videogames",/\b(video games?|gaming|esports|minecraft|nintendo|switch)\b/i,"video game controller"),
 T("lego",/\b(lego|duplo|building blocks)\b/i,"lego bricks colorful"),
 T("stem",/\b(stem|steam|science|robot\w*|coding|code club|engineer\w*|experiment|3d print\w*|maker\w*|lab\b|chemistry|physics)\b/i,"science experiment kids"),
 T("tech",/\b(computer|tech help|technology|internet|smartphone|ipad|digital|ai\b|cyber|excel|microsoft)\b/i,"laptop computer class"),
 T("farmersmarket",/\b(farmers'? market|green market|greenmarket|produce|farm stand)\b/i,"farmers market produce"),
 T("market",/\b(market|bazaar|flea|vendors?|pop[- ]up shop|craft fair|swap meet|yard sale|garage sale|makers market)\b/i,"outdoor market stalls"),
 T("train",/\b(train rides?|mini train|trolley|railroad|choo)\b/i,"miniature train ride"),
 T("knitting",/\b(knit\w*|crochet|stitch\w*|sewing|quilt\w*|yarn|embroider\w*)\b/i,"knitting yarn needles"),
 T("crafts",/\b(crafts?|craft\w*|diy|make and take|ornament|beading|jewelry making|scrapbook\w*|slime|tie[- ]dye|nails?)\b/i,"arts and crafts table"),
 T("painting",/\b(paint\w*|watercolor|drawing|draw|sketch\w*|canvas|art class|art workshop|art club)\b/i,"painting class easel"),
 T("artfair",/\b(art fair|art festival|art walk|artwalk|art show|art market|artisan|gallery|exhibit\w*|museum)\b/i,"outdoor art fair booths"),
 T("photography",/\b(photo\w*|camera)\b/i,"photography camera"),
 T("garden",/\b(garden\w*|plant\w*|seed\w*|cutting swap|master gardeners|orchid|botanical|horticulture|composting)\b/i,"gardening plants pots"),
 T("nature",/\b(nature|wildlife|bird\w*|butterfl\w*|hike|hiking|trail|eco|environment\w*|conservation|preserve|wetland\w*|manatee|turtle)\b/i,"nature trail florida"),
 T("beach",/\b(beach|ocean|sea turtle|snorkel\w*|surf\w*|cleanup|clean[- ]up)\b/i,"florida beach"),
 T("boat",/\b(boat\w*|kayak\w*|paddle\w*|canoe|sail\w*|fishing|marina)\b/i,"kayak paddle water"),
 T("food",/\b(food truck\w*|taste of|tasting|food fest\w*|bbq|barbecue|chili|cook\w*|culinary|chef|brunch|wine|dinner|baking|bake)\b/i,"food festival"),
 T("blockparty",/\b(block party|street party|street fest\w*|sunday funday|nobe)\b/i,"street festival crowd music"),
 T("concert",/\b(concert|live music|band|jazz|orchestra|symphony|choir|chorus|singer|songwriter|acoustic|music in the park|dj|piano|guitar|recital|gershwin|opera)\b/i,"live music concert outdoor"),
 T("dance",/\b(dance\w*|danc\w*|ballet|salsa|zumba|hip hop|line dancing|ballroom|tango|bachata)\b/i,"dance performance"),
 T("theater",/\b(theat(er|re)|musical|play\b|jr\.?|stage|improv|comedy|stand-?up|puppet\w*|magic show|magician|circus|into the woods)\b/i,"theater stage performance"),
 T("movie",/\b(movie\w*|film\w*|cinema|screening)\b/i,"outdoor movie night"),
 T("yoga",/\b(yoga|meditation|mindful\w*|tai chi|pilates|stretch\w*)\b/i,"yoga class outdoors"),
 T("fitness",/\b(fitness|workout|boot ?camp|aerobics|exercise|cycling|spin|walking club|5k|10k|fun run|run\b|race|marathon|triathlon)\b/i,"fun run race"),
 T("soccer",/\b(soccer|futbol|football clinic)\b/i,"kids soccer"),
 T("basketball",/\b(basketball|hoops)\b/i,"basketball court"),
 T("baseball",/\b(baseball|softball|t-?ball)\b/i,"baseball field"),
 T("tennis",/\b(tennis|pickleball|racquet)\b/i,"pickleball tennis court"),
 T("swim",/\b(swim\w*|pool|aquatic\w*|water safety)\b/i,"swimming pool"),
 T("golf",/\b(golf|mini golf|putt)\b/i,"golf course"),
 T("sports",/\b(sports?|athletic\w*|tournament|league|camp)\b/i,"kids sports outdoors"),
 T("pets",/\b(dogs?|pets?|puppy|pupp\w*|cat adoption|adoption event|bark|paw|k9|canine)\b/i,"happy dog park"),
 T("animals",/\b(zoo|farm animals|petting|pony|horse\w*|animal\w*|reptile)\b/i,"petting zoo animals"),
 T("cars",/\b(car show|cars and coffee|auto show|classic cars?|truck show)\b/i,"classic car show"),
 T("history",/\b(history|historic\w*|heritage|tour|museum talk|lecture|veterans?|memorial)\b/i,"historic museum tour"),
 T("culture",/\b(hispanic|latin\w*|cultura|caribbean|haitian|black history|asian|diwali|lunar new year|heritage month|international|cultural)\b/i,"cultural festival dancers"),
 T("health",/\b(health\w*|wellness|blood drive|vaccin\w*|screening|medicare|nutrition|fitness fair|cpr|first aid)\b/i,"community health fair"),
 T("seniors",/\b(seniors?|older adults|55\+|60\+|aarp)\b/i,"seniors activity group"),
 T("teens",/\b(teens?|tween\w*|youth|young adults?)\b/i,"teenagers friends activity"),
 T("career",/\b(career|job fair|resume|interview|business|entrepreneur\w*|networking|small business|financial|money|tax\w*)\b/i,"business workshop"),
 T("language",/\b(english|esl|spanish class|language|conversation club|citizenship)\b/i,"language class conversation"),
 T("sensory",/\b(sensory|autism|special needs|calm|quiet hour)\b/i,"children sensory play"),
 T("festival",/\b(festival|fest|fair|carnival|celebration|jubilee|fiesta)\b/i,"community festival crowd"),
 T("kids",/\b(kids?|children|family|families)\b/i,"kids playing park"),
 T("music",/\bmusic\b/i,"live music"),
 T("arts",/\barts?\b/i,"art class colorful"),
 T("community",/./,"community event people"),
];
export function topicFor(e:{title?:string;desc?:string;category?:string;tags?:string[]}):string{
 const t=String(e.title||""),d=String(e.desc||"").slice(0,300),c=`${e.category||""} ${(e.tags||[]).join(" ")}`;
 for(const x of [t,d,c]){if(!x.trim())continue;const hit=TOPICS.find(p=>p.key!=="community"&&p.re.test(x));if(hit)return hit.key}
 return "community";
}

let ready:Promise<unknown>|null=null;
const schema=()=>ready??=db.query("create table if not exists stock_photos(topic text not null,photo_id bigint not null,image text not null,created_at timestamptz default now(),primary key(topic,photo_id))").catch(()=>{ready=null});
let cache:{at:number;by:Map<string,string[]>}|null=null;
async function library(){
 if(cache&&Date.now()-cache.at<10*60e3)return cache.by;
 await schema();
 const by=new Map<string,string[]>();
 for(const r of (await db.query("select topic,image from stock_photos order by topic,photo_id").catch(()=>({rows:[]}))).rows){const l=by.get(r.topic)||[];l.push(r.image);by.set(r.topic,l)}
 cache={at:Date.now(),by};return by;
}
const hash=(s:string)=>{let h=2166136261;for(const c of s.toLowerCase().replace(/[^a-z0-9]+/g,""))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0};

/** The library photo for an event with no picture ("" if the library isn't built yet). */
export async function stockPicture(e:{title:string;desc?:string;category?:string;tags?:string[]}):Promise<string>{
 const by=await library();const topic=topicFor(e);
 const l=by.get(topic)?.length?by.get(topic)!:by.get("community")||[];
 return l.length?l[hash(e.title)%l.length]:"";
}

/** Fill the library: up to `max` topics per call that have fewer than `per` photos. */
export async function buildLibrary(max=20,per=6){
 const key=process.env.PIXABAY_API_KEY;if(!key)return{ok:false,error:"PIXABAY_API_KEY not set"};
 const by=await library(),done:string[]=[],fails:string[]=[];let added=0;
 const started=Date.now();
 for(const t of TOPICS.filter(t=>(by.get(t.key)?.length||0)<per).slice(0,max)){
  if(Date.now()-started>200e3)break;   // stay inside one request's time; the next call continues
  const u=new URL("https://pixabay.com/api/");
  for(const [k,v] of Object.entries({key,q:t.q,image_type:"photo",orientation:"horizontal",safesearch:"true",per_page:"60",min_width:"1000",order:"popular"}))u.searchParams.set(k,v);
  const d:any=await fetch(u.toString(),{signal:AbortSignal.timeout(20000)}).then(r=>r.json()).catch(()=>null);
  const have=new Set((by.get(t.key)||[]).length?(await db.query("select photo_id from stock_photos where topic=$1",[t.key])).rows.map((r:any)=>Number(r.photo_id)):[]);
  const hits=(d?.hits||[]).filter((h:any)=>h.webformatURL&&h.imageWidth>=h.imageHeight*1.2&&t.must.test(String(h.tags||""))&&!have.has(Number(h.id))).slice(0,per-have.size);
  for(const h of hits){
   // The 960px version (enough for cards and pages); the full-size link as a fallback.
   // Pixabay's image server allows a slow pace: one download every ~1.5 s, and a pause when it says "too many".
   let img:string|undefined;
   for(let attempt=0;attempt<3&&!img;attempt++){
    await new Promise(r=>setTimeout(r,attempt?8000:1500));
    img=await storeImage(String(h.webformatURL||"").replace("_640","_960"),`pixabay-${h.id}`);
    if(!img&&!/429/.test(images.lastStoreError))break;
   }
   if(!img)fails.push(images.lastStoreError);
   if(img){await db.query("insert into stock_photos(topic,photo_id,image) values($1,$2,$3) on conflict do nothing",[t.key,h.id,img]);added++}
  }
  done.push(`${t.key}:${hits.length}`);
 }
 cache=null;
 return{ok:true,added,failed:fails.length,why:[...new Set(fails)].slice(0,5),topics:done};
}

/** For the GitHub job: which photos to fetch next (Pixabay search done here, with our key). */
export async function libraryPlan(max=60,per=6){
 const key=process.env.PIXABAY_API_KEY;if(!key)return{ok:false,error:"PIXABAY_API_KEY not set",items:[]};
 await schema();
 const have=new Map<string,Set<number>>();
 for(const r of (await db.query("select topic,photo_id from stock_photos").catch(()=>({rows:[]}))).rows){const x=have.get(r.topic)||new Set();x.add(Number(r.photo_id));have.set(r.topic,x)}
 const items:{topic:string;id:number;url:string;alt:string}[]=[];
 for(const t of TOPICS.filter(t=>(have.get(t.key)?.size||0)<per).slice(0,max)){
  const u=new URL("https://pixabay.com/api/");
  for(const [k,v] of Object.entries({key,q:t.q,image_type:"photo",orientation:"horizontal",safesearch:"true",per_page:"60",min_width:"1000",order:"popular"}))u.searchParams.set(k,v);
  const d:any=await fetch(u.toString(),{signal:AbortSignal.timeout(20000)}).then(r=>r.json()).catch(()=>null);
  const got=have.get(t.key)||new Set<number>();
  for(const h of (d?.hits||[]).filter((h:any)=>h.webformatURL&&h.imageWidth>=h.imageHeight*1.2&&t.must.test(String(h.tags||""))&&!got.has(Number(h.id))).slice(0,per-got.size))
   items.push({topic:t.key,id:Number(h.id),url:h.largeImageURL||h.webformatURL,alt:h.webformatURL});
 }
 return{ok:true,items};
}

/** For the GitHub job: save one downloaded photo into the library. */
export async function libraryPut(topic:string,id:number,data:Buffer){
 if(!TOPICS.some(t=>t.key===topic)||!Number.isFinite(id)||data.length<2000)return{ok:false};
 const {saveImageData}=await import("./images");
 const img=await saveImageData(data,`pixabay-${id}`,`pixabay:${id}`);
 if(!img)return{ok:false};
 await schema();
 await db.query("insert into stock_photos(topic,photo_id,image) values($1,$2,$3) on conflict do nothing",[topic,id,img]);
 cache=null;return{ok:true,image:img};
}
