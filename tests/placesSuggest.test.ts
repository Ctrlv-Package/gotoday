import {test} from "node:test";
import assert from "node:assert/strict";
import {rankPlaceSuggestions,streetOnly,photonSuggestion} from "../lib/places";

const rows=[
 {name:"Weston Town Center",address:"1675 Market St",city:"Weston, FL"},
 {name:"Vista Park",address:"4001 SW 142nd Ave",city:"Weston, FL"},
 {name:"Central Park",address:"",city:"Plantation, FL"},
 {name:"Weston Town Center",address:"1675 Market St",city:"Weston, FL"},
 {name:"16290 Griffin Road",address:"16290 Griffin Road",city:"Weston, FL"},
 {name:"The Park Restaurant",address:"100 Main St",city:"Davie, FL"},
];
test("same town first, then a place with an address, then the rest",()=>{
 const got=rankPlaceSuggestions("park","Weston, FL",rows).map(r=>r.name);
 assert.deepEqual(got,["Vista Park","The Park Restaurant","Central Park"]);
});
test("a bare street address ranks last",()=>{
 const got=rankPlaceSuggestions("griffin","Weston, FL",rows).map(r=>r.name);
 assert.deepEqual(got,["16290 Griffin Road"]);
 const mixed=rankPlaceSuggestions("weston","Weston, FL",rows).map(r=>r.name);
 assert.equal(mixed[0],"Weston Town Center");
});
test("dedupes the same place and caps at 8",()=>{
 const many=Array.from({length:12},(_,i)=>({name:`Park ${i}`,address:"",city:"Weston, FL"}));
 assert.equal(rankPlaceSuggestions("park","Weston, FL",many).length,8);
 assert.equal(rankPlaceSuggestions("weston","Weston, FL",rows).filter(r=>r.name==="Weston Town Center").length,1);
});
test("streetOnly strips the town/state/zip tail",()=>{
 assert.equal(streetOnly("1675 Market St, Weston, FL 33326","Weston, FL"),"1675 Market St");
 assert.equal(streetOnly("1675 Market St, Weston, FL","Weston, FL"),"1675 Market St");
 assert.equal(streetOnly("100 Main St, Suite 200, Weston, FL 33326","Weston, FL"),"100 Main St, Suite 200");
 assert.equal(streetOnly("1675 Market St, Fort Lauderdale, FL 33326","Weston, FL"),"1675 Market St");
 assert.equal(streetOnly("1675 Market St","Weston, FL"),"1675 Market St");
 assert.equal(streetOnly("Weston, FL 33326","Weston, FL"),"");
});
test("every word must match somewhere: name + town together",()=>{
 const rows=[
  {name:"Flying Squirrel Trampoline Park",address:"3305 Corporate Avenue",city:"Weston, FL"},
  {name:"Flying Fish Bar & Grill",address:"7906 US-80",city:"Savannah, GA"},
 ];
 assert.deepEqual(rankPlaceSuggestions("flying squirrel weston","Weston, FL",rows).map(r=>r.name),["Flying Squirrel Trampoline Park"]);
 assert.deepEqual(rankPlaceSuggestions("flying","Weston, FL",rows).map(r=>r.name),["Flying Squirrel Trampoline Park","Flying Fish Bar & Grill"]);
});
test("a Photon feature maps to the form's fields",()=>{
 const f={properties:{name:"Flying Squirrel Trampoline Park",housenumber:"3305",street:"Corporate Avenue",city:"Weston",state:"Florida",countrycode:"US"}};
 assert.deepEqual(photonSuggestion(f),{name:"Flying Squirrel Trampoline Park",address:"3305 Corporate Avenue",city:"Weston, FL"});
 assert.equal(photonSuggestion({properties:{street:"Main St",city:"Weston",state:"Florida",countrycode:"US"}}),null);
 assert.equal(photonSuggestion({properties:{name:"Café",city:"Lisboa",state:"Lisboa",countrycode:"PT"}})?.city,"Lisboa, Lisboa");
});
test("short queries return nothing",()=>{
 assert.deepEqual(rankPlaceSuggestions("p","Weston, FL",rows),[]);
 assert.deepEqual(rankPlaceSuggestions("","Weston, FL",rows),[]);
});
