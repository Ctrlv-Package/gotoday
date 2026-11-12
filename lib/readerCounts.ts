// Counts of Instagram posts read by each model, for the public health page (/api/db-health).
// The reader is recorded in social_posts.reader when a post is read (see lib/sources/instagram.ts);
// rows read before that column existed have NULL there and count as "unknown", so old days still
// show their volume even though the split is unknown. Pure helpers: no database access here.

export type ReaderName="gemini"|"claude"|"unknown";
export type ReaderCounts={gemini:number;claude:number;unknown:number};

export function emptyReaderCounts():ReaderCounts{
 return{gemini:0,claude:0,unknown:0};
}

/** Anything that isn't a known model name (including NULL from old rows) counts as unknown. */
export function normalizeReader(v:unknown):ReaderName{
 return v==="gemini"||v==="claude"?v:"unknown";
}

/** Rows of {reader, n} (e.g. one group-by row per reader) into one count per model. */
export function summarizeReaderRows(rows:{reader?:unknown;n?:unknown}[]):ReaderCounts{
 const out=emptyReaderCounts();
 for(const r of rows||[])out[normalizeReader(r?.reader)]+=Number(r?.n)||0;
 return out;
}

/** Rows of {day, reader, n} into one count per model per day, oldest day first, every model present. */
export function summarizeReaderByDay(rows:{day?:unknown;reader?:unknown;n?:unknown}[]):{day:string;gemini:number;claude:number;unknown:number}[]{
 const byDay=new Map<string,ReaderCounts>();
 for(const r of rows||[]){
  const day=String(r?.day||"");
  if(!day)continue;
  const counts=byDay.get(day)||emptyReaderCounts();
  counts[normalizeReader(r?.reader)]+=Number(r?.n)||0;
  byDay.set(day,counts);
 }
 return[...byDay.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([day,c])=>({day,...c}));
}

/** The daily cap on paid fallback reads, same value the reader uses (lib/sources/instagram.ts). */
export function aiPostsCap():number{
 return Number(process.env.AI_POSTS_PER_DAY||120);
}

/** True once today's paid (Claude) reads have used up the cap: no more paid reads today. */
export function capReached(claudeToday:number,cap=aiPostsCap()):boolean{
 return claudeToday>=cap;
}
