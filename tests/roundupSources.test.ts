import {test} from "node:test";
import assert from "node:assert/strict";
import {SEED_SOURCES} from "../lib/ingestion/registry";
import {ROUNDUP_USERNAMES} from "../lib/sources/instagram";

// Weekend round-up accounts (researched Oct 2026, cadence re-verified Nov 22, 2026: each still
// posts a weekly weekend list). They get every carousel slide read, so each event in the
// round-up can use its own slide as its picture.
const ADDED=["miamifunevents","thepalmbeachweekender","moms_of_myrtle","cville_kids","macaronikiderie","visitfayettevillenc"];
test("added round-up sources are roundups in the registry and known to the reader",()=>{
 for(const u of ADDED){
  const c=SEED_SOURCES.find(s=>s.platform==="instagram"&&s.params?.username===u);
  assert.ok(c,`no registry source for @${u}`);
  assert.equal(c.source_type,"roundup");
  assert.equal(c.priority,70);
  assert.ok(ROUNDUP_USERNAMES.has(u),`@${u} missing from the reader round-up set`);
 }
 // The two sides must agree: a roundup registry entry the reader doesn't know about would be
 // read as an ordinary account (4 slides, no round-up title filter).
 for(const c of SEED_SOURCES.filter(s=>s.platform==="instagram"&&s.source_type==="roundup")){
  assert.ok(ROUNDUP_USERNAMES.has(String(c.params.username)),`@${c.params.username} is a roundup source but not in the reader set`);
 }
});
