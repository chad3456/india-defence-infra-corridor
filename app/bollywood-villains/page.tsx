import {
  loadBollywood, raw, corrected, column, pooled, pooledTitleWord, titleWordShare,
  reckoningPerEscape, tierMarkers, nullResults, filmsWith, topGenres, genreShare,
} from "@/lib/bollywood";
import {
  Eyebrow, Headline, Standfirst, Mark, Stat, Sources, WhatThisCannotSay, BarRow,
} from "@/components/stories/Kit";
import { ChartTitle, Caption, DivergingRanks } from "@/components/stories/Charts";
import GraphCard from "@/components/stories/GraphCard";
import EvidenceBrowser, { type Row } from "@/components/rights/EvidenceBrowser";

/**
 * Thirty years of Hindi film plots, and what they actually show.
 *
 * ── The finding, and why it is not the one that was expected ─────────────
 *
 * The brief this was built from assumed a rise: that Hindi cinema has been
 * glorifying criminals more and more. Measured over 2,670 films, almost every
 * marker of that goes the other way. Revenge as a plot driver falls from 22%
 * of films in the late nineties to 11% in the 2020s. Organised crime falls
 * from 23% to 11%. A crime word in the title — Don, Gangster, Daaku — falls
 * from 4.3% of films to 0.4%, a tenfold collapse.
 *
 * And the confound runs against that finding, which is what makes it worth
 * printing. Wikipedia plot summaries grew over the period, from a median of
 * 212 words to 310. More text means more room to trip any pattern, so the
 * measurement should have drifted upward on its own. It fell anyway.
 *
 * ── The one thing that did move the other way ────────────────────────────
 *
 * Endings. Films that close on a reckoning — an arrest, a sentence, a death —
 * fall from 18% to 9%. Films that close with someone who did harm still free,
 * still in power, still unaccounted for hold flat at 7%. So the ratio narrows
 * from about two and a half reckonings per escape to about one and a third.
 *
 * Hindi cinema is putting far less crime on screen than it did. When it does,
 * it is markedly less likely to end with the crime answered for. Those are
 * different claims from the one the brief made and they are the ones the data
 * carries.
 *
 * ── What this page will not say ──────────────────────────────────────────
 *
 * That any of it caused anything. There is no control group, no counterfactual
 * India, and every candidate cause over thirty years moves together. This
 * measures what was depicted and how it resolved, and stops there — which is
 * stated on the page rather than buried at the bottom of it.
 */

export const metadata = {
  title: "What Hindi films actually show, 1995–2025 · Bharat Tracker",
  description:
    "2,670 Hindi film plot summaries measured over thirty years: revenge, organised crime, and "
    + "how the stories end — with the confound that would have faked the result published first.",
};

const SPAN_A: [number, number] = [1995, 1999];
const SPAN_B: [number, number] = [2021, 2025];

export default function BollywoodPage() {
  const b = loadBollywood();

  if (!b.present || b.series.length === 0) {
    return (
      <div className="pt-12">
        <Eyebrow>not built</Eyebrow>
        <Headline>The film measures are not in this deployment.</Headline>
        <Standfirst>
          Run <span className="mono">npm run bollywood:ingest</span> in CI. Every count on this
          page is a count of plot summaries; none is an estimate.
        </Standfirst>
      </div>
    );
  }

  const p = (id: string, s: [number, number]): number => pooled(b, id, s[0], s[1]);
  const delta = (id: string): number => p(id, SPAN_B) - p(id, SPAN_A);
  const ratio = reckoningPerEscape(b);
  const ratioEarly = ratio.filter((r) => r.year <= 1999);
  const ratioLate = ratio.filter((r) => r.year >= 2021);
  const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);
  const nulls = nullResults(b);
  const genres = topGenres(b, 6);

  const wordsEarly = mean(b.series.filter((s) => s.year <= 1999).map((s) => s.medianPlotWords));
  const wordsLate = mean(b.series.filter((s) => s.year >= 2021).map((s) => s.medianPlotWords));

  /* Every marker, both spans, for the diverging chart. */
  const diverging = b.markers
    .map((m) => ({
      name: m.label, left: p(m.id, SPAN_A), right: p(m.id, SPAN_B),
      leftDisplay: `${p(m.id, SPAN_A).toFixed(1)}%`, rightDisplay: `${p(m.id, SPAN_B).toFixed(1)}%`,
      mark: Math.abs(delta(m.id)) > 5,
    }))
    .filter((r) => r.left > 0.4 || r.right > 0.4)
    .sort((x, y) => (y.left + y.right) - (x.left + x.right));

  /* The evidence list: every film carrying a marker, with the sentence. */
  const rows: Row[] = b.films
    .filter((f) => f.evidence.length > 0)
    .sort((x, y) => y.year - x.year)
    .map((f): Row => ({
      id: `${f.year}-${f.title}`,
      headline: f.title,
      outlet: `${f.year} · ${f.evidence[0]?.quote.slice(0, 130) ?? ""}`,
      published: String(f.year),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(f.title.replace(/ /g, "_"))}`,
      facet: f.evidence[0]?.marker ?? "unclassified",
    }));

  const facetLabel: Record<string, string> = Object.fromEntries(b.markers.map((m) => [m.id, m.label]));
  const facets = b.markers.filter((m) => filmsWith(b, m.id).length > 0).map((m) => m.id);

  return (
    <article className="pt-10">
      <Eyebrow tone="hot">hindi cinema · 2,670 films · 1995–2025</Eyebrow>
      <Headline>The villains left. The reckonings left with them.</Headline>
      <Standfirst>
        This began as a question about whether Hindi cinema glorifies criminals more than it used
        to. Measured across thirty years of plot summaries, <Mark>almost everything that would
        show goes the other way.</Mark> Revenge, organised crime, corrupt police, crime words in
        titles — all roughly halve or worse. One thing does move as expected, and it is about
        endings rather than about villains.
      </Standfirst>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat size="md" tone="cool"
          value={`${delta("revenge") >= 0 ? "+" : ""}${delta("revenge").toFixed(1)}pp`}
          label="revenge as a plot driver"
          note={`From ${p("revenge", SPAN_A).toFixed(1)}% of films in 1995–99 to ${p("revenge", SPAN_B).toFixed(1)}% in 2021–25.`} />
        <Stat size="md" tone="cool"
          value={`${delta("underworld") >= 0 ? "+" : ""}${delta("underworld").toFixed(1)}pp`}
          label="organised crime"
          note={`From ${p("underworld", SPAN_A).toFixed(1)}% to ${p("underworld", SPAN_B).toFixed(1)}%.`} />
        <Stat size="md" tone="cool"
          value={`${pooledTitleWord(b, SPAN_A[0], SPAN_A[1]).toFixed(1)}% → ${pooledTitleWord(b, SPAN_B[0], SPAN_B[1]).toFixed(1)}%`}
          label="a crime word in the title"
          note="Don, Gangster, Daaku, Khiladi. A tenfold collapse." />
        <Stat size="md" tone="hot"
          value={`${mean(ratioEarly.map((r) => r.value)).toFixed(1)} → ${mean(ratioLate.map((r) => r.value)).toFixed(1)}`}
          label="reckonings per escape"
          note="The one measure that moves the way the question expected. Endings that answer for the harm, against endings that do not." />
      </div>

      {/* ── The confound, before any finding ───────────────────────── */}
      <section className="mt-16">
        <Eyebrow tone="hot">read this before the charts</Eyebrow>
        <h2 className="story-display mt-2 text-[26px] leading-[1.15] sm:text-[32px]">
          The measurement that would have faked this result
        </h2>
        <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.65]" style={{ color: "var(--story-ink-2)" }}>
          Every count here comes from a plot summary, and plot summaries have got longer: a median
          of <Mark tone="mid">{wordsEarly.toFixed(0)} words</Mark> in the late nineties against{" "}
          <Mark tone="mid">{wordsLate.toFixed(0)}</Mark> in the 2020s. A longer summary has more
          room to trip any pattern, so every marker should drift upward across this period whatever
          cinema did. A chart of raw counts would have shown exactly that and been a fact about
          Wikipedia&rsquo;s editing conventions.
        </p>
        <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.65]" style={{ color: "var(--story-ink-2)" }}>
          On this dataset the confound runs <em>against</em> the finding — the markers fall despite
          there being more text to find them in — which is the strongest position a result like
          this can be in. It is still published both ways: raw share of films, and per thousand
          words of summary, side by side, for the two largest series.
        </p>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <GraphCard n={1} tone="mid" unit=" words"
            title="Median plot-summary length, by year"
            note="The control variable. Not a fact about cinema."
            points={column(b, "medianPlotWords")} format={(v) => v.toFixed(0)}
            caption={<>This is the shape every raw count below is fighting. It rises, peaks around
              2016, and falls again as recent films get shorter articles. Nothing about it is a
              property of the films.</>} />
          <GraphCard n={2} tone="cool" unit=" films"
            title="Films measured, by year"
            note="Coverage. Films with an article and a plot section."
            points={column(b, "films")} format={(v) => v.toFixed(0)}
            caption={<>{b.counts.films.toLocaleString("en-IN")} films in all. Low-budget output
              with no English article is absent from every year, and more so from the early
              ones.</>} />
        </div>
      </section>

      {/* ── The main finding ───────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow>what fell</Eyebrow>
        <h2 className="story-display mt-2 text-[26px] leading-[1.15] sm:text-[32px]">
          Crime left the screen
        </h2>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <GraphCard n={3} tone="hot" title="Revenge drives the plot" points={raw(b, "revenge")}
            note="Share of films whose summary carries revenge, vendetta or badla."
            caption={<>From {p("revenge", SPAN_A).toFixed(1)}% to {p("revenge", SPAN_B).toFixed(1)}%.
              A film can be about revenge and be against it — this is presence, the weakest of the
              three tiers.</>} />
          <GraphCard n={4} tone="hot" unit="/1k words"
            title="The same, per thousand words of summary"
            note="The corrected series. Divided by the text it searched."
            points={corrected(b, "revenge")} format={(v) => v.toFixed(2)}
            caption={<>Correcting for summary length steepens the fall rather than flattening it,
              because the text grew while the marker did not.</>} />
          <GraphCard n={5} tone="hot" title="Organised crime" points={raw(b, "underworld")}
            note="Gangs, dons, the underworld, smuggling, extortion."
            caption={<>The gangster picture was a fixture of the late nineties and is now a
              speciality. {p("underworld", SPAN_A).toFixed(1)}% to {p("underworld", SPAN_B).toFixed(1)}%.</>} />
          <GraphCard n={6} tone="hot" unit="/1k words"
            title="Organised crime, per thousand words"
            note="The corrected series."
            points={corrected(b, "underworld")} format={(v) => v.toFixed(2)}
            caption={<>Same direction, same reason.</>} />
          <GraphCard n={7} tone="hot" title="A crime word in the title" points={titleWordShare(b)}
            note="Don, Gangster, Bhai, Daaku, Dacoit, Khiladi, Shootout, Encounter. Share of films."
            caption={<>The clearest single series on the page, and the one least exposed to the
              summary-length confound — a title is a title however long the article is. It
              collapses from {pooledTitleWord(b, SPAN_A[0], SPAN_A[1]).toFixed(1)}% of films to{" "}
              {pooledTitleWord(b, SPAN_B[0], SPAN_B[1]).toFixed(1)}%.</>} />
          <GraphCard n={8} tone="hot" title="Police or state shown corrupt" points={raw(b, "police-corrupt")}
            note="A corrupt officer, a bought minister, a compromised system."
            caption={<>The angry-at-the-system picture thinned out with the gangster picture.</>} />
        </div>
      </section>

      {/* ── The endings ────────────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow tone="hot">what did not fall with it</Eyebrow>
        <h2 className="story-display mt-2 text-[26px] leading-[1.15] sm:text-[32px]">
          The reckoning went; the escape stayed
        </h2>
        <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.65]" style={{ color: "var(--story-ink-2)" }}>
          These three read the closing passage only — a quarter of the sentences, floored at two
          and capped at six. An outcome is how a story resolves; a death in the second act is a
          plot event. They also do not claim <em>whose</em> ending it is. A summary sentence
          reading &ldquo;is shot dead&rdquo; is as often the hero, his father or a bystander, and
          no pattern over English prose resolves that reliably. They record the kind of ending.
        </p>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <GraphCard n={9} tone="cool" title="Ends in a reckoning" points={raw(b, "ending-reckoning")}
            note="The closing lines describe an arrest, a sentence, a surrender or a death."
            caption={<>Halved: {p("ending-reckoning", SPAN_A).toFixed(1)}% to{" "}
              {p("ending-reckoning", SPAN_B).toFixed(1)}%.</>} />
          <GraphCard n={10} tone="hot" title="Ends with the wrongdoer still standing"
            points={raw(b, "ending-escape")}
            note="The closing lines describe an escape, an evasion or an ascent."
            caption={<>Flat across thirty years — {p("ending-escape", SPAN_A).toFixed(1)}% to{" "}
              {p("ending-escape", SPAN_B).toFixed(1)}%. This is the series that does not move while
              everything around it does.</>} />
          <GraphCard n={11} tone="hot" unit="×"
            title="Reckonings per escape" points={ratio} format={(v) => v.toFixed(1)}
            note="Films ending in an arrest, sentence, surrender or death, divided by films ending in an escape, evasion or ascent."
            caption={<><Mark>The finding.</Mark> In the late nineties a story that ended in
              something ended in an answer about two and a half times as often as it ended in an
              exit. By the 2020s that is nearer one and a third. Films show much less crime — and
              when they do, they are markedly less likely to close the account on it.</>} />
          <GraphCard n={12} tone="cool" title="Ends in reconciliation"
            points={raw(b, "ending-reconciliation")}
            note="Reform, forgiveness, reunion, or a sacrifice that settles the story."
            caption={<>The ending that grew: {p("ending-reconciliation", SPAN_A).toFixed(1)}% to{" "}
              {p("ending-reconciliation", SPAN_B).toFixed(1)}%. Whether an audience asked to
              forgive is being asked for less than one shown a punishment is a question about
              films, not a question this measures.</>} />
        </div>
      </section>

      {/* ── Framing ────────────────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow>the narrowest tier</Eyebrow>
        <h2 className="story-display mt-2 text-[26px] leading-[1.15] sm:text-[32px]">
          Where the summaries valorise
        </h2>
        <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.65]" style={{ color: "var(--story-ink-2)" }}>
          Closest to the question originally asked, and the thinnest evidence on the page. These
          require the summary to make an evaluative statement — that someone is feared, respected,
          a legend — rather than merely narrate events.
        </p>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <GraphCard n={13} tone="mid" title="Feared, respected, admired"
            points={raw(b, "feared-respected")}
            note="The summary states that others fear, respect or look up to the character."
            caption={<>No trend worth the name: {p("feared-respected", SPAN_A).toFixed(1)}% then{" "}
              {p("feared-respected", SPAN_B).toFixed(1)}%, with year-to-year noise larger than the
              change.</>} />
          <GraphCard n={14} tone="mid" title="A rise-to-power arc" points={raw(b, "rise-to-power")}
            note="Ranks climbed, an empire built, a name made."
            caption={<>Around one film in a hundred throughout, which is close enough to the noise
              floor that the shape of this line should not be read.</>} />
          <GraphCard n={15} tone="mid" title="Crime framed as justice" points={raw(b, "robin-hood")}
            note="Stealing from the rich, fighting for the poor, protecting the village."
            caption={<>Rare in every year. The Robin-Hood framing that dominates how this genre is
              discussed barely appears in how its plots are written down.</>} />
          <GraphCard n={16} tone="mid" title="Taking the law into his own hands"
            points={raw(b, "vigilante")}
            note="The summary says so in as many words."
            caption={<>Near zero throughout, which is more likely a limit of the instrument than of
              the cinema: vigilante films describe the acts and rarely name the category.</>} />
        </div>
      </section>

      {/* ── Social themes ──────────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow>the social material</Eyebrow>
        <h2 className="story-display mt-2 text-[26px] leading-[1.15] sm:text-[32px]">
          What stayed exactly where it was
        </h2>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <GraphCard n={17} tone="mid" title="Caste or communal conflict"
            points={raw(b, "caste-communal")}
            note="Caste or religious community named as the axis of the conflict."
            caption={<>{p("caste-communal", SPAN_A).toFixed(1)}% then {p("caste-communal", SPAN_B).toFixed(1)}%
              — the flattest line on the page, across a period in which almost everything else
              moved.</>} />
          <GraphCard n={18} tone="mid" title="Dowry or domestic violence"
            points={raw(b, "dowry")} note="Dowry demands, harassment, violence inside a marriage."
            caption={<>Also flat, and low. A theme that recurs in every decade without ever
              becoming common in the summaries.</>} />
          <GraphCard n={19} tone="mid" title="Family honour as a motive"
            points={raw(b, "honour")} note="Izzat, family name, honour as the reason for violence."
            caption={<>Under one per cent throughout. Named explicitly this rarely even where the
              plot turns on it.</>} />
          <GraphCard n={20} tone="mid" title="Pursuit framed as courtship"
            points={raw(b, "stalking")}
            note="Persistent pursuit of a woman who refuses, presented as romance."
            caption={<>A convention much discussed and, by this instrument, almost never written
              down: {p("stalking", SPAN_A).toFixed(1)}% then {p("stalking", SPAN_B).toFixed(1)}%.
              A plot summary records what happened, not how the camera felt about it, and this is
              the clearest case on the page of a real thing a text measure cannot see.</>} />
        </div>
      </section>

      {/* ── Everything at once ─────────────────────────────────────── */}
      <section className="mt-16">
        <ChartTitle note="Every marker that fires on more than one film in 250, pooled across each span.">
          Graph 21 · The whole instrument, then and now
        </ChartTitle>
        <div className="mt-4">
          <DivergingRanks rows={diverging} leftLabel="1995–99" rightLabel="2021–25"
            leftTone="hot" rightTone="cool" />
        </div>
        <Caption>
          Both sides share one scale. Of {b.markers.length} markers, {diverging.length} fire often
          enough to draw; the rest are listed below rather than shown as flat lines, because a flat
          line implies a measured zero and some of these are a pattern that does not work.
        </Caption>
      </section>

      {/* ── Genre mix ──────────────────────────────────────────────── */}
      {genres.length > 0 && (
        <section className="mt-16">
          <ChartTitle note="Share of films carrying each genre in the infobox, pooled across each span.">
            Graph 22 · What the films are called, then and now
          </ChartTitle>
          <div className="mt-4">
            {genres.map((g) => {
              const s = genreShare(b, g);
              const early = mean(s.filter((x) => x.year <= 1999).map((x) => x.value));
              const late = mean(s.filter((x) => x.year >= 2021).map((x) => x.value));
              return (
                <BarRow key={g} label={g} value={late} max={Math.max(1, ...genres.map((gg) => {
                  const ss = genreShare(b, gg);
                  return Math.max(
                    mean(ss.filter((x) => x.year <= 1999).map((x) => x.value)),
                    mean(ss.filter((x) => x.year >= 2021).map((x) => x.value)),
                  );
                }))} display={`${late.toFixed(0)}%`} tone="cool"
                  sub={`${early.toFixed(0)}% in 1995–99`} />
              );
            })}
          </div>
          <Caption>
            Genre comes from the infobox, which many articles leave empty, so these are shares of
            films that declare one rather than of all films.
          </Caption>
        </section>
      )}

      {/* ── The null results ───────────────────────────────────────── */}
      {nulls.length > 0 && (
        <section className="mt-16">
          <Eyebrow tone="hot">what the instrument could not find</Eyebrow>
          <h2 className="story-display mt-2 text-[24px] leading-[1.15] sm:text-[28px]">
            {nulls.length} markers found almost nothing, and that is two different things
          </h2>
          <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.65]" style={{ color: "var(--story-ink-2)" }}>
            A pattern that finds nothing is either a real absence in the corpus or a pattern that
            does not work, and this page often cannot tell which. They are named here rather than
            drawn as flat lines, because a flat line at zero reads as a measured finding.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {nulls.map((m) => (
              <div key={m.id} className="story-card p-4">
                <p className="text-[13px] font-bold">{m.label}</p>
                <p className="mt-1 text-[12px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>
                  {m.note}
                </p>
                <p className="mono mt-2 break-all text-[9.5px]" style={{ color: "var(--story-ink-3)" }}>
                  {m.pattern.slice(0, 120)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Evidence ───────────────────────────────────────────────── */}
      <section className="mt-16">
        <ChartTitle note="Every film carrying a marker, with the sentence that matched it. Filter by marker.">
          The evidence
        </ChartTitle>
        <div className="mt-4">
          <EvidenceBrowser rows={rows} facets={facets} facetLabel={facetLabel}
            note="Each row links to the article the summary came from. The line under the title is the sentence that tripped the marker." />
        </div>
      </section>

      <WhatThisCannotSay
        items={[
          {
            q: "Do these films cause harm?",
            a: <>Nothing here can answer that, and no dataset of films can. There is no control
              group, no counterfactual India, and every candidate cause over thirty years moves
              together. This measures what was depicted and how it resolved.</>,
          },
          {
            q: "Is a falling line good news about cinema?",
            a: <>It is news about plot summaries. Less crime in the summaries is a real change in
              what stories get told; whether that is better is not a measurement.</>,
          },
          {
            q: "Does the instrument see how a film feels about its villain?",
            a: <>Barely. A summary records what happened, not the camera, the score, the star
              persona or the irony. A film depicting a gangster to condemn him reads here exactly
              like one depicting him to thrill. The framing tier is the nearest approach and it is
              the thinnest evidence on the page.</>,
          },
          {
            q: "Why is the stalking line almost flat at zero?",
            a: <>Because plot summaries describe events rather than naming conventions. That is a
              limit of the measure, not evidence the convention is absent, and it is the clearest
              example on this page of something real that a text measure cannot see.</>,
          },
          {
            q: "Are these all the Hindi films?",
            a: <>No. {b.counts.films.toLocaleString("en-IN")} of them — those with an English
              Wikipedia article carrying a plot section. Low-budget output is under-represented in
              every year and more so in the early ones.</>,
          },
          {
            q: "Could the fall just be shorter summaries?",
            a: <>No — summaries got <em>longer</em> over the period, from a median of{" "}
              {wordsEarly.toFixed(0)} words to {wordsLate.toFixed(0)}. The confound pushes every
              marker up, and they fell anyway. Both the raw and the length-corrected series are
              published for the two largest markers.</>,
          },
        ]}
      />

      <Sources>
        English Wikipedia: the year list for each year from {b.series[0]?.year} to{" "}
        {b.series[b.series.length - 1]?.year}, then the plot section of every linked film article
        carrying one — {b.counts.films.toLocaleString("en-IN")} films,{" "}
        {(b.counts.totalPlotWords / 1000).toFixed(0)}k words of summary. Each marker is a regular
        expression, published with its pattern, and every count carries the sentence it matched.
        Outcome markers are scored over the closing passage only. The marker set is fingerprinted
        (<span className="mono">{b.instrument}</span>); when it changes, every film is measured
        again, so the corpus is never scored by two instruments at once. Built{" "}
        {b.builtAt.slice(0, 10)}. No figure here is an estimate and none is interpolated.
      </Sources>
    </article>
  );
}
