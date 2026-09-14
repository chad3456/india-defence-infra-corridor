import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { transportLayers, loadStateStats, statewiseRows } from "@/lib/statewise";

/**
 * Transport infrastructure by state, and three things it is not.
 *
 * ── What is counted ──────────────────────────────────────────────────────
 *
 * Airports with a code, metro lines, and railway stations, each placed into a
 * state by point-in-polygon against the same topology every map here draws.
 * That is presence: the thing exists and it is in that state.
 *
 * ── What "accessibility" would mean ──────────────────────────────────────
 *
 * At least three different claims. Whether a service exists near someone.
 * Whether they can afford it. Whether they can physically board it. Only the
 * first is measurable from anything this project can reach, and even that is
 * measured coarsely — a station in a state says nothing about the distance
 * from any particular village to it.
 *
 * So the word is not used bare anywhere on this page. A count of stations is
 * a count of stations.
 *
 * ── Why the sales column is missing ──────────────────────────────────────
 *
 * Nobody publishes car sales by state. VAHAN, the national registration
 * database, refused this pipeline at the connection on both its URLs — and
 * even reachable it would be the wrong measure: a registration happens where
 * the buyer registers, fleet and lease vehicles are registered wherever road
 * tax is lowest, and the small states that compete on that would be
 * systematically overstated. SIAM publishes real dispatches with no state
 * dimension at all. The two cannot be combined, and neither is "sales by
 * state".
 *
 * The honest thing is an empty column with the reason next to it, which is
 * what this page has.
 */

export const metadata = {
  title: "Transport by state · Bharat Tracker",
  description:
    "Airports, metro lines and railway stations per state, counted from the map's own topology — " +
    "with the three measures that could not be sourced named rather than estimated.",
};

function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}

export default function StatewisePage() {
  const layers = transportLayers();
  const stats = loadStateStats();
  const rows = statewiseRows(layers, stats);
  const ranked = [...rows].sort((a, b) =>
    (b.counts.stations ?? 0) - (a.counts.stations ?? 0));

  const totals = Object.fromEntries(
    layers.map((l) => [l.id, rows.reduce((n, r) => n + (r.counts[l.id] ?? 0), 0)]),
  );
  const maxima = Object.fromEntries(
    layers.map((l) => [l.id, Math.max(1, ...rows.map((r) => r.counts[l.id] ?? 0))]),
  );

  return (
    <div>
      <PageHeader
        eyebrow="india · transport infrastructure"
        title="Transport by state"
        lede={
          <>
            Airports, metro lines and railway stations, each placed into the state whose polygon
            contains it. This counts what exists, not how well it runs — and not how close it is
            to anyone.
          </>
        }
        stats={[
          { k: "States covered", v: String(rows.length) },
          ...layers.map((l) => ({ k: l.label, v: fmt(totals[l.id] ?? 0) })),
        ].slice(0, 4)}
      />

      {/* ── The denominator, or its absence ───────────────────────────── */}
      <section className="mt-8 rounded-lg border border-[color:var(--baseline)] bg-[var(--surface-2)] p-4 sm:p-5">
        <p className="eyebrow">about the numbers</p>
        {stats.present ? (
          <>
            <p className="mt-2.5 max-w-[66ch] text-[13.5px] leading-[1.7]">
              Counts are absolute. Where a population is known the table also shows a rate per
              million, and the figure it divides by is{" "}
              <span className="font-semibold">{stats.populationBasis}</span> — printed here
              because a rate is only as good as its denominator.
            </p>
            <p className="mt-3 max-w-[66ch] text-[13px] leading-[1.7] text-[color:var(--text-secondary)]">
              {stats.staleness}
            </p>
            {stats.suppressed.length > 0 && (
              <div className="mt-4 border-l-2 border-[color:var(--status-warning)] pl-3.5">
                <p className="eyebrow">removed rather than shown</p>
                {stats.suppressed.map((sup) => (
                  <p key={sup.measure} className="mt-1.5 max-w-[64ch] text-[12.5px] leading-[1.6] text-[color:var(--text-secondary)]">
                    <span className="mono text-[11.5px]">{sup.measure}</span> — {sup.why}
                  </p>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="mt-2.5 max-w-[66ch] text-[13.5px] leading-[1.7]">
            Counts only. There is no per-capita column because this deployment has no state
            populations — the parse that reads them has not produced a usable table. A count
            without a denominator ranks states by size, so rather than divide by something
            invented, the rate column is absent and this sentence is here instead.
          </p>
        )}
      </section>

      {/* ── The table ─────────────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="display text-[28px] leading-tight sm:text-[34px]">What is where</h2>
        <p className="mt-3 max-w-[60ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
          Ordered by railway stations, which is the largest and oldest network and the one that
          reaches furthest into places the other two do not go.
        </p>
        <div className="mt-7 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-[color:var(--baseline)]">
                <th className="eyebrow pb-2.5 pr-4 font-normal">State</th>
                {stats.present && (
                  <th className="eyebrow pb-2.5 pr-4 text-right font-normal">Population</th>
                )}
                {layers.map((l) => (
                  <th key={l.id} className="eyebrow pb-2.5 pr-4 text-right font-normal">
                    {l.label}
                  </th>
                ))}
                {stats.present && (
                  <th className="eyebrow pb-2.5 text-right font-normal">
                    Stations per million
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => (
                <tr key={r.state} className="border-b border-[color:var(--hairline)]">
                  <td className="py-2 pr-4 text-[13px]">{r.state}</td>
                  {stats.present && (
                    <td className="mono py-2 pr-4 text-right text-[12.5px] text-[color:var(--text-secondary)]">
                      {r.population === null
                        ? <span className="text-[color:var(--text-muted)]">—</span>
                        : fmt(r.population)}
                    </td>
                  )}
                  {layers.map((l) => {
                    const n = r.counts[l.id] ?? 0;
                    return (
                      <td key={l.id} className="py-2 pr-4 text-right">
                        <span className="flex items-center justify-end gap-2">
                          <span
                            aria-hidden
                            className="hidden h-[6px] rounded-sm sm:block"
                            style={{
                              width: `${Math.max(n > 0 ? 3 : 0, (n / (maxima[l.id] ?? 1)) * 46)}px`,
                              background: n > 0 ? "var(--series-1)" : "transparent",
                            }}
                          />
                          <span className="mono w-[3.25rem] text-right text-[12.5px]">
                            {n > 0 ? fmt(n) : <span className="text-[color:var(--text-muted)]">0</span>}
                          </span>
                        </span>
                      </td>
                    );
                  })}
                  {stats.present && (
                    <td className="mono py-2 text-right text-[12.5px]">
                      {r.rates.stations == null
                        ? <span className="text-[color:var(--text-muted)]">—</span>
                        : r.rates.stations.toFixed(1)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-[70ch] text-[12px] leading-[1.6] text-[color:var(--text-muted)]">
          A zero means nothing in that layer fell inside the state&rsquo;s polygon. For metro
          lines that is usually true — thirteen states have one. For the others it can also mean
          a coordinate that landed just outside a boundary, which is why the totals below the
          headline differ slightly from each dataset&rsquo;s own count.
        </p>
      </section>

      {/* ── What could not be sourced ─────────────────────────────────── */}
      <section className="mt-14 border-t pt-12">
        <h2 className="display text-[28px] leading-tight sm:text-[34px]">
          Three measures that are not here
        </h2>
        <dl className="mt-6 max-w-[66ch] space-y-5 text-[13.5px] leading-[1.7]">
          <div>
            <dt className="font-semibold">Four-wheeler sales by state</dt>
            <dd className="mt-1 text-[color:var(--text-secondary)]">
              Nobody publishes it. VAHAN, the national vehicle registration database, refused this
              pipeline at the connection on both of its URLs. And a registration is not a sale: it
              happens where the buyer registers the vehicle, fleet and lease vehicles are
              registered wherever road tax is lowest, and the small states that compete on that
              would come out systematically overstated. SIAM publishes real dispatches with no
              state dimension at all. The two cannot be combined, and neither one is &ldquo;sales
              by state&rdquo;.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Air passengers by state</dt>
            <dd className="mt-1 text-[color:var(--text-secondary)]">
              The Airports Authority publishes passengers and aircraft movements per airport per
              month, which is a finer grain than the question and would let this page sum to
              states and show its working. Its traffic pages refused the probe at the connection.
              DGCA&rsquo;s portal answered, and its figures are by carrier and route rather than
              by airport, so it is a different cut that needs its own reader. Until one of those
              lands, the airport column counts runways with a code and nothing about traffic.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Accessibility, in the senses that matter most</dt>
            <dd className="mt-1 text-[color:var(--text-secondary)]">
              Whether someone can afford a service, and whether a disabled passenger can board it,
              are the two things most people mean by the word. Neither is in any dataset this
              project can reach. What is here is the third sense — whether the service exists in
              the state at all — and even that is coarse: a station somewhere in Madhya Pradesh
              says nothing about the distance from any particular village to it.
            </dd>
          </div>
        </dl>

        <p className="mt-7 text-[12.5px]">
          <Link href="/" className="link-underline">
            Click any state on the front page to see these named, one by one →
          </Link>
        </p>
      </section>
    </div>
  );
}
