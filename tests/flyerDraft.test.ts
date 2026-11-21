import test from "node:test";
import assert from "node:assert/strict";
import {toFlyerDraft,applyFlyerDraft} from "../lib/flyerDraft";

const base={title:"",date:"",startTime:"",endTime:"",venue:"",address:"",city:"",description:"",isFree:true,visibility:"public" as const};

test("toFlyerDraft maps every stated field",()=>{
 const d=toFlyerDraft({title:"Matteo's 6th Birthday",date:"2026-10-30",start:"18:00",place:"Flying Squirrel at Weston",town:"Weston",summary:"Minions party.",free:false},"2026-10-26");
 assert.equal(d.title,"Matteo's 6th Birthday");assert.equal(d.date,"2026-10-30");assert.equal(d.start,"18:00");
 assert.equal(d.place,"Flying Squirrel at Weston");assert.equal(d.town,"Weston");assert.equal(d.summary,"Minions party.");assert.equal(d.free,false);
});

test("toFlyerDraft splits a street address out of the place name",()=>{
 const d=toFlyerDraft({title:"Krishan's 8th Birthday",date:"2026-12-19",start:"11:00",end:"13:00",place:"Off The Wall, 9130 W State Rd 84",town:"Davie"},"2026-11-21");
 assert.equal(d.place,"Off The Wall");assert.equal(d.address,"9130 W State Rd 84");assert.equal(d.town,"Davie");
});

test("toFlyerDraft keeps a place whole when there is no address in it",()=>{
 const plain=toFlyerDraft({title:"Party",date:"2026-10-30",place:"Flying Squirrel at Weston"},"2026-10-26");
 assert.equal(plain.place,"Flying Squirrel at Weston");assert.equal(plain.address,undefined);
 const commaNoNumber=toFlyerDraft({title:"Party",date:"2026-10-30",place:"Studio 54, New York"},"2026-10-26");
 assert.equal(commaNoNumber.place,"Studio 54, New York");assert.equal(commaNoNumber.address,undefined);
});

test("applyFlyerDraft fills the street address only when empty",()=>{
 const v=applyFlyerDraft({...base},{title:"X",place:"Off The Wall",address:"9130 W State Rd 84"});
 assert.equal(v.venue,"Off The Wall");assert.equal(v.address,"9130 W State Rd 84");
 const kept=applyFlyerDraft({...base,address:"1 Main St"},{title:"X",place:"Off The Wall",address:"9130 W State Rd 84"});
 assert.equal(kept.address,"1 Main St");
});

test("toFlyerDraft drops past dates and malformed times",()=>{
 const d=toFlyerDraft({title:"Old Party",date:"2026-10-20",start:"6pm",end:"25:00"},"2026-10-26");
 assert.equal(d.date,undefined);assert.equal(d.start,undefined);assert.equal(d.end,undefined);assert.equal(d.title,"Old Party");
});

test("applyFlyerDraft fills only empty fields and applies free",()=>{
 const v=applyFlyerDraft({...base,title:"My Party",isFree:true},{title:"Flyer Title",date:"2026-10-30",start:"18:00",place:"Flying Squirrel at Weston",free:false});
 assert.equal(v.title,"My Party");assert.equal(v.date,"2026-10-30");assert.equal(v.startTime,"18:00");assert.equal(v.venue,"Flying Squirrel at Weston");assert.equal(v.isFree,false);
});

test("applyFlyerDraft leaves isFree alone when the flyer says nothing",()=>{
 const v=applyFlyerDraft({...base,isFree:true},{title:"X"});
 assert.equal(v.isFree,true);
});

test("toFlyerDraft maps RSVP contact and drops a malformed reply-by date",()=>{
 const d=toFlyerDraft({title:"Party",date:"2026-10-30",rsvp:{name:"  Jordan  ",phone:"(754) 555-0123",email:"Jordan@Example.com",by:"2026-10-25"}},"2026-10-26");
 assert.deepEqual(d.rsvp,{name:"Jordan",phone:"(754) 555-0123",email:"jordan@example.com",by:"2026-10-25"});
 const bad=toFlyerDraft({title:"Party",date:"2026-10-30",rsvp:{name:"Jordan",by:"Oct 25"}},"2026-10-26");
 assert.deepEqual(bad.rsvp,{name:"Jordan"});
 const empty=toFlyerDraft({title:"Party",date:"2026-10-30",rsvp:{}},"2026-10-26");
 assert.equal(empty.rsvp,undefined);
});

test("toFlyerDraft caps RSVP fields at the form's limits",()=>{
 const d=toFlyerDraft({title:"Party",date:"2026-10-30",rsvp:{name:"N".repeat(80),phone:"1".repeat(50),email:"e@x.com".padEnd(130,"a")}},"2026-10-26");
 assert.equal(d.rsvp?.name?.length,60);assert.equal(d.rsvp?.phone?.length,40);assert.equal(d.rsvp?.email?.length,120);
});

test("applyFlyerDraft fills only empty RSVP fields and keeps onSite",()=>{
 const v=applyFlyerDraft({...base,rsvp:{onSite:false,name:"Sam",phone:"",email:"",by:""}},{title:"X",rsvp:{name:"Jordan",phone:"754-555-0123",email:"j@example.com",by:"2026-10-25"}});
 assert.deepEqual(v.rsvp,{onSite:false,name:"Sam",phone:"754-555-0123",email:"j@example.com",by:"2026-10-25"});
});

test("applyFlyerDraft defaults onSite from visibility when no RSVP exists yet",()=>{
 const pub=applyFlyerDraft({...base,visibility:"public" as const},{title:"X",rsvp:{name:"Jordan"}});
 assert.equal(pub.rsvp?.onSite,false);assert.equal(pub.rsvp?.name,"Jordan");
 const priv=applyFlyerDraft({...base,visibility:"private" as const},{title:"X",rsvp:{phone:"754-555-0123"}});
 assert.equal(priv.rsvp?.onSite,true);assert.equal(priv.rsvp?.phone,"754-555-0123");
});

test("applyFlyerDraft leaves RSVP alone when the flyer states none",()=>{
 const v=applyFlyerDraft({...base,rsvp:{onSite:true,name:"Sam",phone:"",email:"",by:""}},{title:"X"});
 assert.deepEqual(v.rsvp,{onSite:true,name:"Sam",phone:"",email:"",by:""});
 const fresh=applyFlyerDraft({...base},{title:"X"});
 assert.equal(fresh.rsvp,undefined);
});
