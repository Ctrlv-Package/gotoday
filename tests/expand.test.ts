import {test} from "node:test";
import assert from "node:assert/strict";
import {expandDates} from "../lib/ingestion/expand";

// October 2026: Thursdays 1/8/15/22/29, Fridays 2/9/16/23/30, Oct 5 = Monday, Oct 10 = Saturday.
test("every weekday name picks only that weekday",()=>{
 assert.deepEqual(expandDates("2026-10-01","2026-10-31",["Every Thursday"],"2026-10-01","2026-10-31"),
  ["2026-10-01","2026-10-08","2026-10-15","2026-10-22","2026-10-29"]);
});
test("every second and every last pick the right occurrence",()=>{
 assert.deepEqual(expandDates("2026-10-01","2026-10-31",["Every Second Friday"],"2026-10-01","2026-10-31"),["2026-10-09"]);
 assert.deepEqual(expandDates("2026-10-01","2026-10-31",["Every Last Friday"],"2026-10-01","2026-10-31"),["2026-10-30"]);
});
test("everyday, weekdays and weekends",()=>{
 assert.deepEqual(expandDates("2026-10-05","2026-10-11",["Everyday"],"2026-10-05","2026-10-11"),
  ["2026-10-05","2026-10-06","2026-10-07","2026-10-08","2026-10-09","2026-10-10","2026-10-11"]);
 assert.deepEqual(expandDates("2026-10-05","2026-10-11",["Weekdays"],"2026-10-05","2026-10-11"),
  ["2026-10-05","2026-10-06","2026-10-07","2026-10-08","2026-10-09"]);
 assert.deepEqual(expandDates("2026-10-05","2026-10-11",["Weekends"],"2026-10-05","2026-10-11"),["2026-10-10","2026-10-11"]);
});
test("no rules means every day in the range",()=>{
 assert.deepEqual(expandDates("2026-10-05","2026-10-07",[],"2026-10-05","2026-10-11"),["2026-10-05","2026-10-06","2026-10-07"]);
});
test("multiple rules are an OR",()=>{
 assert.deepEqual(expandDates("2026-10-05","2026-10-11",["Every Saturday","Every Sunday"],"2026-10-05","2026-10-11"),["2026-10-10","2026-10-11"]);
});
test("the window clamps the program range on both sides",()=>{
 assert.deepEqual(expandDates("2026-10-01","2026-10-31",["Every Thursday"],"2026-10-08","2026-10-22"),["2026-10-08","2026-10-15","2026-10-22"]);
});
test("an empty intersection yields nothing",()=>{
 assert.deepEqual(expandDates("2026-11-01","2026-11-30",["Every Thursday"],"2026-10-01","2026-10-31"),[]);
 assert.deepEqual(expandDates("2026-10-10","2026-10-01",["Every Thursday"],"2026-10-01","2026-10-31"),[]);
});
