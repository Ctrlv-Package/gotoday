import type {MetadataRoute} from "next";
import {SEO_CITIES, citySlug} from "../lib/cities";
import {CATEGORY_SLUGS} from "../lib/todayPages";

// Static pages + one landing page per covered city (and per city/category).
// Event pages are found through the city pages and the home search.
export default function sitemap(): MetadataRoute.Sitemap {
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
  return out;
}
