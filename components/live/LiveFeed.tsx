"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveItem } from "@/lib/feed-parse";

/**
 * The feeds as they stand, refreshed while the page is open.
 *
 * Deliberately kept visually distinct from the committed record beside it. The
 * record has been validated, cross-checked against primary sources and written
 * down; this has been read off a feed seconds ago and checked against nothing.
 * Fresher and weaker are both true at once, and the panel says so rather than
 * letting recency read as authority.
 */

interface Payload {
  fetchedAt: string;
  items: LiveItem[];
  feedsAsked: number;
  feedsAnswered: number;
}

/** How often the open page asks again. The route caches for 60s regardless. */
const POLL_MS = 90_000;

function ago(iso: string | null, now: number): string {
  if (iso === null) return "undated";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86_400)}d ago`;
}

export default function LiveFeed() {
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let live = true;
    const load = async (): Promise<void> => {
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as Payload;
        if (!live) return;
        setData(json);
        setState("ok");
      } catch {
        if (live) setState((s) => (s === "ok" ? "ok" : "failed"));
      }
    };
    void load();
    timer.current = setInterval(() => { void load(); setNow(Date.now()); }, POLL_MS);
    // The relative times go stale on their own even when nothing refetches.
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      live = false;
      if (timer.current) clearInterval(timer.current);
      clearInterval(tick);
    };
  }, []);

  return (
    <section className="rounded-lg border border-gridline bg-surface-1 p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span aria-hidden className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ background: "var(--series-3)" }} />
            <span className="relative inline-flex h-2 w-2 rounded-full"
              style={{ background: "var(--series-3)" }} />
          </span>
          Straight off the feeds
        </h2>
        {data && (
          <p className="text-[11px] text-ink-muted">
            read {ago(data.fetchedAt, now)} · {data.feedsAnswered} of {data.feedsAsked} official
            feeds answered
          </p>
        )}
      </div>

      <p className="mb-3 max-w-3xl text-xs leading-relaxed text-ink-2">
        Official feeds, read when you loaded this and again every minute or so.{" "}
        <strong className="text-ink">Nothing here has been checked.</strong> It has not been
        corroborated, placed on a map or written down — the record below has, which is why it is
        hours older. Fresher and weaker are both true at once.
      </p>

      {state === "loading" && (
        <p className="py-4 text-sm text-ink-muted">Asking the publishers&hellip;</p>
      )}

      {state === "failed" && (
        <p className="rounded border border-gridline bg-surface-2 px-3 py-2 text-sm text-ink-2">
          The live read failed. That says nothing about whether news happened — only that the
          feeds did not answer this request. The committed record below is unaffected.
        </p>
      )}

      {state === "ok" && data && data.items.length === 0 && (
        <p className="rounded border border-gridline bg-surface-2 px-3 py-2 text-sm text-ink-2">
          {data.feedsAnswered === 0
            ? "No official feed answered. This is a fetch failure, not a quiet news day."
            : "The feeds answered and carried nothing new."}
        </p>
      )}

      {state === "ok" && data && data.items.length > 0 && (
        <ol className="divide-y divide-gridline border-y border-gridline">
          {data.items.slice(0, 12).map((it) => (
            <li key={it.url} className="py-2">
              <a href={it.url} target="_blank" rel="noopener noreferrer"
                className="group flex items-baseline gap-3">
                <span className="min-w-0 flex-1 text-sm leading-snug text-ink group-hover:underline">
                  {it.title}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">
                  {ago(it.published, now)}
                </span>
              </a>
              <span className="text-[11px] text-ink-muted">{it.outlet}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
