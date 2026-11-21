import test from "node:test";
import assert from "node:assert/strict";
import {trackEvent} from "../lib/analytics";

test("trackEvent fires the GA4 event when gtag is loaded",()=>{
 const calls:unknown[][]=[];(globalThis as any).window={gtag:(...a:unknown[])=>calls.push(a)};
 trackEvent("save_event");
 assert.deepEqual(calls,[["event","save_event"]]);
 delete (globalThis as any).window;
});

test("trackEvent stays silent without gtag and never throws",()=>{
 delete (globalThis as any).window;
 assert.doesNotThrow(()=>trackEvent("save_event"));
 (globalThis as any).window={};
 assert.doesNotThrow(()=>trackEvent("save_event"));
 delete (globalThis as any).window;
});
