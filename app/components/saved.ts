"use client";
// Saved events, for guests and signed-in people alike. Guests' saves live in this browser; once they sign in,
// those move into their account (and then show on every device and in their personal calendar).
export type SavedItem={id:string;title:string;date?:string;venue?:string};
const KEY="gotoday:saved";
type Me={signedIn:boolean;name?:string|null;email?:string;image?:string|null;saved?:string[];following?:number[]};

let me:Promise<Me>|null=null;
const listeners=new Set<()=>void>();
export const onSavedChange=(f:()=>void)=>{listeners.add(f);return()=>{listeners.delete(f)}};
const notify=()=>listeners.forEach(f=>f());

export function guestSaved():SavedItem[]{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}}
function setGuest(list:SavedItem[]){try{localStorage.setItem(KEY,JSON.stringify(list.slice(0,200)))}catch{}}

/** Who's signed in and what they've saved (asked once per page). Moves a guest's saves into the account. */
export function loadMe(force=false):Promise<Me>{
 if(!me||force)me=fetch("/api/me",{cache:"no-store"}).then(r=>r.json()).catch(()=>({signedIn:false})).then(async(m:Me)=>{
  const g=guestSaved();
  if(m.signedIn&&g.length){
   const r=await fetch("/api/me/saved",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merge:g.map(x=>x.id)})}).catch(()=>null);
   if(r?.ok){setGuest([]);m.saved=[...new Set([...(m.saved||[]),...g.map(x=>x.id)])]}
  }
  return m;
 });
 return me;
}

export async function isSaved(id:string){const m=await loadMe();return m.signedIn?!!m.saved?.includes(id):guestSaved().some(x=>x.id===id)}

export async function setSaved(item:SavedItem,on:boolean){
 const m=await loadMe();
 if(m.signedIn){
  const r=await fetch("/api/me/saved",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:item.id,on})});
  if(!r.ok)throw new Error("save failed");
  m.saved=on?[...new Set([...(m.saved||[]),item.id])]:(m.saved||[]).filter(x=>x!==item.id);
 }else{
  const list=guestSaved().filter(x=>x.id!==item.id);
  setGuest(on?[item,...list]:list);
 }
 notify();
}

export async function setFollowing(id:string,on:boolean){
 const r=await fetch("/api/me/follow",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id,on})});
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(d.error||"follow failed");
 const m=await loadMe();
 if(d.series)m.following=on?[...new Set([...(m.following||[]),d.series])]:(m.following||[]).filter(x=>x!==d.series);
 if(on)m.saved=[...new Set([...(m.saved||[]),id])];
 notify();
}
