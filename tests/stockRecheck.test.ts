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
