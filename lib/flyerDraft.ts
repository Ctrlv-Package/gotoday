/** What a flyer reading hands the create form: only what the flyer actually states. */
export type FlyerDraft={title?:string;date?:string;start?:string;end?:string;place?:string;town?:string;summary?:string;free?:boolean|null};
/** The reader's event shape, as far as the form cares about it. */
export type FlyerEvent={title:string;date:string;start?:string;end?:string;place?:string;town?:string;summary?:string;free?:boolean|null};

const isTime=(s?:string)=>{if(!/^\d{2}:\d{2}$/.test(s||""))return false;const [h,m]=s!.split(":").map(Number);return h<24&&m<60};
/** Map one read event onto form fields. Past dates are dropped: the form won't accept them anyway. */
export function toFlyerDraft(e:FlyerEvent,today:string):FlyerDraft{
 const d:FlyerDraft={};
 if(e.title?.trim())d.title=e.title.trim();
 if(/^\d{4}-\d{2}-\d{2}$/.test(e.date||"")&&e.date>=today)d.date=e.date;
 if(isTime(e.start))d.start=e.start;
 if(isTime(e.end))d.end=e.end;
 if(e.place?.trim())d.place=e.place.trim();
 if(e.town?.trim())d.town=e.town.trim();
 if(e.summary?.trim())d.summary=e.summary.trim();
 if(e.free!==null&&e.free!==undefined)d.free=e.free;
 return d;
}

type FormFields={title:string;date:string;startTime:string;endTime:string;venue:string;city:string;description:string;isFree:boolean};
/** Fill the form from a flyer draft without touching anything the user already typed. */
export function applyFlyerDraft<T extends FormFields>(v:T,d:FlyerDraft):T{
 return {...v,
  title:v.title||d.title||"",
  date:v.date||d.date||"",
  startTime:v.startTime||d.start||"",
  endTime:v.endTime||d.end||"",
  venue:v.venue||d.place||"",
  city:v.city||d.town||"",
  description:v.description||d.summary||"",
  isFree:d.free===null||d.free===undefined?v.isFree:d.free};
}
