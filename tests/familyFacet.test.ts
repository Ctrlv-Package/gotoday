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
