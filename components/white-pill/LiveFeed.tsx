"use client";

import { useEffect, useState } from "react";

/**
 * What is being reported now, by theme: polled every three minutes from
 * /api/progress-live. Headlines are pointers to reports, good and bad alike,
 * never figures for the charts above.
 */

interface Headline { title: string; outlet: string; url: string; published: string | null; topic: string }
interface Payload { fetchedAt: string; topics: Record<string, Headline[]> }

const POLL = 180_000;

function ago(iso: string | null, now: number): string {
  if (!iso) return "";
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
}

export function LiveFeed({ topics }: { topics: string[] }) {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState(false);
  const [topic, setTopic] = useState<string>("All");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch("/api/progress-live", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as Payload;
        if (!stop) { setData(j); setErr(false); }
      } catch { if (!stop) setErr(true); }
    };
    load();
    const poll = setInterval(load, POLL);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => { stop = true; clearInterval(poll); clearInterval(tick); };
  }, []);

  const all = data ? Object.values(data.topics).flat() : [];
  const seen = new Set<string>();
  const list = (topic === "All" ? all : data?.topics[topic] ?? [])
    .filter((h) => { const k = h.title.toLowerCase().slice(0, 80); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => Date.parse(b.published ?? "0") - Date.parse(a.published ?? "0"))
    .slice(0, topic === "All" ? 24 : 12);

  return (
    <div className="wp-live">
      <div className="wp-livehead">
        <span className="wp-dot" aria-hidden />
        <b>Live reporting</b>
        <span className="wp-muted">{data ? `checked ${ago(data.fetchedAt, now)} · refreshes every 3 min` : err ? "the news index did not answer; retrying" : "loading…"}</span>
      </div>
      <div className="wp-chips" role="tablist" aria-label="Theme">
        {["All", ...topics].map((t) => (
          <button key={t} type="button" role="tab" aria-selected={topic === t} onClick={() => setTopic(t)}>
            {t}{data && t !== "All" && <em> {data.topics[t]?.length ?? 0}</em>}
          </button>
        ))}
      </div>
      {list.length ? (
        <ul className="wp-headlines">
          {list.map((h) => (
            <li key={h.url}>
              <a href={h.url} target="_blank" rel="noopener noreferrer">{h.title}</a>
              <span>{h.outlet}{h.published ? ` · ${ago(h.published, now)}` : ""}{topic === "All" ? ` · ${h.topic}` : ""}</span>
            </li>
          ))}
        </ul>
      ) : data ? <p className="wp-muted">{all.length ? "Nothing reported on this theme in the last three days." : "The news index returned nothing just now — it may be unreachable from here. Trying again in three minutes."}</p> : null}
      <p className="wp-fine">Headlines from Google News&apos;s search of many outlets, on neutral searches — critical reporting appears as readily as good news. A headline is not a fact: nothing here is checked, and nothing here becomes a number on this page. Posts on X are not shown: this site does not republish them.</p>
    </div>
  );
}
