import Link from "next/link";
import { loadElections, nationalTurnout, LOK_SABHA_SEATS } from "@/lib/elections";
import ElectionMap from "@/components/map/ElectionMap";

/**
 * Statewise voting patterns for the last three general elections.
 *
 * The page states its own provenance prominently because the provenance is
 * unusual for this site: every other number here is read from the body that
 * produced it, and this one is not. The Election Commission's results portal
 * answers an automated request with a JavaScript shell, so these figures are
 * read from Wikipedia's per-election tables, which carry the ECI numbers. That
 * is a real step of remove and the reader is told about it rather than shown a
 * commission logo over a number that came from somewhere else.
 */

export const metadata = {
  title: "How India voted, state by state",
  description:
    "Turnout, electors and seats by state for the 2014, 2019 and 2024 general elections, with every row checked against its own arithmetic.",
};

export default function ElectionsPage() {
  const data = loadElections();
  const latest = data.years[data.years.length - 1];
  const first = data.years[0];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">Elections</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-ink">
          How India voted, state by state
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          Turnout, the size of the roll, and the seats each state sends, for the three most
          recent general elections. The interesting number is rarely the national one.
        </p>
      </header>

      {data.present && latest && first ? (
        <>
          <section className="mb-8 rounded-lg border border-gridline bg-surface-1 p-5">
            <h2 className="text-sm font-semibold text-ink">Where these numbers come from</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
              Not, as it happens, from the Election Commission — not directly. Its results portal
              answers an automated request with about a kilobyte of JavaScript and no data, and
              Lok Dhaba, the Trivedi Centre&rsquo;s cleaned compilation of Indian results, does the
              same. So these are read from Wikipedia&rsquo;s per-election tables, which carry the
              ECI figures. That is one step of remove from the source, and saying so is the point:
              the numbers are the commission&rsquo;s, the reading of them is not.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">
              Which is why every row is checked against itself. The table prints a turnout
              percentage next to the electors and voters it was computed from, so voters divided by
              electors has to reproduce it — within a fifth of a percentage point, or the row is
              dropped and the discrepancy recorded. A transposed column still yields a
              plausible-looking number, and that is exactly the error a source at one remove is
              most likely to introduce.
            </p>
          </section>

          <section className="mb-8 grid gap-3 sm:grid-cols-3">
            {data.years.map((y) => (
              <div key={y.year} className="rounded-lg border border-gridline bg-surface-2 p-4">
                <p className="text-[11px] uppercase tracking-wide text-ink-muted">{y.year}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                  {nationalTurnout(y).toFixed(1)}%
                </p>
                <p className="mt-1 text-xs leading-snug text-ink-2">
                  National turnout, recomputed from {y.rows.length} states rather than taken from
                  the summary row. {y.seatsTotal} of {LOK_SABHA_SEATS} seats covered.
                </p>
              </div>
            ))}
          </section>

          <section className="mb-10">
            <ElectionMap years={data.years} />
          </section>

          <section className="mb-10">
            <h2 className="text-sm font-semibold text-ink">What this does not show</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-gridline bg-surface-1 p-4">
                <p className="text-sm font-medium text-ink">Who won</p>
                <p className="mt-1 text-xs leading-snug text-ink-2">
                  Party vote shares are in the same articles but in a different table, one that
                  carries no arithmetic to check itself against. Turnout has electors and voters
                  sitting beside the percentage; a vote share has nothing but the share. Until
                  there is something to verify it with, it is not here.
                </p>
              </div>
              <div className="rounded-lg border border-gridline bg-surface-1 p-4">
                <p className="text-sm font-medium text-ink">Roll revisions and deletions</p>
                <p className="mt-1 text-xs leading-snug text-ink-2">
                  Statewise deletions from the Special Intensive Revision are not published as a
                  table anywhere reachable. The open-data catalogue lists electoral-roll datasets
                  but returns HTTP 400 to every request without an API key. Reported figures
                  circulate in press coverage; a number assembled from those is a press estimate,
                  not a roll.
                </p>
              </div>
              <div className="rounded-lg border border-gridline bg-surface-1 p-4">
                <p className="text-sm font-medium text-ink">Constituencies</p>
                <p className="mt-1 text-xs leading-snug text-ink-2">
                  This is state-level. Constituency results exist in these articles too, but the
                  boundary file here has state polygons only, so a constituency map would be a
                  table pretending to be a map.
                </p>
              </div>
              <div className="rounded-lg border border-gridline bg-surface-1 p-4">
                <p className="text-sm font-medium text-ink">Anything before 2014</p>
                <p className="mt-1 text-xs leading-snug text-ink-2">
                  Earlier elections are readable, but the states are not: Telangana was created in
                  2014, and going further back crosses the 2000 creation of Jharkhand,
                  Chhattisgarh and Uttarakhand. Comparing turnout across a boundary change means
                  comparing different places with the same name.
                </p>
              </div>
            </div>
          </section>
        </>
      ) : (
        <p className="rounded-lg border border-gridline bg-surface-2 p-5 text-sm text-ink-2">
          No election data has been ingested yet. The connector runs in CI and commits what it
          reads; this page fills in on the next run.
        </p>
      )}

      <footer className="mt-10 border-t border-gridline pt-4 text-xs text-ink-muted">
        Figures published by the Election Commission of India, read from Wikipedia&rsquo;s
        per-election result tables. ·{" "}
        <Link href="/methodology" className="underline">Method</Link> ·{" "}
        <Link href="/atlas" className="underline">Atlas</Link>
      </footer>
    </main>
  );
}
