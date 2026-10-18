import {db} from "./db";
import {bestPicture,isGenericPicture} from "./pictures";

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

type Fillable={id:number;source:string;title:string;description:string;image:string|null;city:string;lat:number|null;lng:number|null;ageMin:number|null;ageMax:number|null;start:Date;tz:string};
export async function fillFromCopies<T extends Fillable>(e:T):Promise<T>{
 const day=new Intl.DateTimeFormat("en-CA",{timeZone:e.tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(e.start);
 const {rows}=await db.query(`select e.id,e.title,e.description,e.image_url,e.city,e.age_min,e.age_max,e.start_at,s.name as source,
   coalesce(v.latitude,e.latitude) as lat,coalesce(v.longitude,e.longitude) as lng
  from events e join sources s on s.id=e.source_id left join venues v on v.id=e.venue_id
  where e.local_date=$1::date and e.status='active' and e.id<>$2 limit 3000`,[day,e.id]).catch(()=>({rows:[] as any[]}));
 const near=(r:any)=>(e.lat!=null&&e.lng!=null&&r.lat!=null&&Math.hypot((Number(r.lat)-e.lat)*69,(Number(r.lng)-e.lng!)*69*Math.cos(e.lat*Math.PI/180))<4)||(!!town(e.city)&&town(e.city)===town(r.city));
 // The organizer's own copies first, round-ups last.
 // Same matching as the cards: posts match by title nearby; two calendar listings only when they also start together.
 const ig=(x:string)=>/ · Instagram$/.test(x||"");
 const hm=(d:Date)=>new Intl.DateTimeFormat("en-GB",{timeZone:e.tz,hour:"2-digit",minute:"2-digit",hour12:false}).format(d);
 const timesOk=(r:any)=>{const a=hm(e.start),b=hm(new Date(r.start_at));return a==="00:00"||b==="00:00"||a===b};
 const copies=rows.filter((r:any)=>near(r)&&sameEvent(e.title,r.title)&&(ig(e.source)||ig(r.source)?timesOk(r):new Date(r.start_at).getTime()===e.start.getTime())).sort((a:any,b:any)=>(roundup(a.source)?1:0)-(roundup(b.source)?1:0));
 const out={...e};
 // The picture: the same rule the card uses (lib/pictures), over this listing and all its copies.
 const all=[{id:e.id,image:e.image||"",source:e.source,title:e.title},...copies.map((r:any)=>({id:r.id,image:r.image_url||"",source:r.source,title:r.title}))]
  .filter(p=>p.image&&!expired(p.image)&&!/ticketm\.net\/dam\/c\//.test(p.image)&&!isGenericPicture(p.image));
 const urls=[...new Set(all.map(p=>p.image).filter(u=>!/static\.libnet\.info|ticketm\.net/.test(u)))];
 const shared=urls.length?new Set((await db.query("select image_url from events where image_url=any($1) group by image_url having count(distinct lower(title))>=3",[urls]).catch(()=>({rows:[]}))).rows.map((r:any)=>r.image_url)):new Set();
 out.image=bestPicture(e.title,all.filter(p=>!shared.has(p.image)))||null;
 if(!copies.length)return out;
 if(thin(out.description)){const d=copies.find((r:any)=>!thin(r.description||""));if(d)out.description=d.description}
 if(out.ageMin==null){const a=copies.find((r:any)=>r.age_min!=null);if(a){out.ageMin=a.age_min;out.ageMax=a.age_max}}
 return out;
}
