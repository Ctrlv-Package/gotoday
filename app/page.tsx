"use client";
import { useEffect,useMemo,useState } from "react";

type EventItem={id?:string;title:string;city:string;venue?:string;date?:string;time?:string;image?:string;url?:string;category?:string;genre?:string;minPrice?:number|null;desc?:string;tags?:string[];emoji?:string};
const sampleEvents:EventItem[]=[];
const chips=["All","Family","Music","Sports","Arts & Theatre","Free","Kids"];
const ranges=[["today","Today"],["tomorrow","Tomorrow"],["weekend","This Weekend"]] as const;
function formatEventDate(date?:string,time?:string){if(!date)return"Date TBA";const value=new Date(date+"T"+(time||"12:00:00"));return new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",hour:time?"numeric":undefined,minute:time?"2-digit":undefined}).format(value)}

export default function Home(){
 const[zip,setZip]=useState("33326"),[searchedZip,setSearchedZip]=useState("33326"),[active,setActive]=useState("All"),[query,setQuery]=useState(""),[events,setEvents]=useState<EventItem[]>(sampleEvents),[loading,setLoading]=useState(false),[live,setLive]=useState(false),[message,setMessage]=useState(""),[range,setRange]=useState("today"),[coords,setCoords]=useState<{lat:number;lng:number}|null>(null);
 async function loadEvents(targetZip=searchedZip,targetRange=range,targetCoords=coords){
  setLoading(true);setMessage("");
  try{
   const q=new URLSearchParams({postalCode:targetZip,radius:"50",range:targetRange});
   if(targetCoords){q.set("lat",String(targetCoords.lat));q.set("lng",String(targetCoords.lng));}
   const response=await fetch("/api/events?"+q.toString());const data=await response.json();
   setEvents(data.events||[]);setLive(Boolean(data.configured));
   if(data.configured&&!data.events?.length)setMessage("No Ticketmaster events found for this time period. More local sources are coming next.");
   else if(!data.configured)setMessage(data.message||"Live event source is not configured yet.");
  }catch{setEvents([]);setLive(false);setMessage("Live events are temporarily unavailable.");}finally{setLoading(false);}
 }
 useEffect(()=>{loadEvents("33326","today",null)},[]);
 function submitZip(){const clean=zip.trim();if(!/^\d{5}$/.test(clean)){setMessage("Enter a valid 5-digit ZIP code.");return;}setCoords(null);setSearchedZip(clean);loadEvents(clean,range,null);}
 function chooseRange(next:string){setRange(next);loadEvents(searchedZip,next,coords);}
 function useLocation(){if(!navigator.geolocation){setMessage("Location is not supported by this browser.");return;}setMessage("Getting your location…");navigator.geolocation.getCurrentPosition((pos)=>{const c={lat:pos.coords.latitude,lng:pos.coords.longitude};setCoords(c);setMessage("Using your current location.");loadEvents(searchedZip,range,c);},()=>setMessage("Location permission was not granted. You can still enter a ZIP code."));}
 const filtered=useMemo(()=>events.filter(event=>{const categoryMatch=active==="All"||event.category===active||event.tags?.includes(active)||(active==="Kids"&&event.tags?.includes("Family"));const text=[event.title,event.city,event.venue,event.desc,event.category,event.genre].filter(Boolean).join(" ").toLowerCase();return categoryMatch&&text.includes(query.toLowerCase())}),[events,active,query]);
 return <main><section className="hero"><nav><div className="logo">Go<span>Today</span></div><div className="navlinks">Events · About · Add Event ♡ ☰</div></nav><div className="heroContent"><div className="eyebrow">EXPLORE MORE. TODAY.</div><h1>What are we<br/>doing today?</h1><p>Find amazing things to do near you — for every moment, every mood, every weekend.</p><div className="searchRow"><input value={zip} onChange={e=>setZip(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitZip()} placeholder="Enter ZIP code"/><button onClick={useLocation}>Use my location</button></div><button className="cta" onClick={submitZip}>{loading?"Finding events…":"Find Things to Do →"}</button></div></section>
 <section className="content"><div className="toolbar"><div><b>📍 {coords?"Current location":searchedZip}</b><span>{live?"LIVE EVENTS":"EVENTS"}</span></div><input placeholder="Search events" value={query} onChange={e=>setQuery(e.target.value)}/></div>
 <div className="chips">{ranges.map(([key,label])=><button key={key} className={range===key?"active":""} onClick={()=>chooseRange(key)}>{label}</button>)}</div>
 {message&&<p className="notice">{message}</p>}<div className="chips">{chips.map(chip=><button key={chip} className={active===chip?"active":""} onClick={()=>setActive(chip)}>{chip}</button>)}</div><h2>{loading?"Searching…":filtered.length+" events near you"}</h2>
 <div className="grid">{filtered.map((event,index)=><article className="card" key={event.id||event.title+index}><div className="pic" style={event.image?{backgroundImage:"url("+event.image+")",backgroundSize:"cover",backgroundPosition:"center"}:undefined}><span>{event.image?"":(event.emoji||"🎟️")}</span></div><div className="cardBody"><div className="topline"><h3>{event.title}</h3><button className="heart">♡</button></div><div className="meta">📍 {event.venue?event.venue+" · ":""}{event.city}</div><div className="meta">🗓 {formatEventDate(event.date,event.time)}</div><p>{event.desc||[event.category,event.genre].filter(Boolean).join(" · ")||"Local event"}</p><div className="tags">{(event.tags||[event.category,event.genre].filter(Boolean) as string[]).slice(0,3).map(tag=><span key={tag}>{tag}</span>)}{event.minPrice!=null&&<span>From $ {event.minPrice}</span>}</div>{event.url&&<p><a href={event.url} target="_blank" rel="noreferrer">View event →</a></p>}</div></article>)}</div>
 <div className="aiBox"><div><b>✨ Not sure what to do?</b><p>Tell GoToday a few details and we’ll narrow it down for you.</p></div><button>Find Something for Me →</button></div></section></main>;
}
