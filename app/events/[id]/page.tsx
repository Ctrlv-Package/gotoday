import Link from "next/link";
import {db} from "../../../lib/db";
import BackLink from "./BackLink";

function decodeHtml(s:string){return s.replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16))).replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'")}
function parts(d:Date){const x=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"long",month:"long",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}).formatToParts(d);const v=(t:string)=>x.find(p=>p.type===t)?.value||"";return{day:v("weekday"),date:v("month")+" "+v("day")+", "+v("year"),time:v("hour")+":"+v("minute")+" "+v("dayPeriod")}}
const shell={maxWidth:1120,margin:"0 auto",padding:"0 24px"} as const;
export default async function EventPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params,raw=decodeURIComponent(id);
 if(!raw.startsWith("db-"))return <main style={{...shell,paddingTop:70}}><Link href="/">← GoToday</Link><h1>Event unavailable</h1></main>;
 const eventId=Number(raw.slice(3));
 if(!Number.isInteger(eventId))return <main style={{...shell,paddingTop:70}}><h1>Event unavailable</h1></main>;
 const {rows}=await db.query("select e.title,e.description,e.start_at,e.city,e.image_url,e.official_url,e.price_text,e.is_free,e.category,s.name as source,v.name as venue,v.address from events e join sources s on s.id=e.source_id left join venues v on v.id=e.venue_id where e.id=$1 and e.status='active' limit 1",[eventId]);
 const e=rows[0];if(!e)return <main style={{...shell,paddingTop:70}}><Link href="/">← GoToday</Link><h1>Event unavailable</h1></main>;
 const when=parts(new Date(e.start_at)),title=decodeHtml(e.title||""),desc=decodeHtml(e.description||"");
 return <main style={{minHeight:"100vh",background:"linear-gradient(180deg,#f7f9ff 0%,#fff 55%)",color:"#111a35",fontFamily:"Arial,sans-serif"}}>
  <header style={{borderBottom:"1px solid #e7eaf2",background:"#fff"}}><div style={{...shell,height:72,display:"flex",alignItems:"center",justifyContent:"space-between"}}><Link href="/" style={{fontSize:24,fontWeight:800,textDecoration:"none",color:"#111a35"}}>Go<span style={{color:"#20a66a"}}>Today</span></Link><Link href="/" style={{color:"#526079",textDecoration:"none"}}>Explore events</Link></div></header>
  <div style={{...shell,paddingTop:36,paddingBottom:70}}>
   <BackLink/>
   <section style={{marginTop:24,background:"#fff",border:"1px solid #e8ebf2",borderRadius:28,overflow:"hidden",boxShadow:"0 20px 60px rgba(18,30,62,.09)"}}>
    {e.image_url?<img src={e.image_url} alt="" style={{width:"100%",height:360,objectFit:"cover",display:"block"}}/>:<div style={{height:180,display:"flex",alignItems:"center",justifyContent:"center",fontSize:64,background:"linear-gradient(135deg,#14213d,#263a68)"}}>🎟️</div>}
    <div style={{padding:"34px 38px 40px"}}>
     <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:18}}><span style={{padding:"7px 12px",borderRadius:999,background:"#eef2ff",fontSize:13,fontWeight:700}}>{e.category||"Local event"}</span>{e.is_free&&<span style={{padding:"7px 12px",borderRadius:999,background:"#eaf8f0",color:"#137a4b",fontSize:13,fontWeight:700}}>Free</span>}<span style={{padding:"7px 12px",borderRadius:999,background:"#f5f6f8",fontSize:13}}>Verified local event</span></div>
     <h1 style={{fontSize:"clamp(36px,5vw,58px)",lineHeight:1.04,letterSpacing:"-1.5px",margin:"0 0 28px",maxWidth:850}}>{title}</h1>
     <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:14,marginBottom:30}}>
      <div style={{padding:20,borderRadius:18,background:"#f7f8fb"}}><div style={{fontSize:13,color:"#68738a",fontWeight:700,marginBottom:7}}>DATE & TIME</div><div style={{fontSize:18,fontWeight:700}}>🗓️ {when.day}, {when.date}</div><div style={{marginTop:5,color:"#526079"}}>{when.time}</div></div>
      <div style={{padding:20,borderRadius:18,background:"#f7f8fb"}}><div style={{fontSize:13,color:"#68738a",fontWeight:700,marginBottom:7}}>LOCATION</div><div style={{fontSize:18,fontWeight:700}}>📍 {e.venue||e.city}</div><div style={{marginTop:5,color:"#526079"}}>{e.address||e.city}</div></div>
     </div>
     {desc&&<div style={{maxWidth:820,marginBottom:28}}><h2 style={{fontSize:22}}>About this event</h2><p style={{fontSize:17,lineHeight:1.7,color:"#3f4a61"}}>{desc}</p></div>}
     <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap",paddingTop:24,borderTop:"1px solid #e8ebf2"}}>
      {e.official_url&&<a href={e.official_url} target="_blank" rel="noreferrer" style={{background:"#111a35",color:"#fff",padding:"14px 20px",borderRadius:12,textDecoration:"none",fontWeight:700}}>Official event page ↗</a>}
      <span style={{color:"#68738a",fontSize:14}}>Verified from <b>{e.source}</b></span>{e.price_text&&<span style={{color:"#68738a",fontSize:14}}>• {decodeHtml(e.price_text)}</span>}
     </div>
    </div>
   </section>
  </div>
 </main>
}
