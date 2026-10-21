import {notFound} from "next/navigation";
import type {Metadata} from "next";
import {cityFromSlug} from "../../../../lib/cities";
import {todaysEventsNear, CATEGORY_SLUGS} from "../../../../lib/todayPages";
import {todayIn, DEFAULT_TZ} from "../../../../lib/time";
import {fmtDate} from "../../../../lib/event-detail";
import CityDay, {cityMetadata} from "../../CityDay";

export const dynamic = "force-dynamic";

export async function generateMetadata({params}: {params: Promise<{city: string; category: string}>}): Promise<Metadata> {
  const {city, category} = await params; const name = cityFromSlug(city); const facet = CATEGORY_SLUGS[category];
  if (!name || !facet) return {title: "GoToday"};
  const m = cityMetadata(name, facet);
  return {...m, alternates: {canonical: `/today/${city}/${category}`}, openGraph: {title: m.title, description: m.description, siteName: "GoToday", type: "website"}};
}
export default async function CityCategoryPage({params}: {params: Promise<{city: string; category: string}>}) {
  const {city, category} = await params; const name = cityFromSlug(city); const facet = CATEGORY_SLUGS[category];
  if (!name || !facet) notFound();
  const events = await todaysEventsNear(name, facet).catch(() => []);
  const todayLabel = fmtDate(new Date(`${todayIn(DEFAULT_TZ)}T12:00:00Z`), {weekday: "long", month: "long", day: "numeric"}, "UTC");
  return <CityDay city={name} facet={facet} events={events} todayLabel={todayLabel} />;
}
