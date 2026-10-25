// Shared recurrence expansion: one rule-bearing listing becomes one dated occurrence per
// matching day. This is the representation the site chose for recurring events (a dated
// occurrence shows on that day's page; a single "Saturdays 9-1" card cannot).
//
// Rule language (plain strings, as they arrive from source calendars):
//   "Every Thursday", "Every Second Friday", "Every Last Saturday", "Everyday" / "Daily",
//   "Weekdays", "Weekends". An empty rule list means every day in the range.
// Dates are UTC-safe and date-only; [from,to] is the ingestion window, so expansion is
// bounded by the caller's window, never open-ended.
// First used by Broward County Parks; the USDA farmers-market adapter will use it next.
const DAYS=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const NTH:Record<string,number>={first:1,second:2,third:3,fourth:4,last:-1};

/** Dates in [from,to] that match the recurrence rules (UTC-safe; dates only). */
export function expandDates(start:string,end:string,rules:string[],from:string,to:string):string[]{
 const s=start>from?start:from,e=(end||start)<to?(end||start):to;
 if(s>e)return[];
 const out:string[]=[];
 for(let d=new Date(s+"T12:00:00Z");d.toISOString().slice(0,10)<=e;d.setUTCDate(d.getUTCDate()+1)){
  const date=d.toISOString().slice(0,10),dow=d.getUTCDay(),dom=d.getUTCDate();
  const dim=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
  const ok=rules.length===0||rules.some(r=>{
   const x=r.toLowerCase().trim();
   if(/every\s*day|everyday|daily/.test(x))return true;
   if(/weekdays?/.test(x)&&!/weekends?/.test(x))return dow>=1&&dow<=5;
   if(/weekends?/.test(x))return dow===0||dow===6;
   const m=x.match(/every\s+(?:(first|second|third|fourth|last)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/);
   if(!m||DAYS.indexOf(m[2])!==dow)return false;
   if(!m[1])return true;
   const n=NTH[m[1]];
   return n===-1?dom+7>dim:Math.ceil(dom/7)===n;
  });
  if(ok)out.push(date);
 }
 return out;
}
