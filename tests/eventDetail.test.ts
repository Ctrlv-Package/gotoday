import {test} from "node:test";
import assert from "node:assert/strict";
import {parseId,isAllDay,fmtDate,fmtTime,timeRange,calendarTimes,whereText,directionsUrl,mapEmbedUrl} from "../lib/event-detail";

// The event page's rendering helpers: ids, dates, times, places, calendar links.
const ev=(o:any={})=>({id:1,title:"Boo Bash",description:"Fun night.",start:new Date("2026-10-31T22:00:00Z"),end:new Date("2026-10-31T23:30:00Z"),city:"Hollywood, FL",venue:"ArtsPark",address:"1301 N Young Circle",source:"City Calendar",tz:"America/New_York",lat:null,lng:null,...o} as any);

test("parseId accepts only db-<positive integer>",()=>{
 assert.equal(parseId("db-123"),123);
 assert.equal(parseId("db-0"),null);
 assert.equal(parseId("db-abc"),null);
 assert.equal(parseId("db-12.5"),null);
 assert.equal(parseId("event"),null);
 assert.equal(parseId("%64%62%2d%34%35"),45);
});

test("midnight in the event's zone is all day; an evening is not",()=>{
 assert.equal(isAllDay(new Date("2026-10-31T04:00:00Z"),"America/New_York"),true);
 assert.equal(isAllDay(new Date("2026-10-31T22:00:00Z"),"America/New_York"),false);
});

test("dates and times render in the event's zone",()=>{
 assert.equal(fmtDate(new Date("2026-10-31T22:00:00Z")),"Saturday, October 31");
 assert.equal(fmtTime(new Date("2026-10-31T22:00:00Z")),"6:00 PM");
});

test("timeRange drops an end that is not after the start, or absurdly far away",()=>{
 assert.equal(timeRange(ev({start:new Date("2026-10-31T04:00:00Z"),end:null})),"All day");
 assert.equal(timeRange(ev()),"6:00 PM – 7:30 PM");
 assert.equal(timeRange(ev({end:new Date("2026-10-31T21:00:00Z")})),"6:00 PM");
 assert.equal(timeRange(ev({end:new Date("2026-11-01T15:00:00Z")})),"6:00 PM");
});

test("calendarTimes: all-day uses dates, timed defaults to one hour",()=>{
 assert.deepEqual(calendarTimes(ev({start:new Date("2026-10-31T04:00:00Z"),end:null})),{allDay:true,start:"20261031",end:"20261101"});
 assert.deepEqual(calendarTimes(ev({end:null})),{allDay:false,start:"20261031T220000Z",end:"20261031T230000Z"});
 assert.deepEqual(calendarTimes(ev()),{allDay:false,start:"20261031T220000Z",end:"20261031T233000Z"});
});

test("whereText prefers the address when it already names the place",()=>{
 assert.equal(whereText(ev()),"ArtsPark, 1301 N Young Circle");
 assert.equal(whereText(ev({address:"ArtsPark, 1301 N Young Circle"})),"ArtsPark, 1301 N Young Circle, Hollywood, FL");
 assert.equal(whereText(ev({venue:null})),"1301 N Young Circle");
 assert.equal(whereText(ev({venue:null,address:null})),"Hollywood, FL");
});

test("directions and the map use the place when known, coordinates when not, nothing when neither",()=>{
 assert.equal(directionsUrl(ev()),"https://www.google.com/maps/dir/?api=1&destination=ArtsPark%2C%201301%20N%20Young%20Circle");
 assert.equal(directionsUrl(ev({venue:null,address:null,lat:26.01,lng:-80.15})),"https://www.google.com/maps/dir/?api=1&destination=26.01%2C-80.15");
 assert.equal(mapEmbedUrl(ev({venue:null,address:null,lat:26.01,lng:-80.15})),"https://maps.google.com/maps?q=26.01%2C-80.15&z=15&output=embed");
 assert.equal(mapEmbedUrl(ev({venue:null,address:null,city:""})),null);
});
