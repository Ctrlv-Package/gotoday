"use client";
import {useState} from "react";

/** The event page's picture. If it fails to load (blocked or removed on the other site), shows the library photo instead. */
export default function HeroImage({src,backup,stock,note}:{src:string;backup?:string;stock:boolean;note:string}){
 const [s,setS]=useState(src),[isStock,setStock]=useState(stock),[gone,setGone]=useState(false);
 if(gone)return null;
 return <div className="heroWrap"><img className="detailHero" src={s} alt="" referrerPolicy="no-referrer"
  onError={()=>{if(backup&&s!==backup){setS(backup);setStock(true)}else setGone(true)}}/>
  {isStock&&<span className="stockNote">{note}</span>}</div>;
}
