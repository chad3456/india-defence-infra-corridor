import Link from "next/link";
import { getAtlas, STATE_FACTS } from "@/lib/census";
import AtlasMap from "@/components/map/AtlasMap";
import type { MetricCount } from "@/lib/census";

/**
 * The atlas of things nobody counts.
 *
 * Every other page here starts from a published statistic. This one starts from
 * the opposite position: these are questions no ministry owns, so no table
 * exists. Nobody publishes stepwells by state, or planetariums, or blacksmiths.
 * The only way to get the number is to count what volunteers have put on the
 * map.
 *
 * Which makes the page's own caveat load-bearing rather than decorative. A
 * count from OpenStreetMap measures the thing and the mapping of the thing at
 * once, and the two do not come apart. Presented as a league table it would be
 * a hundred confident and quietly wrong rankings of mapper enthusiasm.
 */

export const metadata = {
  title: "Atlas of the uncounted",
  description:
    "A hundred-odd things counted state by state — libraries, stepwells, observatories, blacksmiths — from the map rather than from a ministry, with the mapping bias stated rather than hidden.",
};

export default function AtlasPage() {
  const atlas = getAtlas();
  const counts: Record<string, MetricCount> = Object.fromEntries(
    atlas.metrics.map((m) => [m.id, m]),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">Atlas</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-ink">
          Things nobody counts
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          Every other page on this site begins with a published statistic. This one begins where
          none exists. No ministry owns the question &ldquo;how many stepwells does Gujarat
          have&rdquo;, or planetariums, or blacksmiths — so the only way to get a number is to count
          what is on the map.
        </p>
      </header>

      {atlas.present ? (
        <>
          <section className="mb-8 rounded-lg border border-gridline bg-surface-2 p-5">
            <h2 className="mb-2 text-base font-semibold text-ink">Read this before the map</h2>
            <p className="max-w-3xl text-sm leading-relaxed text-ink-2">
              These counts come from OpenStreetMap, which is drawn by volunteers, and volunteers are
              not spread evenly across India. A count here measures the thing{" "}
              <em>and the mapping of the thing</em>, and the two do not separate. Kerala and
              Karnataka are mapped far more densely than Arunachal or Nagaland, so a raw ranking
              partly ranks how many people showed up to map.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">
              So the bias is measured rather than warned about. Every state has a{" "}
              <strong className="text-ink">baseline</strong> — its share of all mapped features,
              which is roughly how much of the map it drew. Kerala&rsquo;s is 36%. A metric whose
              leader merely matches its own baseline is telling you about mappers; one where a state
              runs far above its baseline is a concentration real enough to show through. Kerala
              leads mapped museums, at 0.35× its baseline — which means it is{" "}
              <em>under</em>-represented in museums. Rajasthan&rsquo;s observatories run at 23×.
              That number sits beside every map.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">
              The per-million and per-area views exist for the same reason, and none of them fixes it.
              Treat this as <strong className="text-ink">a census of the map, not of the
              country</strong> — a lower bound everywhere, and a tighter one in well-mapped states.
              A blank state means nothing of that kind has been mapped there, which is a different
              claim from none existing, so blanks are hatched rather than shaded pale.
            </p>
          </section>

          <section className="mb-10">
            <AtlasMap specs={atlas.specs} counts={counts} facts={STATE_FACTS} />
          </section>

          <section className="mb-12 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-gridline bg-surface-2 p-4">
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">Metrics counted</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                {atlas.counted}<span className="text-base text-ink-muted"> / {atlas.declared}</span>
              </p>
              <p className="mt-1 text-xs leading-snug text-ink-2">
                The ingest is paced and resumable; the rest fill in on later runs.
              </p>
            </div>
            <div className="rounded-lg border border-gridline bg-surface-2 p-4">
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">Features counted</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                {atlas.metrics.reduce((t, m) => t + m.total, 0).toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-xs leading-snug text-ink-2">
                Each placed into a state by point-in-polygon, not by its own label.
              </p>
            </div>
            <div className="rounded-lg border border-gridline bg-surface-2 p-4">
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">Truncated</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{atlas.capped.length}</p>
              <p className="mt-1 text-xs leading-snug text-ink-2">
                {atlas.capped.length === 0
                  ? "No metric hit the query limit."
                  : "Flagged on the map rather than ranked — a cut-off count looks exactly like a real one."}
              </p>
            </div>
          </section>
        </>
      ) : (
        <section className="mb-12 rounded-lg border border-gridline bg-surface-2 p-6">
          <h2 className="mb-2 text-lg font-semibold text-ink">The census has not landed yet</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-ink-2">
            {atlas.declared} metrics are queued, one Overpass query each, paced at seven seconds
            against a free shared endpoint. The ingest writes after every metric and resumes where
            it stopped, so this page fills in over several runs rather than arriving at once.
          </p>
        </section>
      )}

      <section className="mb-12">
        <h2 className="mb-1 text-lg font-semibold text-ink">What was left out, and why</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ["Phone and drone sales by state", "Not published by anyone. Apple does not release statewise sales and nor does any handset maker; drone sales are not broken out by state either. There is no source to cite, so there is no map here — an estimate would be a number I made up."],
            ["The very common things", "Restaurants, shops and places of worship run to hundreds of thousands of nodes each. Too heavy to fetch politely from a free endpoint, and too familiar to be worth the request."],
            ["Anything needing a key", "India's open-data catalogue lists 287,810 resources and will not return their rows without an API key. Those datasets — rail freight, bus fleets, metro ridership — stay out until there is one."],
            ["Counts as of a date", "OpenStreetMap has no historical snapshot here, so these are current counts with no trend. A line over time would need archived extracts this project does not hold."],
          ].map(([h, b]) => (
            <div key={h} className="rounded border border-gridline p-4">
              <h3 className="mb-1 text-sm font-medium text-ink">{h}</h3>
              <p className="text-xs leading-relaxed text-ink-2">{b}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gridline pt-6 text-sm text-ink-2">
        <p>
          Data: OpenStreetMap contributors, via the Overpass API, under ODbL. ·{" "}
          <Link href="/mobility" className="underline">Mobility</Link> ·{" "}
          <Link href="/methodology" className="underline">Method</Link>
        </p>
      </footer>
    </main>
  );
}
