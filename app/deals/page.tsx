import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import {
  loadDeals, byYear, asWritten, MEASURE_LABEL, MEASURE_ORDER, type Measure,
} from "@/lib/deals";

/**
 * Defence contracts the government has announced, and four things they are not.
 *
 * ── What this page is for ────────────────────────────────────────────────
 *
 * The ask was every defence deal signed since 2014. That is a real and finite
 * set, and this is not it. This is every such announcement that an
 * encyclopaedia editor happened to cite and that PIB still serves — which is a
 * sample, skewed towards the deals that made news.
 *
 * Saying that first is the point of the page. The provenance of every figure
 * here is as good as it gets: each row is a government press release, fetched
 * by its own release id and read directly, with the URL beside it. The
 * coverage is the weak half, and a page that showed a clean ledger without
 * saying which half was weak would be misleading precisely because the figures
 * are good.
 *
 * ── Why nothing is summed ────────────────────────────────────────────────
 *
 * A CCS clearance, a DAC Acceptance of Necessity, a signed contract and a
 * delivery are four different events, and the same aircraft passes through all
 * four. Adding them gives a number four times too large; adding their values
 * gives one that means nothing at all. So the four are counted in separate
 * columns, drawn as small multiples rather than a stack, and there is no total
 * anywhere on the page.
 *
 * The Acceptance of Necessity is the one that matters most. An AoN is
 * permission to begin procuring, many never become contracts, and it is
 * routinely reported as though a purchase had been made. Its meaning is
 * printed next to its count rather than in a footnote.
 *
 * ── Values ───────────────────────────────────────────────────────────────
 *
 * As the release wrote them, with the sentence they came from underneath.
 * Nothing is converted — not rupees to dollars, not crore to billion — because
 * every conversion needs a rate and a date, and a converted figure with
 * neither is a new number wearing the old one's citation.
 */

export const metadata = {
  title: "Defence deals · Bharat Tracker",
  description:
    "Indian defence contract announcements read from the press releases themselves, with " +
    "clearances, acceptances of necessity, contracts and deliveries kept apart.",
};

function Bar({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0;
  return (
    <div className="h-[7px] w-full rounded-sm bg-[var(--surface-2)]">
      <div className="h-full rounded-sm" style={{ width: `${w}%`, background: "var(--series-1)" }} />
    </div>
  );
}

export default function DealsPage() {
  const d = loadDeals();

  if (!d.present) {
    return (
      <div>
        <PageHeader
          eyebrow="defence · contracts and clearances"
          title="Defence deals"
          lede="Announcements read from the press releases themselves, one release at a time."
        />
        <p className="mt-8 max-w-[56ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
          The ledger has not been built in this deployment. It is assembled in CI, because
          pib.gov.in cannot be reached from the editing sandbox and the run is several hundred
          fetches. Run the <span className="mono">Build the defence deals ledger</span> workflow, or{" "}
          <span className="mono">npm run deals:build</span> somewhere with network access.
        </p>
        <p className="mt-4 max-w-[56ch] text-[13px] leading-[1.7] text-[color:var(--text-muted)]">
          This page renders nothing rather than placeholders. A defence ledger showing example
          rows is the single worst failure mode available to it.
        </p>
      </div>
    );
  }

  const series = byYear(d.deals);
  const maxPerYear = Math.max(1, ...series.flatMap((s) => s.years.map((y) => y.n)));
  const dated = d.deals.filter((x) => x.date).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const undated = d.deals.filter((x) => !x.date);

  return (
    <div>
      <PageHeader
        eyebrow="defence · contracts and clearances"
        title="Defence deals"
        lede={
          <>
            Indian defence acquisition announcements, each read from the government's own press
            release. Clearances, acceptances of necessity, contracts and deliveries are counted
            apart and never added together.
          </>
        }
        stats={[
          { k: "Releases read", v: String(d.deals.length) },
          { k: "With a stated figure", v: String(d.withValue) },
          { k: "Dated", v: String(d.withDate) },
          { k: "Release ids found", v: String(d.citedIds) },
        ]}
      />

      {/* ── The caveat, before anything is drawn ──────────────────────── */}
      <section className="mt-8 rounded-lg border border-[color:var(--baseline)] bg-[var(--surface-2)] p-4 sm:p-5">
        <p className="eyebrow">read this first</p>
        <p className="mt-2.5 max-w-[64ch] text-[13.5px] leading-[1.7]">
          {d.coverageWarning}
        </p>
        <p className="mt-3 max-w-[64ch] text-[13px] leading-[1.7] text-[color:var(--text-secondary)]">
          {d.discovery}
        </p>
      </section>

      {/* ── The four measures ─────────────────────────────────────────── */}
      <section className="mt-12 border-t pt-10">
        <h2 className="display text-[28px] leading-tight sm:text-[34px]">Four different events</h2>
        <p className="mt-3 max-w-[58ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
          {d.fourMeasures}
        </p>

        <div className="mt-7 grid gap-px overflow-hidden rounded-md border bg-[var(--hairline)] sm:grid-cols-2">
          {MEASURE_ORDER.filter((m) => (d.byMeasure[m] ?? 0) > 0).map((m) => (
            <div key={m} className="bg-[var(--surface-1)] p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13px] font-semibold">{MEASURE_LABEL[m].label}</p>
                <p className="mono text-[19px] leading-none tracking-tight">{d.byMeasure[m]}</p>
              </div>
              <p className="mt-2 text-[12px] leading-[1.55] text-[color:var(--text-secondary)]">
                {MEASURE_LABEL[m].means}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-[color:var(--text-muted)]">
          These do not add up to anything. The same aircraft appears as a clearance, then a
          contract, then a delivery — so a total would count one procurement three times.
        </p>
      </section>

      {/* ── Small multiples, deliberately not stacked ─────────────────── */}
      {series.length > 0 && (
        <section className="mt-12 border-t pt-10">
          <h2 className="display text-[28px] leading-tight sm:text-[34px]">Announcements by year</h2>
          <p className="mt-3 max-w-[58ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
            One row per measure, on a shared scale, so the shapes are comparable. Not stacked:
            stacking would imply the bars sum to something, and they do not. The rise in later
            years is partly real and partly that recent releases are cited more often — this is a
            record of what was announced and found, not of what was signed.
          </p>
          <div className="mt-7 space-y-6">
            {series.map((s) => (
              <div key={s.measure}>
                <p className="text-[12.5px] font-medium">{MEASURE_LABEL[s.measure].label}</p>
                <div className="mt-2 flex items-end gap-1">
                  {s.years.map((y) => (
                    <div key={y.year} className="min-w-0 flex-1">
                      <div className="flex h-[54px] items-end">
                        <div
                          className="w-full rounded-sm"
                          style={{
                            height: `${(y.n / maxPerYear) * 100}%`,
                            minHeight: y.n > 0 ? 2 : 0,
                            background: "var(--series-1)",
                          }}
                          title={`${y.year}: ${y.n}`}
                        />
                      </div>
                      <p className="mono mt-1 text-center text-[9px] text-[color:var(--text-muted)]">
                        {String(y.year).slice(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── The ledger ────────────────────────────────────────────────── */}
      <section className="mt-12 border-t pt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="display text-[28px] leading-tight sm:text-[34px]">The releases</h2>
          <p className="text-[12px] text-[color:var(--text-muted)]">
            newest first · every title links to the release it was read from
          </p>
        </div>
        <p className="mt-3 max-w-[58ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
          {d.valueNote}
        </p>

        <ul className="mt-7 m-0 list-none space-y-0 p-0">
          {dated.map((x) => (
            <li key={x.prid} className="border-b border-[color:var(--hairline)] py-3.5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="mono text-[11px] text-[color:var(--text-muted)]">{x.date}</span>
                <span
                  className="rounded-[3px] border px-1.5 py-px text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-secondary)]"
                  title={MEASURE_LABEL[x.measure].means}
                >
                  {MEASURE_LABEL[x.measure].label}
                </span>
                {x.money.length > 0 && (
                  <span className="mono text-[12px] font-medium">
                    {x.money.map((m) => asWritten(m)).join("  /  ")}
                    {x.ambiguousValue && (
                      <span className="ml-1.5 font-normal text-[color:var(--status-warning)]">
                        two figures stated
                      </span>
                    )}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[13.5px] leading-snug">
                <a
                  href={x.url}
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                  className="link-underline"
                >
                  {x.title || `PIB release ${x.prid}`}
                </a>
              </p>
              {x.money[0] && (
                <p className="mt-1 max-w-[74ch] text-[11.5px] leading-[1.55] text-[color:var(--text-muted)]">
                  “{x.money[0].sentence}”
                </p>
              )}
            </li>
          ))}
        </ul>

        {undated.length > 0 && (
          <p className="mt-4 text-[12px] leading-[1.6] text-[color:var(--text-muted)]">
            {undated.length} release{undated.length === 1 ? "" : "s"} carried no date this reader
            could find and {undated.length === 1 ? "is" : "are"} left out of the list above rather
            than given a guessed one. They are counted in the measures.
          </p>
        )}
      </section>

      {/* ── What is missing, and why ──────────────────────────────────── */}
      <section className="mt-12 border-t pt-10">
        <h2 className="display text-[28px] leading-tight sm:text-[34px]">What this cannot tell you</h2>
        <dl className="mt-6 max-w-[64ch] space-y-4 text-[13.5px] leading-[1.7]">
          <div>
            <dt className="font-semibold">The Ministry of Defence's own list</dt>
            <dd className="mt-1 text-[color:var(--text-secondary)]">
              mod.gov.in refused every request from this pipeline, with and without the www, at
              the connection rather than with a 404. Its annual reports list contracts concluded
              each year in a PDF appendix, and that appendix is the thing that would turn this
              sample into a set. It is not reachable from here.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">PIB's own archive</dt>
            <dd className="mt-1 text-[color:var(--text-secondary)]">
              Its release index answers a request for any date with the same page. Three different
              dates, one of them in 2016, returned 844,412, 844,413 and 844,416 bytes. Individual
              releases are addressable by id; the index over them is not, which is why the ids
              here come from citations.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">What anything cost in comparable terms</dt>
            <dd className="mt-1 text-[color:var(--text-secondary)]">
              Figures are as written. A 2015 contract in crore and a 2024 contract in crore are
              not the same money, and this page does not pretend otherwise by deflating them
              without saying which index it used.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Whether any of it was delivered</dt>
            <dd className="mt-1 text-[color:var(--text-secondary)]">
              A signature is not a delivery. SIPRI records deliveries on a trend-indicator value
              that is deliberately not a price, and its database sits behind a form rather than a
              URL, so the two cannot be joined here.
            </dd>
          </div>
        </dl>

        <p className="mt-6 text-[12px] leading-[1.6] text-[color:var(--text-muted)]">
          Discovery read {d.articlesRead.length} article
          {d.articlesRead.length === 1 ? "" : "s"} and found {d.citedIds} release id
          {d.citedIds === 1 ? "" : "s"}. Of those, {d.fetched} answered, {d.dead} did not, and{" "}
          {d.notDefence} were not defence acquisitions.
          {d.articlesMissing.length > 0 && <> {d.articlesMissing.length} article
            {d.articlesMissing.length === 1 ? "" : "s"} could not be read at all.</>}
          {d.builtAt && <> Built {d.builtAt.slice(0, 10)}.</>}
        </p>

        <p className="mt-5 text-[12.5px]">
          <Link href="/defence-tracker" className="link-underline">
            Defence exports, production and the corridors →
          </Link>
        </p>
      </section>
    </div>
  );
}
