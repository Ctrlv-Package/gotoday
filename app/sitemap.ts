import type {MetadataRoute} from "next";
import {SEO_CITIES, citySlug} from "../lib/cities";
import {CATEGORY_SLUGS} from "../lib/todayPages";
import {db} from "../lib/db";

// Static pages, one landing page per covered city (and per city/category), and every upcoming event page, so
// searches like "pumpkin patch Davie" can land on the event itself. Rebuilt hourly.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://www.mygotoday.com";
  const out: MetadataRoute.Sitemap = [
    {url: `${base}/`, changeFrequency: "daily", priority: 1},
    {url: `${base}/create`, changeFrequency: "monthly", priority: 0.4},
    {url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2},
    {url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2},
  ];
  for (const city of SEO_CITIES) {
    out.push({url: `${base}/today/${citySlug(city)}`, changeFrequency: "daily", priority: 0.8});
    for (const slug of Object.keys(CATEGORY_SLUGS)) out.push({url: `${base}/today/${citySlug(city)}/${slug}`, changeFrequency: "daily", priority: 0.6});
  }
  // A sitemap holds at most 50,000 addresses: the next three weeks of real events (not classes or meetings).
  try {
    const {rows} = await db.query(`select id, updated_at as at from events
      where status='active' and local_date between current_date and current_date+21 and coalesce(event_type,'event')='event'
      order by local_date, id limit ${50000 - out.length - 10}`);
    for (const r of rows as any[]) out.push({url: `${base}/events/db-${r.id}`, lastModified: r.at ? new Date(r.at) : undefined, changeFrequency: "weekly", priority: 0.5});
  } catch {}
  // Venues with an upcoming listing, in whatever budget is left. Venues with nothing on stay out.
  try {
    const {rows} = await db.query(`select v.id from venues v where exists (select 1 from events e where e.venue_id=v.id and e.status='active' and e.start_at>=now()-interval '3 hours') order by v.id limit ${Math.max(0, 50000 - out.length)}`);
    for (const r of rows as any[]) out.push({url: `${base}/venues/${r.id}`, changeFrequency: "weekly", priority: 0.5});
  } catch {}
  return out;
}
