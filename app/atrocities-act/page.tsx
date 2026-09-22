import {
  loadJudgments, loadCitations, loadRightsNews, loadDocsProbe,
  citationsFor, facetCounts, falseFindings, outletsOf, byDecade,
  FACET_LABEL, FACET_WHY, type Facet,
} from "@/lib/rights";
import {
  Eyebrow, Headline, Standfirst, Mark, Stat, Sources, WhatThisCannotSay, BarRow, TileField,
} from "@/components/stories/Kit";
import { ChartTitle, Caption, RankedRows } from "@/components/stories/Charts";
import EvidenceBrowser, { type Row } from "@/components/rights/EvidenceBrowser";

/**
 * The SC/ST (Prevention of Atrocities) Act, as an argument about evidence.
 *
 * ── The one distinction this page exists to hold ─────────────────────────
 *
 * This statute is argued about through its acquittal rate. The rate is high,
 * it is published, and it is offered — in editorials, in court, in Parliament
 * — as proof that the Act is abused. It is not proof of that.
 *
 * An acquittal can follow from a false complaint. It can equally follow from a
 * hostile witness, from intimidation of the complainant, from an investigation
 * that never gathered the caste-certificate evidence the statute requires, or
 * from a compromise reached outside court. India's own official record
 * discusses all of these. No public dataset separates them.
 *
 * So four things are counted here and never merged: the law operating, a court
 * acquitting, somebody alleging misuse, and a court finding a specific
 * complaint false. Only the last is evidence of misuse. Merging the second
 * into the fourth is the specific error that makes most writing on this
 * subject wrong, and it is easy to make because the merged number is larger
 * and reads as more decisive.
 *
 * ── Why there is no national series on this page ─────────────────────────
 *
 * There should be one. Registrations, chargesheets, convictions and pendency
 * under this Act are collected every year by NCRB and laid before Parliament
 * by the Ministry of Social Justice under section 21(4) of the statute itself.
 * Both were probed. NCRB's year pages serve the Hindi edition as chapter PDFs
 * whose link text is mostly a file size; its per-table page answers HTTP 500;
 * India's open-data portal answers 404 without a key. The ministry's own
 * annual reports on the Act were found by listing the pages rather than
 * counting their PDFs, and reading them is the next piece of work.
 *
 * Until a number has been read out of one of those documents, this page
 * publishes none. That is the house rule — a missing figure is a gap, and a
 * gap is drawn as a gap — and it is also, on this subject, the finding: the
 * country argues about a rate that is published once a year in a PDF almost
 * nobody opens.
 */

export const metadata = {
  title: "The Atrocities Act: four things that are not the same · Bharat Tracker",
  description:
    "A cited record of the SC/ST (Prevention of Atrocities) Act, 1989, keeping apart the law "
    + "operating, a court acquitting, somebody alleging misuse, and a court finding a complaint "
    + "false — only the last of which is evidence of misuse.",
};

const TIER_TONE: Record<Facet, "hot" | "mid" | "cool"> = {
  use: "cool",
  unclassified: "cool",
  acquittal: "mid",
  allegation: "mid",
  "false-finding": "hot",
  dispute: "mid",
};

export default function AtrocitiesActPage() {
  const judgments = loadJudgments();
  const citations = loadCitations();
  const news = loadRightsNews();
  const docs = loadDocsProbe();

  const cited = citationsFor(citations, "scst");
  const press = news.items.filter((i) => i.subject === "scst");
  const tiers = facetCounts([...cited, ...press]);
  const maxTier = Math.max(1, ...tiers.map((t) => t.n));
  const falseFound = falseFindings(judgments);
  const outlets = outletsOf(citations, "scst");
  const decades = byDecade(cited);
  const cases = judgments.judgments.filter((j) => j.kind === "judgment");

  /* Did the official record answer? Read off the probe, not asserted here. */
  const found = (id: string): boolean => docs.findings.find((f) => f.id === id)?.ok === true;
  const ncrbTables = docs.findings.find((f) => f.id === "ncrb:english");
  const poa = docs.findings.find((f) => f.id === "msje:poa");

  const rows: Row[] = [
    ...cited.map((c): Row => ({
      id: c.id, headline: c.headline, outlet: c.outlet, published: c.published,
      url: c.url, facet: c.facet, matchedOn: c.matchedOn, articles: c.articles,
    })),
    ...press.map((p): Row => ({
      id: p.id, headline: p.headline, outlet: p.sources[0]?.outlet ?? null,
      published: p.sources[0]?.published ?? p.firstSeen, url: p.sources[0]?.url ?? null,
      facet: p.facet, matchedOn: "headline",
    })),
  ];

  if (!citations.present && !judgments.present) {
    return (
      <div className="pt-12">
        <Eyebrow>not built</Eyebrow>
        <Headline>The Atrocities Act record is not in this deployment.</Headline>
        <Standfirst>
          Run <span className="mono">npm run rights:citations</span> and{" "}
          <span className="mono">npm run scst:judgments</span> in CI. Every piece on this page is
          collected from a published source; none is written here.
        </Standfirst>
      </div>
    );
  }

  return (
    <article className="pt-10">
      <Eyebrow tone="hot">the scheduled castes and scheduled tribes (prevention of atrocities) act, 1989</Eyebrow>
      <Headline>
        Four things that are not the same thing
      </Headline>
      <Standfirst>
        This law is argued about through its acquittal rate. The rate is real, it is published,
        and it is offered as proof the Act is abused. <Mark>It is not proof of that.</Mark> An
        acquittal can follow from a false complaint — and equally from a hostile witness, from
        intimidation of the complainant, from an investigation that never gathered the
        caste-certificate evidence the statute requires, or from a compromise reached outside
        court. India&rsquo;s own official record discusses all of these. No public dataset
        separates them.
      </Standfirst>

      {/* ── The ladder ─────────────────────────────────────────────── */}
      <section className="mt-14">
        <ChartTitle note="Pieces of published evidence, filed by what they are evidence of.">
          The law operating, a court acquitting, somebody alleging, a court finding
        </ChartTitle>
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            {tiers.map((t) => (
              <BarRow
                key={t.facet}
                label={FACET_LABEL[t.facet]}
                value={t.n}
                max={maxTier}
                display={String(t.n)}
                tone={TIER_TONE[t.facet]}
              />
            ))}
          </div>
          <dl className="space-y-3">
            {tiers.map((t) => (
              <div key={t.facet}>
                <dt className="text-[12.5px] font-bold">{FACET_LABEL[t.facet]}</dt>
                <dd className="mt-0.5 text-[12px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>
                  {FACET_WHY[t.facet]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <Caption>
          Only the bottom tier is evidence of misuse. Merging a court acquitting into a court
          finding a complaint false is the specific error that makes most writing on this subject
          wrong, and it is easy to make because the merged number is larger and reads as more
          decisive.
        </Caption>
      </section>

      {/* ── The numbers this page will not print ───────────────────── */}
      <section className="mt-16">
        <Eyebrow tone="hot">the series that is not here</Eyebrow>
        <h2 className="story-display mt-2 text-[26px] leading-[1.15] sm:text-[32px]">
          India argues about a rate it publishes once a year in a PDF
        </h2>
        <p className="mt-3 max-w-[62ch] text-[14px] leading-[1.65]" style={{ color: "var(--story-ink-2)" }}>
          Registrations, chargesheets, convictions and pendency under this Act are collected every
          year by the National Crime Records Bureau, and laid before both Houses by the Ministry of
          Social Justice under section 21(4) of the statute itself. This page publishes none of
          those figures, because none of them has yet been read out of a primary document. Here is
          exactly what each source did when a script asked it.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            size="sm" tone="hot" value={found("ncrb:2022") ? "Hindi PDFs" : "no answer"}
            label="NCRB, crime in india"
            note="The year pages answer, and serve the Hindi edition as chapter files whose link text is mostly a file size — “[ 633.30 KB ]”. No anchor on the page identifies the SC/ST chapter."
          />
          <Stat
            size="sm" tone="hot" value={ncrbTables?.ok === true ? `${ncrbTables.kept ?? 0} files` : "HTTP 500"}
            label="NCRB, per-table downloads"
            note="The page that would give one table rather than a six-hundred-page volume."
          />
          <Stat
            size="sm" tone="hot" value="404"
            label="data.gov.in"
            note="India's open-data portal, asked for the atrocities datasets with its own published demo key. No open-data route without a real key."
          />
          <Stat
            size="sm" tone={poa?.ok === true ? "cool" : "hot"}
            value={poa?.ok === true ? `${poa.kept ?? 0} documents` : "not yet read"}
            label="the report the act requires"
            note="Section 21(4) obliges the government to report on the statute's working every year. Found by listing the ministry's pages rather than counting their PDFs. Reading it is the next piece of work."
          />
        </div>
        <Caption>
          A missing figure is drawn as a gap here, never filled in. On this subject the gap is also
          the finding: the number the country argues about is published once a year, in a document
          almost nobody opens, in a form no script can read.
        </Caption>
      </section>

      {/* ── The judgment corpus ────────────────────────────────────── */}
      <section className="mt-16">
        <ChartTitle note="Indian Kanoon, walked twelve pages at a time. A judgment is dated, citable, primary evidence.">
          What the courts said, from the court record
        </ChartTitle>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat size="sm" tone="cool" value={String(cases.length)} label="judgments collected"
            note="Each one dated, named for its parties, and one link from its full text." />
          <Stat size="sm" tone="cool" value={String(judgments.counts.withCourt)} label="naming their court" />
          <Stat size="sm" tone="hot" value={String(falseFound.length)} label="mentioning a false complaint"
            note="The narrowest thing this corpus supports, and it is deliberately not divided by anything." />
          <Stat size="sm" tone="mid" value={String(judgments.counts.statutes)} label="statute sections, kept apart"
            note="The search returns the Act's own text alongside cases. Counting those as judgments would inflate the record by the number of sections in the statute." />
        </div>

        {judgments.byCourt.length > 0 && (
          <div className="mt-8">
            <ChartTitle note="Which courts the corpus reached. A search result, not a caseload.">
              Courts in the corpus
            </ChartTitle>
            <div className="mt-3">
              <RankedRows
                rows={judgments.byCourt.slice(0, 12).map((c) => ({
                  name: c.court, value: c.n, display: String(c.n),
                }))}
                tone="cool"
              />
            </div>
            <Caption>
              This is where the search went, not where the cases are. A court absent here is not a
              court without cases under the Act.
            </Caption>
          </div>
        )}

        {falseFound.length > 0 && (
          <div className="mt-10">
            <ChartTitle note="Published beside the flag, so a reader checks rather than trusts.">
              Every judgment in the corpus whose snippet mentions a false complaint
            </ChartTitle>
            <ol className="mt-3">
              {falseFound.slice(0, 12).map((j) => (
                <li key={j.docId} className="border-b py-3 last:border-0" style={{ borderColor: "var(--story-rule)" }}>
                  <p className="text-[13.5px] font-semibold leading-[1.45]">
                    <a href={j.url} target="_blank" rel="noopener noreferrer"
                      style={{ color: "var(--story-ink)", textDecoration: "underline", textUnderlineOffset: 2 }}>
                      {j.title}
                    </a>
                  </p>
                  <p className="mt-1 text-[12px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>
                    {j.snippet}
                  </p>
                </li>
              ))}
            </ol>
            <Caption>
              A mention, not a holding. The snippet may be the court reciting an order it goes on
              to overturn, and ten words of context cannot tell the two apart — which is why the
              snippet is here and why no rate is computed from these.
            </Caption>
          </div>
        )}
      </section>

      {/* ── The cited reporting ────────────────────────────────────── */}
      <section className="mt-16">
        <ChartTitle note="Citation metadata from the reference lists of encyclopaedia articles on this subject. Outlet, headline, date, link.">
          {citations.counts.bySubject.scst} pieces of published reporting
        </ChartTitle>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Stat size="sm" tone="cool" value={String(citations.counts.byMatch.headline)}
            label="qualified on their own headline"
            note="The headline says what the piece is about." />
          <Stat size="sm" tone="mid" value={String(citations.counts.byMatch.bibliography)}
            label="qualified on the bibliography"
            note="Pieces whose own headline does not say so — “Two held in Bihar killing” — kept because they sit in the reference list of an article about a specific case. A weaker claim, counted separately." />
          <Stat size="sm" tone="cool" value={String(citations.counts.withUrl)}
            label="carry a link you can open" />
        </div>

        {outlets.length > 0 && (
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div>
              <ChartTitle note="Newsrooms in the register, by how many pieces of theirs are cited.">
                Who did the reporting
              </ChartTitle>
              <div className="mt-3">
                <RankedRows
                  rows={outlets.slice(0, 12).map((o) => ({ name: o.outlet, value: o.n, display: String(o.n) }))}
                  tone="cool"
                />
              </div>
            </div>
            <div>
              <ChartTitle note="When the cited pieces were published — a property of the register, not of the country.">
                By decade of publication
              </ChartTitle>
              <div className="mt-3">
                {decades.map((d) => (
                  <BarRow key={d.decade} label={d.decade} value={d.n}
                    max={Math.max(1, ...decades.map((x) => x.n))} display={String(d.n)} tone="mid" />
                ))}
              </div>
              <Caption>
                This is not a trend in atrocities. It is when encyclopaedia editors were writing,
                and it rises towards the present for the same reason every citation register does.
              </Caption>
            </div>
          </div>
        )}
      </section>

      {/* ── The register itself ────────────────────────────────────── */}
      <section className="mt-16">
        <ChartTitle note="Filter by what a piece is about, and by how it earned its place.">
          The register
        </ChartTitle>
        <div className="mt-4">
          <EvidenceBrowser
            rows={rows}
            facets={tiers.map((t) => t.facet)}
            facetLabel={FACET_LABEL as Record<string, string>}
            note="Each links to the piece it records. The register is what the collectors found, not everything published."
          />
        </div>
      </section>

      {/* ── The live tripwire ──────────────────────────────────────── */}
      {news.present && (
        <section className="mt-16">
          <Eyebrow>the live register, and its honest rate</Eyebrow>
          <p className="mt-2 max-w-[62ch] text-[14px] leading-[1.65]" style={{ color: "var(--story-ink-2)" }}>
            Five newsrooms answer a script with items. Their first sweep saw{" "}
            <Mark tone="mid">{news.counts.itemsSeen} pieces</Mark> and matched{" "}
            <Mark tone="mid">{news.counts.items}</Mark>. That is not a fault in the filter: an RSS
            feed carries about a day of a general national desk, and this is not a daily story. The
            feeds are a tripwire for new developments. The volume above had to come from
            bibliographies that already existed.
          </p>
          {news.feeds.length > 0 && (
            <div className="mt-5">
              <TileField
                items={news.feeds.map((f) => ({
                  name: f.outlet,
                  value: f.ok ? `${f.kept} of ${f.items}` : "no items",
                  tone: f.ok && f.kept > 0 ? "cool" : "mid",
                  meta: f.ok ? "answered" : (f.error ?? "did not answer"),
                }))}
              />
            </div>
          )}
        </section>
      )}

      <WhatThisCannotSay
        items={[
          {
            q: "How often is this Act misused?",
            a: <>This page cannot say, and neither can the acquittal rate. Only a court explicitly
              finding a specific complaint false is evidence of misuse; those are counted above and
              are rare. An acquittal is not evidence of it — it can follow from a false complaint,
              and equally from a hostile witness, from intimidation of the complainant, from an
              investigation that never gathered the caste-certificate evidence the statute
              requires, or from a compromise outside court. No public dataset separates them.</>,
          },
          {
            q: "How many cases are registered each year?",
            a: <>Not published here, because no figure has yet been read out of a primary document.
              NCRB serves the Hindi edition as chapter PDFs, its per-table page answers 500, and
              the open-data portal answers 404 without a key. The ministry&rsquo;s own annual
              report under section 21(4) has been located and not yet read.</>,
          },
          {
            q: "Is this register a sample of coverage?",
            a: <>No. It is the pieces encyclopaedia editors reached for, plus whatever five RSS
              feeds carried on the days a script ran. It skews hard towards the cases that became
              famous — Khairlanji, Una, Hathras — and away from the ordinary registrations that are
              almost all of this Act&rsquo;s use.</>,
          },
          {
            q: "Do the decade bars show atrocities rising?",
            a: <>No. They show when the cited pieces were published, which is when editors were
              writing. Every citation register rises towards the present for reasons that have
              nothing to do with its subject.</>,
          },
          {
            q: "Does a judgment flagged “acquitted” mean the court acquitted?",
            a: <>Not necessarily. The flag records that the word appeared in a search snippet, and
              the snippet may be the court reciting a trial court&rsquo;s order before overturning
              it. Every snippet is printed beside its flag for exactly this reason.</>,
          },
          {
            q: "Does a case absent from this page mean it did not happen?",
            a: <>No. Most cases were never written up anywhere, and the famous ones are famous
              partly because they were exceptional. Judgments are also the end of a filtered
              process — registration, investigation, chargesheet, trial — and every stage before
              drops cases for reasons this record cannot see.</>,
          },
        ]}
      />

      <Sources>
        Judgments: Indian Kanoon (indiankanoon.org), free judgment search, walked twelve pages a
        run with a judgments-only document filter, eight seconds between requests, accumulated
        across runs. Cited reporting: citation templates in the reference lists of English
        Wikipedia articles on this subject — outlet, headline, date and URL only; no encyclopaedia
        prose is used for anything. Live register: RSS from The Hindu, Hindustan Times, Mint, The
        Quint and Newslaundry. Source availability: probes of ncrb.gov.in, socialjustice.gov.in and
        api.data.gov.in, recorded with their status codes. Built{" "}
        {(citations.builtAt || judgments.builtAt).slice(0, 10)}. Every count on this page is a
        count of collected documents; none is an estimate, and no figure is interpolated.
      </Sources>
    </article>
  );
}
