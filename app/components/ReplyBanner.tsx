"use client";
import {useEffect,useState} from "react";
import {loadMe} from "./saved";
/** "🎉 1 new reply to Test Private Event" at the top of the home page, so a host on a phone sees it without looking. */
export default function ReplyBanner(){
 const [items,setItems]=useState<{title:string;share:string;n:number}[]>([]);
 useEffect(()=>{loadMe().then((m:any)=>setItems(m?.signedIn?m.newRepliesFor||[]:[])).catch(()=>{})},[]);
 if(!items.length)return null;
 return <>{items.map(x=><a key={x.share} className="replyBanner" href={`/e/${x.share}`}>
  <span>🎉 {x.n} new {x.n===1?"reply":"replies"} to “{x.title}”</span><b>See guest list →</b></a>)}</>;
}
