import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {discoveryRejection} from "../lib/ingestion/utils";
import type {EventRecord} from "../lib/ingestion/types";

// The golden set: real keep/drop judgments (most taken from this repo's own commit history).
// Every filter change must keep this set green. When a new junk pattern shows up in the admin
// review, add the listing here FIRST, labelled with the reason, then write the rule.
// See tests/golden/README.md.
type Case = {keep: boolean; reason?: string; note: string; title: string; tags: string[]; desc: string};
const cases = JSON.parse(readFileSync(new URL("./golden/listings.json", import.meta.url), "utf8")) as Case[];

const toEvent = (c: Case): EventRecord => ({
  id: "golden", title: c.title, city: "Sunrise, FL", venue: "West Regional Library",
  date: "2026-10-21", time: "10:00", url: "https://example.org/event",
  category: "", genre: "", desc: c.desc, tags: c.tags, emoji: "", source: "Golden set",
});

for (const c of cases) {
  test(`golden: ${c.keep ? "keep" : "drop"} — ${c.title}`, () => {
    const r = discoveryRejection(toEvent(c));
    if (c.keep) assert.equal(r, null, `expected KEEP but was dropped as "${r}". ${c.note}`);
    else {
      assert.notEqual(r, null, `expected DROP (${c.reason}) but was kept. ${c.note}`);
      if (c.reason) assert.equal(r, c.reason, `dropped, but for the wrong reason. ${c.note}`);
    }
  });
}
