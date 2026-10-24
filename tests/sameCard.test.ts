import {test} from "node:test";
import assert from "node:assert/strict";
import {sameEventCard as same,type CardLike} from "../lib/sameCard";

const ev=(title:string,o:Partial<CardLike>={}):CardLike=>({title,date:"2026-10-24",time:"18:00:00",venue:"",city:"Plantation, FL",source:"City of Plantation",...o});

test("city listing + parks post, same time and town, different wording → one event", () => {
  assert.equal(same(ev("Trunk-Or-Treat (RESIDENTS ONLY)",{venue:"City of Plantation"}),ev("Villains vs. Superheroes Trunk or Treat",{venue:"Pine Island Park",source:"Plantation Parks & Rec · Instagram"})),true);
});
test("two hosts' Trunk or Treats in different towns or at different times → two events", () => {
  assert.equal(same(ev("Trunk or Treat",{venue:"St. Paul Lutheran Church & Pre-School",city:"Weston, FL",time:"17:00:00",source:"GoToday Community"}),ev("Trunk-Or-Treat (RESIDENTS ONLY)",{venue:"Pine Island Park"})),false);
  assert.equal(same(ev("Trunk or Treat",{venue:"Pine Island Park",source:"Plantation Parks & Rec · Instagram"}),ev("Trunk or Treat",{venue:"Pine Island Park",time:"10:00:00"})),false);
});
test("same town and time but two different named places → two events", () => {
  assert.equal(same(ev("Trunk or Treat",{venue:"Pine Island Park",source:"Plantation Parks & Rec · Instagram"}),ev("Trunk or Treat Night",{venue:"Central Park",source:"Church of Plantation · Instagram"})),false);
});
test("one shared word isn't enough for the loose rule", () => {
  assert.equal(same(ev("Halloween Party",{venue:"City of Plantation"}),ev("Halloween Dance",{venue:"Volunteer Park",source:"Plantation Parks & Rec · Instagram"})),false);
});
test("two places of one organizer at the same time stay separate (library branches)", () => {
  const lib={source:"Broward County Library",city:"Plantation, FL",time:"10:30:00"};
  assert.equal(same(ev("Toddler Story Time Fun",{...lib,venue:"Helen B. Hoffman Plantation Library"}),ev("Toddler Story Time",{...lib,venue:"West Regional Library"})),false);
});
test("existing rules still hold", () => {
  assert.equal(same(ev("Boo Bash",{venue:"ArtsPark",source:"City of Hollywood",city:"Hollywood, FL",time:"15:00:00"}),ev("Boo Bash at ArtsPark",{venue:"ArtsPark",source:"Hollywood · Instagram",city:"Hollywood, FL",time:"15:00:00"})),true);
  assert.equal(same(ev("Art Exhibit: Waves",{venue:"Gallery"}),ev("Opening Reception: Waves",{venue:"Gallery"})),false);
  assert.equal(same(ev("Trunk or Treat"),ev("Trunk or Treat",{date:"2026-10-25"})),false);
});

test("different towns don't merge just because both are a similar distance away", () => {
  assert.equal(same(ev("Trunk-Or-Treat (RESIDENTS ONLY)",{venue:"City of Plantation",time:"",distanceMiles:2.8,lat:26.1276,lng:-80.2331}),
    ev("Halloween Happenings and Trunk or Treat",{venue:"Bergeron Rodeo Grounds",city:"Davie, FL",source:"Town of Davie · Instagram",time:"10:00:00",distanceMiles:4.1,lat:26.0765,lng:-80.2521})),false);
});
test("a post placed a few blocks away in a neighboring town's listing still matches when it's the same spot", () => {
  assert.equal(same(ev("Fall Festival",{venue:"Town Center",city:"Weston, FL",time:"",lat:26.1004,lng:-80.3998}),
    ev("Fall Festival 2026",{venue:"Town Center",city:"Davie, FL",source:"Weston · Instagram",time:"16:00:00",lat:26.1010,lng:-80.3990})),true);
});

test("one place under two names (two accounts' posts) is still one event", () => {
  assert.equal(same(ev("Howl-O-Ween",{venue:"Countess deHoernle Spanish River Athletic Complex",city:"Boca Raton, FL",source:"Boca Raton Recreation · Instagram",time:"09:00:00"}),
    ev("Howl-O-Ween",{venue:"Countess de Hoernle Park",city:"Boca Raton, FL",source:"City of Boca Raton · Instagram",time:"09:00:00"})),true);
  // …but two different parks sharing only a generic word are two places
  assert.equal(same(ev("Trunk or Treat",{venue:"Pine Island Park",source:"A · Instagram"}),ev("Trunk or Treat",{venue:"Central Park",source:"B · Instagram"})),false);
});
