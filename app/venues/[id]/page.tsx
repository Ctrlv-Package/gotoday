import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {db} from "../../../lib/db";
import {fmtDate,fmtTime} from "../../../lib/event-detail";
import {getLang} from "../../../lib/lang-server";
import {tFor} from "../../../lib/i18n";
export const dynamic="force-dynamic";

// One page per venue: what's on there next. Only venues with an upcoming listing are linked from
// anywhere and listed in the sitemap; a venue with nothing on still renders (for a visitor who followed
// a link) but stays out of Google's index until it has something to show.
const upcoming=(id:number)=>db.query(`select id,title,start_at,timezone from events where venue_id=$1 and status='active' and start_at>=now()-interval '3 hours' order by start_at limit 50`,[id]);

export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
 const n=Number((await params).id);if(!Number.isInteger(n)||n<=0)return{title:"Venue · GoToday",robots:{index:false}};
 const v=await db.query("select name,city from venues where id=$1",[n]).catch(()=>({rows:[]}));
 if(!v.rows[0])return{title:"Venue · GoToday",robots:{index:false}};
 const ev=await upcoming(n).catch(()=>({rows:[]}));
 const place=v.rows[0].city||"";
 return{title:`Events at ${v.rows[0].name} · GoToday`,description:`Upcoming events at ${v.rows[0].name}${place?` in ${place}`:""}.`,robots:ev.rows[0]?undefined:{index:false}};
}

export default async function VenuePage({params}:{params:Promise<{id:string}>}){
 const n=Number((await params).id);if(!Number.isInteger(n)||n<=0)notFound();
 const v=await db.query("select id,name,address,city,state from venues where id=$1",[n]).catch(()=>({rows:[]}));
 if(!v.rows[0])notFound();
 const venue=v.rows[0],events=(await upcoming(n).catch(()=>({rows:[]}))).rows;
 const t=tFor(await getLang());
 const where=[venue.address,venue.city,venue.state].filter(Boolean).join(", ");
 return <main className="detail"><SiteHeader/><div className="detailWrap"><article className="detailCard"><div className="detailBody">
  <h1>{t("Events at {name}",{name:venue.name})}</h1>
  {where&&<p className="muted">{where}</p>}
  {events.length===0?<p className="muted">{t("No upcoming events listed here right now.")}</p>
  :<section className="related"><ul>{events.map(o=><li key={o.id}><Link href={`/events/db-${o.id}`}><b>{o.title}</b><span>{fmtDate(new Date(o.start_at),{weekday:"short",month:"short",day:"numeric"},o.timezone||undefined)} · {fmtTime(new Date(o.start_at),o.timezone||undefined)}</span></Link></li>)}</ul></section>}
 </div></article></div></main>;
}
