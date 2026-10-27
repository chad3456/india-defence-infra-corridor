"use client";

import { useState } from "react";
import { VERDICTS, type Verdict } from "@/lib/free-palestine";

/**
 * The claims in circulation, each against the record, filterable by verdict.
 * Verdicts are this page's reading of the cited sources.
 */
export interface Checked { claim: string; verdict: Verdict; finding: string; cites: Array<{ publisher: string; url: string }> }

export function ClaimChecker({ claims }: { claims: Checked[] }) {
  const [filter, setFilter] = useState<Verdict | "all">("all");
  const counts = claims.reduce<Record<string, number>>((a, c) => ({ ...a, [c.verdict]: (a[c.verdict] ?? 0) + 1 }), {});
  const shown = claims.filter((c) => filter === "all" || c.verdict === filter);
  const order = Object.keys(VERDICTS).filter((k) => counts[k]) as Verdict[];
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
        {order.map((k) => <span key={k} style={{ width: `${(100 * counts[k]!) / claims.length}%`, background: VERDICTS[k].colour }} />)}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by verdict">
        <button type="button" onClick={() => setFilter("all")} aria-pressed={filter === "all"} className="rounded-full border px-3 py-1 text-[12px] font-semibold" style={{ borderColor: "var(--story-rule)", background: filter === "all" ? "var(--story-ink)" : "transparent", color: filter === "all" ? "var(--story-card)" : "var(--story-ink-2)" }}>All {claims.length}</button>
        {order.map((k) => (
          <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold" style={{ borderColor: filter === k ? VERDICTS[k].colour : "var(--story-rule)", background: filter === k ? VERDICTS[k].colour : "transparent", color: filter === k ? "#fff" : "var(--story-ink-2)" }}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: filter === k ? "#fff" : VERDICTS[k].colour }} />{VERDICTS[k].label} {counts[k]}
          </button>
        ))}
      </div>
      {filter !== "all" && <p className="mt-2 text-[12px]" style={{ color: "var(--story-ink-3)" }}>{VERDICTS[filter].blurb}</p>}
      <ul className="mt-4 grid gap-2.5 md:grid-cols-2">
        {shown.map((c) => (
          <li key={c.claim} className="story-card p-4" style={{ borderLeft: `4px solid ${VERDICTS[c.verdict].colour}` }}>
            <p className="text-[14px] font-semibold leading-snug">&ldquo;{c.claim}&rdquo;</p>
            <p className="mt-2 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.05em] text-white" style={{ background: VERDICTS[c.verdict].colour }}>{VERDICTS[c.verdict].label}</p>
            <p className="mt-2 text-[13px] leading-[1.5]" style={{ color: "var(--story-ink-2)" }}>{c.finding}</p>
            {c.cites.length > 0 && <p className="mt-1.5 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{c.cites.map((s, i) => <span key={s.url}>{i ? " · " : ""}<a className="underline decoration-dotted" href={s.url} target="_blank" rel="noopener noreferrer">{s.publisher}</a></span>)}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
