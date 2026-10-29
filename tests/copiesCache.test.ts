import {test} from "node:test";
import assert from "node:assert/strict";
import {db} from "../lib/db";
import {fillFromCopies} from "../lib/copies";

// The day scan in fillFromCopies is the site's heaviest read (Neon: 172k calls in 3 days, ~1 MB each),
// so its rows are cached per day. These tests stub db.query and count only the day-scan query.
const TZ="America/New_York";
const dayRowsByDay:Record<string,any[]>={
 "2026-10-31":[{id:2,title:"Boo Bash",description:"A long real description of the Boo Bash event with plenty of detail.",image_url:"/img/xyz",city:"Hollywood",age_min:5,age_max:12,start_at:"2026-10-31T22:00:00.000Z",end_at:null,source:"City Calendar",venue:"ArtsPark",address:null,lat:null,lng:null}],
 "2026-11-01":[],
};
const ev=(o:any={})=>({id:1,source:"City Calendar",title:"Boo Bash",description:"",image:null,city:"Hollywood, FL",lat:null,lng:null,ageMin:null,ageMax:null,start:new Date("2026-10-31T18:00:00-04:00"),tz:TZ,...o} as any);

test("day scan is cached per day, fills from a copy, and never counts the event itself as a copy",async()=>{
 const orig=(db as any).query;
 let dayScans=0;
 (db as any).query=async(sql:string,params?:any[])=>{
  if(typeof sql==="string"&&sql.includes("local_date=$1::date")){dayScans++;return{rows:dayRowsByDay[params?.[0]]??[]}}
  return{rows:[]};
 };
 try{
  const out=await fillFromCopies(ev());
  assert.equal(out.image,"/img/xyz");
  assert.equal(out.description,dayRowsByDay["2026-10-31"][0].description);
  assert.equal(out.ageMin,5);
  assert.equal(out.ageMax,12);
  assert.equal(dayScans,1);
  // A second event on the same day reuses the cached rows: no second scan.
  await fillFromCopies(ev({id:3,title:"Fall Festival",description:"",image:null}));
  assert.equal(dayScans,1);
  // A different day scans again.
  await fillFromCopies(ev({id:4,start:new Date("2026-11-01T18:00:00-05:00")}));
  assert.equal(dayScans,2);
  // The copy itself, on its own day, must not count as its own copy.
  const self=await fillFromCopies(ev({id:2}));
  assert.equal(self.image,null);
  assert.equal(dayScans,2);
 }finally{(db as any).query=orig}
});
