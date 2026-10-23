import {db} from "./db";
import {storeImage} from "./images";
import * as images from "./images";
import {TOPICS, NEVER, type Topic} from "./stockPhotoData";
export {TOPICS};

// Events with no picture of their own (a library program, a city class) get a real photo of that kind of event from
// Pixabay (free; copies may be kept). A small library is built once: several photos per event type, saved on our side.
// Which photo an event gets depends only on its title, so its card and its page (and every date of a recurring
// event) show the same one, while different events of the same type rotate through different photos.
// Real event photos always come first; these only replace the plain emoji tiles.
// must: the photo's own tags on Pixabay have to name the subject (a train ride's photo must be tagged train).
const DESC_OK=new Set(["halloween","pumpkin","oktoberfest","christmas","easter","fireworks","chess","lego","videogames","knitting","train","garden","cars","pets","farmersmarket","yoga","soccer","basketball","baseball","tennis","swim","golf","dance","concert","theater","movie","painting","stem"]);
const CULTURE_DANCE=/\b(african|caribbean|latin\w*|salsa|bachata|merengue|cumbia|flamenco|folkl\w*|haitian|bollywood|hula|samba|capoeira|bomba|polynesian|hispanic|mariachi|indian|chinese|lion dance)\b/i;
export function topicFor(e:{title?:string;desc?:string;category?:string;tags?:string[];source?:string;venue?:string}):string{
 const lib=/library|branch/i.test(`${e.source||""} ${e.venue||""}`);
 const t=String(e.title||""),d=String(e.desc||"").slice(0,300),tags=(e.tags||[]).filter(x=>!/^(local|free|paid|indoor|outdoor|tickets|drop-in|family|kids|adults?|teens?|seniors|health (&|and) wellness|education|lifelong learning|community events|major events|program)$/i.test(x.trim())&&!(lib&&/^music$/i.test(x.trim()))).join(" | ");
 const pick=(x:string,allowed?:Set<string>)=>x.trim()?TOPICS.find(p=>p.key!=="community"&&(!allowed||allowed.has(p.key))&&p.re.test(x))?.key:undefined;
 let k=pick(t)||pick(tags)||pick(d,DESC_OK);
 // Cultural dance and drumming get cultural dancers, not ballet.
 if((k==="dance"||k==="concert")&&CULTURE_DANCE.test(`${t} ${d}`)&&/\b(danc\w*|drum\w*)\b/i.test(t))k="culture";
 if(k)return k;
 if(lib)return "library";
 if(/parks?\b|recreation|nature center/i.test(`${e.source||""} ${e.venue||""}`))return "nature";
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

// A type that has no photos yet (or lost them) borrows from the closest related type.
const NEXT:Record<string,string>={discussion:"language",library:"reading",workshop:"career",kidsmusic:"kids",kidsdance:"kids",kidsart:"crafts",kidstheater:"kids",kidsyoga:"kids",kidssports:"kids",kidsgames:"kids",soccer:"sports",basketball:"sports",baseball:"sports",tennis:"sports",swim:"sports",golf:"sports",fitness:"sports",sports:"kids",
 pets:"animals",animals:"nature",cars:"festival",history:"culture",culture:"festival",health:"community",seniors:"community",teens:"community",career:"community",
 language:"reading",sensory:"baby",festival:"blockparty",kids:"baby",music:"concert",arts:"painting",community:"festival",blockparty:"concert",concert:"festival",
 dance:"theater",theater:"concert",movie:"theater",yoga:"fitness",artfair:"painting",market:"farmersmarket",food:"market",boat:"beach",beach:"nature",nature:"garden",
 crafts:"painting",painting:"crafts",tech:"stem",reading:"storytime",games:"chess",videogames:"games",photography:"arts"};

// Seniors programs (55+, chair exercise) get seniors photos rather than a dance troupe or a gym.
const SENIOR_SWAP=new Set(["dance","fitness","yoga","sports","concert","music","community"]);
const forSeniors=(e:{title?:string;desc?:string;tags?:string[]})=>/(\b(seniors?|older adults|chair (dance|yoga|volleyball|exercise\w*)|silver club|golden years)\b|\b[5-6]\d\+)/i.test(`${e.title||""} ${(e.tags||[]).join(" ")}`);
// Who it's for matters: a toddler "Music & Movement" gets a children's music class, not a rock concert.
const KID_VERSION:Record<string,string>={library:"storytime",workshop:"kids",concert:"kidsmusic",music:"kidsmusic",dance:"kidsdance",theater:"kidstheater",painting:"kidsart",arts:"kidsart",crafts:"kidsart",
 artfair:"kidsart",yoga:"kids",fitness:"kidssports",sports:"kidssports",games:"kidsgames",reading:"storytime",tech:"stem",community:"kids",festival:"kids",teens:"kids",
 career:"kids",language:"kids",health:"kids",seniors:"kids",history:"kids",culture:"kids",movie:"kids"};
export const forKids=(e:{title?:string;desc?:string;tags?:string[];ageMax?:number|null})=>
 (e.ageMax!=null&&e.ageMax<=12)||/\b(toddlers?|preschool\w*|pre-?k|kids?|children'?s?|child|bab(y|ies)|infants?|story ?time|tots|little ones|tweens?|kinder\w*|ages? [0-9])\b/i.test(`${e.title||""} ${String(e.desc||"").slice(0,300)} ${(e.tags||[]).join(" ")}`);

/** The library photo for an event with no picture ("" if the library isn't built yet). */
export async function stockPicture(e:{title:string;desc?:string;category?:string;tags?:string[];ageMax?:number|null;source?:string;venue?:string|null}):Promise<string>{
 const by=await library();let topic=topicFor({...e,venue:e.venue||undefined});
 if(forSeniors(e)&&SENIOR_SWAP.has(topic))topic="seniors";
 else if(forKids(e)&&KID_VERSION[topic])topic=KID_VERSION[topic];
 for(let i=0;i<6&&!by.get(topic)?.length&&NEXT[topic];i++)topic=NEXT[topic];
 const l=by.get(topic)||[];
 return l.length?l[hash(e.title)%l.length]:"";
}

// Busy event types (many storytimes on one day) get more photos so neighboring cards don't repeat.
const BIG=new Set(["storytime","baby","library","kids","workshop","crafts","kidsart","discussion","reading","tech","stem","games","seniors","language","community"]);
const want=(k:string,per:number)=>BIG.has(k)?per*2:per;
/** Fill the library: up to `max` topics per call that have fewer than `per` photos. */
export async function buildLibrary(max=20,per=6){
 const key=process.env.PIXABAY_API_KEY;if(!key)return{ok:false,error:"PIXABAY_API_KEY not set"};
 const by=await library(),done:string[]=[],fails:string[]=[];let added=0;
 const started=Date.now();
 for(const t of TOPICS.filter(t=>(by.get(t.key)?.length||0)<want(t.key,per)).slice(0,max)){
  if(Date.now()-started>200e3)break;   // stay inside one request's time; the next call continues
  const u=new URL("https://pixabay.com/api/");
  for(const [k,v] of Object.entries({key,q:t.q,image_type:"photo",orientation:"horizontal",safesearch:"true",per_page:"60",min_width:"1000",order:"popular"}))u.searchParams.set(k,v);
  const d:any=await fetch(u.toString(),{signal:AbortSignal.timeout(20000)}).then(r=>r.json()).catch(()=>null);
  const have=new Set((by.get(t.key)||[]).length?(await db.query("select photo_id from stock_photos where topic=$1",[t.key])).rows.map((r:any)=>Number(r.photo_id)):[]);
  const hits=(d?.hits||[]).filter((h:any)=>h.webformatURL&&h.imageWidth>=h.imageHeight*1.2&&t.must.test(String(h.tags||""))&&!NEVER.test(String(h.tags||""))&&!have.has(Number(h.id))).slice(0,per-have.size);
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
export async function libraryPlan(max=60,per=6,part=0,of=1){
 const key=process.env.PIXABAY_API_KEY;if(!key)return{ok:false,error:"PIXABAY_API_KEY not set",items:[]};
 await schema();
 const have=new Map<string,Set<number>>();
 for(const r of (await db.query("select topic,photo_id from stock_photos").catch(()=>({rows:[]}))).rows){const x=have.get(r.topic)||new Set();x.add(Number(r.photo_id));have.set(r.topic,x)}
 const items:{topic:string;id:number;url:string;alt:string}[]=[];
 const rejected=new Set((await db.query("select photo_id from stock_rejected").catch(()=>({rows:[]}))).rows.map((r:any)=>Number(r.photo_id)));
  // Several jobs can split the work (each fetches every of-th missing type).
 for(const t of TOPICS.filter(t=>(have.get(t.key)?.size||0)<want(t.key,per)).filter((_,i)=>i%of===part).slice(0,max)){
  const u=new URL("https://pixabay.com/api/");
  for(const [k,v] of Object.entries({key,q:t.q,image_type:"photo",orientation:"horizontal",safesearch:"true",per_page:"60",min_width:"1000",order:"popular"}))u.searchParams.set(k,v);
  const d:any=await fetch(u.toString(),{signal:AbortSignal.timeout(20000)}).then(r=>r.json()).catch(()=>null);
  const got=have.get(t.key)||new Set<number>();
  for(const h of (d?.hits||[]).filter((h:any)=>h.webformatURL&&h.imageWidth>=h.imageHeight*1.2&&t.must.test(String(h.tags||""))&&!NEVER.test(String(h.tags||""))&&!got.has(Number(h.id))&&!rejected.has(Number(h.id))).slice(0,want(t.key,per)-got.size))
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
