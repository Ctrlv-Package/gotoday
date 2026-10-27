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
 // Meta's hourly app-usage meter (from the x-app-usage header), shared across runners so Instagram fetching can pace itself.
 `create table if not exists meta_app_usage(id int primary key,usage int not null,at timestamptz not null default now())`,
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
 // Instagram's hourly limit isn't a source failure (now skipped instead): clear the ones recorded as failures.
 `update sources set last_error=null,last_error_at=null where last_error like 'Instagram API: (#4)%'`,
 // Web look-ups for events whose Instagram post says little (official page + description), one per event.
 `create table if not exists event_details(key text primary key,data jsonb not null,created_at timestamptz default now())`,
 // Personal (not business) Instagram accounts can't be read; their towns' official accounts cover them.
 `create index if not exists events_image_url_idx on events(image_url)`,
 `delete from source_configs where name in ('Lake Eola · Instagram','Pines City Center · Instagram','Tamarac Parks & Rec · Instagram')`,
 // CivicPlus-hosted city sites block Vercel's servers: fetch them all from the GitHub job instead.
 `update source_configs set remote=true,updated_at=now() where platform='civicplus' and remote=false`,
 // broward.org blocks cloud servers (since Oct 2026): the GitHub job fetches the parks calendar from a real browser.
 `update source_configs set remote=true,updated_at=now() where platform='broward-parks' and remote=false`,
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
 // ---- Accounts (optional: everything on the site works without one) ----
 `create table if not exists users(id serial primary key,email text unique not null,name text,image text,google_sub text unique,
   calendar_token text unique,created_at timestamptz default now(),last_seen_at timestamptz default now())`,
 // Sign-in sessions: only a hash of the cookie's random token is stored.
 `create table if not exists sessions(token_hash text primary key,user_id int not null references users(id) on delete cascade,
   created_at timestamptz default now(),expires_at timestamptz not null)`,
 `create index if not exists sessions_user_idx on sessions(user_id)`,
 // Annual-event families: "Plantation Fall Festival" is one family; each year's listing is an occurrence of it.
 `create table if not exists event_series(id serial primary key,key text unique not null,title text not null,town text,created_at timestamptz default now())`,
 `alter table events add column if not exists series_id int`,
 `create index if not exists events_series_idx on events(series_id)`,
 `alter table events add column if not exists likes int`,
 `create table if not exists event_actions(id serial primary key,event_id int not null,action text not null,at timestamptz not null default now())`,
 `create index if not exists event_actions_event_idx on event_actions(event_id)`,
 `create index if not exists events_quarantine_idx on events(local_date) where status='quarantine' or quarantine_reason is not null`,
 `create table if not exists saved_events(user_id int not null references users(id) on delete cascade,event_id int not null,created_at timestamptz default now(),primary key(user_id,event_id))`,
 // Personal calendar status: when they tapped "Add to …", and when a calendar app last read the feed (and which).
 `alter table users add column if not exists cal_clicked_at timestamptz,add column if not exists cal_clicked text,
   add column if not exists cal_fetched_at timestamptz,add column if not exists cal_client text`,
 `alter table users add column if not exists cal_ua text`,
 `alter table users add column if not exists lang text`,
 // Every request for someone's calendar link (which app, when, what we answered): to see whether Google is checking.
 `create table if not exists calendar_fetches(id serial primary key,user_id int,at timestamptz default now(),client text,ua text,method text,events int)`,
 // Every calendar app that reads someone's GoToday calendar (a person can use Google and Apple at the same time).
 `create table if not exists calendar_clients(user_id int not null references users(id) on delete cascade,client text not null,first_seen timestamptz default now(),last_seen timestamptz default now(),ua text,primary key(user_id,client))`,
 `insert into calendar_clients(user_id,client,first_seen,last_seen,ua) select id,cal_client,cal_fetched_at,cal_fetched_at,cal_ua from users where cal_client is not null and cal_fetched_at is not null on conflict do nothing`,
 // Events people create while signed in belong to their account (listed in My GoToday on any device, with the manage
 // link kept for them so they don't have to save it).
 `alter table community_events add column if not exists user_id int,add column if not exists owner_token text`,
 `create index if not exists community_events_user_idx on community_events(user_id)`,
 `alter table community_events add column if not exists image text`,
 `alter table community_events add column if not exists categories text[]`,
 `alter table community_events add column if not exists repeat jsonb`,
 `alter table community_events add column if not exists rsvp jsonb`,
 `alter table community_events add column if not exists rsvp_seen_at timestamptz`,
 `create table if not exists push_subs(endpoint text primary key,keys jsonb not null,user_id int,manage_hash text,created_at timestamptz default now())`,
 `create index if not exists push_subs_user_idx on push_subs(user_id)`,
 `create index if not exists push_subs_manage_idx on push_subs(manage_hash)`,
 `create table if not exists follows(user_id int not null references users(id) on delete cascade,series_id int not null references event_series(id) on delete cascade,
   created_at timestamptz default now(),primary key(user_id,series_id))`,
 // Quarantine (quality system): why a held listing is held; null means it published normally.
 // Public queries only read status='active', so a 'quarantine' row is invisible until approved.
 `alter table events add column if not exists quarantine_reason text`,
 // Email + password sign-in: the password is stored only as a scrypt hash (see lib/auth.ts),
 // never in plain text. email_verified_at is set when the address is proven — by a verification
 // link, a password reset link, or a Google sign-in for the same email. email_tokens holds the
 // hashed one-time tokens for verification and reset links; a row is deleted when its link is used.
 `alter table users add column if not exists password_hash text`,
 `alter table users add column if not exists email_verified_at timestamptz`,
 `alter table users add column if not exists failed_attempts int not null default 0`,
 `alter table users add column if not exists locked_until timestamptz`,
 `create table if not exists email_tokens(token_hash text primary key,user_id int not null references users(id) on delete cascade,
   purpose text not null,expires_at timestamptz not null,created_at timestamptz default now())`,
 // Visitor reports about event pages ("wrong date", "cancelled", ...). No foreign key on purpose: listings
 // are deleted by the retention cleanup, and a report about a deleted listing is simply history. Reports
 // never change a listing by themselves — an admin reads them and acts.
 `create table if not exists event_reports(id serial primary key,kind text not null,event_id int not null,
   reason text not null,note text, status text not null default 'open',created_at timestamptz default now())`,
 `create index if not exists event_reports_open_idx on event_reports(created_at desc) where status='open'`,
];
export function ensureSchema(){
 if(!ready)ready=(async()=>{for(const s of STATEMENTS)await db.query(s)})().catch(e=>{ready=null;throw e});
 return ready;
}
/** Read paths use this instead of ensureSchema(). If the schema check fails — e.g. the database plan is
  * blocking writes — reads keep working against the schema that's already there instead of taking the
  * page down with it. The failure is logged, and the next write still retries the check, so a genuine
  * schema change still lands. Writes always use the fatal ensureSchema() above. */
export function ensureSchemaSoft(){
 return ensureSchema().catch(e=>{console.warn("schema check failed, serving reads anyway:",e instanceof Error?e.message:String(e))});
}
