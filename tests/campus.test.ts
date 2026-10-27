import {test} from "node:test";
import assert from "node:assert/strict";
import {discoveryRejection} from "../lib/ingestion/utils";
const ev=(title:string,tags:string[]=[])=>({id:"x",title,date:"2026-10-28",time:"",city:"Tallahassee, FL",venue:"",desc:"",tags,source:"FSU"} as any);

test("university internal business is not a public event", () => {
  for(const [t,tags] of [["Departmental Ledger Review (BTAC04)",["Training and Development"]],["COSSPP Career Center Liaisons Fall 2026 Drop-In Advising Hours",[]],
    ["Fall 2026 Honor Cord Distribution",[]],["University Housing: Selection Kickoff",[]],["Study Strategies",["Professional Development","Workshops & Seminars"]],
    ["Campus Connect 101 (CC101)",["Professional Development"]],["Fall Off-Campus Housing Fair | The Ultimate Housing Quest",["Tabling"]]] as [string,string[]][])
    assert.notEqual(discoveryRejection(ev(t,tags)),null,t);
});
test("public campus events stay", () => {
  for(const t of ["Jazz III Performance","Senior Recital of Ms Haley Ann ONeill, oboe","Dirac-ula Fall Festival","Nightcrawler (2014) Film Screening","48 Hour Film Festival","Alumni Hall of Fame Gala","Climate Change - Four Basic Questions and The Current Debate"])
    assert.equal(discoveryRejection(ev(t,["Arts/Entertainment"])),null,t);
});
test("admission and party bookings aren't events", () => {
  for(const t of ["Museum Admission","Birthday Party","Birthday Parties","General Admission"])assert.notEqual(discoveryRejection(ev(t)),null,t);
  assert.equal(discoveryRejection(ev("Birthday Party for Smokey Bear")),null);
});

test("town services are not events", ()=>{
 for(const t of ["Bulky Item Pickup for Wed/Sat Garbage","Leaf Collection","Social Work Intern - Open Hours","Friends Book Donations"])
  assert.equal(discoveryRejection({title:t,tags:[]} as any),"service-or-support",t);
 assert.equal(discoveryRejection({title:"Pumpkin Palooza",tags:[]} as any),null);
});

test("civic forums are meetings, not events", ()=>{
 for(const t of ["Public Forums - Charter Amendments (Forum 5)","Charter Amendment Information Session","Community Input Meeting: Parks Master Plan","Listening Session with the Mayor"])
  assert.equal(discoveryRejection({title:t,tags:[]} as any),"meeting",t);
 assert.equal(discoveryRejection({title:"Forum Theatre Improv Night",tags:[]} as any),null);
});

test("post text and civic addresses are not events", ()=>{
 for(const [t,src] of [["POV You’re a Yonkers firefighter","City of Yonkers · Instagram"],["We’re just two weeks away from debuting our new special exhibit","Hershey Story Museum · Instagram"],["Snag books for all ages at a great value","Lee County Library System · Instagram"],["Providence has led the state in housing development over the past four years","City of Providence · Instagram"]])
  assert.equal(discoveryRejection({title:t,tags:[],source:src} as any),"announcement",t);
 for(const t of ["Mayor Meerbott's Farewell State of the Town Address","The next Chat with a Planner","Girl Scout Troop 80173"])assert.equal(discoveryRejection({title:t,tags:[]} as any),"meeting",t);
 for(const t of ["Boo Bash","Pemberley","Spirits in the Stacks"])assert.equal(discoveryRejection({title:t,tags:[],source:"X · Instagram"} as any),null,t);
});

test("invitation wording and cut-off sentences", async ()=>{
 const {cleanTitle}=await import("../lib/ingestion/utils");
 assert.equal(cleanTitle("Get ready for Rahway’s Pup-kin Parade"),"Rahway’s Pup-kin Parade");
 assert.equal(cleanTitle("Join us for the Fall Festival"),"Fall Festival");
 assert.equal(discoveryRejection({title:"Join North Bergen for a spooktacular afternoon at",tags:[]} as any),"announcement");
 assert.equal(discoveryRejection({title:"Night at the Museum",tags:[]} as any),null);
});
