import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { events: [], configured: false, message: "Ticketmaster API key is not configured yet." },
      { status: 200 }
    );
  }

  const params = request.nextUrl.searchParams;
  const postalCode = params.get("postalCode") || "33326";
  const radius = params.get("radius") || "50";

  const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("countryCode", "US");
  url.searchParams.set("postalCode", postalCode);
  url.searchParams.set("radius", radius);
  url.searchParams.set("unit", "miles");
  url.searchParams.set("size", "40");
  url.searchParams.set("sort", "date,asc");

  try {
    const response = await fetch(url.toString(), { next: { revalidate: 900 } });
    if (!response.ok) throw new Error("Ticketmaster request failed");
    const data = await response.json();
    const raw = data?._embedded?.events || [];

    const events = raw.map((event: any) => {
      const venue = event?._embedded?.venues?.[0];
      const image = [...(event.images || [])].sort((a: any, b: any) => (b.width || 0) - (a.width || 0))[0]?.url;
      const classification = event.classifications?.[0];
      const price = event.priceRanges?.[0];

      return {
        id: event.id,
        title: event.name,
        city: [venue?.city?.name, venue?.state?.stateCode].filter(Boolean).join(", "),
        venue: venue?.name || "",
        date: event.dates?.start?.localDate || "",
        time: event.dates?.start?.localTime || "",
        status: event.dates?.status?.code || "",
        image: image || "",
        url: event.url || "",
        category: classification?.segment?.name || "Event",
        genre: classification?.genre?.name || "",
        minPrice: price?.min ?? null,
        maxPrice: price?.max ?? null,
        currency: price?.currency || "USD"
      };
    });

    return NextResponse.json({ events, configured: true });
  } catch {
    return NextResponse.json({ events: [], configured: true, message: "Could not load live events right now." }, { status: 502 });
  }
}
