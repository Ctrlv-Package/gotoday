// Repeating events people create on GoToday: every week (on chosen days), every month, or every year.
// Monthly and yearly events can follow the date ("on the 24th") or the weekday ("the 4th Saturday",
// "the last Saturday"), so a festival held on the 4th Saturday of October lands on the right day each year.
// Pure date math on calendar days (YYYY-MM-DD); times and time zones are handled by the caller.

export type RepeatKind="none"|"weekly"|"monthly"|"yearly";
export type RepeatBy="date"|"nth"|"last";
export type Repeat={kind:RepeatKind;days:number[];by:RepeatBy;until:string};   // days: 0=Sunday … 6=Saturday
export const NO_REPEAT:Repeat={kind:"none",days:[],by:"date",until:""};

const DAY=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const ABBR=["SU","MO","TU","WE","TH","FR","SA"];
const ORD=["","1st","2nd","3rd","4th","5th"];
const MONTH=["January","February","March","April","May","June","July","August","September","October","November","December"];

const parse=(d:string)=>{const [y,m,dd]=d.split("-").map(Number);return new Date(Date.UTC(y,m-1,dd))};
const fmt=(d:Date)=>d.toISOString().slice(0,10);
const addDays=(d:Date,n:number)=>new Date(d.getTime()+n*86400e3);
const daysIn=(y:number,m:number)=>new Date(Date.UTC(y,m+1,0)).getUTCDate();

/** Which weekday of its month a date is: the 2nd Saturday, and whether it's also the last one. */
export function weekdayPlace(date:string){
 const d=parse(date),n=Math.ceil(d.getUTCDate()/7),last=d.getUTCDate()+7>daysIn(d.getUTCFullYear(),d.getUTCMonth());
 return{weekday:d.getUTCDay(),n,last};
}

/** The choices that make sense for a start date (shown in the form). */
export function byOptions(date:string,kind:"monthly"|"yearly"):{by:RepeatBy;label:string}[]{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return[];
 const d=parse(date),{weekday,n,last}=weekdayPlace(date),mon=MONTH[d.getUTCMonth()],day=d.getUTCDate();
 const of=kind==="yearly"?` of ${mon}`:"";
 const out:{by:RepeatBy;label:string}[]=[{by:"date",label:kind==="yearly"?`Every ${mon} ${day}`:`On the ${day}${suffix(day)}`}];
 if(n<=4)out.push({by:"nth",label:`On the ${ORD[n]} ${DAY[weekday]}${of}`});
 if(last)out.push({by:"last",label:`On the last ${DAY[weekday]}${of}`});
 return out;
}
const suffix=(n:number)=>n%10===1&&n!==11?"st":n%10===2&&n!==12?"nd":n%10===3&&n!==13?"rd":"th";

/** The given weekday's nth (or last) occurrence in a month; null when that month doesn't have a 5th one. */
function nthWeekday(y:number,m:number,weekday:number,n:number|"last"){
 if(n==="last"){const end=daysIn(y,m),d=new Date(Date.UTC(y,m,end));return addDays(d,-((d.getUTCDay()-weekday+7)%7))}
 const first=new Date(Date.UTC(y,m,1)),day=1+((weekday-first.getUTCDay()+7)%7)+(n-1)*7;
 return day<=daysIn(y,m)?new Date(Date.UTC(y,m,day)):null;
}

/** Dates the event happens on, from `start` (its first date) within [from, to], at most `max`. */
export function occurrences(start:string,r:Repeat,from:string,to:string,max=200):string[]{
 const out:string[]=[],s=parse(start),end=r.until&&r.until<to?r.until:to;
 const keep=(d:Date|null)=>{if(!d)return;const x=fmt(d);if(x>=start&&x>=from&&x<=end&&out.length<max)out.push(x)};
 if(r.kind==="none"){keep(s);return out}
 const {weekday,n}=weekdayPlace(start),which=r.by==="last"?"last" as const:n;
 if(r.kind==="weekly"){
  const days=r.days.length?r.days:[s.getUTCDay()];
  for(let d=s;fmt(d)<=end&&out.length<max;d=addDays(d,1))if(days.includes(d.getUTCDay()))keep(d);
  return out;
 }
 const step=r.kind==="monthly"?1:12;
 for(let i=0;out.length<max;i+=step){
  const y=s.getUTCFullYear()+Math.floor((s.getUTCMonth()+i)/12),m=(s.getUTCMonth()+i)%12;
  if(fmt(new Date(Date.UTC(y,m,1)))>end)break;
  if(r.by==="date"){const day=s.getUTCDate();keep(day<=daysIn(y,m)?new Date(Date.UTC(y,m,day)):null)}   // no Feb 30
  else keep(nthWeekday(y,m,weekday,which));
 }
 return out;
}

/** The next date on or after `today` (the event page shows that one once a date has passed). */
export const nextOccurrence=(start:string,r:Repeat,today:string)=>occurrences(start,r,today,fmt(addDays(parse(today),800)),1)[0]||null;

/** "Every Tuesday and Thursday", "Every month on the 2nd Saturday", "Every year on the last Saturday of October". */
export function describe(start:string,r:Repeat){
 if(r.kind==="none")return"";
 let s="";
 if(r.kind==="weekly"){const days=(r.days.length?r.days:[parse(start).getUTCDay()]).slice().sort((a,b)=>a-b).map(d=>DAY[d]);
  s=days.length===7?"Every day":`Every ${days.length>1?days.slice(0,-1).join(", ")+" and "+days[days.length-1]:days[0]}`}
 else{const opt=byOptions(start,r.kind).find(o=>o.by===r.by)?.label||"";s=`${r.kind==="monthly"?"Every month":"Every year"} ${opt.replace(/^On /,"on ").replace(/^Every /,"on ")}`}
 if(r.until)s+=` until ${MONTH[parse(r.until).getUTCMonth()].slice(0,3)} ${parse(r.until).getUTCDate()}, ${parse(r.until).getUTCFullYear()}`;
 return s;
}

/** RRULE for calendar apps (they then show every date by themselves). */
export function rrule(start:string,r:Repeat){
 if(r.kind==="none")return"";
 const {weekday,n}=weekdayPlace(start),until=r.until?`;UNTIL=${r.until.replace(/-/g,"")}T235959Z`:"";
 if(r.kind==="weekly")return`FREQ=WEEKLY;BYDAY=${(r.days.length?r.days:[weekday]).map(d=>ABBR[d]).join(",")}${until}`;
 const by=r.by==="date"?`BYMONTHDAY=${parse(start).getUTCDate()}`:`BYDAY=${r.by==="last"?-1:n}${ABBR[weekday]}`;
 return r.kind==="monthly"?`FREQ=MONTHLY;${by}${until}`:`FREQ=YEARLY;BYMONTH=${parse(start).getUTCMonth()+1};${by}${until}`;
}

/** Clean form input. */
export function cleanRepeat(raw:any,start:string):Repeat{
 const kind:RepeatKind=["weekly","monthly","yearly"].includes(raw?.kind)?raw.kind:"none";
 if(kind==="none")return NO_REPEAT;
 const days=kind==="weekly"?[...new Set((Array.isArray(raw.days)?raw.days:[]).map(Number).filter((d:number)=>Number.isInteger(d)&&d>=0&&d<=6))] as number[]:[];
 let by:RepeatBy=["nth","last"].includes(raw.by)?raw.by:"date";
 if(kind!=="weekly"&&/^\d{4}-\d{2}-\d{2}$/.test(start)&&!byOptions(start,kind).some(o=>o.by===by))by="date";
 const until=/^\d{4}-\d{2}-\d{2}$/.test(String(raw.until||""))&&String(raw.until)>=start?String(raw.until):"";
 return{kind,days:kind==="weekly"&&!days.length&&/^\d{4}-\d{2}-\d{2}$/.test(start)?[parse(start).getUTCDay()]:days,by:kind==="weekly"?"date":by,until};
}
