// "Worth going" trust signal: pure counting logic.
// One row per user per event family lives in event_love; the tag is earned at 5.
export const WORTH_GOING_LOVES = 5;

/** One grouped event_love row as stored: n users loved this event (or this family) in loved_year.
 *  series_id is null for one-off events; event_id is the occurrence they tapped.
 *  Rows outlive their events on purpose (no foreign key, like event_reports): retention cleanup
 *  deletes old listings, but their loves still count toward the family. */
export type LoveAgg = { event_id: number | null; series_id: number | null; loved_year: number; n: number };

export type LoveStats = { loves: number; lovedBefore: number; worthGoing: boolean };

/** Count the loves for one card (or one event page): every stored row whose event is one of
 *  this event's copies, or whose family is this event's family. A row matching both still
 *  counts once — it is one grouped row. lovedBefore counts only loves from earlier years,
 *  so a new occurrence of a yearly event can say it was "loved last year". */
export function loveStatsFor(rows: LoveAgg[], input: { ids: number[]; seriesIds: number[]; year: number }): LoveStats {
 const idSet = new Set(input.ids);
 const seriesSet = new Set(input.seriesIds);
 let loves = 0, lovedBefore = 0;
 for (const r of rows) {
  if (!idSet.has(r.event_id ?? -1) && !(r.series_id != null && seriesSet.has(r.series_id))) continue;
  loves += r.n;
  if (r.loved_year < input.year) lovedBefore += r.n;
 }
 return { loves, lovedBefore, worthGoing: loves >= WORTH_GOING_LOVES };
}

/** The "Worth going" filter chip is shown only when at least one result earned the tag,
 *  so it never leads to an empty list. */
export function hasWorthGoing(stats: { worthGoing: boolean }[]): boolean {
 return stats.some(s => s.worthGoing);
}
