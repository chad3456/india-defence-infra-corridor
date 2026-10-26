"use client";

import { useEffect, useState } from "react";
import type { DemLive } from "@/lib/demolitions";

/**
 * The latest reporting on religious-structure demolitions, asked of /api/demolitions
 * every two minutes while the page is open. Headlines point to reporting;
 * none becomes a figure on the page until it is checked into the register.
 */
const ago = (iso: string | null, now: number) => {
  if (!iso) return "undated";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  return s < 3600 ? `${Math.max(1, Math.round(s / 60))} min ago` : s < 86_400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86_400)} d ago`;
};

export function DemolitionHeadlines() {
  const [data, setData] = useState<DemLive | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");
  const [now, setNow] = useState(0);
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/demolitions", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        setData((await r.json()) as DemLive); setState("ok");
      } catch { setState((s) => (s === "ok" ? "ok" : "failed")); }
      setNow(Date.now());
    };
    void load();
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="story-card p-4">
      <p className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: state === "failed" ? "var(--story-ink-3)" : "var(--s-hot)" }}>
        <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${state === "ok" ? "animate-pulse" : ""}`} style={{ background: "currentColor" }} />
        {state === "loading" ? "Fetching the latest reporting…" : state === "failed" ? "The live search did not answer; try again shortly." : `Live · ${data?.headlines.length ?? 0} reports in the past fortnight · checked ${ago(data?.fetchedAt ?? null, now)}`}
      </p>
      {data && data.headlines.length > 0 && (
        <ul className="mt-3 divide-y text-[13px]" style={{ borderColor: "var(--story-rule)" }}>
          {data.headlines.map((h) => (
            <li key={h.url} className="py-2" style={{ borderColor: "var(--story-rule)" }}>
              <a href={h.url} target="_blank" rel="noopener noreferrer" className="font-semibold leading-snug hover:underline">{h.title}</a>
              <span className="mt-0.5 block text-[11px]" style={{ color: "var(--story-ink-3)" }}>{h.outlet} · {ago(h.published, now)}{h.lang !== "en" ? " · Hindi" : ""}</span>
            </li>
          ))}
        </ul>
      )}
      {data && data.headlines.length === 0 && <p className="mt-2 text-[12.5px]" style={{ color: "var(--story-ink-3)" }}>No matching reports in the past fortnight.</p>}
    </div>
  );
}
