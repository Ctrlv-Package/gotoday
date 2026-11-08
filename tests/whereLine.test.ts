import {test} from "node:test";
import assert from "node:assert/strict";
import {displayCase,addressLine,whereText,type EventDetail} from "../lib/event-detail";

// The Where block on an event page: no repeated street address, no all-caps shouting.
test("an all-caps address is shown in title case, abbreviations kept",()=>{
 assert.equal(displayCase("COCONUT CREEK PKWY & COCONUT CREEK BLVD, POMPANO BEACH, FL, 33063"),"Coconut Creek Pkwy & Coconut Creek Blvd, Pompano Beach, FL, 33063");
 assert.equal(displayCase("123 MAIN ST, HOLLYWOOD, FL 33019"),"123 Main St, Hollywood, FL 33019");
});

test("mixed-case text is left alone, including ordinals",()=>{
 assert.equal(displayCase("500 NE 26th St., Wilton Manors, FL 33305"),"500 NE 26th St., Wilton Manors, FL 33305");
 assert.equal(displayCase("Fort Lauderdale, FL"),"Fort Lauderdale, FL");
});

test("a venue that IS the street address is not repeated on the line below",()=>{
 assert.equal(addressLine("500 NE 26th St.","500 NE 26th St., Wilton Manors, FL 33305","Wilton Manors, FL"),"Wilton Manors, FL 33305");
 assert.equal(addressLine("ArtsPark","ArtsPark, 1 N Young Circle, Hollywood, FL 33020","Hollywood, FL"),"1 N Young Circle, Hollywood, FL 33020");
});

test("a real venue name keeps the full address, de-shouted",()=>{
 assert.equal(addressLine("Coconut Creek Parks & Rec","COCONUT CREEK PKWY & COCONUT CREEK BLVD, POMPANO BEACH, FL, 33063","Pompano Beach, FL"),"Coconut Creek Pkwy & Coconut Creek Blvd, Pompano Beach, FL, 33063");
});

test("no venue and no address fall back cleanly",()=>{
 assert.equal(addressLine(null,"123 Main St, Hollywood, FL 33019","Hollywood, FL"),"123 Main St, Hollywood, FL 33019");
 assert.equal(addressLine("ArtsPark",null,"Hollywood, FL"),"Hollywood, FL");
 assert.equal(addressLine("Main Library","123 Main St, Hollywood, FL 33019","Hollywood, FL"),"123 Main St, Hollywood, FL 33019");
});

// The map line under the Where block uses whereText: a mixed-case venue name must not shield an
// all-caps address from de-shouting (the joined string is only ~73% caps, under the 80% bar).
test("whereText de-shouts each part on its own, so the map line is clean too",()=>{
 assert.equal(whereText({venue:"Coconut Creek Parks & Rec",address:"COCONUT CREEK PKWY & COCONUT CREEK BLVD, POMPANO BEACH, FL, 33063",city:"Coconut Creek, FL"} as EventDetail),"Coconut Creek Parks & Rec, Coconut Creek Pkwy & Coconut Creek Blvd, Pompano Beach, FL, 33063");
});
