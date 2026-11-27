import {test} from "node:test";
import assert from "node:assert/strict";
import {cleanStaleDates} from "../lib/ingestion/utils";

// Descriptions copied verbatim from a source can carry a date range from another year
// (Black Furrday's 2022 range on a 2026 event, Nov 27, 2026). Only the year is judged:
// a date in the event's own year stays, whatever day it names.
const BLACK_FURRDAY="Friday, November 25, 2022 - Sunday, November 27, 2022 @ 11:00 am - 5:30 pm - Find a fur-ever friend";

test("cleanStaleDates: the Black Furrday description loses its 2022 range, keeps the words",()=>{
 assert.equal(cleanStaleDates(BLACK_FURRDAY,"2026-11-27"),"Find a fur-ever friend");
});

test("cleanStaleDates: a day range written once ('November 25-27, 2022') is stripped too",()=>{
 assert.equal(cleanStaleDates("November 25-27, 2022 - Find a fur-ever friend","2026-11-27"),"Find a fur-ever friend");
 assert.equal(cleanStaleDates("11/25/2022 - Find a fur-ever friend","2026-11-27"),"Find a fur-ever friend");
 assert.equal(cleanStaleDates("Find a fur-ever friend - Friday, November 25, 2022","2026-11-27"),"Find a fur-ever friend");
});

test("cleanStaleDates: a date in the event's own year stays, range or single",()=>{
 assert.equal(cleanStaleDates("Friday, November 27, 2026 @ 11:00 am - 5:30 pm - Find a fur-ever friend","2026-11-27"),"Friday, November 27, 2026 @ 11:00 am - 5:30 pm - Find a fur-ever friend");
 assert.equal(cleanStaleDates("Join us Friday, November 27, 2026 for the tree lighting","2026-11-27"),"Join us Friday, November 27, 2026 for the tree lighting");
});

test("cleanStaleDates: no date, or no usable event date, leaves the text alone",()=>{
 assert.equal(cleanStaleDates("Find a fur-ever friend","2026-11-27"),"Find a fur-ever friend");
 assert.equal(cleanStaleDates(BLACK_FURRDAY,""),BLACK_FURRDAY);
 assert.equal(cleanStaleDates(BLACK_FURRDAY,"not-a-date"),BLACK_FURRDAY);
});
