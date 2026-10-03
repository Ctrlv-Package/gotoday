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
 // API keys that renew themselves (Instagram's 60-day token); seed = tail of the Vercel value it came from.
 `create table if not exists app_tokens(name text primary key,value text not null,expires_at timestamptz,seed text,updated_at timestamptz default now())`,
 // Events people create on GoToday (public ones are also mirrored into events). manage_hash = sha256 of the creator's secret link.
 `create table if not exists community_events(id serial primary key,share_token text unique not null,manage_hash text unique not null,visibility text not null,status text not null,
   review_reason text,title text not null,description text,start_date date not null,start_time text,end_time text,all_day boolean not null default false,timezone text not null,
   venue text,address text,city text,latitude double precision,longitude double precision,is_free boolean not null default true,price_text text,age_min smallint,age_max smallint,
   category text,link text,host_name text,event_id bigint,ip_hash text,created_at timestamptz default now(),updated_at timestamptz default now())`,
 `create table if not exists rsvps(id serial primary key,community_event_id int not null references community_events(id) on delete cascade,name text not null,status text not null,
   guests int not null default 0,note text,created_at timestamptz default now())`,
 `create unique index if not exists rsvps_event_name_idx on rsvps(community_event_id,lower(name))`,
 // One row per full ingest (scheduled or manual) so the status page can show when the daily update last ran.
 `create table if not exists ingest_log(id serial primary key,trigger text,sources int,succeeded int,failed int,started_at timestamptz default now(),finished_at timestamptz)`,
 `alter table ingest_log add column if not exists notes text`,
 // Web look-ups for events whose Instagram post says little (official page + description), one per event.
 `create table if not exists event_details(key text primary key,data jsonb not null,created_at timestamptz default now())`,
 // Personal (not business) Instagram accounts can't be read; their towns' official accounts cover them.
 `delete from source_configs where name in ('Lake Eola · Instagram','Pines City Center · Instagram','Tamarac Parks & Rec · Instagram')`,
 // CivicPlus-hosted city sites block Vercel's servers: fetch them all from the GitHub job instead.
 `update source_configs set remote=true,updated_at=now() where platform='civicplus' and remote=false`,
 // Temple Terrace's parks account is @ttleisureservices (the earlier handle wasn't readable): switch and un-pause.
 `update source_configs set params=jsonb_set(jsonb_set(params,'{username}','"ttleisureservices"'),'{idPrefix}','"ig-ttleisureservices"'),url='https://www.instagram.com/ttleisureservices/',enabled=true,updated_at=now()
   where name='Temple Terrace Parks & Rec · Instagram' and params->>'username'='templeterraceparks_recreation'`,
 // Instagram posts already read (and the events found in them), so each post is sent to the AI once.
 `create table if not exists social_posts(id text primary key,permalink text,posted_at timestamptz,extracted jsonb not null default '[]',created_at timestamptz default now())`,
 // Discovery once saved North Miami Beach's library over the city calendar (same name). The library now has
 // its own row, so point the city row back at the city's CivicPlus calendar.
 `update source_configs set platform='civicplus',params='{"site":"https://www.citynmb.com","city":"North Miami Beach, FL","idPrefix":"nmb"}'::jsonb,
   source_type='official-city',url='https://www.citynmb.com/Calendar.aspx',remote=false,updated_at=now()
   where name='City of North Miami Beach' and platform<>'civicplus'`,
];
export function ensureSchema(){
 if(!ready)ready=(async()=>{for(const s of STATEMENTS)await db.query(s)})().catch(e=>{ready=null;throw e});
 return ready;
}
