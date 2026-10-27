// Data for the /today/[city] landing pages (#4): today's events near a city
// centre, read straight from the events table. The events API answers "near
// this ZIP, right now"; these pages answer the question people type into a
// search engine — "things to do today in <city>" — and give it a stable URL.
import {db} from "./db";
import {ensureSchemaSoft} from "./schema";
import {CITY_COORDS, milesBetween} from "./cities";
import {facetsFor, type Facet} from "./facets";
import {todayIn, DEFAULT_TZ} from "./time";
import {decodeHtml} from "./event-detail";

export type CityEvent = {
  id: number; title: string; start: Date; city: string; venue: string | null;
  image: string | null; isFree: boolean; category: string | null; facets: Facet[];
};
export const CATEGORY_SLUGS: Record<string, Facet> = {
  family: "Family", kids: "Kids", adults: "Adults", music: "Music",
  "arts-and-theatre": "Arts & Theatre", sports: "Sports", free: "Free",
};
export const facetSlug = (f: Facet) => f.toLowerCase().replace(/ & /g, "-and-").replace(/[^a-z0-9]+/g, "-");

const RADIUS_MILES = 12;

export async function todaysEventsNear(cityName: string, facet?: Facet): Promise<CityEvent[]> {
  const center = CITY_COORDS[cityName];
  if (!center) return [];
  await ensureSchemaSoft();
  const today = todayIn(DEFAULT_TZ);
  const dLat = RADIUS_MILES / 69, dLng = RADIUS_MILES / (69 * Math.cos(center[0] * Math.PI / 180));
  const {rows} = await db.query(
    `select e.id,e.title,e.description,e.start_at,e.city,e.image_url,e.category,e.genre,e.tags,e.is_free,e.price_text,
            e.latitude as elat,e.longitude as elng, v.name as venue, v.latitude as vlat, v.longitude as vlng, s.name as source
     from events e join sources s on s.id=e.source_id left join venues v on v.id=e.venue_id
     where e.status='active' and e.local_date=$1::date
       and ((e.latitude between $2 and $3 and e.longitude between $4 and $5)
            or (v.latitude between $2 and $3 and v.longitude between $4 and $5)
            or lower(e.city)=lower($6))
     order by e.start_at limit 500`,
    [today, center[0] - dLat, center[0] + dLat, center[1] - dLng, center[1] + dLng, cityName]);
  const seen = new Set<string>(), out: CityEvent[] = [];
  for (const r of rows) {
    const la = r.elat ?? r.vlat ?? CITY_COORDS[r.city]?.[0], lo = r.elng ?? r.vlng ?? CITY_COORDS[r.city]?.[1];
    const near = la != null && lo != null ? milesBetween(center[0], center[1], Number(la), Number(lo)) <= RADIUS_MILES : (r.city || "").toLowerCase() === cityName.toLowerCase();
    if (!near) continue;
    const key = `${(r.title || "").toLowerCase()}|${r.start_at}`;
    if (seen.has(key)) continue; seen.add(key);
    const tags: string[] = Array.isArray(r.tags) ? r.tags : [];
    const facets = facetsFor({title: r.title, desc: r.description || "", tags, category: r.category || "", genre: r.genre || "", source: r.source, isFree: !!r.is_free, priceText: r.price_text || undefined});
    if (facet && !facets.includes(facet)) continue;
    out.push({id: r.id, title: decodeHtml(r.title), start: new Date(r.start_at), city: r.city || "", venue: r.venue ? decodeHtml(r.venue) : null, image: r.image_url, isFree: !!r.is_free, category: r.category, facets});
    if (out.length >= 60) break;
  }
  return out;
}
