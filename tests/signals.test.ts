import {test} from "node:test";
import assert from "node:assert/strict";
import {hasFamilySignal,looksLikeStreetAddress} from "../lib/quality/signals";

// The family-label gate: a Family/Kids label needs a signal in the listing itself.
// "Open to everyone" is not a family outing (the Yiddish Songs case).
test("an outing word, a kid word, a family tag, a venue kid word, or kid ages all count",()=>{
 assert.equal(hasFamilySignal("Fall Festival"),true);
 assert.equal(hasFamilySignal("Movie Night at the Park"),true);
 assert.equal(hasFamilySignal("Bingo Night"),true);
 assert.equal(hasFamilySignal("Minecraft Club"),true);
 assert.equal(hasFamilySignal("Sensory Play"),true);
 assert.equal(hasFamilySignal("Lil Chefs"),true);
 assert.equal(hasFamilySignal("Junior League Meeting"),true);
 assert.equal(hasFamilySignal("Trunk or Treat"),true);
 assert.equal(hasFamilySignal("Chess Night","",[],"Children's Area"),true);
 assert.equal(hasFamilySignal("Game Night","",["Kids"]),true);
 assert.equal(hasFamilySignal("Yoga Class","",[],undefined,{ageMax:12}),true);
});

test("open to everyone, a plain program, and adult ages do not count",()=>{
 assert.equal(hasFamilySignal("Yiddish Songs and Stories","Enjoy an afternoon of Yiddish songs and stories, open to everyone",["Everyone"]),false);
 assert.equal(hasFamilySignal("Book Club","Monthly meeting",["Adults"],"Library"),false);
 assert.equal(hasFamilySignal("Yoga Class","",[],undefined,{ageMax:18}),false);
 assert.equal(hasFamilySignal(""),false);
});

test("a street address as the venue means the place name was lost",()=>{
 assert.equal(looksLikeStreetAddress("2100 SW 154th Ave"),true);
 assert.equal(looksLikeStreetAddress("1301 N Young Circle","1301 N Young Circle"),true);
 assert.equal(looksLikeStreetAddress("ArtsPark"),false);
 assert.equal(looksLikeStreetAddress("123 Main"),false);
 assert.equal(looksLikeStreetAddress(""),false);
 assert.equal(looksLikeStreetAddress(undefined),false);
});
