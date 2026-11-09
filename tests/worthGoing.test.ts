import {test} from "node:test";
import assert from "node:assert/strict";
import {loveStatsFor, hasWorthGoing, WORTH_GOING_LOVES, type LoveAgg} from "../lib/love";

// The "Worth going" tag: earned at 5 loved-it taps, counted per event family.
// Tests use event_love rows exactly as stored: one grouped row per (event, family, year),
// series_id null for one-off events, loved_year taken from the event's stored local_date.

test("the tag needs exactly 5: 4 is not enough, 5 earns it",()=>{
 const four:LoveAgg[]=[{event_id:101,series_id:null,loved_year:2026,n:4}];
 assert.equal(loveStatsFor(four,{ids:[101],seriesIds:[],year:2026}).worthGoing,false);
 assert.equal(loveStatsFor(four,{ids:[101],seriesIds:[],year:2026}).loves,4);
 const five:LoveAgg[]=[{event_id:101,series_id:null,loved_year:2026,n:5}];
 assert.equal(loveStatsFor(five,{ids:[101],seriesIds:[],year:2026}).worthGoing,true);
 assert.equal(WORTH_GOING_LOVES,5);
});

test("five separate taps count the same as one grouped row of five",()=>{
 const separate:LoveAgg[]=[
  {event_id:101,series_id:null,loved_year:2026,n:1},
  {event_id:101,series_id:null,loved_year:2026,n:1},
  {event_id:101,series_id:null,loved_year:2026,n:1},
  {event_id:101,series_id:null,loved_year:2026,n:1},
  {event_id:101,series_id:null,loved_year:2026,n:1},
 ];
 assert.equal(loveStatsFor(separate,{ids:[101],seriesIds:[],year:2026}).loves,5);
});

test("copies of one event add up: loves on two listings of the same event",()=>{
 // The same event from the city calendar (101) and its Instagram post (102).
 const rows:LoveAgg[]=[
  {event_id:101,series_id:null,loved_year:2026,n:3},
  {event_id:102,series_id:null,loved_year:2026,n:2},
 ];
 assert.equal(loveStatsFor(rows,{ids:[101,102],seriesIds:[],year:2026}).loves,5);
 assert.equal(loveStatsFor(rows,{ids:[101],seriesIds:[],year:2026}).loves,3);
});

test("a row matching both an id and a series counts once, not twice",()=>{
 // Raw stored row: the user tapped occurrence 101, which belongs to family 7.
 const rows:LoveAgg[]=[{event_id:101,series_id:7,loved_year:2026,n:2}];
 assert.equal(loveStatsFor(rows,{ids:[101],seriesIds:[7],year:2026}).loves,2);
});

test("loved last year comes only from earlier years",()=>{
 const rows:LoveAgg[]=[
  {event_id:101,series_id:7,loved_year:2025,n:4},
  {event_id:101,series_id:7,loved_year:2026,n:1},
 ];
 const s=loveStatsFor(rows,{ids:[101],seriesIds:[7],year:2026});
 assert.equal(s.loves,5);
 assert.equal(s.lovedBefore,4);
 assert.equal(s.worthGoing,true);
 const thisYearOnly:LoveAgg[]=[{event_id:101,series_id:7,loved_year:2026,n:5}];
 assert.equal(loveStatsFor(thisYearOnly,{ids:[101],seriesIds:[7],year:2026}).lovedBefore,0);
});

test("one-off events have no series: only the event id matches",()=>{
 const rows:LoveAgg[]=[
  {event_id:55,series_id:null,loved_year:2026,n:5},
  {event_id:999,series_id:9,loved_year:2026,n:5},
 ];
 assert.equal(loveStatsFor(rows,{ids:[55],seriesIds:[],year:2026}).loves,5);
 assert.equal(loveStatsFor(rows,{ids:[55],seriesIds:[],year:2026}).lovedBefore,0);
});

test("a stored love outlives its event: rows from a deleted old occurrence still count",()=>{
 // Retention cleanup deleted the 2024 occurrence (event 77), but its love rows survive
 // (event_love has no foreign key on purpose, like event_reports).
 const rows:LoveAgg[]=[
  {event_id:77,series_id:7,loved_year:2024,n:2},
  {event_id:101,series_id:7,loved_year:2026,n:3},
 ];
 const s=loveStatsFor(rows,{ids:[101],seriesIds:[7],year:2026});
 assert.equal(s.loves,5);
 assert.equal(s.lovedBefore,2);
});

test("the filter shows only when some event earned the tag",()=>{
 assert.equal(hasWorthGoing([{worthGoing:false},{worthGoing:false}]),false);
 assert.equal(hasWorthGoing([{worthGoing:false},{worthGoing:true}]),true);
 assert.equal(hasWorthGoing([]),false);
});
