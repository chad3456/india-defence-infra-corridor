import { loadSindoor, type Claimant } from "@/lib/warroom";
import { CLAIMANT_LABEL } from "@/lib/warroom-shared";
import {
  Eyebrow, Headline, Standfirst, Mark, Stat, Sources, WhatThisCannotSay, Columns,
} from "@/components/stories/Kit";
import { ChartTitle, Caption, RankedRows } from "@/components/stories/Charts";
import Timeline from "@/components/sindoor/Timeline";

/**
 * Operation Sindoor, as a record of what was said about it.
 *
 * ── The distinction this whole page turns on ─────────────────────────────
 *
 * There is no neutral account of this operation. India and Pakistan published
 * incompatible versions — of what was struck, of what was lost, of who stopped
 * first — and both are interested parties. A page that resolved those into one
 * sequence would be inventing the resolution, and would read as more
 * authoritative precisely because it had.
 *
 * So what is drawn here is a timeline of STATEMENTS, each carrying whoever
 * made it and the outlet that reported it. The two national accounts are
 * filterable side by side and never merged. No casualty figure, no
 * aircraft-loss count and no judgement about who prevailed appears anywhere,
 * because those are exactly where the accounts diverge.
 *
 * ── The number that has to be at the top ─────────────────────────────────
 *
 * Three quarters of the extracted statements name no source inside the
 * sentence. That is normal for encyclopedia prose — the citation sits in a
 * footnote rather than in the text — and it means most of what a reader sees
 * here reads as settled fact while being, strictly, a sentence whose origin is
 * one link away. Putting that in a footnote would repeat the exact error the
 * page is about.
 */

export const metadata = {
  title: "Operation Sindoor: a timeline of what was said · Bharat Tracker",
  description:
    "A dated, cited record of statements about Operation Sindoor and the Pahalgam attack, with "
    + "the Indian and Pakistani accounts kept apart rather than merged into one sequence.",
};

const ORDER: Claimant[] = ["India", "Pakistan", "third-party", "unattributed"];

export default function SindoorPage() {
  const s = loadSindoor();

  if (!s.present) {
    return (
      <div className="pt-12">
        <Eyebrow>not built</Eyebrow>
        <Headline>The Sindoor record is not in this deployment.</Headline>
        <Standfirst>
          Run <span className="mono">npm run sindoor:build</span> in CI. Every statement on this
          page is extracted from a cited article; none is written here.
        </Standfirst>
      </div>
    );
  }

  const c = s.counts;
  const citedShare = c.entries > 0 ? (c.withCitation / c.entries) * 100 : 0;
  const unattributedShare = c.entries > 0 ? (c.byClaimant.unattributed / c.entries) * 100 : 0;

  /*
   * The 2025 window, taken from the data rather than typed in.
   *
   * 233 of 252 statements fall in one year and cluster into about three weeks.
   * Naming those dates here would be me supplying the operation's timing from
   * memory; deriving them from the record means the page shows what the
   * sources concentrate on and would move if they moved.
   */
  const byYear = new Map<string, number>();
  for (const d of s.days) {
    const y = d.date.slice(0, 4);
    byYear.set(y, (byYear.get(y) ?? 0) + d.n);
  }
  const peakYear = [...byYear].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const peakDays = s.days.filter((d) => d.date.startsWith(peakYear));
  const busiest = [...s.days].sort((a, b) => b.n - a.n).slice(0, 8);

  const outlets = new Map<string, number>();
  for (const e of s.entries) {
    for (const cite of e.citations) {
      const p = cite.publisher ?? cite.title;
      if (p) outlets.set(p, (outlets.get(p) ?? 0) + 1);
    }
  }

  return (
    <div>
      <header className="pt-10">
        <Eyebrow tone="hot">
          operation sindoor · {c.entries} statements · {c.days} days · {Math.round(citedShare)}% cited
        </Eyebrow>
        <h1 className="story-display mt-4 max-w-[18ch] text-[36px] sm:text-[50px] lg:text-[58px]">
          Two Accounts That Do Not Meet.
        </h1>
        <Standfirst>
          India and Pakistan published incompatible versions of this operation — of what was
          struck, of what was lost, of who stopped first — and both are interested parties. So
          this is not a timeline of what happened. It is{" "}
          <Mark>{c.entries} dated statements</Mark> about it, each carrying whoever made it and
          the outlet that reported it, with the two national accounts kept apart rather than
          resolved into one sequence.
        </Standfirst>
        <p className="mt-5 max-w-[68ch] rounded-lg border p-4 text-[13px] leading-[1.6]"
          style={{ borderColor: "var(--s-hot)", color: "var(--story-ink-2)" }}>
          <strong style={{ color: "var(--story-ink)" }}>
            {Math.round(unattributedShare)}% of these statements name no source inside the sentence.
          </strong>{" "}
          That is ordinary for encyclopedia prose — the citation sits in a footnote rather than in
          the text — and it means most of what follows reads as settled fact while being a
          sentence whose origin is one link away. Those are filtered separately below and marked on
          every card. Where a sentence does name a source, it is tagged with that source and not
          with the country it happens to mention: &ldquo;India said it struck nine sites&rdquo; is
          an Indian claim; &ldquo;India struck nine sites&rdquo; is an assertion by the article.
        </p>
      </header>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat size="md" tone="mid" label="dated statements" value={String(c.entries)}
          note={<>Across {c.days} days, extracted from two articles. {c.duplicatesDropped} were
            duplicates and were dropped.</>} />
        <Stat size="md" tone="cool" label="carry their own citation" value={`${Math.round(citedShare)}%`}
          note={<>{c.withCitation} of {c.entries} statements have a reference inside the sentence
            itself, linking to the outlet that carried it.</>} />
        <Stat size="md" tone="hot" label="name no source" value={String(c.byClaimant.unattributed)}
          note={<>Sentences that assert rather than attribute. They read as fact and are not
            credited to any party here.</>} />
        <Stat size="md" tone="mid" label="explicitly reported speech" value={String(c.reported)}
          note={<>Sentences carrying said, claimed, denied, according to. The rest assert.</>} />
      </section>

      {/* ── Who is speaking ───────────────────────────────────────────── */}
      <section className="mt-14">
        <Eyebrow tone="hot">who is speaking</Eyebrow>
        <Headline>The Record Is Mostly Unattributed.</Headline>
        <Standfirst>
          Every statement is tagged with the source the sentence names, or with nobody when it
          names none. A sentence carrying both accounts at once — &ldquo;India said X, Pakistan
          denied it&rdquo; — belongs to neither and is counted as a third party.
        </Standfirst>
        <div className="story-card mt-7 p-5 sm:p-6">
          <ChartTitle note="Statements by the source the sentence names.">
            Attribution of the record
          </ChartTitle>
          <RankedRows
            tone="mid"
            showRank={false}
            rows={ORDER.map((k) => ({
              name: CLAIMANT_LABEL[k],
              value: c.byClaimant[k],
              display: String(c.byClaimant[k]),
              mark: k === "unattributed",
            }))}
          />
          <Caption>
            The marked row is the one to be most careful with. Those sentences assert without
            naming who is asserting, and crediting them to the country they mention would
            manufacture an attribution the article never made.
          </Caption>
        </div>
      </section>

      {/* ── When ──────────────────────────────────────────────────────── */}
      {peakDays.length > 0 && (
        <section className="mt-14">
          <Eyebrow tone="mid">when</Eyebrow>
          <Headline>Where the Record Concentrates.</Headline>
          <Standfirst>
            {byYear.get(peakYear)} of {c.entries} statements fall in {peakYear}, and within it a
            few days carry most of them. The rest are background the articles reach back for.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-6">
            <ChartTitle note={`Statements recorded per day in ${peakYear}.`}>
              Statements per day
            </ChartTitle>
            <Columns
              tone="hot"
              height={150}
              points={peakDays.map((d) => ({ label: d.date.slice(5), value: d.n }))}
              format={(v) => String(Math.round(v))}
            />
            <Caption>
              Height is how many statements the record holds for that day — how much was written,
              not how much happened. A day of heavy reporting and a day of heavy fighting look
              identical here, and only one of those is what the chart measures.
            </Caption>
          </div>
          <div className="story-card mt-5 p-5 sm:p-6">
            <ChartTitle note="The days the record returns to most.">Busiest days</ChartTitle>
            <RankedRows
              tone="hot"
              rows={busiest.map((d) => ({ name: d.date, value: d.n, display: String(d.n) }))}
            />
          </div>
        </section>
      )}

      {/* ── The timeline itself ───────────────────────────────────────── */}
      <section className="mt-14">
        <Eyebrow tone="hot">the record</Eyebrow>
        <Headline>Every Statement, With Its Source.</Headline>
        <Standfirst>
          Filter by who is speaking, then pick a day. Each card carries the sentence as published,
          the source the sentence names, the section it came from, and links to the outlets cited
          inside it.
        </Standfirst>
        <div className="story-card mt-7 p-5 sm:p-6">
          <Timeline entries={s.entries} />
        </div>
      </section>

      {/* ── Who reported it ───────────────────────────────────────────── */}
      {outlets.size > 0 && (
        <section className="mt-14">
          <Eyebrow tone="cool">who reported it</Eyebrow>
          <Headline>The Outlets Behind the Record.</Headline>
          <div className="story-card mt-7 p-5 sm:p-6">
            <ChartTitle note="Citations inside the extracted sentences, by publisher.">
              Most-cited publishers
            </ChartTitle>
            <RankedRows
              tone="cool"
              rows={[...outlets].sort((a, b) => b[1] - a[1]).slice(0, 15)
                .map(([name, n]) => ({ name, value: n, display: String(n) }))}
            />
            <Caption>
              A count of citations, not of reliability. An outlet appearing often may be one the
              article&rsquo;s editors reached for repeatedly rather than one that reported most.
            </Caption>
          </div>
        </section>
      )}

      <WhatThisCannotSay
        items={[
          {
            q: "What actually happened",
            a: <>Nothing here adjudicates between the two accounts. Every entry is a statement
              someone made, carried with the name of whoever made it, and where the article
              asserts without attributing, the page says so rather than picking a side.</>,
          },
          {
            q: "How many aircraft or people were lost",
            a: <>No casualty total and no loss figure is computed on this page. Those are
              belligerent claims rather than measurements, and they are exactly where the two
              accounts diverge most. Where a sentence carries such a figure it stays inside the
              sentence, attributed, and is never lifted into a number this site publishes.</>,
          },
          {
            q: "Whether the record is complete",
            a: <>It is a reconstruction from two encyclopedia articles and the outlets they cite.
              Only sentences carrying a day and a month are extracted, so anything the articles
              describe without dating is absent. {c.yearInferred} entries have a year carried
              forward from an earlier sentence rather than stated in their own, and each says so.</>,
          },
          {
            q: "Anything about the sources' own leanings",
            a: <>The citation list is a count of what the articles reached for, which reflects
              their editors&rsquo; habits as much as the reporting. English-language and
              international outlets are over-represented in any such list by construction.</>,
          },
        ]}
      />

      <Sources>
        Extracted from English Wikipedia&rsquo;s &ldquo;Operation Sindoor&rdquo; and
        &ldquo;Pahalgam attack&rdquo; articles, read as prose and split into sentences, with the
        citations taken from each sentence&rsquo;s own reference tags. A probe measured 476
        references and 320 news citations on the first of those before the connector was written.
        &ldquo;2025 India–Pakistan conflict&rdquo; is the same article under a second title and is
        deliberately not read twice. Built {s.builtAt.slice(0, 16).replace("T", " ")} UTC.
      </Sources>
    </div>
  );
}
