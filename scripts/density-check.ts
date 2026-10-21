// Event-density check (#3): how many real (local, non-Ticketmaster) events does
// GoToday actually have per day, per area, over the next DAYS days?
//
// Rationale: a "today near you" product dies on an empty day. An area only earns
// a landing page / expansion slot when it clears the gate:
//   READY  = at least MIN_LOCAL events on at least MIN_DAYS of the window
//   THIN   = some local events, but below the gate — keep filling sources
//   EMPTY  = no local events in the window — do not promote this area yet
//
// Usage:  npx tsx scripts/density-check.ts [--days 14] [--json]
// Reads GOTODAY_URL (default https://www.mygotoday.com). Uses only the public
// /api/events endpoint, the same numbers a visitor would get.
const BASE = (process.env.GOTODAY_URL || "https://www.mygotoday.com").replace(/\/$/, "");
const args = process.argv.slice(2);
const DAYS = Number(args[args.indexOf("--days") + 1]) || 14;
const JSON_OUT = args.includes("--json");
const MIN_LOCAL = 5, MIN_DAYS = Math.ceil(DAYS * 0.7);

// One representative ZIP per area (the site searches a 25-mile radius from it).
const AREAS: Record<string, string> = {
  "Sunrise, FL": "33326", "Fort Lauderdale, FL": "33301", "Coral Springs, FL": "33065",
  "Hollywood, FL": "33020", "Pembroke Pines, FL": "33024", "Miramar, FL": "33025",
  "Plantation, FL": "33324", "Davie, FL": "33314", "Weston, FL": "33327",
  "Pompano Beach, FL": "33060", "Deerfield Beach, FL": "33441", "Miami, FL": "33101",
  "Miami Beach, FL": "33139", "Coral Gables, FL": "33134", "Hialeah, FL": "33010",
  "Boca Raton, FL": "33432", "Delray Beach, FL": "33444", "West Palm Beach, FL": "33401",
  "Boynton Beach, FL": "33435", "Wellington, FL": "33414", "Jupiter, FL": "33458",
  "Orlando, FL": "32801", "Winter Park, FL": "32789", "Tampa, FL": "33602",
  "St. Petersburg, FL": "33701", "Manhattan, NY": "10001", "Brooklyn, NY": "11201",
};
const ymd = (d: Date) => d.toISOString().slice(0, 10);

type Day = {date: string; total: number; local: number; ticketmaster: number};
async function probe(zip: string, date: string, today: string): Promise<Day> {
  const u = `${BASE}/api/events?postalCode=${zip}&range=${date}&today=${today}`;
  const r = await fetch(u, {headers: {"user-agent": "gotoday-density-check"}});
  if (!r.ok) throw new Error(`${r.status} for ${u}`);
  const d: any = await r.json();
  return {date, total: d.total ?? 0, local: d.localCount ?? 0, ticketmaster: d.ticketmasterCount ?? 0};
}

async function main() {
  // "Today" in the site's own timezone, then +i days from there.
  const today = new Intl.DateTimeFormat("en-CA", {timeZone: "America/New_York"}).format(new Date());
  const dates = Array.from({length: DAYS}, (_, i) => { const d = new Date(today + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + i); return ymd(d); });
  const report: any[] = [];
  for (const [area, zip] of Object.entries(AREAS)) {
    const days: Day[] = [];
    for (const date of dates) days.push(await probe(zip, date, today));
    const goodDays = days.filter(d => d.local >= MIN_LOCAL).length;
    const totalLocal = days.reduce((a, d) => a + d.local, 0);
    const verdict = totalLocal === 0 ? "EMPTY" : goodDays >= MIN_DAYS ? "READY" : "THIN";
    report.push({area, zip, verdict, goodDays, totalLocal, days});
    if (!JSON_OUT) console.log(`${verdict.padEnd(5)} ${area.padEnd(24)} zip ${zip}  local/day: ${days.map(d => d.local).join(", ")}`);
  }
  if (JSON_OUT) console.log(JSON.stringify({base: BASE, today, days: DAYS, gate: {minLocal: MIN_LOCAL, minDays: MIN_DAYS}, report}, null, 1));
  const ready = report.filter(r => r.verdict === "READY").length;
  if (!JSON_OUT) console.log(`\nGate: >=${MIN_LOCAL} local events on >=${MIN_DAYS} of ${DAYS} days. ${ready}/${report.length} areas READY.`);
}
main().catch(e => { console.error(e); process.exit(1); });
export {};
