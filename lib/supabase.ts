import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NewsItem, PipelineRun } from "./types";

/**
 * Optional Postgres layer.
 *
 * The site is fully functional without it — chart data lives in versioned JSON
 * and the news tracker falls back to the committed `data/live/news.json`. When
 * the env vars are present, the tracker reads from Postgres instead, which lets
 * the news stream refresh continuously rather than only on rebuild.
 *
 * Every function here degrades to null rather than throwing: a database outage
 * must never take the site down.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseConfigured = Boolean(URL && ANON);

let readClient: SupabaseClient | null = null;

/** Read-only client for the app. Safe to use in server components. */
export function getReadClient(): SupabaseClient | null {
  if (!URL || !ANON) return null;
  readClient ??= createClient(URL, ANON, { auth: { persistSession: false } });
  return readClient;
}

/** Write client for the pipeline only. Never import this into a page. */
export function getWriteClient(): SupabaseClient | null {
  if (!URL || !SERVICE) return null;
  return createClient(URL, SERVICE, { auth: { persistSession: false } });
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

/** Called by the ETL. Upserts on url so re-ingesting a feed is idempotent. */
export async function pushNews(items: NewsItem[]): Promise<{ ok: boolean; error?: string }> {
  const client = getWriteClient();
  if (!client) return { ok: false, error: "no service role key configured" };
  const rows = items.map((i) => ({
    id: i.id,
    title: i.title,
    url: i.url,
    outlet: i.outlet,
    published_at: i.publishedAt,
    summary: i.summary ?? null,
    topics: i.topics,
  }));
  const { error } = await client.from("news_items").upsert(rows, { onConflict: "url" });
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
