"use client";

import { useMemo, useState } from "react";

const events = [
  {
    title: "Flamingo Road Nursery Fall Festival",
    city: "Davie, FL",
    miles: 17,
    time: "Today, 9:00 AM – 6:00 PM",
    desc: "Hayrides, pumpkins, food, live entertainment and more.",
    tags: ["Family", "Outdoor", "$20"],
    emoji: "🎃"
  },
  {
    title: "Sundays on the River",
    city: "Fort Lauderdale, FL",
    miles: 28,
    time: "Today, 12:00 PM – 6:00 PM",
    desc: "Live music, artisan market, food and drinks along the New River.",
    tags: ["Live Music", "Food", "Free"],
    emoji: "🎶"
  },
  {
    title: "Dino Little Leapers",
    city: "Pembroke Pines, FL",
    miles: 18,
    time: "Today, 10:00 AM – 12:00 PM",
    desc: "Dinosaur-themed fun for kids 0–6.",
    tags: ["Kids", "Indoor", "$12"],
    emoji: "🦖"
  },
  {
    title: "Las Olas Sunday Market",
    city: "Fort Lauderdale, FL",
    miles: 29,
    time: "Today, 10:00 AM – 4:00 PM",
    desc: "Local vendors, food and ocean views.",
    tags: ["Shopping", "Food", "Free"],
    emoji: "🛍️"
  },
  {
    title: "Encanto Sing-Along",
    city: "Miami, FL",
    miles: 38,
    time: "Today, 6:00 PM",
    desc: "Rooftop movie night with a themed family experience.",
    tags: ["Kids", "Movies", "$22+"],
    emoji: "🎬"
  }
];

const chips = ["All", "Family", "Date", "Free", "Outdoor", "Food", "Kids"];

export default function Home() {
  const [zip, setZip] = useState("33326");
  const [active, setActive] = useState("All");
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      events
        .filter((event) => active === "All" || event.tags.includes(active))
        .filter((event) =>
          [event.title, event.city, event.desc]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase())
        ),
    [active, query]
  );

  return (
    <main>
      <section className="hero">
        <nav>
          <div className="logo">
            Go<span>Today</span>
          </div>
          <div className="navlinks">Events · About · Add Event ♡ ☰</div>
        </nav>

        <div className="heroContent">
          <div className="eyebrow">EXPLORE MORE. TODAY.</div>
          <h1>
            What are we
            <br />
            doing today?
          </h1>
          <p>
            Find amazing things to do near you — for every moment, every mood,
            every weekend.
          </p>

          <div className="searchRow">
            <input
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="Enter ZIP code"
            />
            <button>Use my location</button>
          </div>

          <button className="cta">Find Things to Do →</button>
        </div>
      </section>

      <section className="content">
        <div className="toolbar">
          <div>
            <b>📍 {zip || "Your area"}</b>
            <span>Today</span>
          </div>
          <input
            placeholder="Search events"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="chips">
          {chips.map((chip) => (
            <button
              key={chip}
              className={active === chip ? "active" : ""}
              onClick={() => setActive(chip)}
            >
              {chip}
            </button>
          ))}
        </div>

        <h2>{filtered.length} great events near you</h2>

        <div className="grid">
          {filtered.map((event) => (
            <article className="card" key={event.title}>
              <div className="pic">
                <span>{event.emoji}</span>
              </div>
              <div className="cardBody">
                <div className="topline">
                  <h3>{event.title}</h3>
                  <button className="heart">♡</button>
                </div>
                <div className="meta">
                  📍 {event.city} · {event.miles} min away
                </div>
                <div className="meta">🗓 {event.time}</div>
                <p>{event.desc}</p>
                <div className="tags">
                  {event.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="aiBox">
          <div>
            <b>✨ Not sure what to do?</b>
            <p>Tell GoToday a few details and we’ll narrow it down for you.</p>
          </div>
          <button>Find Something for Me →</button>
        </div>
      </section>
    </main>
  );
}
