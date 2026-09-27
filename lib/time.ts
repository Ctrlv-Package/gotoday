// Time zone helpers built on Intl (no dependencies). Handle daylight-saving changes correctly for
// any IANA zone, so event times stay right across DST and in other time zones.

export const DEFAULT_TZ="America/New_York";

/** Offset (ms) of `tz` from UTC at instant `ts` (e.g. -4h during EDT, -5h during EST). */
export function tzOffsetMs(ts:number,tz:string){
 const p=new Intl.DateTimeFormat("en-US",{timeZone:tz,hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).formatToParts(new Date(ts));
 const g=(t:string)=>Number(p.find(x=>x.type===t)?.value);
 return Date.UTC(g("year"),g("month")-1,g("day"),g("hour")%24,g("minute"),g("second"))-Math.floor(ts/1000)*1000;
}

/** Local wall-clock date ("2026-11-07") + time ("19:00:00", or "" for all day) in `tz` -> UTC Date. */
export function zonedToUtc(date:string,time:string|undefined,tz:string=DEFAULT_TZ):Date{
 const [y,m,d]=date.split("-").map(Number);
 const [hh,mm,ss]=(time||"00:00:00").split(":").map(x=>Number(x)||0);
 const guess=Date.UTC(y,m-1,d,hh,mm,ss);
 let ts=guess-tzOffsetMs(guess,tz);
 const again=guess-tzOffsetMs(ts,tz); // correct when the guess straddles a DST change
 if(again!==ts)ts=again;
 return new Date(ts);
}

/** Local parts of an instant in `tz`: {date:"2026-11-07", time:"19:00:00"}. */
export function localParts(d:Date,tz:string=DEFAULT_TZ){
 const p=new Intl.DateTimeFormat("en-CA",{timeZone:tz,hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).formatToParts(d);
 const g=(t:string)=>p.find(x=>x.type===t)?.value||"00";
 return{date:`${g("year")}-${g("month")}-${g("day")}`,time:`${g("hour").replace(/^24$/,"00")}:${g("minute")}:${g("second")}`};
}

/** Today's date in `tz` ("2026-09-27"). */
export const todayIn=(tz:string=DEFAULT_TZ)=>localParts(new Date(),tz).date;
