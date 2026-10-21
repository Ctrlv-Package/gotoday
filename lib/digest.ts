// The morning digest (#4): one short email per person who has something
// today — the events they saved that happen today, plus the next date of
// anything they follow. People with nothing on get nothing: the digest is a
// reminder, not a newsletter.
//
// Sending is deliberately pluggable: if DIGEST_WEBHOOK_URL is set, each digest
// is POSTed there as JSON {to, subject, text, html} (any email provider's
// inbound webhook / a small relay can accept that shape). Without it, the
// /api/digest endpoint returns the digests so a scheduler or a human can see
// exactly what would go out.
import {db} from "./db";
import {ensureSchema} from "./schema";
import {todayIn, DEFAULT_TZ} from "./time";
import {fmtTime} from "./event-detail";

export type Digest = {to: string; name: string | null; subject: string; text: string; html: string};

type Row = {uid: number; email: string; name: string | null; id: number; title: string; start_at: string; city: string; venue: string | null; kind: string; local_date: string};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function buildDigests(site = "https://www.mygotoday.com"): Promise<Digest[]> {
  await ensureSchema();
  const today = todayIn(DEFAULT_TZ);
  const {rows} = await db.query(
    `select u.id as uid, u.email, u.name, e.id, e.title, e.start_at, e.city, v.name as venue,
            'saved' as kind, e.local_date::text as local_date
       from users u join saved_events se on se.user_id=u.id join events e on e.id=se.event_id
       left join venues v on v.id=e.venue_id
      where e.status='active' and e.local_date=$1::date
     union all
     select u.id, u.email, u.name, e.id, e.title, e.start_at, e.city, v.name,
            'followed', e.local_date::text
       from users u join follows f on f.user_id=u.id join events e on e.series_id=f.series_id
       left join venues v on v.id=e.venue_id
      where e.status='active' and e.local_date between $1::date and $1::date+7
     order by uid, kind desc, start_at limit 5000`, [today]) as {rows: Row[]};
  const byUser = new Map<number, {email: string; name: string | null; saved: Row[]; followed: Row[]}>();
  for (const r of rows) {
    const u = byUser.get(r.uid) || {email: r.email, name: r.name, saved: [], followed: []};
    (r.kind === "saved" ? u.saved : u.followed).push(r); byUser.set(r.uid, u);
  }
  const line = (r: Row) => `• ${r.title} — ${fmtTime(new Date(r.start_at), DEFAULT_TZ)}${r.venue ? ` at ${r.venue}` : ""}${r.city ? `, ${r.city}` : ""} (${site}/events/db-${r.id})`;
  const hline = (r: Row) => `<li><a href="${site}/events/db-${r.id}">${esc(r.title)}</a> — ${fmtTime(new Date(r.start_at), DEFAULT_TZ)}${r.venue ? ` at ${esc(r.venue)}` : ""}</li>`;
  const out: Digest[] = [];
  for (const u of byUser.values()) {
    const first = (u.name || "").split(" ")[0];
    const subject = u.saved.length
      ? `Today: ${u.saved[0].title}${u.saved.length > 1 ? ` and ${u.saved.length - 1} more you saved` : ""}`
      : "Your followed events are coming up";
    const text = [
      `Good morning${first ? `, ${first}` : ""} — here's your GoToday for today.`,
      ...(u.saved.length ? ["", "Saved for today:", ...u.saved.map(line)] : []),
      ...(u.followed.length ? ["", "Coming up from events you follow:", ...u.followed.slice(0, 5).map(r => `${line(r)} — ${r.local_date}`)] : []),
      "", `See everything near you: ${site}/`, "— GoToday (you get this only on days you have something saved or followed coming up)",
    ].join("\n");
    const html = `<p>Good morning${first ? `, ${esc(first)}` : ""} — here's your GoToday for today.</p>`
      + (u.saved.length ? `<p><strong>Saved for today:</strong></p><ul>${u.saved.map(hline).join("")}</ul>` : "")
      + (u.followed.length ? `<p><strong>Coming up from events you follow:</strong></p><ul>${u.followed.slice(0, 5).map(r => hline(r)).join("")}</ul>` : "")
      + `<p><a href="${site}/">See everything near you →</a></p>`;
    out.push({to: u.email, name: u.name, subject, text, html});
  }
  return out;
}

export async function sendDigests(digests: Digest[]): Promise<{sent: number; skipped: number}> {
  const hook = process.env.DIGEST_WEBHOOK_URL;
  if (!hook) return {sent: 0, skipped: digests.length};
  let sent = 0;
  for (const d of digests) {
    const r = await fetch(hook, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(d)}).catch(() => null);
    if (r && r.ok) sent++;
  }
  return {sent, skipped: digests.length - sent};
}
