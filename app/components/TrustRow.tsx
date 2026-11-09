"use client";
import {useT} from "./Lang";

/** The trust row: the "Worth going" tag plus what people already did — loves, saves, follows.
 *  Renders nothing when the event has no signal yet, so a new listing looks exactly like before. */
export default function TrustRow({worthGoing,loves,lovedBefore,saves,follows}:{worthGoing:boolean;loves:number;lovedBefore:number;saves:number;follows:number}){
 const {t}=useT();
 if(!worthGoing&&!loves&&!saves&&!follows)return null;
 const parts:string[]=[];
 if(loves>0)parts.push(t("{n} loved it",{n:String(loves)}));
 if(lovedBefore>0)parts.push(t("loved last year"));
 if(saves>0)parts.push(t("{n} saved this",{n:String(saves)}));
 if(follows>0)parts.push(t("{n} reminding next year",{n:String(follows)}));
 return <div className="trustRow">
  {worthGoing&&<span className="worthTag">★ {t("Worth going")}</span>}
  {parts.length>0&&<span className="trustCounts">{parts.join(" · ")}</span>}
 </div>;
}
