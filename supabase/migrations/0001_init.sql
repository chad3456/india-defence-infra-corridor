-- Bharat Tracker schema.
--
-- The repository's JSON files remain the source of truth for chart data: they
-- are versioned, diffable and reviewable, which is what makes a claim on this
-- site auditable. Postgres is used only for the things git is bad at — an
-- append-only news stream and a pipeline run log that grows forever.
--
-- Apply with:  supabase db push     (or paste into the SQL editor)

create table if not exists news_items (
  id            text primary key,
  title         text        not null,
  url           text        not null unique,
  outlet        text        not null,
  published_at  timestamptz not null,
  summary       text,
  topics        text[]      not null default '{}',
  ingested_at   timestamptz not null default now()
);

create index if not exists news_items_published_at_idx on news_items (published_at desc);
create index if not exists news_items_outlet_idx       on news_items (outlet);
create index if not exists news_items_topics_idx       on news_items using gin (topics);

create table if not exists pipeline_runs (
  id                text primary key,
  started_at        timestamptz not null,
  finished_at       timestamptz,
  status            text        not null check (status in ('ok', 'partial', 'failed')),
  connectors_run    integer     not null default 0,
  connectors_failed integer     not null default 0,
  series_updated    integer     not null default 0,
  messages          text[]      not null default '{}'
);

create index if not exists pipeline_runs_started_at_idx on pipeline_runs (started_at desc);

-- Both tables are world-readable and written only by the pipeline, which uses
-- the service role key. RLS is on with a read-only public policy so the
-- anon/publishable key can never write.
alter table news_items    enable row level security;
alter table pipeline_runs enable row level security;

drop policy if exists "news readable by anyone" on news_items;
create policy "news readable by anyone"
  on news_items for select
  to anon, authenticated
  using (true);

drop policy if exists "runs readable by anyone" on pipeline_runs;
create policy "runs readable by anyone"
  on pipeline_runs for select
  to anon, authenticated
  using (true);

-- Keep the news table bounded; the tracker only ever shows recent items.
create or replace function prune_news_items() returns void
language sql
as $$
  delete from news_items
  where published_at < now() - interval '90 days';
$$;
