import { createClient } from "@supabase/supabase-js";
import type { NewsItem, PipelineRun, Series, Source } from "./types";

/**
 * Postgres layer, scoped to the `bharat_tracker` schema.
 *
 * This Supabase project is shared across several unrelated projects, so the
 * client is pinned to one schema and never reads or writes `public`. A typo in
 * a table name fails rather than silently touching another project's data.
 *
 * Everything degrades to null rather than throwing. The committed JSON in
 * `data/` remains a complete fallback, so a database outage — or a deploy with
 * no credentials at all — still serves the whole site.
 */

export const SCHEMA = "bharat_tracker";

/**
 * Vercel's Supabase integration injects `SUPABASE_URL` / `SUPABASE_ANON_KEY`,
 * while a manual setup usually uses the `NEXT_PUBLIC_` names. Accept both so
 * the same build works either way.
 *
 * Note: only `NEXT_PUBLIC_*` values are readable in the browser. Everything
 * here runs in server components and the ETL, so the non-public names are fine.
 */
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

export const supabaseConfigured = Boolean(URL_ && ANON);

/**
 * Pinning `db.schema` changes the client's type parameters, so the schema-bound
 * client type is derived from the factory rather than written out — that way
 * the schema name is declared in exactly one place.
 */
function makeClient(key: string, url: string) {
  return createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: SCHEMA },
  });
}

type TrackerClient = ReturnType<typeof makeClient>;

let readClient: TrackerClient | null = null;

/** Read-only client. Safe in server components. */
export function getReadClient(): TrackerClient | null {
  if (!URL_ || !ANON) return null;
  readClient ??= makeClient(ANON, URL_);
  return readClient;
}

/** Write client for the pipeline only. Never import into a page. */
export function getWriteClient(): TrackerClient | null {
  if (!URL_ || !SERVICE) return null;
  return makeClient(SERVICE, URL_);
}

/* ------------------------------------------------------------------ */
/* Reads                                                              */
/* ------------------------------------------------------------------ */

interface SeriesRow {
  id: string;
  title: string;
  definition: string;
  category: Series["category"];
  unit: string;
  unit_short: string;
  frequency: Series["frequency"];
  higher_is_better: boolean | null;
  provenance: Series["provenance"];
  confidence: Series["confidence"];
  last_verified: string;
  notes: string[] | null;
  source_ids: string[] | null;
  points: Array<{
    period: string;
    value: number | string | null;
    sourceId: string | null;
    revised: boolean | null;
    note: string | null;
  }> | null;
  peers: Array<{
    iso3: string;
    country: string;
    value: number | string;
    period: string;
    sourceId: string | null;
  }> | null;
}

/** Postgres numerics arrive as strings; coerce without inventing values. */
function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowToSeries(r: SeriesRow): Series {
  return {
    id: r.id,
    title: r.title,
    definition: r.definition,
    category: r.category,
    unit: r.unit,
    unitShort: r.unit_short,
    frequency: r.frequency,
    higherIsBetter: r.higher_is_better,
    provenance: r.provenance,
    confidence: r.confidence,
    lastVerified: r.last_verified,
    notes: r.notes ?? undefined,
    sourceIds: r.source_ids ?? [],
    points: (r.points ?? []).map((p) => ({
      period: p.period,
      value: num(p.value),
      sourceId: p.sourceId ?? undefined,
      revised: p.revised ?? undefined,
      note: p.note ?? undefined,
    })),
    peers:
      r.peers && r.peers.length > 0
        ? r.peers.map((p) => ({
            country: p.country,
            iso3: p.iso3,
            value: num(p.value) ?? 0,
            period: p.period,
            sourceId: p.sourceId ?? "worldbank-wdi",
          }))
        : undefined,
  };
}

export async function fetchSeries(): Promise<Series[] | null> {
  const client = getReadClient();
  if (!client) return null;
  const { data, error } = await client.from("series_full").select("*");
  if (error || !data || data.length === 0) return null;
  return (data as SeriesRow[]).map(rowToSeries);
}

export async function fetchSources(): Promise<Source[] | null> {
  const client = getReadClient();
  if (!client) return null;
  const { data, error } = await client
    .from("sources")
    .select("id,name,publisher,url,provenance,accessed,tier");
  if (error || !data || data.length === 0) return null;
  return data as Source[];
}

export async function fetchNews(limit = 200): Promise<NewsItem[] | null> {
  const client = getReadClient();
  if (!client) return null;
  const { data, error } = await client
    .from("news_items")
    .select("id,title,url,outlet,published_at,summary,topics")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error || !data) return null;
  return data.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    url: r.url as string,
    outlet: r.outlet as string,
    publishedAt: r.published_at as string,
    summary: (r.summary as string | null) ?? undefined,
    topics: (r.topics as string[]) ?? [],
  }));
}

export async function fetchLastRun(): Promise<PipelineRun | null> {
  const client = getReadClient();
  if (!client) return null;
  const { data, error } = await client
    .from("pipeline_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    startedAt: data.started_at as string,
    finishedAt: (data.finished_at as string | null) ?? null,
    status: data.status as PipelineRun["status"],
    connectorsRun: (data.connectors_run as number) ?? 0,
    connectorsFailed: (data.connectors_failed as number) ?? 0,
    seriesUpdated: (data.series_updated as number) ?? 0,
    messages: (data.messages as string[]) ?? [],
  };
}

/* ------------------------------------------------------------------ */
/* Writes (pipeline only)                                             */
/* ------------------------------------------------------------------ */

export async function pushSources(sources: Source[]): Promise<{ ok: boolean; error?: string }> {
  const client = getWriteClient();
  if (!client) return { ok: false, error: "no service role key configured" };
  const { error } = await client.from("sources").upsert(
    sources.map((s) => ({
      id: s.id,
      name: s.name,
      publisher: s.publisher,
      url: s.url,
      provenance: s.provenance,
      accessed: s.accessed,
      tier: s.tier,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "id" },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function pushSeries(series: Series[]): Promise<{ ok: boolean; error?: string }> {
  const client = getWriteClient();
  if (!client) return { ok: false, error: "no service role key configured" };

  const { error: sErr } = await client.from("series").upsert(
    series.map((s) => ({
      id: s.id,
      title: s.title,
      definition: s.definition,
      category: s.category,
      unit: s.unit,
      unit_short: s.unitShort,
      frequency: s.frequency,
      higher_is_better: s.higherIsBetter,
      provenance: s.provenance,
      confidence: s.confidence,
      last_verified: s.lastVerified,
      notes: s.notes ?? [],
      source_ids: s.sourceIds,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "id" },
  );
  if (sErr) return { ok: false, error: sErr.message };

  // Points are replaced wholesale per series: upstream revisions delete and
  // renumber periods, so merging would leave orphaned stale rows behind.
  const ids = series.map((s) => s.id);
  const { error: dErr } = await client.from("data_points").delete().in("series_id", ids);
  if (dErr) return { ok: false, error: dErr.message };

  const points = series.flatMap((s) =>
    s.points.map((p, i) => ({
      series_id: s.id,
      period: p.period,
      value: p.value,
      source_id: p.sourceId ?? null,
      revised: p.revised ?? false,
      note: p.note ?? null,
      ordinal: i,
    })),
  );
  if (points.length > 0) {
    // Chunked: a single insert of every point exceeds the request body limit.
    for (let i = 0; i < points.length; i += 500) {
      const { error } = await client.from("data_points").insert(points.slice(i, i + 500));
      if (error) return { ok: false, error: error.message };
    }
  }

  const { error: pdErr } = await client.from("series_peers").delete().in("series_id", ids);
  if (pdErr) return { ok: false, error: pdErr.message };

  const peers = series.flatMap((s) =>
    (s.peers ?? []).map((p) => ({
      series_id: s.id,
      iso3: p.iso3,
      country: p.country,
      value: p.value,
      period: p.period,
      source_id: p.sourceId,
    })),
  );
  if (peers.length > 0) {
    const { error } = await client.from("series_peers").insert(peers);
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function pushNews(items: NewsItem[]): Promise<{ ok: boolean; error?: string }> {
  const client = getWriteClient();
  if (!client) return { ok: false, error: "no service role key configured" };
  if (items.length === 0) return { ok: true };
  const { error } = await client.from("news_items").upsert(
    items.map((i) => ({
      id: i.id,
      title: i.title,
      url: i.url,
      outlet: i.outlet,
      published_at: i.publishedAt,
      summary: i.summary ?? null,
      topics: i.topics,
    })),
    { onConflict: "url" },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function pushRun(run: PipelineRun): Promise<{ ok: boolean; error?: string }> {
  const client = getWriteClient();
  if (!client) return { ok: false, error: "no service role key configured" };
  const { error } = await client.from("pipeline_runs").insert({
    id: run.id,
    started_at: run.startedAt,
    finished_at: run.finishedAt,
    status: run.status,
    connectors_run: run.connectorsRun,
    connectors_failed: run.connectorsFailed,
    series_updated: run.seriesUpdated,
    messages: run.messages,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}
