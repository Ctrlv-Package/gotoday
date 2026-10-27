import test from "node:test";
import assert from "node:assert/strict";
import {REPORT_REASONS,validateReport} from "../lib/reports";

test("report validation accepts the fixed reasons and cleans the note",()=>{
 const ok=validateReport("listing",42,"Cancelled","  Wrong   day  ");
 assert.equal("error" in ok,false);
 if(!("error" in ok)){assert.equal(ok.kind,"listing");assert.equal(ok.id,42);assert.equal(ok.reason,"Cancelled");assert.equal(ok.note,"Wrong day")}
 const community=validateReport("community",7,"Other","");
 assert.equal("error" in community,false);
 const long=validateReport("listing",1,"Wrong place","x".repeat(600));
 if(!("error" in long))assert.equal(long.note.length,500);
});

test("report validation rejects bad input",()=>{
 assert.equal("error" in validateReport("listing",0,"Cancelled",""),true);
 assert.equal("error" in validateReport("listing","abc","Cancelled",""),true);
 assert.equal("error" in validateReport("listing",1,"Banana",""),true);
 assert.equal("error" in validateReport("venue",1,"Cancelled",""),true);
 assert.equal(REPORT_REASONS.length,5);
});
