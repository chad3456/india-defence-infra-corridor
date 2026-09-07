"use client";

import { useMemo, useState } from "react";
import HoverCard, { useHoverCard } from "./HoverCard";
import type { FilmRow } from "@/lib/cinema-shared";

/**
 * The films, ranked where there is something to rank by.
 *
 * Most of a year's releases have no worldwide figure recorded, which is a fact
 * about the source rather than a gap in the pipeline — so a film without one
 * is listed rather than hidden, and shown as unreported rather than as zero.
 * Sorting puts the reported films first because a leaderboard with nothing at
 * the top is not a leaderboard.
 */

const MOMENTUM_STYLE: Record<string, { label: string; tone: string }> = {
  "climbing": { label: "climbing", tone: "var(--div-pos-2)" },
  "holding": { label: "holding", tone: "var(--div-mid)" },
  "fading": { label: "fading", tone: "var(--div-neg-2)" },
  "opening": { label: "just out", tone: "var(--seq-400)" },
  "too early to say": { label: "too early", tone: "var(--text-muted)" },
};

export default function CinemaTable({ films }: { films: FilmRow[] }) {
  const [language, setLanguage] = useState<string>("all");
  const [onlyReported, setOnlyReported] = useState(false);
  const card = useHoverCard();

  const languages = useMemo(
    () => [...new Set(films.map((f) => f.language))].sort(),
    [films],
  );

  const shown = useMemo(
    () => films.filter((f) =>
      (language === "all" || f.language === language) &&
      (!onlyReported || f.croreGross !== null)),
    [films, language, onlyReported],
  );

  const max = Math.max(1, ...shown.map((f) => f.croreGross ?? 0));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">Language</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}
            className="rounded border border-gridline bg-surface-1 px-2 py-1 text-sm text-ink">
            <option value="all">All {films.length}</option>
            {languages.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={onlyReported}
            onChange={(e) => setOnlyReported(e.target.checked)} />
          Only films with a reported figure
        </label>
        <p className="ml-auto text-xs text-ink-2">
          <strong className="text-ink">{shown.filter((f) => f.croreGross !== null).length}</strong>{" "}
          of {shown.length} carry a figure
        </p>
      </div>

      <ol className="divide-y divide-gridline border-y border-gridline">
        {shown.map((f) => {
          const m = MOMENTUM_STYLE[f.trend.momentum] ?? MOMENTUM_STYLE["too early to say"]!;
          return (
            <li key={f.id}
              className="flex items-center gap-3 py-2"
              onMouseMove={(e) =>
                card.show(e, {
                  title: f.title,
                  subtitle: `${f.language} · ${f.year}`,
                  rows: [
                    { label: "Worldwide gross", value: f.croreGross === null ? "not reported" : `₹${f.croreGross.toLocaleString("en-IN")} cr` },
                    { label: "Momentum", value: m.label },
                    { label: "Days watched", value: String(f.trend.days) },
                    ...(f.bestRank !== null ? [{ label: "Best rank", value: `#${f.bestRank}` }] : []),
                  ],
                  note: f.trend.basis === "none"
                    ? "A trend needs a fortnight of daily readings, or at least the same weekday a week earlier. Cinema is weekly enough that anything less would chart the calendar."
                    : `Compared by ${f.trend.basis}${f.trend.ratio !== null ? `, ratio ${f.trend.ratio.toFixed(2)}` : ""}.`,
                })
              }
              onMouseLeave={card.hide}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{f.title}</span>
                <span className="block text-[11px] text-ink-muted">{f.language}</span>
              </span>

              <span className="hidden w-40 shrink-0 sm:block" aria-hidden>
                {f.croreGross !== null && (
                  <span className="block h-2 rounded-sm"
                    style={{ width: `${Math.max(2, (f.croreGross / max) * 100)}%`, background: "var(--seq-400)" }} />
                )}
              </span>

              <span className="w-28 shrink-0 text-right font-mono text-xs tabular-nums text-ink">
                {f.croreGross === null
                  ? <span className="text-ink-muted">not reported</span>
                  : `₹${f.croreGross.toLocaleString("en-IN")} cr`}
              </span>

              <span className="w-20 shrink-0 text-right text-[11px]" style={{ color: m.tone }}>
                {m.label}
              </span>
            </li>
          );
        })}
      </ol>

      {shown.length === 0 && (
        <p className="py-6 text-sm text-ink-2">No films match that filter.</p>
      )}

      <HoverCard hover={card.hover} />
    </div>
  );
}
