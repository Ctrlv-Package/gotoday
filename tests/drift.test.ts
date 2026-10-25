import {test} from "node:test";
import assert from "node:assert/strict";
import {driftAlerts,type AuditReport} from "../lib/quality/drift";

const rep=(perSource:any,total:number):AuditReport=>({generatedAt:"2026-10-24",totals:{events:total},perSource,findingsByType:{}});
const src=(events:number,o:any={})=>({events,familyNoSignal:0,stock:0,missingImage:0,missingTime:0,failsValidation:0,...o});

test("identical reports: no drift",()=>{
 const r=rep({"Broward County Library":src(100)},100);
 assert.deepEqual(driftAlerts(r,r),[]);
});
test("a source disappearing is flagged",()=>{
 assert.ok(driftAlerts(rep({"A":src(100),"B":src(50)},150),rep({"A":src(100)},100)).some(a=>/disappeared/.test(a)));
});
test("a new source is flagged",()=>{
 assert.ok(driftAlerts(rep({"A":src(100)},100),rep({"A":src(100),"B":src(20)},120)).some(a=>/new source/.test(a)));
});
test("a volume shift over 30% is flagged, a small one is not",()=>{
 assert.ok(driftAlerts(rep({"A":src(100)},100),rep({"A":src(60)},60)).some(a=>/volume shift/.test(a)));
 assert.ok(!driftAlerts(rep({"A":src(100)},100),rep({"A":src(90)},90)).some(a=>/volume shift/.test(a)));
});
test("a family-no-signal share shift is flagged",()=>{
 const before=rep({"A":src(100)},100),after=rep({"A":src(100,{familyNoSignal:12})},100);
 assert.ok(driftAlerts(before,after).some(a=>/family-no-signal/.test(a)));
});
