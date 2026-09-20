"use client";

import { useEffect, useMemo, useState } from "react";

type EventItem = {
  id?: string;
  title: string;
  city: string;
  venue?: string;
  date?: string;
  time?: string;
  status?: string;
  image?: string;
  url?: string;
  category?: string;
  genre?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  currency?: string;
  miles?: number;
  desc?: string;
  tags?: string[];
  emoji?: string;
};

const sampleEvents: EventItem[] = [
  { title:"Fall Festival", city:"Davie, FL", miles:17, desc:"Seasonal family fun, food and entertainment.", tags:["Family","Outdoor"], emoji:"🎃" },
  { title:"Sunday Waterfront Market", city:"Fort Lauderdale, FL", miles:28, desc:"Local vendors, food and live entertainment.", tags:["Food","Free"], emoji:"🎶" },
  { title:"Family Activity Day", city:"Pembroke Pines, FL", miles:18, desc:"A nearby activity for kids and families.", tags:["Kids","Family"], emoji:"🦖" }
];

const chips = ["All","Family","Music","Sports","Arts & Theatre","Free","Kids"];

function formatEventDate(date?: string, time?: string) {
  if (!date) return "Date TBA";
  const value = new Date(date + "T" + (time || "12:00:00"));
  return new Intl.DateTimeFormat("en-US", { weekday:"short", month:"short", day:"numeric", hour: time ? "numeric" : undefined, minute: time ? "2-digit" : undefined }).format(value);
}

export default function Home() {
  const [zip, setZip] = useState("33326");
  const [searchedZip, setSearchedZip] = useState("33326");
  const [active, setActive] = useState("All");
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<EventItem[]>(sampleEvents);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);
  const [message, setMessage] = useState("");

  async function loadEvents(targetZip = searchedZip) {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/events?postalCode=" + encodeURIComponent(targetZip) + "&radius=50");
      const data = await response.json();
      if (data.configured && data.events?.length) {
        setEvents(data.events);
        setLive(true);
      } else {
        setEvents(sampleEvents);
        setLive(false);
        setMessage(data.message || "Live event source is not configured yet.");
      }
    } catch {
      setEvents(sampleEvents);
      setLive(false);
      setMessage("Live events are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadEvents("33326"); }, []);

  function submitZip() {
    const clean = zip.trim();
    if (!/^\d{5}$/.test(clean)) {
      setMessage("Enter a valid 5-digit ZIP code.");
      return;
    }
    setSearchedZip(clean);
    loadEvents(clean);
  }

  function useLocation() {
    if (!navigator.geolocation) {
      setMessage("Location is not supported by this browser.");
      return;
    }
    setMessage("Location detected. ZIP lookup is coming next; for now, enter your ZIP.");
    navigator.geolocation.getCurrentPosition(
      () => setMessage("Location permission works! ZIP conversion is the next integration."),
      () => setMessage("Location permission was not granted. You can still enter a ZIP code.")
    );
  }

  const filtered = useMemo(() => events.filter((event) => {
    const categoryMatch = active === "All" || event.category === active || event.tags?.includes(active) || (active === "Kids" && event.tags?.includes("Family"));
    const text = [event.title,event.city,event.venue,event.desc,event.category,event.genre].filter(Boolean).join(" ").toLowerCase();
    return categoryMatch && text.includes(query.toLowerCase());
  }), [events, active, query]);

  return <main>
    <section className="hero">
      <nav><div className="logo">Go<span>Today</span></div><div className="navlinks">Events · About · Add Event ♡ ☰</div></nav>
      <div className="heroContent">
        <div className="eyebrow">EXPLORE MORE. TODAY.</div>
        <h1>What are we<br/>doing today?</h1>
        <p>Find amazing things to do near you — for every moment, every mood, every weekend.</p>
        <div className="searchRow">
          <input value={zip} onChange={(e)=>setZip(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&submitZip()} placeholder="Enter ZIP code"/>
          <button onClick={useLocation}>Use my location</button>
        </div>
        <button className="cta" onClick={submitZip}>{loading ? "Finding events…" : "Find Things to Do →"}</button>
      </div>
    </section>

    <section className="content">
      <div className="toolbar">
        <div><b>📍 {searchedZip}</b><span>{live ? "LIVE EVENTS" : "DEMO DATA"}</span></div>
        <input placeholder="Search events" value={query} onChange={(e)=>setQuery(e.target.value)}/>
      </div>
      {message && <p className="notice">{message}</p>}
      <div className="chips">{chips.map((chip)=><button key={chip} className={active===chip?"active":""} onClick={()=>setActive(chip)}>{chip}</button>)}</div>
      <h2>{loading ? "Searching…" : filtered.length + " events near you"}</h2>
      <div className="grid">{filtered.map((event,index)=><article className="card" key={event.id || event.title + index}>
        <div className="pic" style={event.image ? {backgroundImage:"url(" + event.image + ")",backgroundSize:"cover",backgroundPosition:"center"} : undefined}><span>{event.image ? "" : (event.emoji || "🎟️")}</span></div>
        <div className="cardBody">
          <div className="topline"><h3>{event.title}</h3><button className="heart">♡</button></div>
          <div className="meta">📍 {event.venue ? event.venue + " · " : ""}{event.city}</div>
          <div className="meta">🗓 {event.date ? formatEventDate(event.date,event.time) : "Today"}</div>
          <p>{event.desc || [event.category,event.genre].filter(Boolean).join(" · ") || "Local event"}</p>
          <div className="tags">
            {(event.tags || [event.category,event.genre].filter(Boolean) as string[]).slice(0,3).map((tag)=><span key={tag}>{tag}</span>)}
            {event.minPrice != null && <span>From $ {event.minPrice}</span>}
          </div>
          {event.url && <p><a href={event.url} target="_blank" rel="noreferrer">View event →</a></p>}
        </div>
      </article>)}</div>
      <div className="aiBox"><div><b>✨ Not sure what to do?</b><p>Tell GoToday a few details and we’ll narrow it down for you.</p></div><button>Find Something for Me →</button></div>
    </section>
  </main>;
}
