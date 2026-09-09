import Link from "next/link";
import ChartCard from "@/components/charts/ChartCard";
import { getRegistry, registryStats } from "@/lib/registry";
import { getSeries, latestPoint, firstPoint, DATA_COVERAGE, getAllSeries } from "@/lib/data";
import HeroGlobe, { type GlobeEvent } from "@/components/ui/HeroGlobe";
import { getEvents } from "@/lib/events";
import { refreshState } from "@/lib/freshness";

/**
 * The front page, as a publication rather than a dashboard.
 *
 * What was here before opened with an eyebrow, a headline, a paragraph and
 * then went straight into a four-across grid of stat tiles. Everything on it
 * was true and none of it was composed: eight tiles of equal weight say that
 * nothing on the page matters more than anything else, which is the opposite
 * of what a front page is for.
 *
 * This one is built like the opening of an annual review. One statement at
 * full size. One figure given room, with the qualification that makes it
 * honest sitting next to it rather than buried. Then the record as an index —
 * a ruled table with the baseline and the change since, which is how a reader
 * compares eight things, rather than eight boxes they have to compare by
 * memory. The globe stays because it is the only element on the page drawn
 * from this fortnight's ingest, and a quiet week genuinely makes it quieter.
 *
 * ── The one number ──────────────────────────────────────────────────────
 *
 * Defence exports leads because it is the site's most-cited figure and its
 * most misused one. It is printed at the size the claim usually gets, and the
 * deflation caveat is set immediately beside it at a size you cannot skip.
 * Putting the correction in a footnote would have been the ordinary choice and
 * would have made the page part of the problem it exists to document.
 */

const HEADLINE_SERIES = [
  "defence-exports",
  "defence-production",
  "nh-network-length",
  "expressway-length",
  "metro-network-length",
  "airports-operational",
  "major-ports-cargo",
  "nuclear-warheads",
];

/** Change since the first reading, as the multiple or percentage that reads honestly. */
function since(first: number, last: number): { text: string; up: boolean } | null {
  if (!Number.isFinite(first) || first === 0) return null;
  const ratio = last / first;
  if (ratio >= 3) return { text: `${ratio.toFixed(ratio >= 10 ? 0 : 1)}×`, up: true };
  const pct = (ratio - 1) * 100;
  if (Math.abs(pct) < 0.5) return { text: "flat", up: pct >= 0 };
  return { text: `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`, up: pct > 0 };
}

/**
 * One format for the whole column, in Indian digit grouping.
 *
 * The first version switched to lakh above 100,000, which put "46,429" in a
 * row's baseline and "1.8 lakh" in its latest — the two numbers a reader is
 * there to compare, in two different units. Grouping alone is longer and
 * entirely comparable, which is the trade worth making in a table.
 */
function grouped(v: number): string {
  return v.toLocaleString("en-IN", { maximumFractionDigits: v < 10 ? 1 : 0 });
}

export default function Home() {
  const stats = registryStats();
  const flagship = getRegistry().filter((c) => c.tags.includes("flagship") && !c.pending);

  const rows = HEADLINE_SERIES.map((id) => {
    const s = getSeries(id);
    if (!s) return null;
    const last = latestPoint(s);
    const first = firstPoint(s);
    if (!last || last.value === null) return null;
    return { s, last, first };
  }).filter((x) => x !== null);

  const exports = getSeries("defence-exports");
  const exportsLatest = exports ? latestPoint(exports) : undefined;
  const seriesCount = getAllSeries().length;
  const refresh = refreshState();

  // The globe's marks. Recency drives size and opacity, so the most recent
  // fortnight reads first and older pins recede rather than disappear.
  const events = getEvents();
  const dated = events
    .map((e) => ({ e, t: new Date(e.date).getTime() }))
    .filter((x) => Number.isFinite(x.t) && Array.isArray(x.e.coords));
  const newest = Math.max(0, ...dated.map((x) => x.t));
  const oldest = Math.min(...dated.map((x) => x.t), newest);
  const span = Math.max(1, newest - oldest);
  const globeEvents: GlobeEvent[] = dated.map(({ e, t }) => ({
    coords: e.coords as [number, number],
    recency: (t - oldest) / span,
    title: `${e.placeName ?? e.state ?? "India"} — ${e.date}`,
  }));

  const colophon = [
    { k: "Series", v: String(seriesCount) },
    { k: "Charts", v: String(stats.total) },
    { k: "Named sources", v: String(DATA_COVERAGE.sourceCount) },
    { k: "Feeds read", v: refresh ? refresh.ago : "on schedule" },
  ];

  return (
    <div>
      {/* ── Masthead ──────────────────────────────────────────────────── */}
      <section className="pt-6 sm:pt-12">
        <p className="eyebrow">India · since 2001 · every figure sourced</p>

        <h1 className="display mt-5 max-w-[15ch] text-[44px] leading-[1.02] sm:text-[64px] lg:text-[78px]">
          What India actually built
        </h1>
        <p className="display mt-1 max-w-[22ch] text-[28px] italic leading-[1.12] text-[color:var(--text-secondary)] sm:text-[36px] lg:text-[42px]">
          measured against what was announced
        </p>

        <p className="mt-7 max-w-[52ch] text-[14px] leading-[1.7] text-[color:var(--text-secondary)]">
          Defence, infrastructure, trade and manufacturing, drawn from named publishers and
          nothing else. Every number carries its source, its verification date and a confidence
          grade. Where the figures contradict the press release, the figures win — and where a
          figure cannot carry the weight put on it, this site says so on the same line.
        </p>

        {/* The colophon. A publication states its own scale before it argues. */}
        <dl className="mt-9 grid max-w-[46rem] grid-cols-2 gap-px overflow-hidden rounded-md border bg-[var(--hairline)] sm:grid-cols-4">
          {colophon.map((c) => (
            <div key={c.k} className="bg-[var(--surface-1)] px-4 py-3.5">
              <dt className="eyebrow">{c.k}</dt>
              <dd className="mono mt-1.5 text-[19px] leading-none tracking-tight text-[color:var(--text-primary)]">
                {c.v}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── The lead figure, and the map of this fortnight ────────────── */}
      <section className="mt-14 grid gap-10 border-t pt-12 lg:grid-cols-[1fr_400px] lg:gap-14">
        <div className="min-w-0">
          {exportsLatest?.value != null && (
            <>
              <p className="eyebrow">the number everyone quotes · defence exports</p>
              <p className="display mt-4 text-[76px] leading-[0.9] tracking-[-0.03em] sm:text-[104px]">
                ₹{(exportsLatest.value / 1000).toFixed(1)}
                <span className="ml-2 align-baseline text-[24px] tracking-normal text-[color:var(--text-secondary)] sm:text-[30px]">
                  thousand crore
                </span>
              </p>
              <p className="mono mt-3 text-[11px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
                {exportsLatest.period} · up from ₹686 crore in FY2013-14
              </p>

              {/* The caveat is set beside the figure, not beneath the fold.
                  A 56× headline with the deflation buried is the exact format
                  this site exists to correct. */}
              <div className="mt-7 max-w-[46ch] border-l-2 border-[color:var(--series-2)] pl-4">
                <p className="text-[13.5px] leading-[1.65] text-[color:var(--text-secondary)]">
                  That is a <strong className="font-semibold text-[color:var(--text-primary)]">56×</strong>{" "}
                  rise in nominal rupees. Roughly a third of it is rupee inflation and
                  depreciation rather than volume, and the series counts authorisations, not
                  deliveries. It is still a real and large increase. It is not 56×.
                </p>
              </div>
            </>
          )}

          <div className="mt-9 flex flex-wrap gap-2">
            <Link
              href="/charts"
              className="rounded-md border border-[color:var(--baseline)] px-4 py-2 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-2)]"
            >
              Browse all {stats.total} charts
            </Link>
            <Link
              href="/benchmark"
              className="rounded-md border px-4 py-2 text-[12.5px] transition-colors hover:bg-[var(--surface-2)]"
            >
              Honest global assessment
            </Link>
            <Link
              href="/everyday"
              className="rounded-md border px-4 py-2 text-[12.5px] transition-colors hover:bg-[var(--surface-2)]"
            >
              A hundred numbers anyone can read
            </Link>
          </div>
        </div>

        {/* The globe is data, not decoration: the landmass the map page draws,
            and the developments the ingest actually found this fortnight. */}
        <figure className="m-0 min-w-0">
          <div className="overflow-hidden rounded-lg border bg-[var(--surface-1)]">
            <HeroGlobe events={globeEvents} />
          </div>
          <figcaption className="mt-3 text-[11.5px] leading-relaxed text-[color:var(--text-muted)]">
            <span className="mono text-[color:var(--text-secondary)]">{globeEvents.length}</span>{" "}
            development{globeEvents.length === 1 ? "" : "s"} the pipeline placed on the map,
            newest brightest{refresh ? ` · feeds read ${refresh.ago}` : ""}. Nothing here is
            decorative: a quiet week is a quieter globe.
          </figcaption>
        </figure>
      </section>

      {/* ── The record, as an index ───────────────────────────────────── */}
      <section className="mt-16 border-t pt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="display text-[30px] leading-tight sm:text-[36px]">The record</h2>
          <Link
            href="/charts"
            className="link-underline text-[12px] text-[color:var(--text-muted)]"
          >
            all {stats.total} charts →
          </Link>
        </div>
        <p className="mt-3 max-w-[54ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
          Eight series, each with the first reading this site holds and the latest one. The change
          column is arithmetic on those two numbers and nothing else — no smoothing, no rebasing,
          no adjustment that is not named.
        </p>

        {/* A ruled index rather than a tile grid: eight boxes of equal weight
            make the reader hold eight baselines in their head to compare them.
            A table puts the baseline in the row. */}
        <div className="mt-7 overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-[color:var(--baseline)]">
                <th className="eyebrow pb-2.5 pr-4 font-normal">Measure</th>
                <th className="eyebrow pb-2.5 pr-4 text-right font-normal">Baseline</th>
                <th className="eyebrow pb-2.5 pr-4 text-right font-normal">Latest</th>
                <th className="eyebrow pb-2.5 text-right font-normal">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, last, first }) => {
                // A series whose first and latest reading are the same year has
                // no change to report. Printing "flat" there would claim a
                // stable trend from a single observation.
                const oneReading = first == null || first.period === last.period;
                const delta =
                  !oneReading && first?.value != null && last.value != null
                    ? since(first.value, last.value)
                    : null;
                // Direction is judged against the series' own declared
                // direction, so "up" on warheads is not painted as progress.
                const good =
                  delta && s.higherIsBetter !== null ? delta.up === s.higherIsBetter : null;
                return (
                  <tr
                    key={s.id}
                    className="border-b transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <td className="py-3 pr-4 align-baseline">
                      <span className="text-[14px] font-medium">{s.title}</span>
                      <span className="mono ml-2 text-[10.5px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                        {s.unitShort}
                      </span>
                    </td>
                    <td className="mono py-3 pr-4 text-right align-baseline text-[12.5px] tabular-nums text-[color:var(--text-muted)]">
                      {!oneReading && first?.value != null ? grouped(first.value) : "—"}
                      <span className="ml-1.5 text-[10.5px]">
                        {oneReading ? "one reading" : (first?.period ?? "")}
                      </span>
                    </td>
                    <td className="mono py-3 pr-4 text-right align-baseline text-[15px] tabular-nums">
                      {grouped(last.value as number)}
                      <span className="ml-1.5 text-[10.5px] text-[color:var(--text-muted)]">
                        {last.period}
                      </span>
                    </td>
                    <td className="py-3 text-right align-baseline">
                      {delta ? (
                        <span
                          className="mono text-[13px] tabular-nums"
                          style={{
                            color:
                              good === null
                                ? "var(--text-secondary)"
                                : good
                                  ? "var(--success-text)"
                                  : "var(--status-critical)",
                          }}
                        >
                          {delta.text}
                        </span>
                      ) : (
                        <span className="mono text-[13px] text-[color:var(--text-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3.5 text-[11.5px] leading-relaxed text-[color:var(--text-muted)]">
          Green and red follow each series&rsquo; own declared direction, not the arrow. A rising
          warhead count is not painted as progress.
        </p>
      </section>

      {/* ── Flagship charts ──────────────────────────────────────────── */}
      <section className="mt-16 border-t pt-12">
        <h2 className="display text-[30px] leading-tight sm:text-[36px]">The charts that matter</h2>
        <p className="mt-3 max-w-[54ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
          Each pairs a headline claim against the measure that tests it — the fastest way to see
          where Indian delivery matches Indian announcement, and where it does not.
        </p>
        <div className="mt-7 grid gap-3 md:grid-cols-2">
          {flagship.map((spec) => (
            <ChartCard key={spec.id} spec={spec} />
          ))}
        </div>
      </section>

      {/* ── How to read this ─────────────────────────────────────────── */}
      <section className="mt-16 border-t pt-12">
        <h2 className="display text-[30px] leading-tight sm:text-[36px]">How to read this</h2>
        <div className="mt-7 grid gap-px overflow-hidden rounded-md border bg-[var(--hairline)] sm:grid-cols-3">
          {[
            {
              k: "Method",
              href: "/methodology",
              t: "What counts as a source",
              d: "Every series names its publisher, the date it was last reconciled, and a confidence grade. Anything that fails the publish gate is listed as awaiting data rather than estimated.",
            },
            {
              k: "Benchmark",
              href: "/benchmark",
              t: "Against the rest of the world",
              d: "India set beside China, Vietnam, Brazil, Indonesia and the United States on the same definitions — including the comparisons that do not flatter.",
            },
            {
              k: "Sources",
              href: "/sources",
              t: "The full list",
              d: `All ${DATA_COVERAGE.sourceCount} publishers behind the figures, with what each one contributes and when it was last read.`,
            },
          ].map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group flex flex-col gap-2 bg-[var(--surface-1)] p-5 transition-colors hover:bg-[var(--surface-2)]"
            >
              <span className="eyebrow">{c.k}</span>
              <span className="display text-[19px] leading-snug">{c.t}</span>
              <span className="text-[12.5px] leading-relaxed text-[color:var(--text-secondary)]">
                {c.d}
              </span>
              <span className="link-underline mt-auto pt-2 text-[11.5px] text-[color:var(--text-muted)]">
                Read →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Pipeline status */}
      {DATA_COVERAGE.wdiPending && (
        <section className="mt-12 rounded-md border border-dashed p-5">
          <p className="eyebrow">pipeline status</p>
          <p className="mt-2 max-w-[64ch] text-[12.5px] leading-relaxed text-[color:var(--text-secondary)]">
            {stats.pending} of {stats.total} charts are waiting on the first ETL run. They are
            listed with an explicit &ldquo;awaiting data&rdquo; state rather than rendered from
            estimates.
          </p>
        </section>
      )}
    </div>
  );
}
