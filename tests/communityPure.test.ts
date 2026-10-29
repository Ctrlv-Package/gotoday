import {test} from "node:test";
import assert from "node:assert/strict";
import {validate,cleanPhone,showPhone,cleanRsvp,tzForCity,listingDates,startOf,endOf,rowToEvent} from "../lib/community";
import {NO_REPEAT} from "../lib/repeat";
import {DEFAULT_TZ} from "../lib/time";

// The create form's validation: what a visitor can publish, and what gets stopped.
const future=()=>new Date(Date.now()+30*86400e3).toISOString().slice(0,10);
const past=()=>new Date(Date.now()-2*86400e3).toISOString().slice(0,10);
const farFuture=()=>new Date(Date.now()+500*86400e3).toISOString().slice(0,10);
const base=(o:any={})=>({title:"Boo Bash",description:"A fun night.",date:future(),startTime:"18:00",endTime:"20:00",venue:"ArtsPark",city:"Hollywood, FL",categories:["Community"],...o});

test("a complete form validates",()=>{
 const r=validate(base());
 assert.equal(r.ok,true);
 if(r.ok){assert.equal(r.v.title,"Boo Bash");assert.equal(r.v.startTime,"18:00");assert.equal(r.v.city,"Hollywood, FL");assert.deepEqual(r.v.categories,["Community"])}
});

test("each missing or bad field is named",()=>{
 const bad=(o:any,msg:string)=>{const r=validate(base(o));assert.equal(r.ok,false);if(!r.ok)assert.ok(r.errors.includes(msg),`expected "${msg}" in ${r.errors.join("; ")}`)};
 bad({title:"AB"},"Add a title.");
 bad({categories:[]},"Pick at least one category.");
 bad({date:"not-a-date"},"Pick a date.");
 bad({date:past()},"The date has already passed.");
 bad({date:farFuture()},"Pick a date within the next year.");
 bad({startTime:""},"Add a start time (or mark it all day).");
 bad({venue:"",address:""},"Add a place (venue name or address).");
 bad({city:""},"Add the city.");
});

test("all-day clears the times, and an end before the start is dropped, not an error",()=>{
 const all=validate(base({allDay:true,startTime:"18:00",endTime:"20:00"}));
 assert.equal(all.ok,true);if(all.ok){assert.equal(all.v.startTime,"");assert.equal(all.v.endTime,"")}
 const flipped=validate(base({endTime:"17:00"}));
 assert.equal(flipped.ok,true);if(flipped.ok)assert.equal(flipped.v.endTime,"");
});

test("ages are swapped into order, free clears the price, and a bare town gets Florida",()=>{
 const r=validate(base({ageMin:10,ageMax:5,isFree:true,priceText:"$5",city:"Hollywood"}));
 assert.equal(r.ok,true);if(r.ok){assert.equal(r.v.ageMin,5);assert.equal(r.v.ageMax,10);assert.equal(r.v.priceText,"");assert.equal(r.v.city,"Hollywood, FL")}
});

test("bad links, bad photos and unknown categories are dropped, and categories cap at four",()=>{
 const r=validate(base({link:"notaurl",image:"https://example.com/x.jpg",categories:["Community","Bogus","Music","Arts & Theatre","Sports","Food & Drink"]}));
 assert.equal(r.ok,true);if(r.ok){assert.equal(r.v.link,"");assert.equal(r.v.image,"");assert.deepEqual(r.v.categories,["Community","Music","Arts & Theatre","Sports"])}
});

test("an impossible repeat choice falls back to the date, and a monthly repeat caps at two years",()=>{
 const nth=validate(base({date:"2026-10-31",repeat:{kind:"monthly",by:"nth"}}));
 assert.equal(nth.ok,true);if(nth.ok)assert.equal(nth.v.repeat.by,"date");
 const capped=validate(base({date:"2027-06-15",repeat:{kind:"monthly",by:"date",until:"2030-01-01"}}));
 assert.equal(capped.ok,true);if(capped.ok)assert.equal(capped.v.repeat.until,"2029-06-14");
});

test("RSVP phone numbers are cleaned to E.164 and bad ones are errors",()=>{
 assert.equal(cleanPhone("(754) 555-0123"),"+17545550123");
 assert.equal(cleanPhone("17545550123"),"+17545550123");
 assert.equal(cleanPhone("+44 20 7946 0958"),"+442079460958");
 assert.equal(cleanPhone("abc"),"");
 assert.equal(showPhone("+17545550123"),"(754) 555-0123");
 const bad=cleanRsvp({phone:"abc",email:"not-an-email"},"public","2026-10-31");
 assert.deepEqual(bad.errors,["The RSVP phone number doesn't look right.","The RSVP email doesn't look right."]);
 const clamped=cleanRsvp({by:"2026-12-25"},"public","2026-10-31");
 assert.equal(clamped.rsvp.by,"2026-10-31");
 assert.equal(cleanRsvp({},"public","2026-10-31").rsvp.onSite,false);
 assert.equal(cleanRsvp({},"private","2026-10-31").rsvp.onSite,true);
});

test("time zones come from the state, defaulting to Eastern",()=>{
 assert.equal(tzForCity("Austin, TX"),"America/Chicago");
 assert.equal(tzForCity("Hollywood, FL"),DEFAULT_TZ);
 assert.equal(tzForCity("Nowhere"),DEFAULT_TZ);
});

test("listing dates: a one-off shows its date, a weekly shows coming Mondays",()=>{
 const one={date:"2026-10-31",repeat:NO_REPEAT} as any;
 assert.deepEqual(listingDates(one,"2026-10-29"),["2026-10-31"]);
 const weekly={date:"2026-10-26",repeat:{kind:"weekly",days:[1],by:"date",until:""}} as any;
 const dates=listingDates(weekly,"2026-10-29");
 assert.equal(dates[0],"2026-11-02");
 assert.ok(dates.length<=60);
 assert.ok(dates.every(d=>new Date(d+"T00:00:00Z").getUTCDay()===1));
});

test("start and end convert the local wall-clock time to UTC",()=>{
 const e={date:"2026-10-31",startTime:"18:00",endTime:"20:00",allDay:false,tz:"America/New_York"} as any;
 assert.equal(startOf(e).toISOString(),"2026-10-31T22:00:00.000Z");
 assert.equal(endOf(e)!.toISOString(),"2026-11-01T00:00:00.000Z");
 const allDay={...e,allDay:true} as any;
 assert.equal(startOf(allDay).toISOString(),"2026-10-31T04:00:00.000Z");
 assert.equal(endOf(allDay),null);
});

test("a database row maps to the event shape the pages use",()=>{
 const row={id:1,share_token:"abc",status:"live",review_reason:null,timezone:"America/New_York",latitude:26.01,longitude:-80.15,event_id:null,created_at:"2026-10-01T00:00:00Z",title:"Boo Bash",description:"x",start_date:"2026-10-31",start_time:"18:00",end_time:"20:00",all_day:false,venue:"ArtsPark",address:"",city:"Hollywood, FL",visibility:"public",is_free:true,price_text:"",age_min:null,age_max:null,category:"Community",link:"",host_name:"",image:"",repeat:null,categories:[]};
 const ev=rowToEvent(row);
 assert.equal(ev.date,"2026-10-31");
 assert.equal(ev.tz,"America/New_York");
 assert.deepEqual(ev.repeat,NO_REPEAT);
 assert.deepEqual(ev.categories,["Community"]);
});
