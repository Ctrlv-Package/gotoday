// Annual-event families. "13th Annual Plantation Fall Festival 2026" and next year's "14th Annual Plantation Fall
// Festival" are two occurrences of one family; people follow the family, so next year's listing reaches them
// whenever it's announced, whatever date it lands on.
//
// Family key = the title without years, ordinals ("13th"), "annual", leading "the" or "cancelled:", plus the town.
// Listings of the same event from the city calendar and its Instagram share a key, so they're one family too.
import {db} from "./db";

const town=(city:string)=>String(city||"").toLowerCase().replace(/^ft\.?\s/,"fort ").replace(/,.*$/,"").replace(/[^a-z ]+/g,"").trim();
export function seriesKey(title:string,city:string){
 const t=String(title||"").toLowerCase()
  .replace(/&#?\w+;/g," ").replace(/&/g," and ")
  .replace(/^\W*(cancel+ed|postponed)\W*/,"")
  .replace(/\b(19|20)\d{2}\b/g," ")                      // years
  .replace(/\b\d+(st|nd|rd|th)\b/g," ")                  // 13th
  .replace(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b(?= annual)/g," ")
  .replace(/\bannual\b/g," ").replace(/^\s*the\b/," ")
  .replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
 // "Plantation's Family Fall Festival" in Plantation = "Family Fall Festival" in Plantation.
 const tw=town(city),core=tw&&t.startsWith(tw+" ")?t.slice(tw.length).replace(/^\s*s\b/,"").trim():t;
 const name=core.length>=3?core:t;
 if(name.length<3)return null;
 return `${name}|${tw}`;
}
const tidyTitle=(title:string)=>String(title||"").replace(/^\W*(cancel+ed|postponed)\W*/i,"").replace(/\b(19|20)\d{2}\b/g,"").replace(/\b\d+(st|nd|rd|th)\s+annual\s+/i,"").replace(/\s{2,}/g," ").trim();

/** Give events without a family one (new rows since the last run). Cheap: one upsert per distinct key. */
export async function assignSeries(limit=20000){
 const {rows}=await db.query(`select e.id,e.title,e.city from events e where e.series_id is null order by e.id desc limit $1`,[limit]);
 const byKey=new Map<string,{title:string;town:string;ids:number[]}>();
 for(const r of rows){const k=seriesKey(r.title,r.city);if(!k)continue;const g=byKey.get(k)||{title:tidyTitle(r.title),town:k.split("|")[1],ids:[]};g.ids.push(r.id);byKey.set(k,g)}
 const keys=[...byKey.keys()];if(!keys.length)return 0;
 // Bulk: create missing families, look up their ids, then point every event at its family in one statement.
 for(let i=0;i<keys.length;i+=2000){
  const ks=keys.slice(i,i+2000);
  await db.query(`insert into event_series(key,title,town) select * from unnest($1::text[],$2::text[],$3::text[]) on conflict(key) do nothing`,
   [ks,ks.map(k=>byKey.get(k)!.title.slice(0,200)),ks.map(k=>byKey.get(k)!.town||null)]);
  const ids=new Map((await db.query("select id,key from event_series where key=any($1::text[])",[ks])).rows.map((r:any)=>[r.key,r.id]));
  const ev:number[]=[],se:number[]=[];for(const k of ks)for(const id of byKey.get(k)!.ids){ev.push(id);se.push(ids.get(k))}
  await db.query("update events e set series_id=x.s from unnest($1::int[],$2::int[]) as x(e,s) where e.id=x.e",[ev,se]);
 }
 const n=rows.length;
 return n;
}

/** The family of one event (assigning it on the spot if the nightly run hasn't yet). */
export async function seriesOf(eventId:number):Promise<number|null>{
 const r=(await db.query("select series_id,title,city from events where id=$1",[eventId])).rows[0];
 if(!r)return null;if(r.series_id)return r.series_id;
 const key=seriesKey(r.title,r.city);if(!key)return null;
 const s=await db.query(`insert into event_series(key,title,town) values($1,$2,$3) on conflict(key) do update set key=excluded.key returning id`,[key,tidyTitle(r.title).slice(0,200),key.split("|")[1]||null]);
 await db.query("update events set series_id=$1 where id=$2",[s.rows[0].id,eventId]);
 return s.rows[0].id;
}

/** Follow makes sense for events that come around now and then (yearly festivals, seasonal events), not for a
 *  storytime that's on every week — those you just save. */
// Events that come back every year: festivals, fairs, parades, holiday celebrations, "annual" anything, races.
const ANNUAL=/\b(annual|\d+(st|nd|rd|th) (annual|year)|festival|fest\b|fair\b|parade|carnival|expo\b|jubilee|celebration|heritage|holiday|halloween|trunk[- ]or[- ]treat|haunted|harvest|pumpkin|thanksgiving|christmas|santa|tree lighting|menorah|hanukkah|kwanzaa|new year|easter|egg hunt|st\.? patrick|cinco de mayo|juneteenth|memorial day|july 4|fourth of july|independence day|labor day|veterans day|mlk|black history|pride|oktoberfest|diwali|lunar new year|5k|10k|half marathon|marathon|fun run|turkey trot|regatta|air show|fireworks|gala|homecoming|founders'? day|block party|art walk|food truck (fest|rally))\b/i;
// One-off productions and programs (a kids' studio's musical, a touring show, a class) don't come back as "the same" event.
const ONE_OFF=/\b(musical|the musical|play\b|presents|tour\b|comedy|stand-?up|tribute|recital|workshop|class|club|storytime|story time|lecture|talk\b|book (club|talk)|meeting|webinar|screening)\b/i;
export async function followable(seriesId:number,title=""){
 const r=(await db.query(`select count(distinct local_date) filter (where local_date between current_date and current_date+60)::int as soon,
   bool_or(recurrence is not null and recurrence<>'') as recurring,
   bool_or(local_date < current_date-300) as seen_last_year from events where series_id=$1`,[seriesId])).rows[0];
 if(r?.recurring||(r?.soon??0)>3)return false;
 // Seen last year too = it really repeats yearly. Otherwise only when its name says it's a yearly kind of event.
 return !!r?.seen_last_year||(ANNUAL.test(title)&&!ONE_OFF.test(title.replace(ANNUAL,"")));
}
