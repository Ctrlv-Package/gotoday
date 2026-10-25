"use client";
import {useEffect,useState} from "react";
import {myEvents} from "../../components/myEvents";
// The host opened their own event on the device they created it on (not signed in): point them to the guest list.
export default function HostLink({share}:{share:string}){
 const [url,setUrl]=useState("");
 useEffect(()=>{const m=myEvents().find(x=>x.shareUrl.endsWith(`/e/${share}`));if(m)setUrl(m.manageUrl)},[share]);
 if(!url)return null;
 return <div className="hostBox"><b>You created this event.</b> <a className="btn primary small" href={url}>👥 See guest list &amp; manage</a></div>;
}
