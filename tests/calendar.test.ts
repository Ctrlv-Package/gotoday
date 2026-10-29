import {test} from "node:test";
import assert from "node:assert/strict";
import {calendarSpan,googleCalendarLink,outlookCalendarLink,icsText,icsFeed} from "../lib/calendar";

// "Add to calendar" for every calendar app: one shape in, every format out.
const timed={uid:"test-1",title:"Boo Bash",description:"Fun night.",location:"ArtsPark, Hollywood, FL",start:new Date("2026-10-31T22:00:00Z"),end:new Date("2026-10-31T23:30:00Z"),allDay:false,tz:"America/New_York",url:"https://www.mygotoday.com/events/db-1"} as any;
const allDay={...timed,allDay:true,start:new Date("2026-10-31T04:00:00Z"),end:null};

test("calendarSpan: timed defaults to one hour and drops absurd ends; all-day uses dates",()=>{
 assert.deepEqual(calendarSpan({...timed,end:null}),{allDay:false,start:timed.start,end:new Date("2026-10-31T23:00:00Z")});
 assert.deepEqual(calendarSpan({...timed,end:new Date("2026-11-01T15:00:00Z")}),{allDay:false,start:timed.start,end:new Date("2026-10-31T23:00:00Z")});
 assert.deepEqual(calendarSpan(allDay),{allDay:true,startDay:"2026-10-31",endDay:"2026-11-01"});
});

test("Google links carry the event, its zone, and a repeat when present",()=>{
 const u=new URL(googleCalendarLink(timed));
 assert.equal(u.searchParams.get("action"),"TEMPLATE");
 assert.equal(u.searchParams.get("text"),"Boo Bash");
 assert.equal(u.searchParams.get("dates"),"20261031T220000Z/20261031T233000Z");
 assert.equal(u.searchParams.get("ctz"),"America/New_York");
 assert.ok(u.searchParams.get("details")!.includes("More info: https://www.mygotoday.com/events/db-1"));
 const rrule=new URL(googleCalendarLink({...timed,rrule:"FREQ=WEEKLY;BYDAY=MO"}));
 assert.equal(rrule.searchParams.get("recur"),"RRULE:FREQ=WEEKLY;BYDAY=MO");
 const day=new URL(googleCalendarLink(allDay));
 assert.equal(day.searchParams.get("dates"),"20261031/20261101");
 assert.equal(day.searchParams.get("ctz"),null);
});

test("Outlook links pick the right host and flag all-day events",()=>{
 assert.equal(new URL(outlookCalendarLink(timed)).hostname,"outlook.live.com");
 assert.equal(new URL(outlookCalendarLink(timed,"office")).hostname,"outlook.office.com");
 const day=new URL(outlookCalendarLink(allDay));
 assert.equal(day.searchParams.get("allday"),"true");
 assert.equal(day.searchParams.get("startdt"),"2026-10-31");
});

test("ics text is a valid event with a reminder, and repeats stay in local time for Eastern events",()=>{
 const ics=icsText(timed);
 assert.ok(ics.includes("BEGIN:VCALENDAR"));
 assert.ok(ics.includes("UID:test-1@mygotoday.com"));
 assert.ok(ics.includes("SUMMARY:Boo Bash"));
 assert.ok(ics.includes("DTSTART:20261031T220000Z"));
 assert.ok(ics.includes("DTEND:20261031T233000Z"));
 assert.ok(ics.includes("TRIGGER:-PT1H"));
 assert.ok(ics.includes("END:VCALENDAR"));
 const day=icsText(allDay);
 assert.ok(day.includes("DTSTART;VALUE=DATE:20261031"));
 assert.ok(day.includes("DTEND;VALUE=DATE:20261101"));
 assert.ok(day.includes("TRIGGER:PT9H"));
 const rep=icsText({...timed,rrule:"FREQ=WEEKLY;BYDAY=MO"});
 assert.ok(rep.includes("RRULE:FREQ=WEEKLY;BYDAY=MO"));
 assert.ok(rep.includes("DTSTART;TZID=America/New_York:20261031T180000"));
 assert.ok(rep.includes("BEGIN:VTIMEZONE"));
});

test("a feed names the calendar, stays valid with no events, and marks cancellations",()=>{
 const feed=icsFeed("My GoToday",[]);
 assert.ok(feed.includes("X-WR-CALNAME:My GoToday"));
 assert.ok(feed.includes("BEGIN:VTIMEZONE"));
 assert.ok(!feed.includes("BEGIN:VEVENT"));
 assert.ok(feed.includes("END:VCALENDAR"));
 const cancelled=icsFeed("My GoToday",[{e:timed,cancelled:true}]);
 assert.ok(cancelled.includes("STATUS:CANCELLED"));
 assert.ok(cancelled.includes("SUMMARY:CANCELLED: Boo Bash"));
});
