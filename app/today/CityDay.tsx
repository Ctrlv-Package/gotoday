import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import {SEO_CITIES, citySlug} from "../../lib/cities";
import {CATEGORY_SLUGS, facetSlug, type CityEvent} from "../../lib/todayPages";
import {fmtDate, fmtTime} from "../../lib/event-detail";
import {DEFAULT_TZ} from "../../lib/time";

// Shared rendering for /today/[city] and /today/[city]/[category].
export default function CityDay({city, facet, events, todayLabel}: {city: string; facet?: string; events: CityEvent[]; todayLabel: string}) {
  const town = city.replace(/, [A-Z]{2}$/, "");
  const heading = facet ? `${facet} events today in ${town}` : `Things to do today in ${town}`;
  const jsonLd = {
    "@context": "https://schema.org", "@type": "ItemList", name: heading,
    itemListElement: events.slice(0, 30).map((e, i) => ({"@type": "ListItem", position: i + 1, url: `https://www.mygotoday.com/events/db-${e.id}`, name: e.title})),
  };
  return <main className="detail">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd)}} />
    <SiteHeader />
    <div className="detailWrap">
      <h1 style={{marginTop: 24}}>{heading}</h1>
      <p>{todayLabel} · {events.length} {events.length === 1 ? "event" : "events"} within about 12 miles of {town}.
        {" "}<Link href="/">Search another ZIP →</Link></p>
      <nav style={{display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0"}}>
        <Link href={`/today/${citySlug(city)}`}>All</Link>
        {Object.entries(CATEGORY_SLUGS).map(([slug, name]) => <Link key={slug} href={`/today/${citySlug(city)}/${slug}`}>{name}</Link>)}
      </nav>
      {events.length === 0
        ? <p>Nothing is listed for today yet — listings appear as organizers publish them. <Link href="/">See what&apos;s on nearby →</Link></p>
        : <div className="grid">{events.map(e => (
          <article className="card" key={e.id}>
            {e.image ? <img src={e.image} alt="" loading="lazy" style={{width: "100%", aspectRatio: "16/9", objectFit: "cover"}} /> : null}
            <div className="cardBody">
              <h3><Link href={`/events/db-${e.id}`}>{e.title}</Link></h3>
              <div>{fmtTime(e.start, DEFAULT_TZ)} · {e.venue || e.city}{e.isFree ? " · Free" : ""}</div>
              <div>{e.facets.map(f => <Link key={f} href={`/today/${citySlug(city)}/${facetSlug(f)}`} style={{marginRight: 8}}>{f}</Link>)}</div>
            </div>
          </article>))}
        </div>}
      <h2 style={{marginTop: 36}}>Other cities today</h2>
      <p>{SEO_CITIES.filter(c => c !== city).map(c => (
        <span key={c}><Link href={`/today/${citySlug(c)}`}>{c.replace(/, [A-Z]{2}$/, "")}</Link>{" · "}</span>))}</p>
      <p style={{margin: "24px 0 48px"}}><Link href="/">← GoToday home</Link></p>
    </div>
  </main>;
}
export function cityMetadata(city: string, facet?: string) {
  const town = city.replace(/, [A-Z]{2}$/, "");
  const title = facet ? `${facet} events today in ${town} · GoToday` : `Things to do today in ${town} · GoToday`;
  const description = facet
    ? `${facet} events happening today in ${town}, Florida — times, places and free options, updated daily on GoToday.`
    : `What's on today in ${town}, Florida: concerts, storytimes, markets, festivals and free local events, updated daily on GoToday.`;
  return {title, description};
}
export {fmtDate};
