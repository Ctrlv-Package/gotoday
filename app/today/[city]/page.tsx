import {notFound} from "next/navigation";
import type {Metadata} from "next";
import {cityFromSlug} from "../../../lib/cities";
import {todaysEventsNear} from "../../../lib/todayPages";
import {todayIn, DEFAULT_TZ} from "../../../lib/time";
import {fmtDate} from "../../../lib/event-detail";
import CityDay, {cityMetadata} from "../CityDay";

export const dynamic = "force-dynamic";

export async function generateMetadata({params}: {params: Promise<{city: string}>}): Promise<Metadata> {
  const {city} = await params; const name = cityFromSlug(city);
  if (!name) return {title: "GoToday"};
  const m = cityMetadata(name);
  return {...m, alternates: {canonical: `/today/${city}`}, openGraph: {title: m.title, description: m.description, siteName: "GoToday", type: "website"}};
}
export default async function CityTodayPage({params}: {params: Promise<{city: string}>}) {
  const {city} = await params; const name = cityFromSlug(city);
  if (!name) notFound();
  const events = await todaysEventsNear(name).catch(() => []);
  const todayLabel = fmtDate(new Date(`${todayIn(DEFAULT_TZ)}T12:00:00Z`), {weekday: "long", month: "long", day: "numeric"}, "UTC");
  return <CityDay city={name} events={events} todayLabel={todayLabel} />;
}
