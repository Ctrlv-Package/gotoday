import {test} from "node:test";
import assert from "node:assert/strict";
import {imageKey,isOwnImage} from "../lib/images";
import {decodeEntities} from "../lib/html";
import {translate,isLang,tFor} from "../lib/i18n";
import {seriesKey} from "../lib/series";
import {topicFor,forKids} from "../lib/stockPhotos";

// Small pure helpers shared across the site.
test("an image key follows the file name, not the signed link",()=>{
 const a=imageKey("https://scontent-mia3-1.cdninstagram.com/v/abc123.jpg?oe=ABCDEF01");
 const b=imageKey("https://scontent-mia3-1.cdninstagram.com/v/abc123.jpg?oe=12345678");
 const c=imageKey("https://scontent-mia3-1.cdninstagram.com/v/other.jpg?oe=ABCDEF01");
 assert.equal(a,b);
 assert.notEqual(a,c);
 assert.ok(/^[0-9a-f]{24}$/.test(a));
 assert.equal(imageKey("abc.jpg"),imageKey("abc.jpg?x=1"));
 assert.equal(isOwnImage("/img/abc123"),true);
 assert.equal(isOwnImage("https://example.com/x.jpg"),false);
 assert.equal(isOwnImage(null),false);
 assert.equal(isOwnImage(""),false);
});

test("entities decode, including double-encoded feeds, and unknown entities survive",()=>{
 assert.equal(decodeEntities("&#233;"),"é");
 assert.equal(decodeEntities("&#xE9;"),"é");
 assert.equal(decodeEntities("&amp;"),"&");
 assert.equal(decodeEntities("&eacute;"),"é");
 assert.equal(decodeEntities("&amp;eacute;"),"é");
 assert.equal(decodeEntities("Fish &amp; Chips"),"Fish & Chips");
 assert.equal(decodeEntities("&bogus;"),"&bogus;");
 assert.equal(decodeEntities(""),"");
 assert.equal(decodeEntities("plain"),"plain");
});

test("translations fall back to English and fill in placeholders",()=>{
 assert.equal(translate("en","Illustrative photo"),"Illustrative photo");
 assert.equal(translate("es","Illustrative photo"),"Foto ilustrativa");
 assert.equal(translate("es","Zqxwv unknown key"),"Zqxwv unknown key");
 assert.equal(translate("es","Waiting for {app}'s next check",{app:"Instagram"}),"Esperando la próxima revisión de Instagram");
 assert.equal(translate("en","Waiting for {app}'s next check",{app:"Instagram"}),"Waiting for Instagram's next check");
 assert.equal(translate("es","Waiting for {app}'s next check"),"Esperando la próxima revisión de {app}");
 assert.equal(isLang("es"),true);
 assert.equal(isLang("fr"),false);
 assert.equal(tFor("es")("Illustrative photo"),"Foto ilustrativa");
});

test("series keys strip years, ordinals, annual, cancelled and a leading town name",()=>{
 assert.equal(seriesKey("Plantation's Family Fall Festival","Plantation, FL"),"family fall festival|plantation");
 assert.equal(seriesKey("Fall Festival 2025","Hollywood, FL"),"fall festival|hollywood");
 assert.equal(seriesKey("13th Annual Plant Sale","Miami, FL"),"plant sale|miami");
 assert.equal(seriesKey("Cancelled: Boo Bash","Hollywood, FL"),"boo bash|hollywood");
 assert.equal(seriesKey("The Fall Festival","Hollywood, FL"),"fall festival|hollywood");
 assert.equal(seriesKey("AB","Hollywood, FL"),null);
});

test("library photos follow the topic: title match, library, parks, or community",()=>{
 assert.equal(topicFor({title:"Boo Bash"}),"halloween");
 assert.equal(topicFor({title:"Ballet Dance Class"}),"dance");
 assert.equal(topicFor({title:"Salsa Dance Night"}),"culture");
 assert.equal(topicFor({title:"",source:"Broward County Library"}),"library");
 assert.equal(topicFor({title:"",source:"City of Hollywood Parks"}),"nature");
 assert.equal(topicFor({title:""}),"community");
 assert.equal(forKids({ageMax:12}),true);
 assert.equal(forKids({ageMax:13,title:"Yoga Class"}),false);
 assert.equal(forKids({title:"Toddler Story Time"}),true);
 assert.equal(forKids({title:"Board Meeting"}),false);
});
