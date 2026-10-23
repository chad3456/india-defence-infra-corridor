"use client";

import { useMemo, useState } from "react";

/**
 * Every state, one metric at a time, across the NFHS rounds. Two views:
 * 1998–99 boundaries, on which DHS republishes every later round so all four
 * rounds compare like with like, and today's states, which exist only from
 * the round after they were formed. A blank cell is a round with no figure.
 */

export interface StateMetric { key: string; title: string; unit: string; higherIs: "better" | "worse" | "neither"; note?: string; rows: Record<string, Array<number | null>> }
type Props = { rounds: Array<{ id: string; name: string; label: string }>; metrics: StateMetric[]; comparable: string[]; current: string[] };

const fmtV = (v: number | null | undefined, unit: string) => (v === null || v === undefined ? "" : unit === "%" ? v.toFixed(1) : unit === "children" ? v.toFixed(1) : String(Math.round(v)));

export default function StateExplorer({ rounds, metrics, comparable, current }: Props) {
  const [key, setKey] = useState(metrics[0]?.key ?? "");
  const [view, setView] = useState<"comparable" | "current">("comparable");
  const [sort, setSort] = useState<"latest" | "change" | "name">("latest");
  const m = metrics.find((x) => x.key === key) ?? metrics[0];
  const names = view === "comparable" ? comparable : current;

  const rows = useMemo(() => {
    if (!m) return [];
    const out = names.map((s) => {
      const v = m.rows[s] ?? rounds.map(() => null);
      const firstI = v.findIndex((x) => x !== null);
      const lastI = v.length - 1 - [...v].reverse().findIndex((x) => x !== null);
      const change = firstI >= 0 && lastI > firstI ? v[lastI]! - v[firstI]! : null;
      return { s, v, change, latest: firstI >= 0 ? v[lastI]! : null, from: firstI };
    }).filter((r) => r.v.some((x) => x !== null));
    const dir = m.higherIs === "better" ? -1 : 1;
    const by = (f: (r: (typeof out)[number]) => number | null) => (a: (typeof out)[number], b: (typeof out)[number]) => {
      const x = f(a), y = f(b);
      return x === null ? (y === null ? 0 : 1) : y === null ? -1 : y - x;
    };
    // "Worst" and "least progress" follow the metric's direction; a state with no figure sorts last.
    return out.sort(sort === "name" ? (a, b) => a.s.localeCompare(b.s) : sort === "latest" ? by((r) => (r.latest === null ? null : dir * r.latest)) : by((r) => (r.change === null ? null : dir * r.change)));
  }, [m, names, rounds, sort]);

  if (!m) return null;
  const all = Object.values(m.rows).flat().filter((x): x is number => x !== null);
  const lo = Math.min(...all), hi = Math.max(...all);
  const hue = m.higherIs === "worse" ? "var(--s-hot)" : m.higherIs === "better" ? "var(--s-cool)" : "var(--series-1)";
  const shade = (v: number | null) => (v === null ? "transparent" : `color-mix(in srgb, ${hue} ${Math.round(8 + 52 * ((v - lo) / (hi - lo || 1)))}%, var(--story-card))`);
  const good = (d: number) => (m.higherIs === "neither" || d === 0 ? "var(--story-ink-2)" : (d > 0) === (m.higherIs === "better") ? "var(--s-cool)" : "var(--s-hot)");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={key} onChange={(e) => setKey(e.target.value)} aria-label="Metric" className="max-w-full rounded-md border bg-transparent px-2 py-1 text-[12.5px]" style={{ borderColor: "var(--story-rule)" }}>
          {metrics.map((x) => <option key={x.key} value={x.key}>{x.title}</option>)}
        </select>
        <div className="flex overflow-hidden rounded-md border text-[11.5px]" style={{ borderColor: "var(--story-rule)" }} role="group" aria-label="Boundaries">
          {(["comparable", "current"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className="px-2.5 py-1" style={{ background: view === v ? "var(--story-ink)" : "transparent", color: view === v ? "var(--story-card)" : "var(--story-ink-2)" }}>
              {v === "comparable" ? "1998–99 boundaries (all rounds)" : "Today's states"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-md border bg-transparent px-1.5 py-0.5" style={{ borderColor: "var(--story-rule)" }}>
            <option value="latest">{m.higherIs === "neither" ? "highest" : "worst"} latest first</option><option value="change">{m.higherIs === "neither" ? "largest rise" : "least progress"} first</option><option value="name">A–Z</option>
          </select>
        </label>
      </div>
      {m.note && <p className="mt-2 text-[11.5px] leading-[1.5]" style={{ color: "var(--story-ink-3)" }}>{m.note}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[12px] tabular-nums">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-[0.05em]" style={{ color: "var(--story-ink-3)" }}>
              <th className="py-1.5 pr-2 font-semibold">{view === "comparable" ? "State, 1998–99 boundaries" : "State or union territory"}</th>
              {rounds.map((r) => <th key={r.id} className="px-1 py-1.5 text-right font-semibold">{r.name}<span className="block font-normal normal-case tracking-normal">{r.label}</span></th>)}
              <th className="py-1.5 pl-2 text-right font-semibold">Change<span className="block font-normal normal-case tracking-normal">first to last, derived</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.s} className="border-t" style={{ borderColor: "var(--story-rule)" }}>
                <td className="py-1 pr-2">{r.s}</td>
                {r.v.map((v, i) => <td key={rounds[i]!.id} className="mono px-1 py-1 text-right" style={{ background: shade(v) }} title={v === null ? `${r.s}, ${rounds[i]!.name}: no figure` : `${r.s}, ${rounds[i]!.name}: ${fmtV(v, m.unit)}${m.unit === "%" ? "%" : ""}`}>{fmtV(v, m.unit) || <span style={{ color: "var(--story-ink-3)" }}>·</span>}</td>)}
                <td className="mono py-1 pl-2 text-right font-semibold" style={{ color: r.change === null ? "var(--story-ink-3)" : good(r.change) }}>
                  {r.change === null ? "—" : `${r.change > 0 ? "+" : ""}${fmtV(r.change, m.unit)}`}{r.change !== null && r.from > 0 ? <span className="font-normal" style={{ color: "var(--story-ink-3)" }}> since {rounds[r.from]!.label}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10.5px] leading-[1.5]" style={{ color: "var(--story-ink-3)" }}>
        Shading runs from the lowest to the highest value any state recorded in any round, {m.higherIs === "worse" ? "darker where higher is worse" : m.higherIs === "better" ? "darker where higher is better" : "darker where higher; neither end is good or bad"}. Change is in {m.unit === "%" ? "percentage points" : m.unit === "children" ? "children per woman" : "deaths per 1,000"}, computed on this page. {view === "current" ? "States formed in 2000 appear from 2005–06; Telangana, from 2015–16; Ladakh, from 2019–21." : "Bihar includes Jharkhand, Madhya Pradesh includes Chhattisgarh, Uttar Pradesh includes Uttarakhand and Andhra Pradesh includes Telangana in every round, so the four rounds compare like with like."}
      </p>
    </div>
  );
}
