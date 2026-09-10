import Link from "next/link";
import { getSeries } from "@/lib/data";
import { EVERYDAY, EVERYDAY_THEMES, sparseNote } from "@/lib/everyday";
import EverydayCompare, { type Row } from "@/components/charts/EverydayCompare";

/**
 * A hundred numbers you could explain on a train, against five other countries.
 *
 * The rest of this site is organised by subject — defence, trade, mobility.
 * This page is organised by legibility instead. Everything on it is already in
 * the catalogue; what it adds is the plain question each number answers and the
 * sentence saying what it cannot tell you. The second part is the point. A
 * number this easy to read is easy to over-read, and "more Indians have a
 * phone" is a fact about phones.
 *
 * The two absences are stated in prose rather than left as a gap, because both
 * were asked for by name. See the docblock in lib/everyday.ts for the longer
 * version.
 */

export const metadata = {
  title: "A hundred numbers anyone can read",
  description:
    "A hundred everyday economic indicators — light, water, toilets, phones, flights, bank accounts — with India set against China, Vietnam, Brazil, Indonesia and the United States.",
};

export default function EverydayPage() {
  /**
   * Built at request time from the ingested catalogue rather than duplicated
   * into the curation file, so a re-ingest moves this page and a series that
   * disappears fails loudly in the test rather than quietly here.
   */
  const rows: Row[] = EVERYDAY.flatMap((e) => {
    const s = getSeries(e.id);
    if (!s || !s.peers || s.peers.length < 3) return [];
    return [{
      id: e.id,
      theme: e.theme,
      question: e.question,
      why: e.why,
      butNot: e.butNot,
      title: s.title,
      unitShort: s.unitShort,
      higherIsBetter: s.higherIsBetter,
      peers: s.peers.map((p) => ({
        country: p.country, iso3: p.iso3, value: p.value, period: p.period,
      })),
      sparse: sparseNote(e.id),
    }];
  });

  // Themes in the declared order, minus any that lost all their rows.
  const themes = EVERYDAY_THEMES.filter((t) => rows.some((r) => r.theme === t));

  const years = rows.flatMap((r) => r.peers.map((p) => Number(p.period)))
    .filter((n) => Number.isFinite(n));
  const newest = years.length > 0 ? Math.max(...years) : null;
  const oldest = years.length > 0 ? Math.min(...years) : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-10 border-b border-gridline pb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">Everyday</p>
        <h1 className="display mt-4 max-w-[22ch] text-[32px] leading-[1.07] text-ink sm:text-[42px]">
          A hundred numbers anyone can read
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          Does the light come on. Is there a toilet. Can you cook without smoke. How long do people
          live, how many children see five, how many households have a bank account that is
          actually used. {rows.length} indicators, each one a thing a person can picture, with India
          set against China, Vietnam, Brazil, Indonesia and the United States.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2">
          Every row carries the question it answers, why it moves when a country gets richer, and
          the thing it cannot tell you. That last one is not a disclaimer. A legible number is the
          easiest kind to over-read, and the qualification is what stops it.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-gridline bg-surface-2 p-5 text-sm text-ink-2">
          The World Bank series have not been ingested yet. The connector runs in CI and commits
          what it reads; this page fills in on the next run.
        </p>
      ) : (
        <>
          {/* ── The two that were asked for and are not here ──────────── */}
          <section className="mb-10 rounded-lg border border-gridline bg-surface-2 p-5">
            <h2 className="text-sm font-semibold tracking-tight text-ink">
              Two things that ought to be here and are not
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
              <strong className="text-ink">Air conditioner sales.</strong> A good instinct — an AC is
              the purchase a household makes the year it stops being poor — and no multilateral
              source publishes appliance ownership across countries on a common definition. Trade
              data would be worse than nothing here: India assembles most of the air conditioners it
              sells, so counting imports of finished units would put the world&rsquo;s
              fastest-growing AC market near the bottom of the table. The honest substitute is
              household electricity use per person, which rises when people buy appliances and run
              them, and it is in the list below.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">
              <strong className="text-ink">Cost of housing per square foot.</strong> The World Bank
              carries no cross-country house price series, and the commercial indices that do are
              neither open nor consistently defined — they measure different cities, different
              property types and different years in each country, which is exactly the kind of
              comparison this site exists not to make. Urban population, urban growth and the share
              living in slums are the nearest available, and none of them is a price.
            </p>
          </section>

          <section className="mb-8">
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-xl font-semibold tracking-tight text-ink">The hundred</h2>
              {oldest !== null && newest !== null && (
                <p className="text-[11px] uppercase tracking-wide text-ink-muted">
                  latest reading per country, {oldest}&ndash;{newest}
                </p>
              )}
            </div>
            <p className="mb-5 max-w-3xl text-sm leading-relaxed text-ink-2">
              Each row is one indicator, scaled to its own values rather than to zero, because the
              question is the spread between these countries. Countries do not all report in the
              same year — every mark names its own year on hover, and where India&rsquo;s reading is
              older than a comparator&rsquo;s, the gap is smaller or larger than it looks by however
              much changed in between.
            </p>
            <EverydayCompare rows={rows} themes={[...themes]} />
          </section>

          <p className="max-w-3xl text-sm leading-relaxed text-ink-2">
            All {rows.length} come from the World Bank&rsquo;s development indicators, ingested in
            full and listed with their sources on the{" "}
            <Link href="/sources" className="underline underline-offset-2 hover:text-ink">
              sources page
            </Link>
            . Where a series is measured too rarely to draw a trend through — poverty and inequality
            come from household consumption surveys India has run four times since 2004 — the row
            says so rather than implying a line between the readings.
          </p>
        </>
      )}
    </main>
  );
}
