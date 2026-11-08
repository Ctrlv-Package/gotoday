"use client";
import {useEffect,useState} from "react";
import ExpandableImage from "./ExpandableImage";

/** The event page's picture. If it fails to load (blocked or removed on the other site), shows the library photo instead.
 * Tapping it opens the full image. */
export default function HeroImage({src,backup,stock,note}:{src:string;backup?:string;stock:boolean;note:string}){
 const [s,setS]=useState(src),[isStock,setStock]=useState(stock),[gone,setGone]=useState(false);
 // A picture that failed before the page became interactive never fires onError: test it once more after load.
 useEffect(()=>{const im=new Image();im.referrerPolicy="no-referrer";im.onerror=()=>{if(backup&&s!==backup){setS(backup);setStock(true)}else if(s===src)setGone(true)};im.src=s;
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[s]);
 if(gone)return null;
 return <div className="heroWrap"><ExpandableImage className="detailHero" src={s} alt="" referrerPolicy="no-referrer"
  onError={()=>{if(backup&&s!==backup){setS(backup);setStock(true)}else setGone(true)}}/>
  {isStock&&<span className="stockNote">{note}</span>}</div>;
}
