import {test} from "node:test";
import assert from "node:assert/strict";
import {captionTitle,captionPlace} from "../lib/sources/captionRead";

const largo=`Beautiful weather is in the forecast for this weekend’s Largo Evening Market! 🌞🛍️

Held every fourth Sat of the month, discover food trucks, artisans, and local vendors that come together to offer a diverse array of culinary delights.

🗓️ Sat, Oct 24
🕐 5-9pm
📍 Ulmer Park (301 West Bay Drive)`;

test("the event's name, not the opening chatter", () => {
  assert.equal(captionTitle(largo),"Largo Evening Market");
  assert.equal(captionTitle("Join us for the Fall Festival at Vista Park this Saturday! Games, food and more."),"Fall Festival at Vista Park");
  assert.equal(captionTitle("HOLLYWEIRD\nThe spookiest block party is back..."),"HOLLYWEIRD");
  assert.equal(captionTitle("Don't miss Movie Night in the Park! Bring a blanket."),"Movie Night in the Park");
});
test("the place and address from the 📍 / Location line", () => {
  assert.deepEqual(captionPlace(largo),{place:"Ulmer Park",address:"301 West Bay Drive"});
  assert.deepEqual(captionPlace("Fun!\nLocation: Vista Park, 4001 SW 142nd Ave"),{place:"Vista Park",address:"4001 SW 142nd Ave"});
  assert.deepEqual(captionPlace("no place here"),{});
});
