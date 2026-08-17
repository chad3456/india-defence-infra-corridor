import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NewsItem, PipelineRun } from "@/lib/types";
import { OUTLET_NAMES } from "@/lib/outlets";
import { supabaseConfigured, fetchNews, fetchLastRun } from "@/lib/supabase";

export const metadata = { title: "Live tracker" };

// Rebuilt hourly; the GitHub Action refreshes the underlying file on its own
// schedule and triggers a redeploy.
export const revalidate = 3600;

interface NewsFile {
  fetchedAt: string;
  outletsOk: number;
  outletsTotal: number;
  items: NewsItem[];
}

/**
 * Prefer Postgres when it is configured — it refreshes continuously — and fall
 * back to the committed JSON otherwise. Either path is fine; the JSON is what
 * ships by default so the site works with no database at all.
 */
async function loadNews(): Promise<NewsFile | null> {
  if (supabaseConfigured) {
    const rows = await fetchNews(200);
    if (rows && rows.length > 0) {
      return {
        fetchedAt: rows[0]!.publishedAt,
        outletsOk: new Set(rows.map((r) => r.outlet)).size,
        outletsTotal: OUTLET_NAMES.length,
        items: rows,
      };
    }
  }
  try {
    const raw = await readFile(join(process.cwd(), "data/live/news.json"), "utf8");
    return JSON.parse(raw) as NewsFile;
  } catch {
    return null;
  }
}

async function loadRun(): Promise<PipelineRun | null> {
  if (supabaseConfigured) {
    const run = await fetchLastRun();
    if (run) return run;
  }
  try {
    const raw = await readFile(join(process.cwd(), "data/live/last-run.json"), "utf8");
    return JSON.parse(raw) as PipelineRun;
  } catch {
    return null;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default async function TrackerPage() {
  const news = await loadNews();
  const run = await loadRun();

  return (
    <div>
      <section className="border-b pb-5">
        <p className="eyebrow">live tracker</p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-tight">
          What the press is reporting
        </h1>
        <p className="mt-2 max-w-[640px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          Headlines from {OUTLET_NAMES.length} outlets, filtered to defence, infrastructure, trade,
          manufacturing, space and energy.{" "}
          <strong>Nothing here feeds a chart.</strong> Press reports of government figures are
          tier-3 evidence: they flag that a number may have moved, and a human then verifies against
          the primary release before any series changes. That separation is deliberate and is the
          main reason this site&apos;s numbers can be trusted.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {OUTLET_NAMES.map((n) => (
            <span key={n} className="rounded-full border px-2 py-0.5 text-[10px] text-[color:var(--text-secondary)]">
              {n}
            </span>
          ))}
        </div>
      </section>

      {/* Pipeline status */}
      <section className="my-5 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div>
            <p className="eyebrow">pipeline</p>
            <p className="mt-0.5 text-[12px] font-medium">
              {run ? run.status.toUpperCase() : "NOT YET RUN"}
            </p>
          </div>
          {run && (
            <>
              <div>
                <p className="eyebrow">last run</p>
                <p className="mt-0.5 text-[12px]">{timeAgo(run.finishedAt ?? run.startedAt)}</p>
              </div>
              <div>
                <p className="eyebrow">series updated</p>
                <p className="tnum mt-0.5 text-[12px]">{run.seriesUpdated}</p>
              </div>
            </>
          )}
          {news && (
            <div>
              <p className="eyebrow">feeds reachable</p>
              <p className="tnum mt-0.5 text-[12px]">
                {news.outletsOk}/{news.outletsTotal}
              </p>
            </div>
          )}
        </div>
        {run && run.messages.length > 0 && (
          <details className="mt-2">
            <summary className="eyebrow cursor-pointer">
              {run.messages.length} message(s) from the last run
            </summary>
            <ul className="mt-1.5 space-y-0.5">
              {run.messages.map((m, i) => (
                <li key={i} className="mono text-[10px] text-[color:var(--text-muted)]">
                  {m}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {!news || news.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="eyebrow">no items yet</p>
          <p className="mx-auto mt-2 max-w-[420px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
            The tracker populates on the first pipeline run. Run{" "}
            <span className="mono text-[11px]">npm run etl</span> locally, or wait for the scheduled
            GitHub Action.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-[11px] text-[color:var(--text-muted)]">
            {news.items.length} items · fetched {timeAgo(news.fetchedAt)}
          </p>
          <ul className="divide-y">
            {news.items.map((item) => (
              <li key={item.id} className="py-3">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="group block"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="eyebrow">{item.outlet}</span>
                    <span className="text-[10px] text-[color:var(--text-muted)]">
                      {timeAgo(item.publishedAt)}
                    </span>
                    {item.topics.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border px-1.5 py-px text-[9px] text-[color:var(--text-muted)]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 text-[13px] font-medium leading-snug group-hover:underline">
                    {item.title}
                  </p>
                  {item.summary && (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[color:var(--text-secondary)]">
                      {item.summary}
                    </p>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
