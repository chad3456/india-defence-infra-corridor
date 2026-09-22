import {
  loadSearch, loadCitations, loadRightsNews, loadPmShriProbe,
  citationsFor, facetCounts, outletsOf, statesNamed, byYear,
  FACET_LABEL, FACET_WHY, type Facet,
} from "@/lib/rights";
import {
  Eyebrow, Headline, Standfirst, Mark, Stat, Sources, WhatThisCannotSay, BarRow, Columns,
} from "@/components/stories/Kit";
import { ChartTitle, Caption, RankedRows } from "@/components/stories/Charts";
import EvidenceBrowser, { type Row } from "@/components/rights/EvidenceBrowser";

/**
 * PM SHRI, which does not publish a number.
 *
 * ── What this page found before it found anything else ───────────────────
 *
 * The scheme upgrades schools under the National Education Policy, and states
 * must sign a memorandum to take part. How many schools have been sanctioned,
 * to which states, and how much money has been released are therefore the
 * three figures that would settle most of what is argued about it.
 *
 * None of them can be read. Four rounds of probing established it:
 *
 *   — The scheme's own portal returns the same 1,238 bytes for its front page
 *     and for two data paths that do not exist. It renders its counts in the
 *     browser, so a script gets a shell. A probe looking only for the words
 *     "PM SHRI" and "school" would have called it a working source: they are
 *     both in those 1,238 bytes.
 *   — The Ministry of Education's page for the scheme, and its documents
 *     listing, are six-kilobyte JavaScript shells.
 *   — Parliament's question API answers 404.
 *   — Two PIB releases came back carrying no occurrence of the scheme's name.
 *   — India's open-data portal answers 404 without a key.
 *
 * So this page publishes no school count and no funding figure, because none
 * has been read out of a primary document. That is the house rule. It is also,
 * here, the story: a national scheme whose central facts are rendered in a
 * browser and nowhere else.
 *
 * ── What it is built on instead ──────────────────────────────────────────
 *
 * Coverage, searched rather than waited for. The scheme has no encyclopaedia
 * article — the bibliography harvest that found 507 pieces on the SC/ST Act
 * found three on this — and the five newsrooms that answer a script carry
 * about a day of a general desk each. Querying two news indexes one theme at a
 * time reached 271 pieces, which is a record of what was reported and is not a
 * substitute for the numbers above.
 */

export const metadata = {
  title: "PM SHRI: a scheme that renders its numbers in a browser · Bharat Tracker",
  description:
    "A cited record of the PM SHRI schools scheme — what states said about signing its "
    + "memorandum, and why no school count or funding figure appears on this page.",
};

const TIER_TONE: Record<Facet, "hot" | "mid" | "cool"> = {
  use: "cool", unclassified: "cool", acquittal: "mid",
  allegation: "mid", "false-finding": "hot", dispute: "hot",
};

export default function PmShriPage() {
  const search = loadSearch();
  const citations = loadCitations();
  const news = loadRightsNews();
  const probe = loadPmShriProbe();

  const searched = search.items.filter((i) => i.subject === "pmshri");
  const cited = citationsFor(citations, "pmshri");
  const press = news.items.filter((i) => i.subject === "pmshri");

  const tiers = facetCounts([...searched, ...cited, ...press]);
  const maxTier = Math.max(1, ...tiers.map((t) => t.n));
  const outlets = outletsOf("pmshri", searched, cited,
    press.map((p) => ({ subject: p.subject, outlet: p.sources[0]?.outlet ?? null })));
  const disputes = searched.filter((i) => i.facet === "dispute");
  const states = statesNamed(searched.map((i) => i.headline)).slice(0, 12);
  const years = byYear([...searched, ...cited]);

  /* Read off the probe, never asserted here. */
  const f = (id: string) => probe.findings.find((x) => x.id === id);
  const portal = f("portal:root");
  const portalStats = f("portal:stats");
  const moe = f("moe:schemes");
  const sansad = f("sansad:search");

  const rows: Row[] = [
    ...searched.map((i): Row => ({
      id: `s:${i.id}`, headline: i.headline, outlet: i.outlet,
      published: i.published, url: i.url, facet: i.facet, matchedOn: "headline",
    })),
    ...cited.map((c): Row => ({
      id: `c:${c.id}`, headline: c.headline, outlet: c.outlet,
      published: c.published, url: c.url, facet: c.facet, matchedOn: c.matchedOn,
    })),
  ];

  if (!search.present && !citations.present) {
    return (
      <div className="pt-12">
        <Eyebrow>not built</Eyebrow>
        <Headline>The PM SHRI record is not in this deployment.</Headline>
        <Standfirst>
          Run <span className="mono">npm run rights:search</span> in CI. Every piece on this page
          is collected from a published source; none is written here.
        </Standfirst>
      </div>
    );
  }

  return (
    <article className="pt-10">
      <Eyebrow tone="hot">pm shri — pradhan mantri schools for rising india</Eyebrow>
      <Headline>A national scheme that renders its numbers in a browser</Headline>
      <Standfirst>
        How many schools have been sanctioned, to which states, and how much money has been
        released would settle most of what is argued about this scheme.{" "}
        <Mark>None of the three can be read by a script.</Mark> The scheme&rsquo;s own portal
        returns the same 1,238 bytes for its front page and for two data paths that do not exist.
        The ministry&rsquo;s pages are six-kilobyte JavaScript shells. Parliament&rsquo;s question
        API answers 404. So this page publishes no school count and no funding figure — and that
        absence is the first thing it has to report.
      </Standfirst>

      {/* ── The absence, drawn ─────────────────────────────────────── */}
      <section className="mt-14">
        <ChartTitle note="Every official route asked, and what it returned. Each target named the figure it was after, so a 200 without that figure is a failure to answer.">
          What the scheme publishes about itself
        </ChartTitle>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat size="sm" tone="hot"
            value={portal?.bytes ? `${portal.bytes} bytes` : "a shell"}
            label="the scheme's own portal"
            note="The same response for the front page and for two data paths that do not exist. It contains the words “PM SHRI” and “school” and no counts at all — which is exactly why a probe has to name the figure it wants." />
          <Stat size="sm" tone="hot"
            value={portalStats?.bytes === portal?.bytes ? "identical" : "differs"}
            label="its data call"
            note="A path invented for the probe returned the same bytes as the front page. A soft 404: the server answers 200 for everything." />
          <Stat size="sm" tone="hot"
            value={moe?.shape === "js-app" ? "js shell" : (moe?.status ?? "no answer")}
            label="the ministry's scheme page"
            note="Six kilobytes of JavaScript. The word “scheme” does not appear in what a script receives." />
          <Stat size="sm" tone="hot"
            value={sansad?.ok === false ? (sansad.status ?? "404") : "answered"}
            label="parliament's question api"
            note="A minister answering state-wise on a dated day would be the best source that could exist for this scheme." />
        </div>
        <Caption>
          A missing figure is drawn as a gap here and never filled in. The scheme may well be
          working exactly as announced; this says only that a reader cannot check, and that
          checking is supposed to be possible.
        </Caption>
      </section>

      {/* ── The argument the coverage is actually about ────────────── */}
      <section className="mt-16">
        <ChartTitle note="Pieces of published reporting, filed by what they are about.">
          What the reporting is about
        </ChartTitle>
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            {tiers.map((t) => (
              <BarRow key={t.facet} label={FACET_LABEL[t.facet]} value={t.n} max={maxTier}
                display={String(t.n)} tone={TIER_TONE[t.facet]} />
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
          These counts are per query. Each theme was asked for by name, so the number of pieces in
          a tier reflects that it was asked for — not how common it is.
        </Caption>
      </section>

      {/* ── The states ─────────────────────────────────────────────── */}
      {states.length > 0 && (
        <section className="mt-16">
          <ChartTitle note="How often each state is named in the headlines collected.">
            Where the argument is
          </ChartTitle>
          <div className="mt-4">
            <RankedRows
              rows={states.map((s) => ({ name: s.state, value: s.n, display: String(s.n) }))}
              tone="mid"
            />
          </div>
          <Caption>
            <Mark tone="hot">This counts headlines, not positions.</Mark> A state high on this list
            has been written about often. It has not refused anything this many times, and a state
            absent from the list has not agreed to anything. The distinction matters more here than
            usual, because the argument is precisely about which states signed.
          </Caption>
        </section>
      )}

      {/* ── The dispute, in its own words ──────────────────────────── */}
      {disputes.length > 0 && (
        <section className="mt-16">
          <ChartTitle note="Every collected piece filed as a dispute over the memorandum or the money, newest first.">
            {disputes.length} pieces on signing, refusing, and the money
          </ChartTitle>
          <ol className="mt-3">
            {disputes.slice(0, 16).map((d) => (
              <li key={d.id} className="border-b py-2.5 last:border-0" style={{ borderColor: "var(--story-rule)" }}>
                <p className="text-[13.5px] font-semibold leading-[1.45]">
                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noopener noreferrer"
                      style={{ color: "var(--story-ink)", textDecoration: "underline", textUnderlineOffset: 2 }}>
                      {d.headline}
                    </a>
                  ) : d.headline}
                </p>
                <p className="mono mt-1 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>
                  {[d.outlet, d.published].filter(Boolean).join("  ·  ")}
                </p>
              </li>
            ))}
          </ol>
          <Caption>
            Headlines as published, with their outlet and date. No testimony is quoted anywhere on
            this page that was not printed by a named outlet first, and none is paraphrased into
            something it did not say.
          </Caption>
        </section>
      )}

      {/* ── Who reported it, and when the register found it ─────────── */}
      <section className="mt-16 grid gap-8 lg:grid-cols-2">
        <div>
          <ChartTitle note="Newsrooms in the register, by pieces collected.">
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
          <ChartTitle note="When the collected pieces were published.">
            By year of publication
          </ChartTitle>
          <div className="mt-3">
            <Columns points={years.map((y) => ({ label: y.year, value: y.n }))} tone="mid" height={130} />
          </div>
          <Caption>
            <Mark tone="hot">This is the shape of a search index, not of a scheme.</Mark> Both
            indexes rank recent material higher and carry more of it, so every register built this
            way rises towards the present whatever its subject was doing. It is drawn because
            hiding it would be worse, and labelled because reading it as coverage growth would be
            wrong.
          </Caption>
        </div>
      </section>

      {/* ── The register ───────────────────────────────────────────── */}
      <section className="mt-16">
        <ChartTitle note="Every collected piece, filterable.">The register</ChartTitle>
        <div className="mt-4">
          <EvidenceBrowser
            rows={rows}
            facets={tiers.map((t) => t.facet)}
            facetLabel={FACET_LABEL as Record<string, string>}
            note="Each links to the piece it records. The register is what the collectors found, not everything published."
          />
        </div>
      </section>

      <WhatThisCannotSay
        items={[
          {
            q: "How many PM SHRI schools are there?",
            a: <>This page cannot say. The scheme&rsquo;s portal renders its counts in the browser
              and returns the same 1,238 bytes to a script for its front page and for data paths
              that do not exist; the ministry&rsquo;s pages are JavaScript shells;
              Parliament&rsquo;s question API answers 404. No figure is printed until one has been
              read out of a primary document.</>,
          },
          {
            q: "How much money has been released, and to whom?",
            a: <>Also not published here, for the same reason. Several collected pieces report
              figures; a press report of a number is not the number, and this project does not
              promote one into a series.</>,
          },
          {
            q: "Does the state ranking show which states refused?",
            a: <>No. It counts how often a state is named in a collected headline. A state high on
              it has been written about often — it has not refused anything that many times, and a
              state absent from it has not agreed to anything.</>,
          },
          {
            q: "Does the rise to 2026 mean coverage grew?",
            a: <>No. Both news indexes rank recent material higher and carry more of it. Every
              register built by searching them rises towards the present whatever its subject was
              doing.</>,
          },
          {
            q: "Is this register a sample of coverage?",
            a: <>No. It is what two search indexes returned for twenty queries asked one theme at a
              time, plus three citations from encyclopaedia reference lists. A search index returns
              what it ranks, from the outlets it carries, for the words it was given.</>,
          },
          {
            q: "Is the scheme failing?",
            a: <>Nothing here supports that, and nothing here refutes it. What is established is
              narrower and worth saying plainly: the figures that would let anyone judge are not
              published in a form anyone can check.</>,
          },
        ]}
      />

      <Sources>
        Coverage: Google News and Bing News keyless RSS, {search.counts.queriesAsked} queries asked
        one theme at a time, three seconds apart, merged across runs; a searched item links through the index that found it, and carries the outlet the index names; every item classified from
        its own headline, and {search.counts.offSubjectDropped} items whose headline was off
        subject dropped and counted. Citations: reference lists of English Wikipedia articles on
        Indian education policy — {cited.length} pieces, against 507 for the SC/ST Act, because
        this scheme has no article of its own. Source availability: probes of
        pmshrischools.education.gov.in, education.gov.in, pib.gov.in, sansad.in and api.data.gov.in,
        recorded with their status codes and response sizes. Built{" "}
        {(search.builtAt || citations.builtAt).slice(0, 10)}. No school count, funding figure or
        estimate appears anywhere on this page.
      </Sources>
    </article>
  );
}
