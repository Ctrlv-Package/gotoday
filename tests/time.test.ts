import {test} from "node:test";
import assert from "node:assert/strict";
import {zonedToUtc, localParts, todayIn} from "../lib/time";

test("summer evening in New York is EDT (UTC-4)", () => {
  assert.equal(zonedToUtc("2026-07-01", "19:00:00").toISOString(), "2026-07-01T23:00:00.000Z");
});
test("winter evening in New York is EST (UTC-5)", () => {
  assert.equal(zonedToUtc("2026-01-15", "19:00:00").toISOString(), "2026-01-16T00:00:00.000Z");
});
test("spring-forward day resolves without a phantom hour", () => {
  // 2026-03-08: clocks jump 2:00 -> 3:00 in America/New_York.
  assert.equal(zonedToUtc("2026-03-08", "09:00:00").toISOString(), "2026-03-08T13:00:00.000Z");
});
test("localParts round-trips a zoned time", () => {
  const d = zonedToUtc("2026-11-07", "19:00:00");
  assert.deepEqual(localParts(d), {date: "2026-11-07", time: "19:00:00"});
});
test("todayIn returns a date shape", () => {
  assert.match(todayIn(), /^\d{4}-\d{2}-\d{2}$/);
});
