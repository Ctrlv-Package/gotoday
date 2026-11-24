import {test} from "node:test";
import assert from "node:assert/strict";
import {pickLibraryPhoto} from "../lib/stockPhotos";

// The library photo pick, without a database: topic → /img/ URLs.
const lib=(o:Record<string,string[]>)=>new Map(Object.entries(o));
const story=lib({storytime:["/img/s1","/img/s2"],kids:["/img/k1","/img/k2"],baby:["/img/b1","/img/b2"],reading:["/img/r1"],crafts:["/img/c1"]});

test("no avoid: the title's seed pick from its own topic, stable across calls",()=>{
 const a=pickLibraryPhoto("storytime","All Ages Story Time",undefined,story);
 assert.ok(["/img/s1","/img/s2"].includes(a));
 assert.equal(pickLibraryPhoto("storytime","All Ages Story Time",undefined,story),a);
});

test("an avoided seed pick moves to the next photo in the topic",()=>{
 const first=pickLibraryPhoto("storytime","All Ages Story Time",undefined,story);
 const second=pickLibraryPhoto("storytime","All Ages Story Time",new Set([first]),story);
 assert.notEqual(second,first);
 assert.ok(["/img/s1","/img/s2"].includes(second));
});

test("a used-up topic borrows from the NEXT topic, not a repeat",()=>{
 const p=pickLibraryPhoto("storytime","All Ages Story Time",new Set(["/img/s1","/img/s2"]),story);
 assert.ok(["/img/k1","/img/k2","/img/b1","/img/b2"].includes(p));
});

test("the NEXT walk does not cycle kids<->baby: a used-up chain borrows from any topic",()=>{
 // storytime + kids + baby all used: the old code cycled kids<->baby and then repeated a
 // storytime photo. The pick must come from an unrelated topic instead.
 const used=new Set(["/img/s1","/img/s2","/img/k1","/img/k2","/img/b1","/img/b2"]);
 const p=pickLibraryPhoto("storytime","All Ages Story Time",used,story);
 assert.ok(["/img/r1","/img/c1"].includes(p));
});

test("a whole library used up repeats the title's own pick (unavoidable)",()=>{
 const used=new Set(["/img/s1","/img/s2","/img/k1","/img/k2","/img/b1","/img/b2","/img/r1","/img/c1"]);
 const p=pickLibraryPhoto("storytime","All Ages Story Time",used,story);
 assert.ok(["/img/s1","/img/s2"].includes(p));
});

test("an empty topic falls through to its NEXT topic",()=>{
 const p=pickLibraryPhoto("reading","Book Club",undefined,lib({reading:[],storytime:["/img/s1"]}));
 assert.equal(p,"/img/s1");
});
