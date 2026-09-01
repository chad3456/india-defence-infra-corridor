"use client";

import { useMemo, useState } from "react";
import type { Stage } from "@/lib/localisation";
import { STAGES } from "@/lib/localisation";
import StageChip from "./StageChip";
import CoverageSpark from "./CoverageSpark";

export interface ExplorerRow {
  code: string;
  name: string;
  chapter: string;
  chapterName: string;
  stage: Stage;
  openM: number;
  openX: number;
  closeM: number;
  closeX: number;
  coverageShift: number;
  flags: string[];
  years: Array<{ year: number; m: number; x: number }>;
}

const PAGE = 60;

function usd(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}bn`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}m`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

type SortKey = "size" | "shift" | "code";

/**
 * The full commodity table.
 *
 * Thousands of rows, so it filters and pages rather than rendering everything —
 * but the counts always describe the whole filtered set, not the page, so the
 * reader is never told "12 results" when they are looking at page one of 400.
 */
export default function ProductExplorer({ rows }: { rows: ExplorerRow[] }) {
  const [stage, setStage] = useState<Stage | "all">("all");
  const [chapter, setChapter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("size");
  const [page, setPage] = useState(0);

  const chapters = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.chapter, r.chapterName);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (stage !== "all" && r.stage !== stage) return false;
      if (chapter !== "all" && r.chapter !== chapter) return false;
      if (needle && !r.name.toLowerCase().includes(needle) && !r.code.includes(needle)) return false;
      return true;
    });
    out.sort((a, b) => {
      if (sort === "code") return a.code.localeCompare(b.code);
      if (sort === "shift") {
        const av = Number.isFinite(a.coverageShift) ? a.coverageShift : 1e9;
        const bv = Number.isFinite(b.coverageShift) ? b.coverageShift : 1e9;
        return bv - av;
      }
      return (b.closeM + b.closeX) - (a.closeM + a.closeX);
    });
    return out;
  }, [rows, stage, chapter, q, sort]);

  const shown = filtered.slice(0, (page + 1) * PAGE);

  function reset<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(0); };
  }

  return (
    <div>
      {/* Filters, in one row above the table. */}
      <div className="mb-4 flex flex-wrap items-end gap-3 border-b border-gridline pb-4">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">Search</span>
          <input
            value={q}
            onChange={(e) => reset(setQ)(e.target.value)}
            placeholder="pins, penicillin, 851713…"
            className="w-56 rounded border border-gridline bg-surface-1 px-2 py-1 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">Stage</span>
          <select value={stage} onChange={(e) => reset(setStage)(e.target.value as Stage | "all")}
            className="rounded border border-gridline bg-surface-1 px-2 py-1 text-sm text-ink">
            <option value="all">All stages</option>
            {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">Chapter</span>
          <select value={chapter} onChange={(e) => reset(setChapter)(e.target.value)}
            className="max-w-64 rounded border border-gridline bg-surface-1 px-2 py-1 text-sm text-ink">
            <option value="all">All {chapters.length} chapters</option>
            {chapters.map(([c, n]) => <option key={c} value={c}>{c} · {n}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">Sort</span>
          <select value={sort} onChange={(e) => reset(setSort)(e.target.value as SortKey)}
            className="rounded border border-gridline bg-surface-1 px-2 py-1 text-sm text-ink">
            <option value="size">Largest trade</option>
            <option value="shift">Biggest shift</option>
            <option value="code">HS code</option>
          </select>
        </label>
        <p className="ml-auto text-sm text-ink-2">
          <strong className="text-ink">{filtered.length.toLocaleString("en-IN")}</strong> lines
          {filtered.length !== rows.length && <> of {rows.length.toLocaleString("en-IN")}</>}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-baseline text-left text-[11px] uppercase tracking-wide text-ink-muted">
              <th className="py-2 pr-3 font-medium">Commodity</th>
              <th className="py-2 pr-3 font-medium">Stage</th>
              <th className="py-2 pr-3 text-right font-medium">Imports now</th>
              <th className="py-2 pr-3 text-right font-medium">Exports now</th>
              <th className="py-2 pr-3 font-medium">Exports ÷ imports</th>
              <th className="py-2 pr-3 font-medium">Caveat</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.code} className="border-b border-gridline align-middle">
                <td className="py-2 pr-3">
                  <span className="block max-w-[26rem] truncate text-ink" title={r.name}>{r.name}</span>
                  <span className="font-mono text-[11px] text-ink-muted">HS {r.code} · {r.chapterName}</span>
                </td>
                <td className="py-2 pr-3"><StageChip stage={r.stage} small /></td>
                <td className="py-2 pr-3 text-right font-mono text-xs text-ink-2">{usd(r.closeM)}</td>
                <td className="py-2 pr-3 text-right font-mono text-xs text-ink-2">{usd(r.closeX)}</td>
                <td className="py-2 pr-3"><CoverageSpark years={r.years} /></td>
                <td className="py-2 pr-3 text-[11px] text-ink-muted">
                  {r.flags.length === 0 ? "—" : r.flags.join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shown.length < filtered.length && (
        <button onClick={() => setPage((p) => p + 1)}
          className="mt-4 rounded border border-gridline px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2">
          Show {Math.min(PAGE, filtered.length - shown.length)} more
          <span className="text-ink-muted"> ({(filtered.length - shown.length).toLocaleString("en-IN")} left)</span>
        </button>
      )}
      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-muted">No commodity line matches those filters.</p>
      )}
    </div>
  );
}
