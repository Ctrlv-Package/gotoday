import {test} from "node:test";
import assert from "node:assert/strict";
import {CITY_COORDS,milesBetween,citySlug,cityFromSlug,SEO_CITIES} from "../lib/cities";

test("milesBetween is zero for the same spot and sane across South Florida",()=>{
 assert.equal(milesBetween(26.16697,-80.25659,26.16697,-80.25659),0);
 const toMiami=milesBetween(26.16697,-80.25659,25.7617,-80.1918);
 assert.ok(toMiami>25&&toMiami<31,`Sunrise–Miami was ${toMiami}`);
 const toPlantation=milesBetween(26.16697,-80.25659,26.12759,-80.2331);
 assert.ok(toPlantation<toMiami);
 assert.ok(toPlantation>2&&toPlantation<8);
});

test("slugs round-trip for every known city, and unknown slugs give null",()=>{
 assert.equal(citySlug("Fort Lauderdale, FL"),"fort-lauderdale");
 assert.equal(citySlug("Lauderdale-By-The-Sea, FL"),"lauderdale-by-the-sea");
 assert.equal(citySlug("Miami, FL"),"miami");
 assert.equal(cityFromSlug("sunrise"),"Sunrise, FL");
 assert.equal(cityFromSlug("nowhere"),null);
 for(const name of Object.keys(CITY_COORDS))assert.equal(cityFromSlug(citySlug(name)),name);
});

test("every landing-page city is a known city with coordinates",()=>{
 for(const name of SEO_CITIES){assert.ok(name in CITY_COORDS,`${name} missing from CITY_COORDS`);assert.equal(CITY_COORDS[name].length,2)}
});
