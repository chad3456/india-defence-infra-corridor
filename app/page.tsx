import Link from "next/link";
import ChartCard from "@/components/charts/ChartCard";
import StatTile from "@/components/ui/StatTile";
import { getRegistry, registryStats } from "@/lib/registry";
import { getSeries, latestPoint, firstPoint, DATA_COVERAGE, getAllSeries } from "@/lib/data";
import HeroGlobe, { type GlobeEvent } from "@/components/ui/HeroGlobe";
import { getEvents } from "@/lib/events";
import { refreshState } from "@/lib/freshness";

const HEADLINE_SERIES = [
  "defence-exports",
  "defence-production",
  "nh-network-length",
  "airports-operational",
  "metro-network-length",
  "major-ports-cargo",
  "expressway-length",
  "nuclear-warheads",
];

export default function Home() {
  const stats = registryStats();
  const flagship = getRegistry().filter((c) => c.tags.includes("flagship") && !c.pending);

  const tiles = HEADLINE_SERIES.map((id) => {
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

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b pb-10">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_460px]">
          <div className="min-w-0">
            <p className="eyebrow">India · defence · infrastructure · trade · manufacturing</p>
            <h1 className="mt-3 max-w-[640px] text-[30px] font-semibold leading-[1.12] tracking-tight sm:text-[38px]">
              What India actually built,
              <br className="hidden sm:block" /> measured against what was announced.
            </h1>
            <p className="mt-4 max-w-[560px] text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
              {seriesCount} series and {stats.total} charts drawn from{" "}
              {DATA_COVERAGE.sourceCount} named sources. Every figure carries its publisher, its
              verification date and a confidence grade. Where the numbers contradict the press
              release, the numbers win.
            </p>

            {exportsLatest?.value != null && (
              <div className="mt-8 flex flex-wrap items-end gap-x-7 gap-y-3">
                <div>
                  <p className="eyebrow">defence exports, {exportsLatest.period}</p>
                  <p className="mt-1 text-[52px] font-semibold leading-none tracking-tight">
                    ₹{(exportsLatest.value / 1000).toFixed(1)}k
                    <span className="ml-1.5 text-[16px] font-normal text-[color:var(--text-secondary)]">
                      crore
                    </span>
                  </p>
                </div>
                <p className="max-w-[290px] pb-1 text-[11px] leading-snug text-[color:var(--text-muted)]">
                  Up 56x from ₹686 crore in FY2013-14 — though roughly a third of that is rupee
                  inflation and depreciation, not volume.
                </p>
              </div>
            )}
          </div>

          {/* The globe is data, not decoration: the landmass the map page draws,
              and the developments the ingest actually found this fortnight. */}
          <div className="mx-auto w-full max-w-[460px] lg:mx-0">
            <div className="overflow-hidden rounded-xl border">
              <HeroGlobe events={globeEvents} />
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-[color:var(--text-muted)]">
              {globeEvents.length} development{globeEvents.length === 1 ? "" : "s"} the pipeline
              placed on the map, newest brightest
              {refresh ? ` · feeds read ${refresh.ago}` : ""}. Nothing here is decorative: a quiet
              week is a quieter globe.
            </p>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-2">
          <Link
            href="/charts"
            className="rounded border px-3 py-1.5 text-[12px] transition-colors hover:bg-[var(--surface-2)]"
          >
            Browse all {stats.total} charts
          </Link>
          <Link
            href="/benchmark"
            className="rounded border px-3 py-1.5 text-[12px] transition-colors hover:bg-[var(--surface-2)]"
          >
            Honest global assessment
          </Link>
          <Link
            href="/map"
            className="rounded border px-3 py-1.5 text-[12px] transition-colors hover:bg-[var(--surface-2)]"
          >
            Map & highway timelapse
          </Link>
        </div>
      </section>

      {/* Headline tiles */}
      <section className="py-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight">Where things stand</h2>
          <span className="eyebrow">latest available period</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {tiles.map(({ s, last, first }) => (
            <StatTile
              key={s.id}
              label={`${s.title} · ${last.period}`}
              value={last.value as number}
              unitShort={s.unitShort}
              fromValue={first?.value ?? undefined}
              fromPeriod={first?.period}
              higherIsBetter={s.higherIsBetter}
            />
          ))}
        </div>
      </section>

      {/* Flagship charts */}
      <section className="border-t py-8">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight">The charts that matter</h2>
          <Link href="/charts" className="link-underline text-[11px] text-[color:var(--text-muted)]">
            all charts →
          </Link>
        </div>
        <p className="mb-4 max-w-[560px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          Each of these pairs a headline claim against the measure that tests it. They are the
          fastest way to see where Indian delivery matches Indian announcement, and where it does
          not.
        </p>
        <div className="grid gap-2.5 md:grid-cols-2">
          {flagship.map((spec) => (
            <ChartCard key={spec.id} spec={spec} />
          ))}
        </div>
      </section>

      {/* Pipeline status */}
      {DATA_COVERAGE.wdiPending && (
        <section className="rounded-lg border border-dashed p-4">
          <p className="eyebrow">pipeline status</p>
          <p className="mt-1.5 max-w-[640px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
            {stats.pending} of {stats.total} charts are waiting on the first ETL run, which pulls
            full 2001-present history for {" "}
            <span className="mono text-[11px]">66</span> World Bank indicators across six
            comparator countries. They are listed with an explicit &ldquo;awaiting data&rdquo; state
            rather than rendered from estimates. Run{" "}
            <span className="mono text-[11px]">npm run etl</span> or let the scheduled GitHub
            Action populate them.
          </p>
        </section>
      )}
    </div>
  );
}
