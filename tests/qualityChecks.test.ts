import {test} from "node:test";
import assert from "node:assert/strict";
import {auditFindings} from "../lib/quality/checks";

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
