import test from "node:test";
import assert from "node:assert/strict";
import {reportEmail} from "../lib/email";

test("report email names the event, reason, note and link",()=>{
 const m=reportEmail("Story Time","https://www.mygotoday.com/events/db-42","Cancelled","Library closed");
 assert.ok(m.subject.includes("Cancelled"));assert.ok(m.subject.includes("Story Time"));
 assert.ok(m.html.includes("Library closed"));assert.ok(m.html.includes("/events/db-42"));
 const bare=reportEmail("X",null,"Wrong place","");
 assert.ok(!bare.html.includes("Details:"));assert.ok(!bare.html.includes("Open the event"));
});

test("report email escapes note html",()=>{
 const m=reportEmail("X","https://www.mygotoday.com/events/db-1","Other","<script>alert(1)</script>");
 assert.ok(!m.html.includes("<script>"));assert.ok(m.html.includes("&lt;script&gt;"));
});
