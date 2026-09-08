"use client";

import { useMemo, useState } from "react";
import HoverCard, { useHoverCard } from "./HoverCard";

/**
 * A hundred indicators, each as one row comparing six countries.
 *
 * A hundred charts would be a hundred charts. What a reader wants here is not
 * a shape over time but a position: where India sits against the others, right
 * now, on something they can picture. So each indicator is a single axis with
 * six marks on it, scaled to the six values rather than to zero — the question
 * is the spread between these countries, and anchoring at zero would squeeze
 * all six into a corner on the many indicators where one country is far ahead.
 *
 * ── Colour carries one distinction, not six ──────────────────────────────
 *
 * India against the comparators is two categories, not six, so it uses two
 * marks: India in the series hue, everyone else in recessive ink. Giving each
 * country its own colour would need six categorical hues on a page with a
 * hundred of these, and the reader does not need to tell Brazil from Indonesia
 * at a glance — they need to find India. Every mark names its country on
 * hover, and India's value is printed, so identity is never colour alone.
 */

export interface Peer { country: string; iso3: string; value: number; period: string }

export interface Row {
  id: string;
  theme: string;
  question: string;
  why: string;
  butNot: string;
  title: string;
  unitShort: string;
  /** Null for the 26 where neither direction is better — urbanisation, imports,
   *  the share of people over 65. Those get no rank. */
  higherIsBetter: boolean | null;
  /** All six countries, India included. */
  peers: Peer[];
  /** Set when the series is measured too rarely to trend. */
  sparse: string | null;
}

const IND = "IND";

/**
 * Decimals from the row's own spread, which is the only thing that knows.
 *
 * A fixed precision breaks in both directions. Electricity access runs 99.8 to
 * 100 across all six, and whole numbers printed "India 100 %" beside a rank of
 * fourth, which reads as a broken page rather than as a narrow spread. Urban
 * growth printed four different rates as "1 %" and "2 %". Life expectancy
 * spans fifteen years and wants no decimal at all.
 *
 * The rule is a tenth of the spread — roughly the gap an eye can resolve on an
 * axis this wide. Separating every pair instead was worse: two comparators a
 * hundredth apart dragged the whole row to two decimals and printed India's
 * water access as 95.72 %, which claims a precision the survey does not have.
 * Trailing zeros come off after, so a row can carry 99.8 and 100 together
 * without writing the second one as 100.00.
 */
const MAX_DP = 2;

/** Decimals to resolve a tenth of the spread — about what an eye can pick out. */
function fromSpan(span: number): number {
  if (!(span > 0)) return 0;
  for (let d = 0; d <= MAX_DP; d++) if ((span / 10) * 10 ** d >= 1) return d;
  return MAX_DP;
}

/**
 * Four significant figures, whatever the spread asks for.
 *
 * Without this a 0.2-point spread near 100 printed "99.90 %" and "100.00 %",
 * which claims a hundredth of a percentage point the survey never measured.
 */
function sigCap(magnitude: number): number {
  const abs = Math.abs(magnitude);
  const digits = abs >= 1 ? Math.floor(Math.log10(abs)) + 1 : 1;
  return Math.max(0, Math.min(MAX_DP, 4 - digits));
}

/** Decimals for the values on one row. */
function axisDecimals(span: number, magnitude: number): number {
  return Math.min(fromSpan(span), sigCap(magnitude));
}

/**
 * Decimals for a spread quoted on its own, which is a different question.
 *
 * "all 6 within 0.2 %" needs whatever it takes to make the number non-zero,
 * not whatever the values on the axis are using.
 */
function spanDecimals(span: number): number {
  if (!(span > 0)) return 0;
  for (let d = 0; d <= MAX_DP; d++) if (span * 10 ** d >= 1) return d;
  return MAX_DP;
}

function fmt(v: number, unit: string, decimals = 1): string {
  const abs = Math.abs(v);
  const n = abs >= 1e12 ? `${(v / 1e12).toFixed(1)}T`
    : abs >= 1e9 ? `${(v / 1e9).toFixed(1)}B`
      : abs >= 1e6 ? `${(v / 1e6).toFixed(1)}M`
        : abs >= 1e3 ? `${(v / 1e3).toFixed(1)}k`
          : v.toFixed(decimals);
  if (!unit) return n;
  // Currency reads in front of the number, not behind it: "1.2k US$" is not
  // how anyone writes money.
  if (unit === "US$") return `$${n}`;
  if (unit === "int$") return `$${n} PPP`;
  return `${n} ${unit}`;
}

/**
 * India's place among the comparators, respecting whether high is good.
 *
 * Null when the series has no better direction. A rank on urban population
 * share would be inventing a judgement the data does not carry — being 5th of
 * 6 on "how many people live in cities" is not being behind at anything.
 */
function rankOfIndia(peers: Peer[], higherIsBetter: boolean | null): number | null {
  if (higherIsBetter === null) return null;
  const ind = peers.find((p) => p.iso3 === IND);
  if (!ind) return null;
  const sorted = [...peers].sort((a, b) => higherIsBetter ? b.value - a.value : a.value - b.value);
  return sorted.findIndex((p) => p.iso3 === IND) + 1;
}

export default function EverydayCompare({ rows, themes }: { rows: Row[]; themes: string[] }) {
  const [theme, setTheme] = useState<string>("all");
  const [only, setOnly] = useState<"all" | "ahead" | "behind">("all");
  const card = useHoverCard();

  const shown = useMemo(() => rows.filter((r) => {
    if (theme !== "all" && r.theme !== theme) return false;
    if (only === "all") return true;
    const rank = rankOfIndia(r.peers, r.higherIsBetter);
    // No direction means no position, so these drop out of both filters
    // rather than being silently sorted into one.
    if (rank === null) return false;
    const half = Math.ceil(r.peers.length / 2);
    return only === "ahead" ? rank <= half : rank > half;
  }), [rows, theme, only]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">Theme</span>
          <select value={theme} onChange={(e) => setTheme(e.target.value)}
            className="w-52 rounded border border-gridline bg-surface-1 px-2 py-1 text-sm text-ink">
            <option value="all">All {rows.length}</option>
            {themes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">India&rsquo;s position</span>
          <select value={only} onChange={(e) => setOnly(e.target.value as typeof only)}
            className="rounded border border-gridline bg-surface-1 px-2 py-1 text-sm text-ink">
            <option value="all">Anywhere</option>
            <option value="ahead">Top half</option>
            <option value="behind">Bottom half</option>
          </select>
        </label>
        <p className="ml-auto text-xs text-ink-2">
          showing <strong className="text-ink">{shown.length}</strong> of {rows.length}
        </p>
      </div>

      {/* Two marks, named, so identity never rests on colour alone. */}
      <p className="mb-4 flex flex-wrap items-center gap-4 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--series-1)" }} />
          India
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-gridline"
            style={{ background: "var(--text-muted)" }} />
          China, Vietnam, Brazil, Indonesia and the United States, where each publishes
        </span>
        <span>Each row is scaled to its own values, not to zero.</span>
      </p>

      <ol className="divide-y divide-gridline border-y border-gridline">
        {shown.map((r) => {
          const vals = r.peers.map((p) => p.value);
          const lo = Math.min(...vals), hi = Math.max(...vals);
          const span = hi - lo;
          const ind = r.peers.find((p) => p.iso3 === IND);
          const rank = rankOfIndia(r.peers, r.higherIsBetter);
          // All six equal is a real result — universal electricity access is
          // the obvious one — and it belongs in the middle, not piled on the
          // left edge where a zero span would otherwise put it.
          const pos = (v: number) => (span === 0 ? 50 : ((v - lo) / span) * 100);
          const dp = axisDecimals(span, hi);
          /**
           * An axis scaled to its own values magnifies whatever spread it is
           * given, and on a row where the six countries are essentially
           * identical that magnification is a lie the dots tell on their own.
           * Access to electricity runs 99.8 to 100 and drew India a third of
           * the way along a full-width axis. So every row prints its two ends,
           * and a row whose spread is a rounding error says that instead.
           */
          const negligible = span > 0 && span / Math.max(Math.abs(hi), 1e-9) < 0.02;
          /**
           * Best first where the series has a direction, largest first where
           * it does not. A card that listed them in the ingest's own order
           * would make the reader do the sorting.
           */
          const ordered = [...r.peers].sort((a, b) =>
            r.higherIsBetter === false ? a.value - b.value : b.value - a.value);
          const range = span === 0
            ? `all ${r.peers.length} at ${fmt(hi, r.unitShort, dp)}`
            : negligible
              ? `all ${r.peers.length} within ${fmt(span, r.unitShort, spanDecimals(span))}`
              : `${fmt(lo, r.unitShort, dp)} – ${fmt(hi, r.unitShort, dp)}`;

          return (
            <li key={r.id} className="py-3">
              <div className="grid gap-x-5 gap-y-2 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug text-ink">{r.question}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{r.title}</p>
                </div>

                <div className="min-w-0">
                  {/*
                    The whole track is the hover target, not each mark.
                    Per-mark handlers looked right and were not: on any row
                    where two countries land close together the upper dot
                    covers the lower one, and the country underneath cannot be
                    pointed at at all. One card listing all of them, ordered,
                    is both reachable everywhere along the row and a better
                    answer to the question a reader actually has, which is who
                    is where rather than what is this one dot.
                  */}
                  <div
                    className="relative mx-1.5 h-7"
                    onMouseMove={(e) => card.show(e, {
                      title: r.question,
                      subtitle: r.title,
                      rows: ordered.map((p) => ({
                        label: p.country,
                        value: `${fmt(p.value, r.unitShort, dp)} · ${p.period}`,
                        colour: p.iso3 === IND ? "var(--series-1)" : "var(--text-muted)",
                      })),
                      note: rank !== null
                        ? `India ${rank} of ${r.peers.length}${r.higherIsBetter === false ? ", where lower is better" : ""}.`
                        : "Neither direction is better on this one.",
                    })}
                    onMouseLeave={card.hide}
                  >
                    {/* The axis the marks sit on. */}
                    <span className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2"
                      style={{ background: "var(--gridline)" }} aria-hidden />
                    {r.peers.map((p) => {
                      const isIndia = p.iso3 === IND;
                      return (
                        <span
                          key={p.iso3}
                          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                          style={{
                            left: `${pos(p.value)}%`,
                            width: isIndia ? 12 : 9,
                            height: isIndia ? 12 : 9,
                            background: isIndia ? "var(--series-1)" : "var(--text-muted)",
                            // A ring in the surface colour keeps overlapping
                            // marks readable as separate marks.
                            boxShadow: "0 0 0 2px var(--surface-1)",
                            zIndex: isIndia ? 2 : 1,
                            // The track handles hover; a mark that swallowed
                            // the pointer would hide the one beneath it.
                            pointerEvents: "none",
                          }}
                          aria-hidden
                        />
                      );
                    })}
                  </div>

                  {/* The same content in reading order, for anyone not pointing. */}
                  <ul className="sr-only">
                    {ordered.map((p) => (
                      <li key={p.iso3}>
                        {p.country}: {fmt(p.value, r.unitShort, dp)} in {p.period}
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap items-baseline gap-x-3 text-[11px] text-ink-muted">
                    {ind && (
                      <span className="font-mono tabular-nums text-ink">
                        India {fmt(ind.value, r.unitShort, dp)}
                        <span className="ml-1 text-ink-muted">({ind.period})</span>
                      </span>
                    )}
                    {rank !== null ? (
                      <span>
                        {rank} of {r.peers.length}
                        {r.higherIsBetter === false && <span className="ml-1">· lower is better</span>}
                      </span>
                    ) : (
                      <span>no better direction</span>
                    )}
                    {/* The numbers the axis is drawn from, so a magnified
                        hair cannot pass for a gap. */}
                    <span className="ml-auto font-mono tabular-nums">{range}</span>
                  </div>
                </div>
              </div>

              <p className="mt-1.5 max-w-4xl text-[11.5px] leading-snug text-ink-2">
                <span className="text-ink-muted">Why it matters.</span> {r.why}{" "}
                <span className="text-ink-muted">But not.</span> {r.butNot}
              </p>
              {r.sparse && (
                <p className="mt-1 max-w-4xl text-[11px] leading-snug text-ink-muted">
                  Measured rarely — {r.sparse}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {shown.length === 0 && (
        <p className="py-6 text-sm text-ink-2">Nothing matches that filter.</p>
      )}

      <HoverCard hover={card.hover} />
    </div>
  );
}
