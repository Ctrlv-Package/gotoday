import {test} from "node:test";
import assert from "node:assert/strict";
import {dedupeCalendars} from "../lib/ingestion/registry";

test("the same calendar under two names is fetched once", () => {
  const out=dedupeCalendars([
    {name:"Leon County",platform:"libcal",params:{site:"leoncountyfl",defaultVenue:"Leon County"}},
    {name:"LeRoy Collins Leon County Public Library",platform:"libcal",params:{site:"leoncountyfl",defaultVenue:"LeRoy Collins"}},
    {name:"Lee County",platform:"civicplus",params:{site:"https://www.leegov.com",city:"Fort Myers, FL"}},
    {name:"Lee County Library System",platform:"civicplus",params:{site:"https://www.leegov.com",city:"Fort Myers, FL"}},
    {name:"Ticketmaster Jacksonville",platform:"ticketmaster",params:{latlong:"30.3,-81.6",label:"Jacksonville"}},
    {name:"Ticketmaster Lakeland",platform:"ticketmaster",params:{latlong:"28.0,-81.9",label:"Lakeland"}},
  ] as any);
  assert.deepEqual(out.filter(c=>c.enabled!==false).map(c=>c.name),["LeRoy Collins Leon County Public Library","Lee County","Ticketmaster Jacksonville","Ticketmaster Lakeland"]);
});
