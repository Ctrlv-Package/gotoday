import {db} from "./db";
// Idempotent, additive schema changes. Runs once per server instance.
let ready:Promise<void>|null=null;
const STATEMENTS=[
 `alter table events add column if not exists age_min smallint, add column if not exists age_max smallint,
   add column if not exists registration_url text, add column if not exists registration_text text, add column if not exists recurrence text,
   add column if not exists timezone text, add column if not exists local_date date,
   add column if not exists latitude double precision, add column if not exists longitude double precision`,
 // Backfill rows saved before these columns existed (all earlier sources were Eastern).
 `update events set timezone='America/New_York' where timezone is null`,
 `update events set local_date=(start_at at time zone timezone)::date where local_date is null`,
 `create index if not exists events_local_date_idx on events(local_date) where status='active'`,
 `create index if not exists events_latlng_idx on events(latitude,longitude) where status='active'`,
 // Geocoded places ("Weston, FL" -> lat/lng), so every event can be placed on the map even without a street address.
 `create table if not exists places(key text primary key,latitude double precision,longitude double precision,updated_at timestamptz default now())`,
 // Source configuration: which adapter, its settings, region, time zone, and whether it runs on Vercel or remotely.
 `create table if not exists source_configs(name text primary key,platform text not null,params jsonb not null default '{}',
   source_type text not null default 'official-city',url text,priority int not null default 90,region text,timezone text not null default 'America/New_York',
   enabled boolean not null default true,remote boolean not null default false,created_at timestamptz default now(),updated_at timestamptz default now())`,
];
export function ensureSchema(){
 if(!ready)ready=(async()=>{for(const s of STATEMENTS)await db.query(s)})().catch(e=>{ready=null;throw e});
 return ready;
}
