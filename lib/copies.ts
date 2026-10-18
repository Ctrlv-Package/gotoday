import {db} from "./db";

// The same event often reaches us several times (the city's calendar, the city's Instagram, a round-up account,
// Ticketmaster). The cards merge those copies into one; an event page opens just one of them. So the page looks up the
// other copies the same way the cards do (same day, same area, mostly the same title) and fills in what its own
// listing lacks: the photo, a real description, the ages.
const STOP=new Set(["the","and","of","a","at","in","on","for","with","to","annual","city","town","village","free","fl","event","day","night","2025","2026","2027"]);
const words=(t:string)=>new Set(t.toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").split(" ").filter(w=>w.length>2&&!STOP.has(w)));
const flat=(t:string)=>t.toLowerCase().replace(/[^a-z0-9]+/g,"");
const town=(x:string)=>String(x||"").toLowerCase().replace(/^ft\.?\s/,"fort ").replace(/,.*$/,"").trim();
const partOf=(t:string)=>/^(opening|closing) reception|^vip\b|\bpreview\b|after ?party|pre-?show|meet (and|&) greet/i.test(t);
const roundup=(s:string)=>/^(Miami Residents|Weekend Broward|The Broward Scene|To Do with Kids (Broward|Miami)) · Instagram$/.test(s);
export function sameEvent(a:string,b:string){
 if(partOf(a)!==partOf(b))return false;
 const fa=flat(a),fb=flat(b);if(fa.length>=4&&fb.length>=4&&(fa.includes(fb)||fb.includes(fa)))return true;
 const wa=words(a),wb=words(b);let hit=0;for(const x of wa)if(wb.has(x))hit++;
 const small=Math.min(wa.size,wb.size);return small>0&&hit>=Math.min(2,small)&&hit/small>=0.6;
}
const thin=(d:string)=>!d||/^Official .* event\.$/.test(d)||/^Posted by @/.test(d)||d.length<40;
const expired=(u:string)=>{const oe=/cdninstagram\.com|fbcdn\.net/.test(u)&&u.match(/[?&]oe=([0-9A-Fa-f]{8})/);return!!oe&&parseInt(oe[1],16)*1000<Date.now()};

type Fillable={id:number;title:string;description:string;image:string|null;city:string;lat:number|null;lng:number|null;ageMin:number|null;ageMax:number|null;start:Date;tz:string};
export async function fillFromCopies<T extends Fillable>(e:T):Promise<T>{
 if(e.image&&!thin(e.description)&&e.ageMin!=null)return e;
 const day=new Intl.DateTimeFormat("en-CA",{timeZone:e.tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(e.start);
 const {rows}=await db.query(`select e.id,e.title,e.description,e.image_url,e.city,e.age_min,e.age_max,s.name as source,
   coalesce(v.latitude,e.latitude) as lat,coalesce(v.longitude,e.longitude) as lng
  from events e join sources s on s.id=e.source_id left join venues v on v.id=e.venue_id
  where e.local_date=$1::date and e.status='active' and e.id<>$2 limit 3000`,[day,e.id]).catch(()=>({rows:[] as any[]}));
 const near=(r:any)=>(e.lat!=null&&e.lng!=null&&r.lat!=null&&Math.hypot((Number(r.lat)-e.lat)*69,(Number(r.lng)-e.lng!)*69*Math.cos(e.lat*Math.PI/180))<4)||(!!town(e.city)&&town(e.city)===town(r.city));
 // The organizer's own copies first, round-ups last.
 const copies=rows.filter((r:any)=>near(r)&&sameEvent(e.title,r.title)).sort((a:any,b:any)=>(roundup(a.source)?1:0)-(roundup(b.source)?1:0));
 if(!copies.length)return e;
 const out={...e};
 if(!out.image){
  const pics=[...new Set(copies.map((r:any)=>r.image_url).filter((u:string)=>u&&!expired(u)&&!/ticketm\.net\/dam\/c\//.test(u)))] as string[];
  // Same rule as the cards: a photo shared by 3+ differently named events is a cover, not this event's.
  const shared=pics.length?new Set((await db.query("select image_url from events where image_url=any($1) group by image_url having count(distinct lower(title))>=3",[pics]).catch(()=>({rows:[]}))).rows.map((r:any)=>r.image_url)):new Set();
  out.image=pics.find(u=>!shared.has(u)||/static\.libnet\.info|ticketm\.net/.test(u))||null;
 }
 if(thin(out.description)){const d=copies.find((r:any)=>!thin(r.description||""));if(d)out.description=d.description}
 if(out.ageMin==null){const a=copies.find((r:any)=>r.age_min!=null);if(a){out.ageMin=a.age_min;out.ageMax=a.age_max}}
 return out;
}
