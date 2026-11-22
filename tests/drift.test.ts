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
test("a new source is not an alert (sources are added all the time)",()=>{
 assert.ok(!driftAlerts(rep({"A":src(100)},100),rep({"A":src(100),"B":src(20)},120)).some(a=>/new source/.test(a)));
});
test("a big source losing half its events is flagged; small swings and growth are not",()=>{
 assert.ok(driftAlerts(rep({"A":src(100)},100),rep({"A":src(40)},90)).some(a=>/volume drop/.test(a)));
 assert.ok(!driftAlerts(rep({"A":src(100)},100),rep({"A":src(70)},90)).some(a=>/volume/.test(a)));
 assert.ok(!driftAlerts(rep({"A":src(10)},100),rep({"A":src(6)},96)).some(a=>/volume/.test(a)));
 assert.ok(!driftAlerts(rep({"A":src(100)},100),rep({"A":src(160)},110)).some(a=>/volume/.test(a)));
});
test("a family-no-signal share shift is flagged",()=>{
 const before=rep({"A":src(100)},100),after=rep({"A":src(100,{familyNoSignal:12})},100);
 assert.ok(driftAlerts(before,after).some(a=>/family-no-signal/.test(a)));
});
test("fewer stock photos or fewer unsupported family labels is an improvement, not an alert",()=>{
 assert.ok(!driftAlerts(rep({"A":src(100,{stock:61})},100),rep({"A":src(100,{stock:31})},100)).some(a=>/stock-photo/.test(a)));
 assert.ok(driftAlerts(rep({"A":src(100,{stock:31})},100),rep({"A":src(100,{stock:61})},100)).some(a=>/stock-photo/.test(a)));
 assert.ok(!driftAlerts(rep({"A":src(100,{familyNoSignal:12})},100),rep({"A":src(100)},100)).some(a=>/family-no-signal/.test(a)));
});
test("any broken picture or duplicate photo fails the run, even one",()=>{
 const before=rep({"A":src(100)},100);
 assert.ok(driftAlerts(before,rep({"A":src(100,{brokenImage:1})},100)).some(a=>/broken image/.test(a)));
 assert.ok(driftAlerts(before,rep({"A":src(100,{duplicateImage:2})},100)).some(a=>/duplicate image/.test(a)));
 assert.ok(!driftAlerts(before,rep({"A":src(100)},100)).some(a=>/broken image|duplicate image/.test(a)));
});
test("a rising share of listings with no photo at all is flagged; a drop is not",()=>{
 const before=rep({"A":src(100,{missingImage:2})},100),after=rep({"A":src(100,{missingImage:12})},100);
 assert.ok(driftAlerts(before,after).some(a=>/missing-image/.test(a)));
 assert.ok(!driftAlerts(after,before).some(a=>/missing-image/.test(a)));
});
