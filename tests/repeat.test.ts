import {test} from "node:test";
import assert from "node:assert/strict";
import {occurrences,byOptions,describe,rrule,cleanRepeat,nextOccurrence} from "../lib/repeat";

test("weekly on several days", () => {
  const r=cleanRepeat({kind:"weekly",days:[2,4]},"2026-10-27");   // Tue
  assert.deepEqual(occurrences("2026-10-27",r,"2026-10-01","2026-11-06"),["2026-10-27","2026-10-29","2026-11-03","2026-11-05"]);
  assert.equal(describe("2026-10-27",r),"Every Tuesday and Thursday");
  assert.equal(rrule("2026-10-27",r),"FREQ=WEEKLY;BYDAY=TU,TH");
});

test("yearly on the 4th Saturday of October moves with the weekday", () => {
  const r=cleanRepeat({kind:"yearly",by:"nth"},"2026-10-24");   // 4th Saturday of Oct 2026
  assert.deepEqual(occurrences("2026-10-24",r,"2026-01-01","2028-12-31"),["2026-10-24","2027-10-23","2028-10-28"]);
  assert.equal(describe("2026-10-24",r),"Every year on the 4th Saturday of October");
  assert.equal(rrule("2026-10-24",r),"FREQ=YEARLY;BYMONTH=10;BYDAY=4SA");
});

test("last Saturday, and options offered for the date", () => {
  assert.deepEqual(byOptions("2026-10-31","monthly").map(o=>o.by),["date","last"]);   // 5th Saturday → last only
  assert.deepEqual(byOptions("2026-10-24","yearly").map(o=>o.by),["date","nth"]);   // 4th (Oct 31 is the last)
  assert.deepEqual(byOptions("2026-10-25","monthly").map(o=>o.by),["date","nth","last"]);   // 4th Sunday is also the last
  const r=cleanRepeat({kind:"monthly",by:"last"},"2026-10-31");
  assert.deepEqual(occurrences("2026-10-31",r,"2026-10-01","2027-01-31"),["2026-10-31","2026-11-28","2026-12-26","2027-01-30"]);
});

test("monthly on the 31st skips short months; until ends it", () => {
  const r=cleanRepeat({kind:"monthly",by:"date",until:"2027-03-31"},"2026-12-31");
  assert.deepEqual(occurrences("2026-12-31",r,"2026-12-01","2027-12-31"),["2026-12-31","2027-01-31","2027-03-31"]);
  assert.equal(nextOccurrence("2026-12-31",r,"2027-02-01"),"2027-03-31");
  assert.equal(nextOccurrence("2026-12-31",r,"2027-04-01"),null);
});

test("an option that doesn't fit the date falls back to the date", () => {
  assert.equal(cleanRepeat({kind:"monthly",by:"nth"},"2026-10-31").by,"date");
  assert.equal(cleanRepeat({kind:"none"},"2026-10-31").kind,"none");
});
