import Link from "next/link";
import { getMobility, pooledFlights, collapseDirections, pathKm } from "@/lib/mobility";
import MobilityMap from "@/components/map/MobilityMap";

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
            <Stat label="Metro & light rail, running" value={`${Math.round(runningKm).toLocaleString("en-IN")} km`}
              sub={`Union of track across ${d.networks.length} networks. A further ${Math.round(totalKm - runningKm).toLocaleString("en-IN")} km is mapped but marked under construction.`} />
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
                      {n.runningKm < n.km && (
                        <span className="absolute inset-y-0 left-0 rounded-sm opacity-90"
                          style={{ width: `${(n.runningKm / maxKm) * 100}%`, background: "var(--series-3)" }} />
                      )}
                    </span>
                    <span className="text-right font-mono text-[11px] tabular-nums text-ink-2">
                      {Math.round(n.km)} km
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 flex flex-wrap gap-x-4 text-[11px] text-ink-muted">
                <span><span className="mr-1.5 inline-block h-2 w-3 align-middle" style={{ background: "var(--series-3)" }} />Running</span>
                <span><span className="mr-1.5 inline-block h-2 w-3 align-middle" style={{ background: "var(--series-1)" }} />Mapped, incl. under construction</span>
              </p>

              <h2 className="mt-8 mb-1 text-lg font-semibold text-ink">Vande Bharat</h2>
              <p className="mb-3 text-sm text-ink-2">
                {vande.length} services mapped as route relations, {Math.round(vandeKm).toLocaleString("en-IN")} route km.
                This is what volunteers have traced, not the operator&rsquo;s timetable — the real
                fleet is larger than the mapped set.
              </p>
              <ul className="space-y-1 text-xs text-ink-2">
                {vande.slice(0, 10).map((v) => (
                  <li key={v.id} className="flex items-baseline justify-between gap-3 border-b border-gridline py-1">
                    <span className="truncate" title={v.name}>{v.name.replace(/^Train\s+/, "")}</span>
                    <span className="shrink-0 font-mono text-[11px] text-ink-muted">{Math.round(pathKm(v.path))} km</span>
                  </li>
                ))}
              </ul>
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
