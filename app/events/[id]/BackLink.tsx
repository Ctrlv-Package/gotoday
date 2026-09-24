"use client";
import {useRouter} from "next/navigation";
export default function BackLink(){
 const router=useRouter();
 return <button onClick={()=>{if(window.history.length>1)router.back();else router.push("/")}} style={{border:0,background:"transparent",padding:0,color:"#526079",fontWeight:600,fontSize:16,cursor:"pointer"}}>← Back to events</button>
}
