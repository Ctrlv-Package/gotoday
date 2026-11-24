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

// Photo findings fail the run only when they are NEW: the identity (event IDs + image key)
// is in today's report but not yesterday's. A standing finding is reported by the audit
// itself but does not fail every run.
const withPhotos=(perSource:any,total:number,photo:any):AuditReport=>({...rep(perSource,total),photoFindings:photo});
test("a standing duplicate photo does not fail; a new one does",()=>{
 const before=withPhotos({"A":src(100,{duplicateImage:1})},100,{broken:[],duplicate:["db-1|db-2|/img/x"]});
 const same=withPhotos({"A":src(100,{duplicateImage:1})},100,{broken:[],duplicate:["db-1|db-2|/img/x"]});
 assert.deepEqual(driftAlerts(before,same),[]);
 const oneNew=withPhotos({"A":src(100,{duplicateImage:2})},100,{broken:[],duplicate:["db-1|db-2|/img/x","db-3|db-4|/img/y"]});
 assert.ok(driftAlerts(before,oneNew).some(a=>/new duplicate image/.test(a)));
});
test("a fixed pair replaced by a different new pair still fails",()=>{
 const before=withPhotos({"A":src(100,{duplicateImage:1})},100,{broken:[],duplicate:["db-1|db-2|/img/x"]});
 const after=withPhotos({"A":src(100,{duplicateImage:1})},100,{broken:[],duplicate:["db-3|db-4|/img/y"]});
 assert.ok(driftAlerts(before,after).some(a=>/new duplicate image/.test(a)));
});
test("a standing broken image does not fail; a new one does",()=>{
 const before=withPhotos({"A":src(100,{brokenImage:1})},100,{broken:["db-1|/img/gone"],duplicate:[]});
 const same=withPhotos({"A":src(100,{brokenImage:1})},100,{broken:["db-1|/img/gone"],duplicate:[]});
 assert.deepEqual(driftAlerts(before,same),[]);
 const oneNew=withPhotos({"A":src(100,{brokenImage:2})},100,{broken:["db-1|/img/gone","db-2|/img/gone2"],duplicate:[]});
 assert.ok(driftAlerts(before,oneNew).some(a=>/new broken image/.test(a)));
});
test("a report from before finding identities still fails on any photo problem (transitional)",()=>{
 const before=rep({"A":src(100)},100); // no photoFindings
 const after=withPhotos({"A":src(100,{duplicateImage:1})},100,{broken:[],duplicate:["db-1|db-2|/img/x"]});
 assert.ok(driftAlerts(before,after).some(a=>/duplicate image/.test(a)));
 const afterBroken=withPhotos({"A":src(100,{brokenImage:1})},100,{broken:["db-1|/img/gone"],duplicate:[]});
 assert.ok(driftAlerts(before,afterBroken).some(a=>/broken image/.test(a)));
});
