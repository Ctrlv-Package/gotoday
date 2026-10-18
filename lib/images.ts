import {createHash} from "crypto";
import {db} from "./db";

// Instagram's picture links are signed and stop working after a few days, and each update only re-reads an
// account's latest posts, so a flyer posted a while back would lose its picture before the event happens.
// Keep our own small copy (≤ 800px wide, WebP, ~60 KB) when the post is read; cards show /img/<key>, which never expires.
// Copies of pictures no upcoming event uses any more are deleted daily (purgeImages).
let ready:Promise<unknown>|null=null;
const schema=()=>ready??=db.query("create table if not exists images(key text primary key,type text not null,data bytea not null,bytes int not null,source_url text,created_at timestamptz default now())").catch(()=>{ready=null});

/** The same picture keeps the same key even as its signed link changes (the link's file name is stable). */
export function imageKey(url:string){
 const path=(()=>{try{return new URL(url).pathname}catch{return url.split("?")[0]}})();
 return createHash("sha1").update(path.split("/").pop()||path).digest("hex").slice(0,24);
}
export const isOwnImage=(u?:string|null)=>!!u&&u.startsWith("/img/");
const needsCopy=(u?:string|null)=>!!u&&/cdninstagram\.com|fbcdn\.net/.test(u);

export async function keepImage(url?:string):Promise<string|undefined>{
 if(!needsCopy(url))return url;
 await schema();
 const key=imageKey(url!),local=`/img/${key}`;
 if((await db.query("select 1 from images where key=$1",[key]).catch(()=>({rowCount:0}))).rowCount)return local;
 // Its link has already expired: nothing to copy.
 const oe=url!.match(/[?&]oe=([0-9A-Fa-f]{8})/);if(oe&&parseInt(oe[1],16)*1000<Date.now())return url;
 try{
  const r=await fetch(url!,{signal:AbortSignal.timeout(15000)});if(!r.ok)return url;
  const buf=Buffer.from(await r.arrayBuffer());if(buf.length<500)return url;
  const sharp=(await import("sharp")).default;
  const out=await sharp(buf,{failOn:"none"}).rotate().resize({width:800,height:1200,fit:"inside",withoutEnlargement:true}).webp({quality:66}).toBuffer();
  await db.query("insert into images(key,type,data,bytes,source_url) values($1,'image/webp',$2,$3,$4) on conflict(key) do nothing",[key,out,out.length,url!.split("?")[0].slice(0,500)]);
  return local;
 }catch(e:any){console.log(`image copy failed: ${e?.message||e}`);return url}
}

/** Copy several at once (a few at a time). */
export async function keepImages<T extends {image?:string}>(list:T[]):Promise<T[]>{
 let next=0;
 await Promise.all(Array.from({length:4},async()=>{while(next<list.length){const e=list[next++];e.image=await keepImage(e.image)}}));
 return list;
}

/** Save any picture under a given name (stock photos); returns /img/<key>, or undefined if it couldn't be fetched. */
export async function storeImage(url:string,name:string):Promise<string|undefined>{
 await schema();
 const key=createHash("sha1").update(name).digest("hex").slice(0,24),local=`/img/${key}`;
 if((await db.query("select 1 from images where key=$1",[key]).catch(()=>({rowCount:0}))).rowCount)return local;
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)return;
  const buf=Buffer.from(await r.arrayBuffer());if(buf.length<2000)return;
  const sharp=(await import("sharp")).default;
  const out=await sharp(buf,{failOn:"none"}).rotate().resize({width:900,height:600,fit:"cover",position:"attention"}).webp({quality:70}).toBuffer();
  await db.query("insert into images(key,type,data,bytes,source_url) values($1,'image/webp',$2,$3,$4) on conflict(key) do nothing",[key,out,out.length,url.slice(0,500)]);
  return local;
 }catch(e:any){console.log(`stock image failed: ${e?.message||e}`);return}
}

export async function getImage(key:string){
 await schema();
 return (await db.query("select type,data from images where key=$1",[key])).rows[0] as {type:string;data:Buffer}|undefined;
}

/** Drop copies no event from the last few days or the future still shows. */
export async function purgeImages(){
 await schema();
 const r=await db.query(`delete from images i where created_at<now()-interval '2 days' and not exists
  (select 1 from events e where e.image_url='/img/'||i.key and e.local_date>=current_date-3)
  and not exists (select 1 from stock_photos p where p.image='/img/'||i.key)`).catch(()=>({rowCount:0}));
 return r.rowCount||0;
}
