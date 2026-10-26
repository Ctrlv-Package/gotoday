import {test} from "node:test";
import assert from "node:assert/strict";
import {quarantineReasons} from "../lib/ingestion/quarantine";
import {facetsFor} from "../lib/facets";

const ev=(o:any={})=>({id:"x",title:"Test Event",city:"Plantation, FL",venue:"Park",date:"2026-10-24",time:"18:00:00",url:"https://example.com",category:"Local",genre:"Venue Event",desc:"",tags:[],emoji:"📍",source:"Broward County Library",...o} as any);

test("a borrowed picture is held",()=>{
 assert.deepEqual(quarantineReasons(ev({source:"City of Plantation · Instagram",image:"/img/abc",imageBorrowed:true})),["borrowed-image"]);
});
test("a new source's first batch publishes unless flagged",()=>{
 assert.deepEqual(quarantineReasons(ev()),[]);
});
test("the fixed Yiddish case publishes (no flag)",()=>{
 assert.deepEqual(quarantineReasons(ev({title:"Yiddish Songs and Stories",desc:"Enjoy an afternoon of Yiddish songs and stories with a professional singer.",tags:["Everyone","Performances - Dance, Concerts & Theater","Free","Library","Indoor"],ageMin:0,ageMax:99})),[]);
});
test("a Kids label granted only by a round-up source's name, with no signal in the listing, is held",()=>{
 assert.deepEqual(quarantineReasons(ev({title:"Plant Sale",tags:["Local"],source:"To Do with Kids Broward · Instagram"})),["family-no-signal"]);
});
test("the same round-up listing with a signal in the title publishes",()=>{
 assert.deepEqual(quarantineReasons(ev({title:"Kids Plant Sale",tags:["Local"],source:"To Do with Kids Broward · Instagram"})),[]);
});
test("a clean library event publishes",()=>{
 assert.deepEqual(quarantineReasons(ev({title:"Author Talk",tags:["Adults"]})),[]);
});
test("a kid word only in the venue counts as a family signal",()=>{
 assert.deepEqual(quarantineReasons(ev({title:"Plant Sale",tags:["Local"],source:"To Do with Kids Broward · Instagram",venue:"Children's Garden"})),[]);
});
test("Babies in Bloom in a Children's Area publishes",()=>{
 assert.deepEqual(quarantineReasons(ev({title:"Babies in Bloom",venue:"Anne Arundel County Public Library – Glen Burnie -Children's Area",source:"Anne Arundel County Public Library"})),[]);
});
test("Baby & Me Playtime and Homeschool Art Club publish",()=>{
 assert.deepEqual(quarantineReasons(ev({title:"Baby & Me Playtime",venue:"Leir Children's Program Room",source:"Ridgefield Library"})),[]);
 assert.deepEqual(quarantineReasons(ev({title:"Homeschool Art Club",venue:"Discoveries - Programming Room",source:"Anne Arundel County Public Library"})),[]);
});
test("a performer name is not a kids' event: Wheeler Walker Jr. and Cry Baby Tour get no Kids/Family label",()=>{
 const w=ev({title:"Wheeler Walker Jr.",source:"Ticketmaster",category:"Music",venue:"Toad's Place",tags:["Music","Tickets"]});
 const c=ev({title:"Cry Baby Tour",source:"Ticketmaster",category:"Music",venue:"The Fillmore Silver Spring",tags:["Music","Tickets"]});
 assert.ok(!facetsFor(w).includes("Kids")&&!facetsFor(w).includes("Family"));
 assert.ok(!facetsFor(c).includes("Kids")&&!facetsFor(c).includes("Family"));
 assert.deepEqual(quarantineReasons(w),[]);
 assert.deepEqual(quarantineReasons(c),[]);
});
test("a real Ticketmaster family show still gets its Kids label and publishes",()=>{
 const s=ev({title:"Baby Shark Live",source:"Ticketmaster",category:"Family",venue:"Kia Center",tags:["Family","Tickets"]});
 assert.ok(facetsFor(s).includes("Kids"));
 assert.deepEqual(quarantineReasons(s),[]);
});
