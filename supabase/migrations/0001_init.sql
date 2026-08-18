-- Bharat Tracker — isolated schema.
--
-- This Supabase project is shared across several unrelated projects, so every
-- object here lives in its own `bharat_tracker` schema. Nothing is created in
-- `public`, no `public` object is altered, and the grants below are scoped to
-- this schema only. Dropping `bharat_tracker` removes this project completely
-- and touches nothing else in the database.
--
-- After applying: Supabase Dashboard → Settings → API → Exposed schemas
--                 add `bharat_tracker` so PostgREST can serve it.

create schema if not exists bharat_tracker;

comment on schema bharat_tracker is
  'India defence & infrastructure tracker. Self-contained; safe to drop independently of other projects in this database.';

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

create table if not exists bharat_tracker.sources (
  id          text primary key,
  name        text not null,
  publisher   text not null,
  url         text not null,
  provenance  text not null check (provenance in ('official','multilateral','think-tank','press','derived')),
  accessed    date not null,
  tier        smallint not null check (tier in (1,2,3)),
  updated_at  timestamptz not null default now()
);

comment on table bharat_tracker.sources is
  'The source register. Every published number must resolve to a row here.';

create table if not exists bharat_tracker.series (
  id               text primary key,
  title            text not null,
  definition       text not null,
  category         text not null check (category in (
                     'defence','infrastructure','economy','trade','manufacturing',
                     'space','quality-of-life','social','real-estate','energy')),
  unit             text not null,
  unit_short       text not null,
  frequency        text not null check (frequency in ('annual','fiscal-year','quarterly','monthly','point-in-time')),
  higher_is_better boolean,               -- null = direction genuinely contested
  provenance       text not null check (provenance in ('official','multilateral','think-tank','press','derived')),
  confidence       text not null check (confidence in ('high','medium','low')),
  last_verified    date not null,
  notes            text[] not null default '{}',
  source_ids       text[] not null default '{}',
  updated_at       timestamptz not null default now(),

  -- The editorial rules from lib/types.ts, enforced by the database rather
  -- than by convention. A row that breaks one cannot be inserted at all.
  -- cardinality(), not array_length(): array_length returns NULL for an empty
  -- array, and a CHECK constraint passes on NULL — so the array_length form
  -- silently accepts exactly the rows it is meant to reject.
  constraint low_confidence_needs_a_note
    check (confidence <> 'low' or cardinality(notes) >= 1),
  constraint estimates_are_not_records
    check (not (provenance = 'think-tank' and confidence = 'high')),
  constraint must_cite_a_source
    check (cardinality(source_ids) >= 1)
);

comment on constraint low_confidence_needs_a_note on bharat_tracker.series is
  'A low-confidence series must explain its uncertainty.';
comment on constraint estimates_are_not_records on bharat_tracker.series is
  'Think-tank estimates cannot be graded high confidence.';

create index if not exists series_category_idx on bharat_tracker.series (category);

create table if not exists bharat_tracker.data_points (
  series_id  text    not null references bharat_tracker.series (id) on delete cascade,
  period     text    not null,
  value      numeric,                     -- null = genuinely unknown, never zero-filled
  source_id  text    references bharat_tracker.sources (id),
  revised    boolean not null default false,
  note       text,
  ordinal    integer not null default 0,  -- authored order, for non-temporal labels
  primary key (series_id, period)
);

comment on column bharat_tracker.data_points.value is
  'NULL means the figure could not be located. Never interpolated or zero-filled.';

create index if not exists data_points_series_idx on bharat_tracker.data_points (series_id, ordinal);

create table if not exists bharat_tracker.series_peers (
  series_id text    not null references bharat_tracker.series (id) on delete cascade,
  iso3      char(3) not null,
  country   text    not null,
  value     numeric not null,
  period    text    not null,
  source_id text    references bharat_tracker.sources (id),
  primary key (series_id, iso3)
);

-- ---------------------------------------------------------------------------
-- Live pipeline output
-- ---------------------------------------------------------------------------

create table if not exists bharat_tracker.news_items (
  id           text primary key,
  title        text not null,
  url          text not null unique,
  outlet       text not null,
  published_at timestamptz not null,
  summary      text,
  topics       text[] not null default '{}',
  ingested_at  timestamptz not null default now()
);

comment on table bharat_tracker.news_items is
  'Change-detection signal only. Nothing here is ever promoted into series data.';

create index if not exists news_items_published_at_idx on bharat_tracker.news_items (published_at desc);
create index if not exists news_items_topics_idx       on bharat_tracker.news_items using gin (topics);

create table if not exists bharat_tracker.pipeline_runs (
  id                text primary key,
  started_at        timestamptz not null,
  finished_at       timestamptz,
  status            text not null check (status in ('ok','partial','failed')),
  connectors_run    integer not null default 0,
  connectors_failed integer not null default 0,
  series_updated    integer not null default 0,
  messages          text[] not null default '{}'
);

create index if not exists pipeline_runs_started_at_idx on bharat_tracker.pipeline_runs (started_at desc);

-- ---------------------------------------------------------------------------
-- Read model
-- ---------------------------------------------------------------------------

-- One row per series with its points and peers nested, so the app fetches a
-- whole chart-ready payload in a single request instead of three.
create or replace view bharat_tracker.series_full as
select
  s.*,
  coalesce((
    select jsonb_agg(jsonb_build_object(
             'period',   d.period,
             'value',    d.value,
             'sourceId', d.source_id,
             'revised',  d.revised,
             'note',     d.note)
           order by d.ordinal, d.period)
    from bharat_tracker.data_points d
    where d.series_id = s.id
  ), '[]'::jsonb) as points,
  coalesce((
    select jsonb_agg(jsonb_build_object(
             'iso3',     p.iso3,
             'country',  p.country,
             'value',    p.value,
             'period',   p.period,
             'sourceId', p.source_id))
    from bharat_tracker.series_peers p
    where p.series_id = s.id
  ), '[]'::jsonb) as peers
from bharat_tracker.series s;

-- Coverage counters used by the site footer and methodology page.
create or replace view bharat_tracker.coverage as
select
  (select count(*) from bharat_tracker.series)                        as series_count,
  (select count(*) from bharat_tracker.sources)                       as source_count,
  (select count(*) from bharat_tracker.data_points where value is not null) as point_count,
  (select count(*) from bharat_tracker.series where confidence = 'high')   as high_confidence,
  (select count(*) from bharat_tracker.series where confidence = 'medium') as medium_confidence,
  (select count(*) from bharat_tracker.series where confidence = 'low')    as low_confidence;

-- ---------------------------------------------------------------------------
-- Access control
-- ---------------------------------------------------------------------------

-- Everything is world-readable and written only by the pipeline's service role.
alter table bharat_tracker.sources       enable row level security;
alter table bharat_tracker.series        enable row level security;
alter table bharat_tracker.data_points   enable row level security;
alter table bharat_tracker.series_peers  enable row level security;
alter table bharat_tracker.news_items    enable row level security;
alter table bharat_tracker.pipeline_runs enable row level security;

do $$
declare t text;
begin
  foreach t in array array['sources','series','data_points','series_peers','news_items','pipeline_runs']
  loop
    execute format('drop policy if exists %I on bharat_tracker.%I', t || '_public_read', t);
    execute format(
      'create policy %I on bharat_tracker.%I for select to anon, authenticated using (true)',
      t || '_public_read', t);
  end loop;
end $$;

-- Scope grants to this schema only. The API roles get no rights anywhere else
-- through this migration.
grant usage on schema bharat_tracker to anon, authenticated, service_role;
grant select on all tables in schema bharat_tracker to anon, authenticated;
grant all    on all tables in schema bharat_tracker to service_role;

alter default privileges in schema bharat_tracker
  grant select on tables to anon, authenticated;
alter default privileges in schema bharat_tracker
  grant all on tables to service_role;

-- ---------------------------------------------------------------------------
-- Housekeeping
-- ---------------------------------------------------------------------------

create or replace function bharat_tracker.prune_news_items()
returns void
language sql
security invoker
set search_path = bharat_tracker, pg_temp
as $$
  delete from bharat_tracker.news_items
  where published_at < now() - interval '90 days';
$$;

-- ---------------------------------------------------------------------------
-- Expose the schema to PostgREST
-- ---------------------------------------------------------------------------
--
-- supabase-js can only reach a schema that PostgREST is configured to serve.
-- That is normally a dashboard setting (Settings -> API -> Exposed schemas);
-- doing it here keeps setup to a single command.
--
-- Additive and idempotent: it reads whatever the authenticator role already
-- exposes and appends this one, so schemas belonging to other projects in this
-- database are preserved. Wrapped in an exception handler because the statement
-- needs elevated rights — if it cannot run, the migration still succeeds and
-- the dashboard toggle remains available as a fallback.

do $$
declare
  cfg      text[];
  entry    text;
  current_ text := 'public, graphql_public';
begin
  select s.setconfig into cfg
  from pg_db_role_setting s
  join pg_roles r on r.oid = s.setrole
  where r.rolname = 'authenticator'
  limit 1;

  if cfg is not null then
    foreach entry in array cfg loop
      if entry like 'pgrst.db_schemas=%' then
        current_ := split_part(entry, '=', 2);
      end if;
    end loop;
  end if;

  if position('bharat_tracker' in current_) = 0 then
    execute format('alter role authenticator set pgrst.db_schemas = %L', current_ || ', bharat_tracker');
    raise notice 'Exposed schemas now: %', current_ || ', bharat_tracker';
  else
    raise notice 'bharat_tracker already exposed';
  end if;

  notify pgrst, 'reload config';
exception when others then
  raise warning 'Could not auto-expose bharat_tracker to PostgREST (%). Add it manually under Settings -> API -> Exposed schemas.', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- Development events (map pins)
-- ---------------------------------------------------------------------------

create table if not exists bharat_tracker.events (
  id         text primary key,
  title      text not null,
  category   text not null check (category in (
               'startups','infrastructure','defence','roads-airports','pipelines',
               'exports','trade-deals','psu-msme','manufacturing','energy','space','ports')),
  date       date not null,
  place_id   text,
  place_name text,
  state      text,
  lon        double precision,
  lat        double precision,
  outlet     text not null,
  url        text not null,
  summary    text,
  status     text not null check (status in ('verified','reported')),
  ingested_at timestamptz not null default now(),

  -- A pin is either fully located or not located at all; half a coordinate
  -- would place an event on the equator off Africa.
  constraint coords_are_paired check ((lon is null) = (lat is null)),
  -- Bounding box for India, so a transposed lat/lon cannot reach the map.
  constraint coords_within_india check (
    lon is null or (lon between 68 and 98 and lat between 6 and 38)
  )
);

create index if not exists events_date_idx     on bharat_tracker.events (date desc);
create index if not exists events_category_idx on bharat_tracker.events (category);

alter table bharat_tracker.events enable row level security;
drop policy if exists events_public_read on bharat_tracker.events;
create policy events_public_read on bharat_tracker.events
  for select to anon, authenticated using (true);

grant select on bharat_tracker.events to anon, authenticated;
grant all    on bharat_tracker.events to service_role;
