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

test("when-words before names and 'Begins at' venues", async ()=>{
 const {cleanTitle,normalize}=await import("../lib/ingestion/utils");
 assert.equal(cleanTitle("TOMORROW Honoring Those Who Serve and Protect"),"Honoring Those Who Serve and Protect");
 assert.equal(cleanTitle("TONIGHT: Movie in the Park"),"Movie in the Park");
 const e=normalize({id:"x",title:"Salute",city:"Tamarac, FL",venue:"Begins at Tamarac City Hall",date:"2026-10-27",time:"",url:"u",category:"Local",genre:"",desc:"x".repeat(260)+"\n📅 Tuesday, Oc",tags:[],emoji:"",source:"s"} as any);
 assert.equal(e.venue,"Tamarac City Hall");assert.ok(!e.desc.includes("Tuesday, Oc"));
});

test("animated movie nights are Kids; park movie nights with no price are Free", async ()=>{
 const {facetsFor}=await import("../lib/facets");
 const f=facetsFor({title:"ArtsPpark Movie Night - Toy Story 5",desc:"Movie Night every Friday 8PM. Bring your chairs and blankets!",source:"ArtsPark at Young Circle · Instagram",venue:"ArtsPark @ Young Circle Amphitheater",tags:["Family","Local","Outdoor"]} as any);
 assert.ok(f.includes("Kids"));assert.ok(f.includes("Free"));
 const g=facetsFor({title:"Movie Night: Oppenheimer",desc:"Rated R",source:"City of Weston",tags:[]} as any);
 assert.ok(!g.includes("Kids"));
 const h=facetsFor({title:"Movie in the Park: Moana",desc:"Tickets $5 at the gate",source:"City of Weston",tags:[]} as any);
 assert.ok(h.includes("Kids"));assert.ok(!h.includes("Free"));
 const k=facetsFor({title:"Dinner and a Movie at the Cinema",desc:"PG-13 action film",source:"Regal Cinema",tags:[]} as any);
 assert.ok(!k.includes("Kids"));
});

// Only government sources (city, town, county, parks & rec) and family places (zoos, children's museums) get Family by
// default. Bars, restaurants, business districts and venue Instagram accounts have to say so.
test("venue and bar posts aren't Family by default; city and zoo events are", () => {
  const f=(title:string,source:string,desc="",venue="")=>facetsFor({title,source,desc,tags:[],venue} as any);
  assert.ok(!f("Sunday Drag Brunch","Wynwood","Join us Sunday for our fabulous drag brunch!").includes("Family"));
  assert.ok(!f("NFL Sunday Ticket in Wynwood Miami | Watch Every Game at Grails","Wynwood","Looking for the best place to watch NFL Sunday football?").includes("Family"));
  assert.ok(!f("Día de los Muertos Brunch at Bar Tulio’s","Wynwood","Brunch specials all day.").includes("Family"));
  assert.ok(!f("Last of the Red Hot Lovers","City of Sunrise","A Neil Simon comedy.","Sunrise Civic Center Theatre").includes("Family"));
  assert.ok(!f("Shopping Sunday","The Village at Gulfstream Park · Instagram","Sales all day.").includes("Family"));
  assert.ok(f("Dream Car Classic Car Show","City of Hollywood","Classic cars on display.").includes("Family"));
  assert.ok(f("Guided Nature Walk","Broward County Parks","Walk the trail with a naturalist.").includes("Family"));
  assert.ok(f("Animal Encounters","Brevard Zoo","Meet the animals.").includes("Family"));
});
test("a community theater's play listed by a city isn't Family/Kids", () => {
  const f=(source:string,tags:string[],venue:string,desc="Presented by Curtain Call Playhouse")=>facetsFor({title:"Last of the Red Hot Lovers",source,desc,tags,venue} as any);
  assert.ok(!f("City of Sunrise",["Local"],"City of Sunrise").includes("Family"));
  assert.ok(!f("City of Boca Raton",["Family","Kids","Local"],"City of Boca Raton").includes("Kids"));
  assert.ok(facetsFor({title:"Annie Jr.",source:"City of Sunrise",desc:"A kids' musical presented by Curtain Call Playhouse youth company",tags:[],venue:"Sunrise Civic Center Theatre"} as any).includes("Kids"));
});
test("brunch, dinner and sports-bar listings aren't Free unless they say so", () => {
  const f=(title:string,source:string,desc:string)=>facetsFor({title,source,desc,tags:["Free"],isFree:true} as any);
  assert.ok(!f("Sunday Drag Brunch","Wynwood","Join us Sunday for our fabulous drag brunch! Book now.").includes("Free"));
  assert.ok(!f("NFL Sunday Ticket in Wynwood Miami | Watch Every Game at Grails","Wynwood","The best place to watch NFL Sunday football. Drink specials.").includes("Free"));
  assert.ok(f("Free Pancake Breakfast with Santa","Wynwood","Bring the kids.").includes("Free"));
  assert.ok(f("Community Pancake Breakfast","City of Weston","Join your neighbors.").includes("Free"));
  assert.ok(f("Jazz Night","Wynwood","Live jazz, no cover.").includes("Free"));
});
test("teens + adults programs (Young Adult (12-18) + Adult (19+)) aren't Kids; a teen-only one is", () => {
  const f=(tags:string[],ageMin?:number,ageMax?:number)=>facetsFor({title:"Dungeons & Dragons Club",source:"Miami-Dade Public Library",desc:"Roll for initiative!",tags,ageMin,ageMax} as any);
  assert.ok(!f(["Young Adult (12-18)","Adult (19+)","Games","Library"],12,99).includes("Kids"));
  assert.ok(f(["Young Adult (12-18)","Games","Library"],12,18).includes("Kids"));
  assert.ok(!facetsFor({title:"Concert: Rahsaan Cruse Jr. & Trio",source:"Plainview-Old Bethpage Public Library",desc:"Jazz.",tags:[]} as any).includes("Kids"));
});
