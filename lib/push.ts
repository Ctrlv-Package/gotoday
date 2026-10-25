// Phone/browser notifications (Web Push) for hosts: "New RSVP: Matteo's 6th Birthday — Elena: Going (+2)".
// The signing keys are made once and kept in the database, so nothing needs setting up in Vercel.
import webpush from "web-push";
import {db} from "./db";
import {ensureSchema} from "./schema";

let keys:Promise<{publicKey:string;privateKey:string}>|null=null;
export function vapidKeys(){
 return keys??=(async()=>{
  await ensureSchema();
  const {rows}=await db.query("select value from app_tokens where name='vapid'");
  if(rows[0])return JSON.parse(rows[0].value);
  const k=webpush.generateVAPIDKeys();
  await db.query("insert into app_tokens(name,value) values('vapid',$1) on conflict(name) do nothing",[JSON.stringify(k)]);
  const again=await db.query("select value from app_tokens where name='vapid'");   // two first calls at once: keep the stored pair
  return JSON.parse(again.rows[0].value);
 })();
}

export async function saveSubscription(sub:any,owner:{userId?:number|null;manageHash?:string|null}){
 if(!sub?.endpoint||!/^https:\/\//.test(sub.endpoint)||!sub.keys?.p256dh||!sub.keys?.auth)return false;
 await ensureSchema();
 await db.query(`insert into push_subs(endpoint,keys,user_id,manage_hash) values($1,$2,$3,$4)
  on conflict(endpoint) do update set keys=excluded.keys,user_id=coalesce(excluded.user_id,push_subs.user_id),manage_hash=coalesce(excluded.manage_hash,push_subs.manage_hash)`,
  [sub.endpoint,JSON.stringify(sub.keys),owner.userId??null,owner.manageHash??null]);
 return true;
}

/** Notify an event's host on every device they turned notifications on (signed in, or the device that made it). */
export async function notifyHost(ev:{id:number},msg:{title:string;body:string;url:string}){
 try{
  const own=(await db.query("select user_id,manage_hash from community_events where id=$1",[ev.id])).rows[0];if(!own)return;
  const {rows}=await db.query("select endpoint,keys from push_subs where (user_id is not null and user_id=$1) or (manage_hash is not null and manage_hash=$2)",[own.user_id,own.manage_hash]);
  if(!rows.length)return;
  const k=await vapidKeys();
  webpush.setVapidDetails("https://www.mygotoday.com",k.publicKey,k.privateKey);
  await Promise.all(rows.map(async(r:any)=>{
   try{await webpush.sendNotification({endpoint:r.endpoint,keys:r.keys},JSON.stringify(msg),{TTL:24*3600})}
   catch(e:any){if(e?.statusCode===404||e?.statusCode===410)await db.query("delete from push_subs where endpoint=$1",[r.endpoint]).catch(()=>{})}
  }));
 }catch(e){console.error("push",e)}
}
