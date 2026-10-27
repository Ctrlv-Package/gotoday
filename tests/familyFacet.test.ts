import {test} from "node:test";
import assert from "node:assert/strict";
import {facetsFor} from "../lib/facets";

const lib=(title:string,tags:string[],desc="")=>({title,desc,tags,source:"Broward County Library",category:"Arts & Theatre",ageMin:0,ageMax:99} as any);

test("'Everyone' at the library isn't a family outing by itself", () => {
  const f=facetsFor(lib("Yiddish Songs and Stories",["Everyone","Performances - Dance, Concerts & Theater","Free","Library","Indoor"],"Enjoy an afternoon of Yiddish songs and stories with a professional singer."));
  assert.ok(!f.includes("Family"),String(f));assert.ok(!f.includes("Kids"),String(f));
});
test("'Everyone' plus a family-type event is Family", () => {
  assert.ok(facetsFor(lib("Halloween Movie Night",["Everyone","Library"])).includes("Family"));
  assert.ok(facetsFor(lib("Bingo for Books",["Everyone"],"All ages welcome.")).includes("Family"));
  assert.ok(facetsFor(lib("Fall Craft Afternoon",["Families"])).includes("Family"));
});
test("teens + adults library programs aren't Kids", () => {
  const f=facetsFor({title:"Coffee @ The Library",desc:"Calling all lovers of books and music!",tags:["Teens","New Adults","Adults","Discussion/Lecture"],source:"Broward County Library",category:"Local",ageMin:13,ageMax:99} as any);
  assert.ok(!f.includes("Kids"),String(f));
  assert.ok(facetsFor({title:"Teen Anime Club",tags:["Teens"],source:"Broward County Library",category:"Local",ageMin:13,ageMax:17} as any).includes("Kids"));
});

test("ages written in the description win over the audience label", async ()=>{
 const {textAgeRange}=await import("../lib/ingestion/utils");
 assert.deepEqual(textAgeRange("Recommended for kids aged 7-12 get to come"),[7,12]);
 assert.deepEqual(textAgeRange("For 7-10 year olds"),[7,10]);
 assert.deepEqual(textAgeRange("children 5 to 8 years old"),[5,8]);
 assert.equal(textAgeRange("Open 10-12 pm for families"),null);
});

test("titles lose emoji and tacked-on audience notes; the note still sets the ages", async ()=>{
 const {cleanTitle,normalize,textAgeRange}=await import("../lib/ingestion/utils");
 assert.equal(cleanTitle("Halloween Storytime at City Hall. Kids 5 & under 🎃👻"),"Halloween Storytime at City Hall");
 assert.equal(cleanTitle("🎃 Trunk or Treat 🎃"),"Trunk or Treat");
 assert.equal(cleanTitle("Mr. Bill's Magic Show"),"Mr. Bill's Magic Show");
 assert.equal(cleanTitle("Movie Night - Free"),"Movie Night");
 assert.deepEqual(textAgeRange("Kids 5 & under"),[0,5]);
 const e=normalize({id:"x",title:"Halloween Storytime at City Hall. Kids 5 & under 🎃",city:"Oakland Park, FL",venue:"City Hall",date:"2026-10-27",time:"10:00:00",url:"u",category:"Family",genre:"",desc:"Join us",tags:[],emoji:"",source:"s"} as any);
 assert.equal(e.title,"Halloween Storytime at City Hall");assert.equal(e.ageMin,0);assert.equal(e.ageMax,5);
});

test("shouting titles and when-tails", async ()=>{
 const {cleanTitle}=await import("../lib/ingestion/utils");
 assert.equal(cleanTitle("MONDAY NIGHT FOOTBALL AT BAR TULIO’S BEGINNING SEPT. 14"),"Monday Night Football at Bar Tulio’s");
 assert.equal(cleanTitle("NFL WATCH PARTY WITH DJ MIKE"),"NFL Watch Party with DJ Mike");
 assert.equal(cleanTitle("Yoga on the Lawn"),"Yoga on the Lawn");
 assert.equal(cleanTitle("Movie Night starting Oct 3"),"Movie Night");
});

test("ages come out of titles but still set the ages", async ()=>{
 const {cleanTitle,normalize}=await import("../lib/ingestion/utils");
 assert.equal(cleanTitle("Scavenger Hunt, Ages 3-12 yo"),"Scavenger Hunt");
 assert.equal(cleanTitle("Lego Club (Ages 6–10)"),"Lego Club");
 assert.equal(cleanTitle("Storytime - Ages 0-5"),"Storytime");
 assert.equal(cleanTitle("Art Explorers (Grades K-5)"),"Art Explorers");
 assert.equal(cleanTitle("Teen Gaming (12-18)"),"Teen Gaming");
 assert.equal(cleanTitle("Toddler Time: Ages 2+"),"Toddler Time");
 assert.equal(cleanTitle("Ocean's 11 Movie Night"),"Ocean's 11 Movie Night");
 const e=normalize({id:"x",title:"Scavenger Hunt, Ages 3-12 yo",city:"South Orange, NJ",venue:"L",date:"2026-10-27",time:"",url:"u",category:"Family",genre:"",desc:"Children are invited",tags:["Age - 4 years"],emoji:"",source:"s"} as any);
 assert.equal(e.title,"Scavenger Hunt");assert.equal(e.ageMin,3);assert.equal(e.ageMax,12);
});
