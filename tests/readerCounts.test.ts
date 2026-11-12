import {test} from "node:test";
import assert from "node:assert/strict";
import {aiPostsCap,capReached,emptyReaderCounts,normalizeReader,summarizeReaderByDay,summarizeReaderRows} from "../lib/readerCounts";

// Per-model reading counts for the public health page: which model read each Instagram post.

test("unknown reader names (including NULL from old rows) count as unknown",()=>{
 assert.equal(normalizeReader("gemini"),"gemini");
 assert.equal(normalizeReader("claude"),"claude");
 assert.equal(normalizeReader(null),"unknown");
 assert.equal(normalizeReader(undefined),"unknown");
 assert.equal(normalizeReader(""),"unknown");
 assert.equal(normalizeReader("gpt-6-luna"),"unknown");
});

test("today's rows sum per model, with missing and non-numeric counts as zero",()=>{
 assert.deepEqual(summarizeReaderRows([
  {reader:"gemini",n:90},{reader:"claude",n:35},{reader:null,n:12},{reader:"gemini",n:5},
 ]),{gemini:95,claude:35,unknown:12});
 assert.deepEqual(summarizeReaderRows([]),{gemini:0,claude:0,unknown:0});
 assert.deepEqual(summarizeReaderRows([{reader:"claude"}]),{gemini:0,claude:0,unknown:0});
 assert.deepEqual(summarizeReaderRows([{reader:"gemini",n:"7"}]),{gemini:7,claude:0,unknown:0});
 assert.deepEqual(emptyReaderCounts(),{gemini:0,claude:0,unknown:0});
});

test("by-day rows group per day, oldest first, with every model present even at zero",()=>{
 assert.deepEqual(summarizeReaderByDay([
  {day:"11-12",reader:"claude",n:35},{day:"11-11",reader:"gemini",n:120},
  {day:"11-12",reader:"gemini",n:80},{day:"11-11",reader:null,n:4},
  {day:"11-12",reader:"gemini",n:10},
 ]),[
  {day:"11-11",gemini:120,claude:0,unknown:4},
  {day:"11-12",gemini:90,claude:35,unknown:0},
 ]);
 assert.deepEqual(summarizeReaderByDay([{reader:"gemini",n:1}]),[]);
 assert.deepEqual(summarizeReaderByDay([]),[]);
});

test("the cap is reached exactly at the limit, and the env var moves it",()=>{
 assert.equal(capReached(120,120),true);
 assert.equal(capReached(119,120),false);
 assert.equal(capReached(0,120),false);
 const saved=process.env.AI_POSTS_PER_DAY;
 try{
  process.env.AI_POSTS_PER_DAY="200";
  assert.equal(aiPostsCap(),200);
  assert.equal(capReached(199),false);
  assert.equal(capReached(200),true);
  delete process.env.AI_POSTS_PER_DAY;
  assert.equal(aiPostsCap(),120);
 }finally{
  if(saved===undefined)delete process.env.AI_POSTS_PER_DAY;
  else process.env.AI_POSTS_PER_DAY=saved;
 }
});
