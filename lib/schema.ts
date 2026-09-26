import {db} from "./db";
// Idempotent, additive schema changes. Runs once per server instance.
let ready:Promise<void>|null=null;
export function ensureSchema(){
 if(!ready)ready=db.query("alter table events add column if not exists age_min smallint, add column if not exists age_max smallint").then(()=>{}).catch(e=>{ready=null;throw e});
 return ready;
}
