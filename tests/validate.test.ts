import {test} from "node:test";
import assert from "node:assert/strict";
import {isValidEvent, validationErrors} from "../lib/ingestion/validate";
import type {EventRecord} from "../lib/ingestion/types";

const base: EventRecord = {
  id: "test-1", title: "Family Storytime", city: "Sunrise, FL", venue: "West Regional Library",
  date: "2026-10-21", time: "10:30", url: "https://example.org/storytime",
  category: "Library", genre: "", desc: "Stories and songs for kids.", tags: ["Kids"], emoji: "", source: "Broward Library",
};

test("a normal listing is valid", () => {
  assert.equal(isValidEvent(base), true);
  assert.deepEqual(validationErrors(base), []);
});
test("a placeholder title is rejected", () => {
  assert.ok(validationErrors({...base, title: "More Details"}).includes("title"));
});
test("a scraped navigation title is rejected", () => {
  assert.ok(validationErrors({...base, title: "Calendar of Events"}).includes("title"));
});
test("a bad date is rejected", () => {
  assert.ok(validationErrors({...base, date: "Oct 21"}).includes("date"));
});
test("a non-web link is rejected", () => {
  assert.ok(validationErrors({...base, url: "javascript:void(0)"}).includes("url"));
});
test("site boilerplate in the description is rejected", () => {
  assert.ok(validationErrors({...base, desc: "Use the calendarEvent moduleContent to subscribe"}).includes("description"));
});
