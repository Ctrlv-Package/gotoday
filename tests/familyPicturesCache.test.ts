import {test} from "node:test";
import assert from "node:assert/strict";
import {db} from "../lib/db";
import {familyPictures, familyKey} from "../lib/copies";

// The town-set scan in familyPictures is the listing side's heaviest read (Neon: 88k calls in 3 days, up to
// 8,000 rows a call), so its rows are cached per town set. These tests stub db.query and count only the
// town-set scan query and its shared-picture query. Each test uses its own town, because the module-level
// cache is shared across the tests in this file.
const rowsFor=(title:string,city:string,image:string)=>[{id:9,title,city,image_url:image,source:"City Calendar"}];

test("town-set scan is cached, and a different town set scans again",async()=>{
 const orig=(db as any).query;
 let scans=0,sharedScans=0;
 (db as any).query=async(sql:string)=>{
  if(typeof sql==="string"&&sql.includes("current_date-90")){scans++;return{rows:rowsFor("Farmers Market","Weston","/img/flyer")}}
  if(typeof sql==="string"&&sql.includes("having count(distinct lower(title))")){sharedScans++;return{rows:[]}}
  return{rows:[]};
 };
 try{
  const first=await familyPictures([{title:"Farmers Market",city:"Weston, FL"}]);
  assert.equal(first.get(familyKey("Farmers Market","Weston, FL")),"/img/flyer");
  assert.equal(scans,1);
  assert.equal(sharedScans,1);
  // A second call for the same town reuses the cached rows: no second scan.
  const second=await familyPictures([{title:"Farmers Market",city:"Weston, FL"}]);
  assert.equal(second.get(familyKey("Farmers Market","Weston, FL")),"/img/flyer");
  assert.equal(scans,1);
  assert.equal(sharedScans,1);
  // A different town scans again.
  const other=await familyPictures([{title:"Jazz Night",city:"Hollywood, FL"}]);
  assert.equal(other.get(familyKey("Jazz Night","Hollywood, FL")),undefined);
  assert.equal(scans,2);
 }finally{(db as any).query=orig}
});

test("a failed town-set scan is never cached",async()=>{
 const orig=(db as any).query;
 let scans=0,failNext=true;
 (db as any).query=async(sql:string)=>{
  if(typeof sql==="string"&&sql.includes("current_date-90")){scans++;if(failNext){failNext=false;throw new Error("db down")}return{rows:rowsFor("Yoga Class","Sunrise","/img/yoga")}}
  return{rows:[]};
 };
 try{
  const failed=await familyPictures([{title:"Yoga Class",city:"Sunrise, FL"}]);
  assert.equal(failed.size,0);
  assert.equal(scans,1);
  // The next call retries the scan instead of serving the failure.
  const retried=await familyPictures([{title:"Yoga Class",city:"Sunrise, FL"}]);
  assert.equal(retried.get(familyKey("Yoga Class","Sunrise, FL")),"/img/yoga");
  assert.equal(scans,2);
 }finally{(db as any).query=orig}
});

test("cached town-set rows expire after the TTL",async()=>{
 const orig=(db as any).query;
 const realNow=Date.now;
 let now=realNow();
 (Date as any).now=()=>now;
 let scans=0;
 (db as any).query=async(sql:string)=>{
  if(typeof sql==="string"&&sql.includes("current_date-90")){scans++;return{rows:rowsFor("Art Walk","Miami","/img/art")}}
  return{rows:[]};
 };
 try{
  await familyPictures([{title:"Art Walk",city:"Miami, FL"}]);
  assert.equal(scans,1);
  now+=61*60e3;
  await familyPictures([{title:"Art Walk",city:"Miami, FL"}]);
  assert.equal(scans,2);
 }finally{(db as any).query=orig;(Date as any).now=realNow}
});
