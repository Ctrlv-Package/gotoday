import test from "node:test";
import assert from "node:assert/strict";
import {townFromLibrary as t} from "../lib/ingestion/platforms";

test("consortium library names give the library's own town", ()=>{
 assert.equal(t("Montclair Public Library","South Orange, NJ"),"Montclair, NJ");
 assert.equal(t("Fair Lawn's Maurice M. Pine Library","South Orange, NJ"),"Fair Lawn, NJ");
 assert.equal(t("Palisades Park - Meeting Room","South Orange, NJ"),"Palisades Park, NJ");
 assert.equal(t("Ridgefield Park Free Public Library","South Orange, NJ"),"Ridgefield Park, NJ");
});
test("branch rooms and generic names keep the home town", ()=>{
 for(const v of ["Main Library","Central Library","Bergen County Library","Children's Room","Meeting Room A","Northwest Branch Library","Lakes Regional Library","South Orange Public Library","Main Branch - Room 2","Youth Services - Story Room"])
  assert.equal(t(v,"South Orange, NJ"),"",v);
 assert.equal(t("Montclair Public Library",""),"");
});
