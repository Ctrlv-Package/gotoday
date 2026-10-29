import {test} from "node:test";
import assert from "node:assert/strict";
import {bestPicture,isGenericPicture} from "../lib/pictures";

// One rule for which picture an event shows, used by the cards AND the event page.
const pic=(o:any)=>({id:1,image:"/img/a",source:"City Calendar",title:"Boo Bash",...o} as any);

test("source order wins: organizer calendar, then Ticketmaster, then Instagram, then round-ups",()=>{
 const pics=[pic({id:1,image:"/img/ig",source:"City of Hollywood · Instagram"}),pic({id:2,image:"/img/tm",source:"Ticketmaster"}),pic({id:3,image:"/img/cal",source:"City Calendar"})];
 assert.equal(bestPicture("Boo Bash",pics),"/img/cal");
 assert.equal(bestPicture("Boo Bash",pics.slice(0,2)),"/img/tm");
 const withRoundup=[pic({id:1,image:"/img/ig",source:"City of Hollywood · Instagram"}),pic({id:2,image:"/img/ru",source:"The Broward Scene · Instagram"})];
 assert.equal(bestPicture("Boo Bash",withRoundup),"/img/ig");
});

test("within one source, the best title match wins, then the oldest copy",()=>{
 const pics=[pic({id:3,image:"/img/other",source:"City of Hollywood · Instagram",title:"Fall Festival"}),pic({id:4,image:"/img/contains",source:"City of Hollywood · Instagram",title:"Boo Bash at ArtsPark"}),pic({id:5,image:"/img/exact",source:"City of Hollywood · Instagram",title:"Boo Bash"})];
 assert.equal(bestPicture("Boo Bash",pics),"/img/exact");
 assert.equal(bestPicture("Boo Bash",pics.slice(0,2)),"/img/contains");
 const tied=[pic({id:9,image:"/img/new",source:"City of Hollywood · Instagram"}),pic({id:4,image:"/img/old",source:"City of Hollywood · Instagram"})];
 assert.equal(bestPicture("Boo Bash",tied),"/img/old");
});

test("source order beats title match: a calendar copy wins over an exact-title Instagram post",()=>{
 const pics=[pic({id:1,image:"/img/ig",source:"City of Hollywood · Instagram",title:"Boo Bash"}),pic({id:2,image:"/img/cal",source:"City Calendar",title:"Fall Festival"})];
 assert.equal(bestPicture("Boo Bash",pics),"/img/cal");
});

test("banners, logos and placeholders never count; a copy listed twice counts once; nothing usable gives empty",()=>{
 assert.equal(isGenericPicture("https://x.com/og-image.jpg"),true);
 assert.equal(isGenericPicture("https://x.com/logo.png"),true);
 assert.equal(isGenericPicture("https://x.com/flyer.svg"),true);
 assert.equal(isGenericPicture("https://x.com/placeholder.jpg"),true);
 assert.equal(isGenericPicture("https://x.com/share-image.png"),true);
 assert.equal(isGenericPicture("https://x.com/favicon.ico"),true);
 assert.equal(isGenericPicture("https://x.com/seal-of-the-city.png"),true);
 assert.equal(isGenericPicture("/img/abc123"),false);
 assert.equal(isGenericPicture("https://x.com/flyer.jpg"),false);
 const dupes=[pic({id:7,image:"/img/first"}),pic({id:7,image:"/img/second"})];
 assert.equal(bestPicture("Boo Bash",dupes),"/img/first");
 assert.equal(bestPicture("Boo Bash",[pic({image:"https://x.com/logo.png"})]),"");
 assert.equal(bestPicture("Boo Bash",[]),"");
});
