/** What a flyer reading hands the create form: only what the flyer actually states. */
export type FlyerRsvp={name?:string;phone?:string;email?:string;by?:string};
export type FlyerDraft={title?:string;date?:string;start?:string;end?:string;place?:string;address?:string;town?:string;summary?:string;free?:boolean|null;rsvp?:FlyerRsvp};
/** The reader's event shape, as far as the form cares about it. */
export type FlyerEvent={title:string;date:string;start?:string;end?:string;place?:string;town?:string;summary?:string;free?:boolean|null;rsvp?:FlyerRsvp};

const isTime=(s?:string)=>{if(!/^\d{2}:\d{2}$/.test(s||""))return false;const [h,m]=s!.split(":").map(Number);return h<24&&m<60};
const isDate=(s?:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s||"");
/** Split a reader place ("Name, 9130 W State Rd 84") into name and street address. Only splits when the
 part after the first comma holds a house number: a comma alone is not an address ("Studio 54, New York"
 stays one name). Same rule ingestion already uses for its venue/address split. */
const splitPlace=(p:string)=>{const i=p.indexOf(",");if(i<0)return{place:p};const tail=p.slice(i+1).trim();if(!/\d/.test(tail))return{place:p};return{place:p.slice(0,i).trim(),address:tail.slice(0,200)};};
/** Map one read event onto form fields. Past dates are dropped: the form won't accept them anyway. */
export function toFlyerDraft(e:FlyerEvent,today:string):FlyerDraft{
 const d:FlyerDraft={};
 if(e.title?.trim())d.title=e.title.trim();
 if(isDate(e.date)&&e.date>=today)d.date=e.date;
 if(isTime(e.start))d.start=e.start;
 if(isTime(e.end))d.end=e.end;
 if(e.place?.trim()){const s=splitPlace(e.place.trim());d.place=s.place;if(s.address)d.address=s.address;}
 if(e.town?.trim())d.town=e.town.trim();
 if(e.summary?.trim())d.summary=e.summary.trim();
 if(e.free!==null&&e.free!==undefined)d.free=e.free;
 if(e.rsvp){
  const r:FlyerRsvp={};
  const name=(e.rsvp.name||"").replace(/\s+/g," ").trim();if(name)r.name=name.slice(0,60);
  const phone=(e.rsvp.phone||"").replace(/\s+/g," ").trim();if(phone)r.phone=phone.slice(0,40);
  const email=(e.rsvp.email||"").replace(/\s+/g," ").trim().toLowerCase();if(email)r.email=email.slice(0,120);
  if(isDate(e.rsvp.by))r.by=e.rsvp.by;
  if(Object.keys(r).length)d.rsvp=r;
 }
 return d;
}

type RsvpFields={onSite:boolean;name:string;phone:string;email:string;by:string};
type FormFields={title:string;date:string;startTime:string;endTime:string;venue:string;address:string;city:string;description:string;isFree:boolean;visibility:"public"|"private";rsvp?:RsvpFields};
/** Fill the form from a flyer draft without touching anything the user already typed. */
export function applyFlyerDraft<T extends FormFields>(v:T,d:FlyerDraft):T&{rsvp?:RsvpFields}{
 const base=v.rsvp||{onSite:v.visibility==="private",name:"",phone:"",email:"",by:""};
 return {...v,
  title:v.title||d.title||"",
  date:v.date||d.date||"",
  startTime:v.startTime||d.start||"",
  endTime:v.endTime||d.end||"",
  venue:v.venue||d.place||"",
  address:v.address||d.address||"",
  city:v.city||d.town||"",
  description:v.description||d.summary||"",
  isFree:d.free===null||d.free===undefined?v.isFree:d.free,
  rsvp:d.rsvp?{...base,name:base.name||d.rsvp.name||"",phone:base.phone||d.rsvp.phone||"",email:base.email||d.rsvp.email||"",by:base.by||d.rsvp.by||""}:v.rsvp};
}
