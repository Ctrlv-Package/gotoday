import {test} from "node:test";
import assert from "node:assert/strict";
import {tagsViolate} from "../lib/stockPhotos";
import {TOPICS,REJECTED_PHOTO_IDS} from "../lib/stockPhotoData";

const must=(k:string)=>TOPICS.find(t=>t.key===k)!.must;

// The tag check that decides whether a library photo stays: a NEVER word, or tags that don't name the topic.
test("a close-up portrait of a child reading fails the filter",()=>{
 assert.equal(tagsViolate("girl, portrait, reading, book",must("reading")),true);
 assert.equal(tagsViolate("girl, face, child, reading, book",must("reading")),true);
 assert.equal(tagsViolate("child, close-up, reading, book",must("reading")),true);
});

test("clean tags pass, and a topic mismatch fails even without a NEVER word",()=>{
 assert.equal(tagsViolate("girl, child, reading, book",must("reading")),false);
 assert.equal(tagsViolate("festival, crowd, music",must("festival")),false);
 assert.equal(tagsViolate("girl, reading, book",must("festival")),true);
});

test("empty tags pass: a missing Pixabay record is not proof the photo is bad",()=>{
 assert.equal(tagsViolate("",must("festival")),false);
});

// Pixabay 2771936 (the girl-reading photo): its real tags are "Girl, English, Dictionary, Read, Reading,
// Studying, Book, Open, Open Book, Student, Young Girl, Study, School, Lessons, Think, Oxford, Language
// Learning, Research" — no NEVER word, and they name its topic's subject. The tag filter alone does NOT
// catch it, which is why it is removed by hand instead (see REJECTED_PHOTO_IDS).
test("the girl-reading photo's real tags pass the tag filter, so it is rejected by id",()=>{
 assert.equal(tagsViolate("Girl, English, Dictionary, Read, Reading, Studying, Book, Open, Open Book, Student, Young Girl, Study, School, Lessons, Think, Oxford, Language Learning, Research",must("reading")),false);
 assert.equal(REJECTED_PHOTO_IDS.has(2771936),true);
 assert.equal(REJECTED_PHOTO_IDS.has(123),false);
});

// One day's list never shows the same library photo twice: the pick skips photos already used
// on the page (Nov 22, 2026: "Brunch at Earls" and "Feed the City Experience" shared one photo).
test("stockPicture skips photos already used on the page, borrowing a neighboring type when the type is used up",async()=>{
 const {stockPicture}=await import("../lib/stockPhotos");
 const {db}=await import("../lib/db");
 const orig=(db as any).query;
 const rows=[
  {topic:"food",photo_id:1,image:"/img/food1"},
  {topic:"food",photo_id:2,image:"/img/food2"},
  {topic:"market",photo_id:3,image:"/img/market1"},
  {topic:"storytime",photo_id:4,image:"/img/story1"},
  {topic:"kids",photo_id:5,image:"/img/kids1"},
 ];
 (db as any).query=async(sql:string)=>{
  if(typeof sql==="string"&&sql.includes("from stock_photos"))return{rows};
  return{rows:[]};
 };
 try{
  const first=await stockPicture({title:"Brunch at Earls"});
  assert.ok(["/img/food1","/img/food2"].includes(first));
  const second=await stockPicture({title:"Food Truck Friday"},new Set([first]));
  assert.ok(["/img/food1","/img/food2"].includes(second));
  assert.notEqual(second,first);
  // Both food photos used: the next food event borrows from the closest related type (market),
  // instead of showing the same photo a third time.
  const third=await stockPicture({title:"Taste of the Town"},new Set(["/img/food1","/img/food2"]));
  assert.equal(third,"/img/market1");
  // Storytime has only one photo: the second storytime on the page borrows a kids photo.
  assert.equal(await stockPicture({title:"Baby Storytime"}),"/img/story1");
  assert.equal(await stockPicture({title:"Preschool Storytime"},new Set(["/img/story1"])),"/img/kids1");
 }finally{(db as any).query=orig}
});
