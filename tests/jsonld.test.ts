import {test} from "node:test";
import assert from "node:assert/strict";
import {eventsInJsonLd,recordFromJsonLd} from "../lib/sources/jsonld";
const page=`<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"TheaterEvent","name":"Annie Jr.","startDate":"2026-11-07T19:30:00-05:00","endDate":"2026-11-07T21:30:00-05:00","url":"/shows/annie","image":"https://x.org/a.jpg","location":{"@type":"Place","name":"Main Street Playhouse","address":{"streetAddress":"1 Main St","addressLocality":"Cranford","addressRegion":"New Jersey"}},"offers":{"@type":"Offer","price":"22.00","url":"https://tix.example/annie"},"description":"A family musical for kids of all ages."}]}</script>`;
test("theater events from schema.org data", ()=>{
 const o=eventsInJsonLd(page);assert.equal(o.length,1);
 const e=recordFromJsonLd(o[0],{url:"https://x.org/shows",source:"Main Street Playhouse",idPrefix:"msp",city:"Westfield, NJ",venue:"MSP"},"https://x.org/shows")!;
 assert.equal(e.title,"Annie Jr.");assert.equal(e.date,"2026-11-07");assert.equal(e.time,"19:30:00");assert.equal(e.endTime,"21:30:00");
 assert.equal(e.city,"Cranford, NJ");assert.equal(e.venue,"Main Street Playhouse");assert.equal(e.priceText,"$22");assert.equal(e.isFree,false);
 assert.equal(e.url,"https://x.org/shows/annie");assert.equal(e.genre,"Theatre");
});
