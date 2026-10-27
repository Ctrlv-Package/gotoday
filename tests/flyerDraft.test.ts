import test from "node:test";
import assert from "node:assert/strict";
import {toFlyerDraft,applyFlyerDraft} from "../lib/flyerDraft";

const base={title:"",date:"",startTime:"",endTime:"",venue:"",city:"",description:"",isFree:true};

test("toFlyerDraft maps every stated field",()=>{
 const d=toFlyerDraft({title:"Matteo's 6th Birthday",date:"2026-10-30",start:"18:00",place:"Flying Squirrel at Weston",town:"Weston",summary:"Minions party.",free:false},"2026-10-26");
 assert.equal(d.title,"Matteo's 6th Birthday");assert.equal(d.date,"2026-10-30");assert.equal(d.start,"18:00");
 assert.equal(d.place,"Flying Squirrel at Weston");assert.equal(d.town,"Weston");assert.equal(d.summary,"Minions party.");assert.equal(d.free,false);
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
