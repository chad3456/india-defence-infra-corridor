import Link from "next/link";
import { loadRegistry, fmt } from "@/lib/owid";
import { selectPanels, tally, changeLabel, type Panel } from "@/lib/growth-panels";
import {
  Eyebrow, Headline, Standfirst, Mark, Stat, Sources,
} from "@/components/stories/Kit";
import { Caption, Sparkline, RankedRows } from "@/components/stories/Charts";

/**
 * A hundred indicators, chosen by coverage and shown whichever way they point.
 *
 * ── Why this page is not a hundred good-news charts ──────────────────────
 *
 * The obvious build is: find the hundred indicators that rose most, draw them,
 * call it growth. That is a finding about the sort rather than about India —
 * every country has a hundred rising indicators — and it would be a brochure
 * with citations.
 *
 * The selector here is blind to direction. It ranks on how much data exists
 * for India (series length, recency, comparator coverage), caps any single
 * subject so health or economics cannot take over, and draws whatever comes
 * out. The rising/falling mix is therefore a result the page can report rather
 * than a choice it made.
 *
 * ── The judgement the page refuses ───────────────────────────────────────
 *
 * Rising is not improving. Emissions per head and literacy both rising are not
 * the same kind of fact, and OWID's metadata carries no reliable direction
 * flag. So nothing here is labelled good or bad: panels say rose and fell, the
 * page says in its own words that it does not know which way is desirable for
 * each indicator, and the reader supplies what the data cannot.
 *
 * That refusal is the whole difference between a hundred charts and a hundred
 * claims.
 */

export const metadata = {
  title: "A hundred indicators, whichever way they point · Bharat Tracker",
  description:
    "India across a hundred Our World in Data indicators, selected by data coverage rather than " +
    "by direction — so the mix of rising and falling is a result, not an edit.",
};

function PanelCard({ p }: { p: Panel }) {
  const tone = p.direction === "rose" ? "cool" : p.direction === "fell" ? "hot" : "mid";
  return (
    <li className="story-card min-w-0 p-4" data-tone={tone}>
      <Link href={`/world?i=${encodeURIComponent(p.indicator.slug)}`} className="block">
        <p className="mono text-[9.5px] uppercase tracking-[0.1em]" style={{ color: "var(--story-ink-3)" }}>
          {p.indicator.category}
        </p>
        <h3 className="mt-1.5 text-[13px] font-bold leading-[1.3]">{p.indicator.title}</h3>
        {/*
          When a chart carries several measures, its title names the comparison
          and not the column this figure came from. "Age dependency breakdown"
          shipped over the old-age dependency ratio alone; "Access to
          electricity in urban vs. rural areas" shipped over the urban figure.
          Both read as complete labels and neither was one.

          Naming the column is better than dropping the indicator, which would
          throw away a real series, and better than relabelling it with
          something invented. OWID's own column names are long and occasionally
          carry an SDG code, which is a fair price for the card saying which of
          a chart's measures it is showing.
        */}
        {(p.indicator.columnCount ?? 1) > 1 && (
          <p className="mt-1 text-[10px] leading-[1.35]" style={{ color: "var(--story-ink-2)" }}>
            one of {p.indicator.columnCount} measures on this chart:{" "}
            <span className="mono">{p.indicator.column}</span>
          </p>
        )}
        <p className="mono mt-1 truncate text-[10px]" style={{ color: "var(--story-ink-3)" }}>
          {p.indicator.shortUnit || p.indicator.unit || "no unit stated"}
        </p>

        <div className="mt-3 flex items-end justify-between gap-2">
          <span>
            <span className="story-display block text-[22px]">{fmt(p.last.value)}</span>
            <span className="mono block text-[10px]" style={{ color: "var(--story-ink-3)" }}>
              {p.last.year}
            </span>
          </span>
          <Sparkline points={p.india} tone={tone} width={110} height={34} />
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t pt-2.5"
          style={{ borderColor: "var(--story-rule)" }}>
          <span className="text-[12px] font-bold" style={{ color: `var(--s-${tone})` }}>
            {changeLabel(p)}
          </span>
          <span className="mono text-[10px]" style={{ color: "var(--story-ink-3)" }}>
            since {p.first.year}
          </span>
          {p.rank > 0 && (
            <span className="mono text-[10px]" style={{ color: "var(--story-ink-3)" }}>
              · {p.rank} of {p.of} comparators
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

export default function GrowthHundred() {
  const reg = loadRegistry();

  if (!reg.present) {
    return (
      <div className="pt-12">
        <Eyebrow>not built</Eyebrow>
        <Headline>The indicator registry is not in this deployment.</Headline>
        <Standfirst>
          Run <span className="mono">npm run owid:build</span> in CI. Every panel here is computed
          from that registry; none is written by hand, so without it there is nothing to show.
        </Standfirst>
      </div>
    );
  }

  const { panels, rejected } = selectPanels(reg, { limit: 100 });
  const t = tally(panels);
  const excluded = rejected.projection + rejected.twoVariable + rejected.duplicateMeasure;

  const biggestRises = [...panels]
    .filter((p) => p.changePct !== null && p.direction === "rose")
    .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
    .slice(0, 8);
  const biggestFalls = [...panels]
    .filter((p) => p.changePct !== null && p.direction === "fell")
    .sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0))
    .slice(0, 8);

  return (
    <div>
      <header className="pt-10">
        <Eyebrow tone="mid">
          {panels.length} indicators · {t.categories.length} subjects · median span {t.medianSpan} years
        </Eyebrow>
        <h1 className="story-display mt-4 max-w-[18ch] text-[36px] sm:text-[50px] lg:text-[58px]">
          {panels.length} Indicators, Whichever Way They Point.
        </h1>
        <Standfirst>
          India across {panels.length} of Our World in Data&rsquo;s indicators, chosen by how much
          data exists rather than by what it shows. <Mark tone="cool">{t.rose} rose</Mark>,{" "}
          <Mark>{t.fell} fell</Mark>, {t.flat} moved less than two per cent. That mix is a result
          of the selection rule, not a decision about what to include.
        </Standfirst>
        <p className="mt-5 max-w-[66ch] rounded-lg border p-4 text-[13px] leading-[1.6]"
          style={{ borderColor: "var(--story-rule)", color: "var(--story-ink-2)" }}>
          <strong style={{ color: "var(--story-ink)" }}>Rising is not improving.</strong>{" "}
          Emissions per head rising and literacy rising are not the same kind of fact, and the
          source carries no reliable flag for which direction is desirable. So nothing on this page
          is marked good or bad — green means the number went up and red means it went down, and
          the judgement about whether that is welcome is yours. A page that made it for you across
          a hundred unrelated indicators would be wrong on a great many of them.
        </p>
      </header>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat size="md" tone="cool" label="indicators that rose" value={String(t.rose)}
          note={<>Latest value higher than the first, by more than two per cent.</>} />
        <Stat size="md" tone="hot" label="indicators that fell" value={String(t.fell)}
          note={<>Latest lower than the first. Several of these are falls anyone would want.</>} />
        <Stat size="md" tone="mid" label="subjects covered" value={String(t.categories.length)}
          note={<>Capped at fourteen panels each, so no single subject can take the page over.</>} />
        <Stat size="md" tone="mid" label="drawn from" value={reg.counts.indicators.toLocaleString("en-US")}
          note={<>Indicators in the registry with a unit and a citation. The hundred are those with the most Indian data, not the most interesting values.</>} />
      </section>

      {/* ── The two tails ─────────────────────────────────────────────── */}
      <section className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <div className="story-card min-w-0 p-5 sm:p-6">
          <Eyebrow tone="cool">largest rises among the hundred</Eyebrow>
          <div className="mt-4">
            <RankedRows
              tone="cool"
              rows={biggestRises.map((p) => ({
                name: p.indicator.title,
                value: Math.abs(p.changePct ?? 0),
                display: changeLabel(p),
                meta: `${p.first.year}–${p.last.year}`,
              }))}
            />
          </div>
        </div>
        <div className="story-card min-w-0 p-5 sm:p-6">
          <Eyebrow tone="hot">largest falls among the hundred</Eyebrow>
          <div className="mt-4">
            <RankedRows
              tone="hot"
              rows={biggestFalls.map((p) => ({
                name: p.indicator.title,
                value: Math.abs(p.changePct ?? 0),
                display: changeLabel(p),
                meta: `${p.first.year}–${p.last.year}`,
              }))}
            />
          </div>
          <Caption>
            Bar length is the size of the move, not its direction. Several of the largest falls
            here — child mortality, extreme poverty, undernourishment — are the falls a country
            works for, which is exactly why this page will not colour a direction as good or bad.
          </Caption>
        </div>
      </section>

      {/* ── The hundred ───────────────────────────────────────────────── */}
      <section className="mt-14">
        <Eyebrow>the set</Eyebrow>
        <Headline>Every One of Them.</Headline>
        <Standfirst>
          Ordered by how much data stands behind them. Each panel is India&rsquo;s own series;
          click through for the world map, the comparator set and the citation.
        </Standfirst>

        {/*
          What was thrown out, and why, before anyone asks why the number is not
          a round hundred.

          The first version of this page drew ninety panels and four of them
          were the same series. OWID publishes one column under several chart
          titles — "Annual CO₂ emissions", "CO₂ emissions from fossil fuels and
          land-use change", "…by world region", "…by income level" — and
          nothing in a panel showed which column it came from, so four
          identical sparklines sat under four different names and counted as
          four indicators.
        */}
        <div className="mt-6 rounded-lg border p-4 text-[12.5px] leading-[1.65]"
          style={{ borderColor: "var(--story-rule)", color: "var(--story-ink-2)" }}>
          <strong style={{ color: "var(--story-ink)" }}>
            {excluded} indicators were held out of this set.
          </strong>{" "}
          <span className="mono">{rejected.twoVariable}</span> are charts titled
          &ldquo;X&nbsp;vs.&nbsp;Y&rdquo;, which plot two measures against each other: the
          registry can only take one column from them, so the title is not a name for the number
          underneath it and there is no honest one to substitute.{" "}
          <span className="mono">{rejected.duplicateMeasure}</span> were a second or third chart
          drawing a column already on this page under a different title.{" "}
          <span className="mono">{rejected.projection}</span> end in a future year, which makes
          the headline figure a forecast — and nothing in the source marks which of their earlier
          points were measured and which were modelled, so they cannot be trimmed back to the
          present either.
        </div>
        <ul className="mt-7 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {panels.map((p) => <PanelCard key={p.indicator.slug} p={p} />)}
        </ul>
        <Caption>
          Sparklines are drawn from the series minimum, not from zero, because a line encodes
          change and a zero baseline flattens every series whose variation is small against its
          level. Read shape from the line and magnitude from the number beside it. A sparkline
          marked <span className="mono">log</span> spans fiftyfold or more and is drawn on a
          logarithmic axis, where steady exponential growth is a straight rising line; on a linear
          one those series are a flat rule along the bottom with a tick at the end. A break in a
          line is a gap in the record, not a value of zero.
        </Caption>
      </section>

      {/* ── The subjects ──────────────────────────────────────────────── */}
      <section className="mt-14">
        <Eyebrow>what the hundred is made of</Eyebrow>
        <div className="story-card mt-5 p-5 sm:p-6">
          <RankedRows
            tone="mid"
            rows={t.categories.map((c) => ({
              name: c.key,
              value: c.n,
              display: String(c.n),
            }))}
          />
          <Caption>
            The mix reflects what Our World in Data carries and what has long Indian series, not
            what matters most. A subject with fourteen panels is not fourteen times as important as
            one with two; it is better covered by this particular compiler.
          </Caption>
        </div>
      </section>

      <section className="mt-12 border-t pt-8" style={{ borderColor: "var(--story-rule)" }}>
        <Eyebrow>what this page cannot tell you</Eyebrow>
        <ul className="mt-4 grid list-none grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-3 p-0 sm:grid-cols-2">
          <li className="min-w-0 text-[13px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
            Whether any of these changes is good. The page has no direction flag and does not
            invent one.
          </li>
          <li className="min-w-0 text-[13px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
            Whether India&rsquo;s hundred is better or worse than anyone else&rsquo;s. The same
            selector run on another country would pick different indicators, because it selects on
            that country&rsquo;s data coverage.
          </li>
          <li className="min-w-0 text-[13px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
            Anything about causes. A hundred series on one page invite the eye to connect them, and
            none of them is evidence about another.
          </li>
          {reg.cannotSay.map((c) => (
            <li key={c} className="min-w-0 text-[13px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
              {c}
            </li>
          ))}
        </ul>
      </section>

      <Sources>
        {reg.source} {reg.attribution} Built {reg.builtAt.slice(0, 10)}. Panels are selected by a
        coverage score — series length, recency and comparator coverage — that cannot see which way
        a series points. Every figure is arithmetic on that registry; none is typed in.{" "}
        <Link href="/world" className="underline">The map tracker</Link>
        {" · "}
        <Link href="/stories" className="underline">Visual stories</Link>
      </Sources>
    </div>
  );
}
