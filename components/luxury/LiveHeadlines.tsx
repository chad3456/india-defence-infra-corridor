"use client";

import { useEffect, useState } from "react";
import type { LivePayload } from "@/app/api/luxury-beliefs/route";
import type { AreaId } from "@/lib/luxury-beliefs";

/**
 * The latest reporting on each area the page tests, asked of
 * /api/luxury-beliefs every minute while the page is open. Headlines are
 * pointers to reporting; none of them is a figure on this page.
 */
const ago = (iso: string | null, now: number) => {
  if (!iso) return "undated";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  return s < 3600 ? `${Math.max(1, Math.round(s / 60))} min ago` : s < 86_400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86_400)} d ago`;
};

export function LiveHeadlines({ areas }: { areas: Array<{ id: AreaId; label: string }> }) {
  const [data, setData] = useState<LivePayload | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");
  const [area, setArea] = useState<AreaId>(areas[0]!.id);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/luxury-beliefs", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        setData((await r.json()) as LivePayload); setState("ok");
      } catch { setState((s) => (s === "ok" ? "ok" : "failed")); }
      setNow(Date.now());
    };
    void load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);
  const mine = data?.areas.find((a) => a.id === area);
  return (
    <div className="story-card p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <span className="flex items-center gap-1.5 font-bold" style={{ color: state === "failed" ? "var(--story-ink-3)" : "var(--s-hot)" }}>
          <span aria-hidden className={state === "ok" ? "animate-pulse" : ""} style={{ width: 8, height: 8, borderRadius: 9, background: state === "failed" ? "var(--story-ink-3)" : "var(--s-hot)" }} />
          {state === "loading" ? "Connecting…" : state === "failed" ? "Live headlines unavailable" : "Live"}
        </span>
        {data && <span style={{ color: "var(--story-ink-3)" }}>Checked {ago(data.fetchedAt, now || Date.parse(data.fetchedAt))} · refreshes every minute · Google News, English and Hindi, past week</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" role="tablist">
        {areas.map((a) => {
          const n = data?.areas.find((x) => x.id === a.id)?.headlines.length;
          return (
            <button key={a.id} type="button" role="tab" aria-selected={area === a.id} onClick={() => setArea(a.id)} className="rounded-full border px-2.5 py-0.5 text-[11.5px]"
              style={{ borderColor: area === a.id ? "var(--story-ink)" : "var(--story-rule)", fontWeight: area === a.id ? 700 : 500 }}>{a.label}{n !== undefined ? ` · ${n}` : ""}</button>
          );
        })}
      </div>
      <ul className="mt-3 divide-y" style={{ borderColor: "var(--story-rule)" }}>
        {(mine?.headlines ?? []).map((h) => (
          <li key={h.url} className="py-1.5 text-[13px] leading-snug" style={{ borderColor: "var(--story-rule)" }}>
            <a className="hover:underline" href={h.url} target="_blank" rel="noopener noreferrer">{h.title}</a>
            <span className="ml-1.5 text-[11px]" style={{ color: "var(--story-ink-3)" }}>{h.outlet} · {h.lang === "hi" ? "Hindi" : "English"} · {ago(h.published, now || Date.parse(data!.fetchedAt))}</span>
          </li>
        ))}
        {data && !mine?.headlines.length && <li className="py-2 text-[12.5px]" style={{ color: "var(--story-ink-3)" }}>{mine?.ok === false ? "The search did not answer." : "No matching headline in the past week."}</li>}
      </ul>
    </div>
  );
}
