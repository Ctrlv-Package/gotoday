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

// Sample photos must always fill the card (object-fit: cover, the .pic
// default). fitPic letterboxes non-16:9 photos via the "whole" class, and it
// only runs from img onLoad — which a cached image can beat during hydration.
// That race made the portrait market sample render narrow with gradient sides
// on first load and full-bleed on refresh. Samples are illustrations, so they
// never run fitPic; real event cards still do.
import {readFileSync} from "node:fs";

test("sample strip photos never run fitPic, event cards still do", () => {
 const src = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
 const lines = src.split("\n");
 const sampleImg = lines.find((l) => l.includes("src={s.image}"));
 assert.ok(sampleImg, "sample strip img not found");
 assert.equal(
  sampleImg.includes("fitPic"),
  false,
  "sample img must not run fitPic or a portrait sample letterboxes on first load",
 );
 const eventImg = lines.find((l) => l.includes("src={e.image}") && l.includes("picMain"));
 assert.ok(eventImg, "event card img not found");
 assert.equal(eventImg.includes("fitPic"), true, "event cards still use fitPic");
});
