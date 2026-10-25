import {test} from "node:test";
import assert from "node:assert/strict";
import {quarantineReasons} from "../lib/ingestion/quarantine";

const ev=(o:any={})=>({id:"x",title:"Test Event",city:"Plantation, FL",venue:"Park",date:"2026-10-24",time:"18:00:00",url:"https://example.com",category:"Local",genre:"Venue Event",desc:"",tags:[],emoji:"📍",source:"Broward County Library",...o} as any);

test("a borrowed picture is held",()=>{
 assert.deepEqual(quarantineReasons(ev({source:"City of Plantation · Instagram",image:"/img/abc",imageBorrowed:true}),{isNewSource:false}),["borrowed-image"]);
});
test("a new source's first batch is held",()=>{
 assert.deepEqual(quarantineReasons(ev(),{isNewSource:true}),["new-source"]);
});
test("the fixed Yiddish case publishes (no flag)",()=>{
 assert.deepEqual(quarantineReasons(ev({title:"Yiddish Songs and Stories",desc:"Enjoy an afternoon of Yiddish songs and stories with a professional singer.",tags:["Everyone","Performances - Dance, Concerts & Theater","Free","Library","Indoor"],ageMin:0,ageMax:99}),{isNewSource:false}),[]);
});
test("a Kids label granted only by a round-up source's name, with no signal in the listing, is held",()=>{
 assert.deepEqual(quarantineReasons(ev({title:"Plant Sale",tags:["Local"],source:"To Do with Kids Broward · Instagram"}),{isNewSource:false}),["family-no-signal"]);
});
test("the same round-up listing with a signal in the title publishes",()=>{
 assert.deepEqual(quarantineReasons(ev({title:"Kids Plant Sale",tags:["Local"],source:"To Do with Kids Broward · Instagram"}),{isNewSource:false}),[]);
});
test("a clean library event publishes",()=>{
 assert.deepEqual(quarantineReasons(ev({title:"Author Talk",tags:["Adults"]}),{isNewSource:false}),[]);
});
