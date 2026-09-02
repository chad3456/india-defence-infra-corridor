import Link from "next/link";
import { getMobility, pooledFlights, collapseDirections, pathKm } from "@/lib/mobility";
import MobilityMap from "@/components/map/MobilityMap";
import VandeMap from "@/components/map/VandeMap";
import { getVande, growth } from "@/lib/vande";

/**
 * How India moves.
 *
 * Kept apart from the development map, which tracks things being built, and
 * from the defence tracker, which tracks violence. This page answers a third
 * question — what the moving network actually consists of — and it is built
 * almost entirely from geometry rather than from counts.
 *
 * The honesty problem specific to this page is that "connectivity" invites a
 * single score, and there is no defensible way to make one. A metro alignment
 * is concrete, a pooled aircraft position is a sample of a moment, and an
 * airport is a point. The page keeps them as separate claims and says what each
 * one is, rather than averaging them into a number nobody could check.
 */

export const metadata = {
  title: "How India moves",
  description:
    "Metro and light-rail alignments, Vande Bharat routes, airports and live aircraft positions over India — mapped from open geometry, with the difference between track built and track running stated.",
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gridline bg-surface-2 p-4">
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs leading-snug text-ink-2">{sub}</p>}
    </div>
  );
}

export default function MobilityPage() {
  const d = getMobility();
  const vb = getVande();
  const vbGrowth = growth(vb);
  const flights = pooledFlights(d);
  const alignments = collapseDirections(d.metro);
  const vande = collapseDirections(d.vande);

  const totalKm = d.networks.reduce((a, b) => a + b.km, 0);
  const runningKm = d.networks.reduce((a, b) => a + b.runningKm, 0);
  const stations = d.networks.reduce((a, b) => a + b.stations, 0);
  const vandeKm = vande.reduce((a, v) => a + pathKm(v.path), 0);
  const aloft = d.snapshots.length > 0 ? d.snapshots[d.snapshots.length - 1]!.n : 0;
  const maxKm = Math.max(1, ...d.networks.map((n) => n.km));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">Mobility</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-ink">
          How India moves
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          Where the network physically runs, drawn from open geometry rather than from a
          ministry&rsquo;s summary of itself. Four layers, four different kinds of claim — and the
          one thing none of them measures is how many people travelled.
        </p>
      </header>

      {d.present ? (
        <>
          <section className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Metro & light rail, mapped" value={`${Math.round(totalKm).toLocaleString("en-IN")} km`}
              sub={`Union of track across ${d.networks.length} networks. An upper bound — see the note below on what OSM does and does not tag.`} />
            <Stat label="Distinct alignments" value={alignments.length.toLocaleString("en-IN")}
              sub={`From ${d.metro.length} route relations — each direction is mapped separately and is collapsed here.`} />
            <Stat label="Metro stations" value={stations.toLocaleString("en-IN")}
              sub="Stop members on the collapsed alignments." />
            <Stat label="Aircraft aloft" value={aloft.toLocaleString("en-IN")}
              sub={`Latest snapshot over the Indian box. ${flights.length.toLocaleString("en-IN")} positions pooled across ${d.snapshots.length} snapshot${d.snapshots.length === 1 ? "" : "s"}.`} />
          </section>

          <section className="mb-12 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div>
              <MobilityMap
                metro={alignments}
                vande={vande}
                airports={d.airports}
                flights={flights}
                snapshotCount={d.snapshots.length}
              />
            </div>

            <div>
              <h2 className="mb-1 text-lg font-semibold text-ink">Metro networks by track</h2>
              <p className="mb-4 text-sm text-ink-2">
                Union of track, so a section carried by four services counts once. Summing route
                lengths instead would have put Delhi at 711 km.
              </p>
              <div className="space-y-1.5">
                {d.networks.filter((n) => n.km >= 5).map((n) => (
                  <div key={n.city} className="grid grid-cols-[9.5rem_1fr_4.2rem] items-center gap-2">
                    <span className="truncate text-xs text-ink-2" title={n.city}>{n.city}</span>
                    <span className="relative block h-3.5 overflow-hidden rounded-sm bg-surface-2">
                      <span className="absolute inset-y-0 left-0 rounded-sm"
                        style={{ width: `${(n.km / maxKm) * 100}%`, background: "var(--series-1)" }} />
                    </span>
                    <span className="text-right font-mono text-[11px] tabular-nums text-ink-2">
                      {Math.round(n.km)} km
                    </span>
                  </div>
                ))}
              </div>
              {/* One bar, not two. A running/under-construction split would rest on
                  the 5 lines of 118 that carry a lifecycle tag, and drawing it
                  would imply a precision the tagging does not support. */}
              <p className="mt-3 text-[11px] text-ink-muted">
                Mapped alignment, including sections under construction. Only {d.tagged.lifecycle} of{" "}
                {d.tagged.total} lines say which they are.
              </p>

            </div>
          </section>
        </>
      ) : (
        <section className="mb-12 rounded-lg border border-gridline bg-surface-2 p-6">
          <h2 className="mb-2 text-lg font-semibold text-ink">The network data has not landed yet</h2>
          <p className="max-w-2xl text-sm text-ink-2">
            Geometry is fetched in CI from Overpass, which throttles country-wide queries hard.
            This page fills in as the ingest completes.
          </p>
        </section>
      )}

      {/* ── Vande Bharat ─────────────────────────────────────────────── */}
      {vb.present && (
        <section className="mb-12">
          <h2 className="mb-1 text-lg font-semibold text-ink">Vande Bharat</h2>
          <p className="mb-5 max-w-2xl text-sm text-ink-2">
            Two counts, both true. There are{" "}
            <strong className="text-ink">{vb.routes} routes</strong> and{" "}
            <strong className="text-ink">{vb.trainNumbers} train numbers</strong>, because a route
            runs in both directions and each direction is numbered separately. Quoting one without
            the other makes the other look wrong.
          </p>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Routes" value={String(vb.routes)}
              sub="One article per origin–destination pair." />
            <Stat label="Train numbers" value={String(vb.trainNumbers)}
              sub="Both directions counted, as the railway numbers them." />
            <Stat label="Route km, summed" value={Math.round(vb.totalRouteKm).toLocaleString("en-IN")}
              sub="Stated distances added up — a corridor served by several routes counts once per route." />
            <Stat label="Drawn on the map" value={`${vb.drawable} of ${vb.routes}`}
              sub={vb.unplaced.length > 0
                ? "Some endpoint names matched no station and are named below rather than approximated."
                : "Every endpoint resolved to a station."} />
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <VandeMap
                routes={vb.services.map((s) => ({
                  title: s.title, name: s.name, trainNumbers: s.trainNumbers,
                  from: s.from, to: s.to, distanceKm: s.distanceKm,
                  frequency: s.frequency, a: s.a, b: s.b, drawable: s.drawable,
                }))}
                hubs={vb.hubs}
                tracedCount={d.vande.length}
              />
            </div>

            <div className="min-w-0">
              <h3 className="mb-1 text-base font-semibold text-ink">How fast it was built</h3>
              <p className="mb-3 text-sm text-ink-2">
                Cumulative routes in service, by the year each began running. {vbGrowth.dated} of{" "}
                {vb.routes} articles state a start date; the rest are left out rather than dropped
                into the first year.
              </p>
              <svg viewBox="0 0 320 132" className="w-full" role="img"
                aria-label="Cumulative Vande Bharat routes in service by year">
                {(() => {
                  const pts = vbGrowth.points;
                  if (pts.length < 2) return null;
                  const maxC = Math.max(...pts.map((p) => p.count));
                  const x = (i: number) => 26 + (i / (pts.length - 1)) * 280;
                  const y = (c: number) => 108 - (c / maxC) * 92;
                  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.count).toFixed(1)}`).join("");
                  const last = pts[pts.length - 1]!;
                  return (
                    <>
                      <line x1={26} y1={108} x2={306} y2={108} stroke="var(--baseline)" strokeWidth={1} />
                      <path d={`${line}L${x(pts.length - 1).toFixed(1)},108L26,108Z`} fill="var(--series-2)" opacity={0.12} />
                      <path d={line} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinejoin="round" />
                      {pts.map((p, i) => (
                        <g key={p.year}>
                          <circle cx={x(i)} cy={y(p.count)} r={i === pts.length - 1 ? 3.4 : 2}
                            fill="var(--series-2)" stroke="var(--surface-1)" strokeWidth={1.2} />
                          <text x={x(i)} y={123} fontSize={8.5} textAnchor="middle" fill="var(--text-muted)">
                            {String(p.year).slice(2)}
                          </text>
                        </g>
                      ))}
                      <text x={x(pts.length - 1)} y={y(last.count) - 9} fontSize={11} textAnchor="end"
                        fill="var(--text-primary)" fontWeight={600}>{last.count}</text>
                    </>
                  );
                })()}
              </svg>

              <h3 className="mb-1 mt-6 text-base font-semibold text-ink">Where they converge</h3>
              <p className="mb-3 text-sm text-ink-2">
                Stations by how many services start or end there.
              </p>
              <div className="space-y-1.5">
                {vb.hubs.slice(0, 9).map((h) => (
                  <div key={h.name} className="grid grid-cols-[10.5rem_1fr_1.6rem] items-center gap-2">
                    <span className="truncate text-xs text-ink-2" title={h.name}>{h.name}</span>
                    <span className="block h-3 overflow-hidden rounded-sm bg-surface-2">
                      <span className="block h-full rounded-sm"
                        style={{ width: `${(h.services / (vb.hubs[0]?.services ?? 1)) * 100}%`, background: "var(--series-1)" }} />
                    </span>
                    <span className="text-right font-mono text-[11px] tabular-nums text-ink-2">{h.services}</span>
                  </div>
                ))}
              </div>

              {vb.unplaced.length > 0 && (
                <p className="mt-5 text-[11px] leading-relaxed text-ink-muted">
                  <span className="text-ink-2">Not placed:</span>{" "}
                  {[...new Set(vb.unplaced.map((u) => u.replace(/\s*\([A-Z]+\)\s*$/, "")))].join(", ")}.
                  These stations are real; they are absent from the mapped station set this build
                  uses. The nearest same-name station would have put trains in the wrong city, so
                  those routes are left undrawn.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="mb-12">
        <h2 className="mb-1 text-lg font-semibold text-ink">What each layer is, and is not</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ["Metro alignments", "OpenStreetMap route relations. A fact about where track runs, at volunteer-mapped accuracy. It is not ridership, and OSM maps lines under construction the same way it maps running ones — which is why the two are separated above rather than summed."],
            ["Vande Bharat routes", "Route relations whose name carries the service. Mapping is incomplete: the count here is what volunteers have traced, and is a floor on the real fleet, never a total."],
            ["Aircraft positions", "OpenSky, pooled across the snapshots held. A single call is one instant in the sky; density is a pattern over time, so one snapshot is labelled as one snapshot and the pool grows with each run."],
            ["Airports", "Aerodromes carrying an IATA code. A point, not a volume — nothing here says how busy any of them is."],
          ].map(([h, b]) => (
            <div key={h} className="rounded border border-gridline p-4">
              <h3 className="mb-1 text-sm font-medium text-ink">{h}</h3>
              <p className="text-xs leading-relaxed text-ink-2">{b}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-gridline bg-surface-2 p-4">
          <h3 className="mb-1.5 text-sm font-medium text-ink">Why the track total is an upper bound</h3>
          <p className="text-xs leading-relaxed text-ink-2">
            Only {d.tagged.lifecycle} of {d.tagged.total} mapped lines carry any lifecycle tag at
            all. The rest say nothing about whether they are running, and this page treats an
            untagged line as running — which is the generous reading. So{" "}
            {Math.round(totalKm).toLocaleString("en-IN")} km is the ceiling on mapped alignment, not
            a measurement of operating network, and the true operating figure is lower. Published
            operational totals for Indian metro sit closer to a thousand kilometres. The gap is
            construction that OSM maps the same way it maps running track, and it is shown here
            rather than quietly closed, because the alternative is a confident number that would be
            wrong.
          </p>
        </div>
        <p className="mt-4 max-w-3xl text-xs leading-relaxed text-ink-muted">
          Passenger and freight volumes are the obvious missing half. They are published by DGCA and
          the Railway Board rather than mapped by anyone, and both portals failed to answer the
          source probe — DGCA returned a page with no data links, the Railway Board&rsquo;s statistics
          path failed at DNS. Those series stay declared and unfilled rather than being approximated
          from geometry, because track length is not traffic and the two are not convertible.
        </p>
      </section>

      <footer className="border-t border-gridline pt-6 text-sm text-ink-2">
        <p>
          <Link href="/map" className="underline">Development map</Link> ·{" "}
          <Link href="/methodology" className="underline">Method</Link> ·{" "}
          <Link href="/data-sources" className="underline">Sources</Link>
        </p>
      </footer>
    </main>
  );
}
