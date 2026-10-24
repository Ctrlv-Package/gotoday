import {test} from "node:test";
import assert from "node:assert/strict";
import {cleanPhone,showPhone,cleanRsvp} from "../lib/community";

test("phone numbers are read the way people type them", () => {
  for(const p of ["754-715-2330","(754) 715 2330","+1 754.715.2330","17547152330"])assert.equal(cleanPhone(p),"+17547152330",p);
  assert.equal(showPhone("+17547152330"),"(754) 715-2330");
  assert.equal(cleanPhone("call me"),"");
});
test("RSVP settings: defaults by visibility, bad contact flagged, reply-by not after the party", () => {
  assert.equal(cleanRsvp(undefined,"private","2026-10-30").rsvp.onSite,true);
  assert.equal(cleanRsvp(undefined,"public","2026-10-30").rsvp.onSite,false);
  const ok=cleanRsvp({onSite:false,name:"Pieri",phone:"754-715-2330",email:"",by:"2026-11-05"},"private","2026-10-30");
  assert.deepEqual(ok,{rsvp:{onSite:false,name:"Pieri",phone:"+17547152330",email:"",by:"2026-10-30"},errors:[]});
  assert.equal(cleanRsvp({phone:"12",email:"nope"},"private","2026-10-30").errors.length,2);
});
