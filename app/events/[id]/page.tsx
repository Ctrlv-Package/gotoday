import Link from "next/link";
import {db} from "../../../lib/db";

function nice(d:Date){try{return new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"long",month:"long",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}).format(d)}catch{return String(d)}}

export default async function EventPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const raw=decodeURIComponent(id);
 if(!raw.startsWith("db-"))return <main style={{maxWidth:900,margin:"60px auto",padding:24}}><Link href="/">← GoToday</Link><h1>Event unavailable</h1><p>This event is no longer in our verified local feed.</p></main>;
 const eventId=Number(raw.slice(3));
 if(!Number.isInteger(eventId))return <main style={{maxWidth:900,margin:"60px auto",padding:24}}><Link href="/">← GoToday</Link><h1>Event unavailable</h1></main>;
 const {rows}=await db.query("select e.title,e.description,e.start_at,e.city,e.image_url,e.official_url,e.price_text,s.name as source,v.name as venue,v.address from events e join sources s on s.id=e.source_id left join venues v on v.id=e.venue_id where e.id=$1 and e.status='active' limit 1",[eventId]);
 const e=rows[0];
 if(!e)return <main style={{maxWidth:900,margin:"60px auto",padding:24}}><Link href="/">← GoToday</Link><h1>Event unavailable</h1><p>This event is no longer in our verified feed.</p></main>;
 return <main style={{maxWidth:900,margin:"40px auto",padding:24}}><Link href="/">← Back to GoToday</Link>{e.image_url&&<img src={e.image_url} alt="" style={{width:"100%",maxHeight:420,objectFit:"cover",borderRadius:24,marginTop:24}}/>}<h1 style={{fontSize:44,marginBottom:12}}>{e.title}</h1><p style={{fontSize:20}}>🗓 {nice(new Date(e.start_at))}</p><p style={{fontSize:20}}>📍 {e.venue||""}{e.address?", "+e.address:""}{e.city?" · "+e.city:""}</p>{e.description&&<p style={{fontSize:18,lineHeight:1.6}}>{e.description}</p>}{e.price_text&&<p><b>Price:</b> {e.price_text}</p>}<p><b>Source:</b> {e.source}</p><a href={e.official_url} target="_blank" rel="noreferrer" style={{display:"inline-block",marginTop:12}}>Official source →</a></main>
}
