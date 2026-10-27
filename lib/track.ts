import {db} from "./db";
/** Count one visitor action on an event (calendar add, share, details view) — the "Popular" ranking uses these.
 *  Only the event and the kind of action are kept: nothing about who did it. */
export async function trackAction(id:string,action:"calendar"|"share"|"view"){
 const n=Number(String(id||"").replace(/^db-/,""));if(!Number.isFinite(n)||n<=0)return;
 await db.query("insert into event_actions(event_id,action) values($1,$2)",[n,action]).catch(()=>{});
}
