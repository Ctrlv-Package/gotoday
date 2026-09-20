import { NextRequest, NextResponse } from "next/server";

function dedupeKey(title: string, venue: string, date: string) {
  const normalizedTitle = title
    .toLowerCase()
    .replace(/\b\d{1,2}:\d{2}\s*(am|pm)?\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return [normalizedTitle, venue.toLowerCase().trim(), date].join("|");
}

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
  const useSouthFloridaMarket = /^33\d{3}$/.test(postalCode);

  const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("countryCode", "US");
  if (useSouthFloridaMarket) {
    url.searchParams.set("marketId", "15");
  } else {
    url.searchParams.set("postalCode", postalCode);
    url.searchParams.set("radius", radius);
    url.searchParams.set("unit", "miles");
  }
  url.searchParams.set("size", "100");
  url.searchParams.set("sort", "date,asc");

  try {
    const response = await fetch(url.toString(), { cache: "no-store" });
    const responseText = await response.text();

    if (!response.ok) {
      let ticketmasterError: unknown = responseText;
      try { ticketmasterError = JSON.parse(responseText); } catch {}
      return NextResponse.json(
        {
          events: [],
          configured: true,
          message: "Ticketmaster API request failed.",
          ticketmasterStatus: response.status,
          ticketmasterStatusText: response.statusText,
          ticketmasterError
        },
        { status: 502 }
      );
    }

    const data = JSON.parse(responseText);
    const raw = data?._embedded?.events || [];

    const mapped = raw.map((event: any) => {
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
        currency: price?.currency || "USD",
        source: "Ticketmaster"
      };
    });

    const seen = new Set<string>();
    const events = mapped.filter((event: any) => {
      const key = dedupeKey(event.title, event.venue, event.date);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 40);

    return NextResponse.json({
      events,
      configured: true,
      searchMode: useSouthFloridaMarket ? "greater-miami-market" : "postal-code",
      requestedPostalCode: postalCode,
      rawCount: raw.length,
      deduplicatedCount: events.length
    });
  } catch (error) {
    return NextResponse.json(
      {
        events: [],
        configured: true,
        message: "GoToday could not complete the Ticketmaster request.",
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 502 }
    );
  }
}
