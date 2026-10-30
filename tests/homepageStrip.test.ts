import test from "node:test";
import assert from "node:assert/strict";
import {ES, RU} from "../lib/i18n-dict";

// Every string the homepage strip renders through t(). A missing key fails
// silently (English fallback), so the dict coverage is asserted here.
const STRIP_STRINGS = [
 "Find free events",
 "near you.",
 "Events like these, near you",
 "Find near me",
 "See events near you",
 "Enter your ZIP code or use your location to see real events near you.",
 "Concert under the city skyline",
 "Saturday farmers market",
 "Summer music festival",
];

test("homepage strip strings are translated in ES and RU", () => {
 for (const s of STRIP_STRINGS) {
  assert.ok(ES[s]?.length, `ES missing: ${s}`);
  assert.ok(RU[s]?.length, `RU missing: ${s}`);
 }
});

test("retired homepage strings are gone from the dicts", () => {
 for (const s of ["Happening today", "near you today.", "Find your", "next thing."]) {
  assert.equal(ES[s], undefined, `ES still has: ${s}`);
  assert.equal(RU[s], undefined, `RU still has: ${s}`);
 }
});
