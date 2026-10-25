import {test} from "node:test";
import assert from "node:assert/strict";
import {decodeEntities} from "../lib/html";
import {stripHtml} from "../lib/ingestion/utils";
test("named, numeric and double-encoded entities decode", ()=>{
 assert.equal(decodeEntities("Pok&eacute;mon"),"Pokémon");
 assert.equal(decodeEntities("Pok&amp;eacute;mon"),"Pokémon");
 assert.equal(decodeEntities("Caf&#233; &ndash; Ni&ntilde;os &rsquo;24"),"Café – Niños ’24");
 assert.equal(decodeEntities("AT&T &unknown;"),"AT&T &unknown;");
 assert.equal(stripHtml("<p>Calling all Pok&eacute;mon trainers!</p>"),"Calling all Pokémon trainers!");
});
