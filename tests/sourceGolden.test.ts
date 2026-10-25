import {test} from "node:test";
import assert from "node:assert/strict";
import {readdirSync,readFileSync} from "node:fs";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {facetsFor} from "../lib/facets";

// Per-source golden sets (tests/golden-sources/*.json): each source's representative listings
// with the facets they must (and must not) get. A new source earns a file when it is onboarded;
// a case that stops passing means a rule changed for that source, and the impact report
// (scripts/rule-impact.ts) shows how far the change reaches.
const dir=join(dirname(fileURLToPath(import.meta.url)),"golden-sources");
for(const file of readdirSync(dir).filter(f=>f.endsWith(".json"))){
 const set=JSON.parse(readFileSync(join(dir,file),"utf8"));
 for(const c of set.cases){
  test(`${set.source}: ${c.name}`,()=>{
   const got=facetsFor(c.input);
   for(const x of c.expect||[])assert.ok(got.includes(x),`expected ${x} in ${JSON.stringify(got)}`);
   for(const x of c.forbid||[])assert.ok(!got.includes(x),`forbade ${x} in ${JSON.stringify(got)}`);
  });
 }
}
