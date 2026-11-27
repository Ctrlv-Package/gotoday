import {test} from "node:test";
import assert from "node:assert/strict";
import {db} from "../lib/db";
import {purgeImages,existingImageKeys,mapImageKeys} from "../lib/images";

// The purge must not delete a copy a borrowed picture still serves: recurring events borrow
// their picture from the same event up to 90 days back (familyPictures), so the purge's
// protection window has to reach 90 days too. (The old 3-day window deleted bytes the Nov 22,
// 2026 cards still pointed at, and those cards fell back to the emoji tile.)
test("purgeImages protects copies referenced by events up to 90 days back",async()=>{
 const orig=(db as any).query;
 let deleteSql="";
 (db as any).query=async(sql:string)=>{
  if(typeof sql==="string"&&sql.includes("delete from images")){deleteSql=sql;return{rowCount:7}}
  return{rows:[]};
 };
 try{
  assert.equal(await purgeImages(),7);
  assert.ok(deleteSql.includes("current_date-90"),"protection window must reach the 90-day borrow window");
  assert.ok(!deleteSql.includes("current_date-3"),"the old 3-day window must be gone");
  assert.ok(deleteSql.includes("from stock_photos"),"library photos stay protected");
  assert.ok(deleteSql.includes("from community_events"),"community event photos stay protected");
 }finally{(db as any).query=orig}
});

test("existingImageKeys reports which stored keys are still there",async()=>{
 const orig=(db as any).query;
 let queries=0;
 (db as any).query=async()=>{
  queries++;
  return{rows:[{key:"aaaaaaaaaaaaaaaaaaaaaaaa"},{key:"bbbbbbbbbbbbbbbbbbbbbbbb"}]};
 };
 try{
  const have=await existingImageKeys(["aaaaaaaaaaaaaaaaaaaaaaaa","bbbbbbbbbbbbbbbbbbbbbbbb","cccccccccccccccccccccccc"]);
  assert.deepEqual([...have].sort(),["aaaaaaaaaaaaaaaaaaaaaaaa","bbbbbbbbbbbbbbbbbbbbbbbb"]);
  assert.equal(queries,1);
  assert.deepEqual([...await existingImageKeys([])],[]);
 }finally{(db as any).query=orig}
});

test("mapImageKeys reports keys stored from a map source",async()=>{
 const orig=(db as any).query;
 let sql="",params:any[]=[];
 (db as any).query=async(s:string,p?:any[])=>{
  sql=typeof s==="string"?s:"";params=p||[];
  return{rows:[{key:"aaaaaaaaaaaaaaaaaaaaaaaa"}]};
 };
 try{
  const found=await mapImageKeys(["aaaaaaaaaaaaaaaaaaaaaaaa","bbbbbbbbbbbbbbbbbbbbbbbb"]);
  assert.deepEqual([...found],["aaaaaaaaaaaaaaaaaaaaaaaa"]);
  assert.ok(sql.includes("source_url"),"the check must read the stored source URL");
  assert.ok(sql.includes("~*"),"the check must use a case-insensitive pattern match");
  assert.ok(String(params[1]||"").includes("openstreetmap"),"the pattern must cover map tile services");
  assert.deepEqual([...await mapImageKeys([])],[]);
 }finally{(db as any).query=orig}
});
