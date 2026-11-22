import {test} from "node:test";
import assert from "node:assert/strict";
import {auditFindings,duplicateImageFindings,brokenImageFindings} from "../lib/quality/checks";

const ev=(o:any={})=>({id:"db-1",title:"Test Event",desc:"",tags:[],facets:[],image:"/img/abc",venue:"Central Park",address:"",time:"18:00",url:"https://example.com/event",date:"2026-10-24",source:"City of Plantation",...o});
const types=(o:any)=>auditFindings(ev(o)).map(f=>f.type);

test("Kids facet from a round-up source's name with no signal is flagged",()=>{
 assert.ok(types({title:"Plant Sale",facets:["Kids"],source:"To Do with Kids Broward · Instagram"}).includes("family-no-signal"));
});
test("the fixed Yiddish case is clean",()=>{
 assert.deepEqual(types({title:"Yiddish Songs and Stories",desc:"Enjoy an afternoon of Yiddish songs and stories with a professional singer.",tags:["Everyone"],facets:["Music","Arts & Theatre","Free"],source:"Broward County Library"}),[]);
});
test("a venue that is just a street address is flagged",()=>{
 assert.ok(types({venue:"2100 SW 154th Ave",address:"2100 SW 154th Ave"}).includes("venue-is-address"));
});
test("missing time, missing image and boilerplate titles are flagged",()=>{
 assert.ok(types({time:""}).includes("missing-time"));
 assert.ok(types({image:undefined}).includes("missing-image"));
 assert.ok(types({title:"Click here"}).includes("fails-validation"));
});
test("a clean listing has no findings",()=>{assert.deepEqual(types({}),[])});

test("event page prices: labelled and unlabelled", async ()=>{
 const {costFromPage}=await import("../lib/ingestion/utils");
 assert.equal(costFromPage("<p>DATE &amp; TIME: Sunday</p><p>Reserved seating:  $20</p>"),"$20");
 assert.equal(costFromPage("<p>Saturday at 2pm</p><p>Reserved Seats $20</p>"),"$20");
 assert.equal(costFromPage("<p>Tickets are only $15 in advance at the door</p>"),"are only $15 in advance at the door");
 assert.equal(costFromPage("<p>Join us for fun</p>"),undefined);
});
test("city theater shows aren't guessed free", async ()=>{
 const {facetsFor}=await import("../lib/facets");
 const f=facetsFor({title:"The Lightning Thief: The Percy Jackson Musical",source:"City of Sunrise",desc:"Official City of Sunrise event."} as any);
 assert.ok(!f.includes("Free"));assert.ok(!f.includes("Music"));assert.ok(f.includes("Arts & Theatre"));
 assert.ok(facetsFor({title:"Fall Festival",source:"City of Sunrise"} as any).includes("Free"));
});
test("a kid word only in the venue clears the family-no-signal flag",()=>{
 assert.ok(!types({title:"Plant Sale",facets:["Kids"],source:"To Do with Kids Broward · Instagram",venue:"Children's Garden"}).includes("family-no-signal"));
});

// The two photo classes from Sun Nov 22, 2026: the same stored photo on two different events
// in one day's list, and a stored picture whose bytes are gone (404).
test("two different events sharing one stored photo in a day's list is flagged once, on the second",()=>{
 const list=[
  ev({id:"db-1",title:"The MKT",image:"/img/3361a3ab2d66a2ef151d3528",venue:"CityPlace Doral"}),
  ev({id:"db-2",title:"Sunny Side Up Market",image:"/img/3361a3ab2d66a2ef151d3528",venue:"Huizenga Park"}),
  ev({id:"db-3",title:"Brunch at Earls",image:"/img/5f2ed154dc9fdd7ba8617eb3",venue:"Earls Kitchen + Bar"}),
  ev({id:"db-4",title:"Feed the City Experience",image:"/img/5f2ed154dc9fdd7ba8617eb3",venue:"301 E Broward Blvd"}),
 ];
 const found=duplicateImageFindings(list);
 assert.equal(found.length,2);
 assert.deepEqual(found.map(f=>f.eventId),["db-2","db-4"]);
 assert.ok(found[0].detail!.includes("The MKT"));
 assert.ok(found[1].detail!.includes("Brunch at Earls"));
});
test("the same photo on the same listing twice, or an external image, is not a duplicate",()=>{
 assert.deepEqual(duplicateImageFindings([
  ev({id:"db-1",title:"Sunday Market",image:"/img/aaa",venue:"CityPlace Doral"}),
  ev({id:"db-2",title:"Sunday Market",image:"/img/aaa",venue:"CityPlace Doral"}),
 ]),[]);
 assert.deepEqual(duplicateImageFindings([
  ev({id:"db-1",title:"Concert A",image:"https://cdn.example.com/a.jpg",venue:"Park"}),
  ev({id:"db-2",title:"Concert B",image:"https://cdn.example.com/a.jpg",venue:"Hall"}),
 ]),[]);
 assert.deepEqual(duplicateImageFindings([ev({id:"db-1",title:"Solo",image:"/img/aaa"})]),[]);
});
test("a stored picture that 404s is flagged with its URL; a live one is clean",()=>{
 const list=[
  ev({id:"db-1",title:"Sunday Market",image:"/img/695e7ce231bdef5ff3bcc3b9"}),
  ev({id:"db-2",title:"Symphony in Lights",image:"/img/c2a665fa7957db850196c48f"}),
  ev({id:"db-3",title:"Beach & Groove",image:"/img/c9b6f4d33b086fcc3729f0e6"}),
  ev({id:"db-4",title:"Last of the Red Hot Lovers",image:"/img/c17dd1af60fbc359f2b7f9cf"}),
  ev({id:"db-5",title:"Winterfest",image:"/img/ok123"}),
 ];
 const broken=new Set(["/img/695e7ce231bdef5ff3bcc3b9","/img/c2a665fa7957db850196c48f","/img/c9b6f4d33b086fcc3729f0e6","/img/c17dd1af60fbc359f2b7f9cf"]);
 const found=brokenImageFindings(list,broken);
 assert.equal(found.length,4);
 assert.deepEqual(found.map(f=>f.eventId),["db-1","db-2","db-3","db-4"]);
 assert.equal(found[0].detail,"/img/695e7ce231bdef5ff3bcc3b9");
 assert.deepEqual(brokenImageFindings(list,new Set()),[]);
});
