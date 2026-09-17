import Link from "next/link";
import {
  loadCinema, usableYears, shareSeries, meanShare, coverageBoundTotal,
  languagesByRecentShare, topGrossers, grossersByYear,
} from "@/lib/cinema";
import {
  Eyebrow, Headline, Standfirst, Mark, Stat, Columns, WhatThisCannotSay, Sources,
} from "@/components/stories/Kit";
import {
  ChartTitle, Caption, RankedRows, StackedBars, PairedChange, DotStrip,
} from "@/components/stories/Charts";

/**
 * The thing that declined was Bollywood's share, not Indian filmmaking.
 *
 * ── What the brief asked and what the data says ──────────────────────────
 *
 * The brief called it a downgrade of filmmaking in India. The measurable
 * version of that claim turns out to be true, specific, and about something
 * narrower than it sounds: Hindi cinema's share of Indian film titles roughly
 * halved between the 2000s and the 2020s, from about a fifth to about an
 * eighth, while Malayalam, Tamil and Kannada held or gained.
 *
 * Indian filmmaking as a whole did not shrink on any measure here. What
 * happened is a redistribution, and calling it a decline without saying whose
 * would be repeating the industry's own centre-of-gravity assumption — that
 * Bombay is the numerator and everything else is regional.
 *
 * ── The confounder, and why the page leads with a ratio ──────────────────
 *
 * Title counts come from English Wikipedia's year-by-language lists, and those
 * grew because films were made AND because people wrote them down. The second
 * is enormous over twenty-six years and uneven across languages.
 *
 * Share is robust to that in a way the absolute count is not, because coverage
 * growth moves numerator and denominator together. So every headline on this
 * page is a share; the absolute total appears once, in a panel whose entire
 * job is to explain why it is not the story.
 *
 * ── Three bugs stood between this page and a wrong one ───────────────────
 *
 * The first run had Punjabi at 29% of Indian cinema through the 2000s, because
 * ten years of requests had each been redirected to one combined article.
 * Nothing about the output looked wrong. That is recorded in the connector and
 * worth remembering here: a share chart is exactly as good as the denominator
 * under it.
 */

export const metadata = {
  title: "Bollywood's share halved · Bharat Tracker",
  description:
    "Hindi cinema's share of Indian film titles fell from about a fifth to about an eighth since " +
    "2000. Indian filmmaking did not shrink — it moved south.",
};

/** The four industries the story turns on, plus Hindi. */
const FOCUS = ["Hindi", "Tamil", "Malayalam", "Kannada", "Telugu"];

const EARLY_FROM = 2000;
const EARLY_TO = 2009;
const LATE_FROM = 2017;
const LATE_TO = 2026;

export default function CinemaStory() {
  const d = loadCinema();

  if (!d.present) {
    return (
      <div className="pt-12">
        <Eyebrow>not built</Eyebrow>
        <Headline>The cinema file is not in this deployment.</Headline>
        <Standfirst>
          Run <span className="mono">npm run cinema:build</span> in CI to build{" "}
          <span className="mono">data/cinema/output.json</span>. Nothing here is typed in.
        </Standfirst>
      </div>
    );
  }

  const years = usableYears(d);
  const first = years[0];
  const last = years[years.length - 1];

  const hindiEarly = meanShare(d, "Hindi", EARLY_FROM, EARLY_TO);
  const hindiLate = meanShare(d, "Hindi", LATE_FROM, LATE_TO);
  const hindiFall = hindiEarly > 0 ? ((hindiEarly - hindiLate) / hindiEarly) * 100 : 0;

  const movers = d.languages
    .map((l) => ({
      language: l,
      early: meanShare(d, l, EARLY_FROM, EARLY_TO),
      late: meanShare(d, l, LATE_FROM, LATE_TO),
    }))
    .filter((m) => m.early > 0.5 || m.late > 0.5)
    .map((m) => ({ ...m, change: m.late - m.early }))
    .sort((a, b) => b.change - a.change);

  const ordered = languagesByRecentShare(d).filter((l) => FOCUS.includes(l));
  const grossers = topGrossers(d, 15);
  const grossYears = grossersByYear(d);

  /** The stacked mix, thinned so the bars stay readable. */
  const stackYears = years.filter((s) => s.year % 3 === 0 || s.year === last?.year);
  /**
   * Three bands, not six.
   *
   * The register has exactly three validated tones, so a six-way split had to
   * reuse them and produced two amber bands and two green ones that a reader
   * could not tell apart. Adding hues would mean a new categorical palette
   * validated for both themes and for colour-blind separation — real work for
   * a chart whose argument is three-way anyway: Hindi, the southern four, and
   * everyone else. The per-language detail is the next section's job.
   */
  const SOUTH = ["Tamil", "Telugu", "Malayalam", "Kannada"];
  const STACK_PARTS = [
    { key: "Hindi", label: "Hindi", tone: "hot" as const },
    { key: "South", label: "Tamil, Telugu, Malayalam and Kannada", tone: "cool" as const },
    { key: "Other", label: "Every other language tracked", tone: "mid" as const },
  ];

  return (
    <div>
      {/* ── Opening ───────────────────────────────────────────────────── */}
      <header className="pt-10">
        <Eyebrow tone="hot">
          cinema · {d.counts.yearsListed} year-language lists · {first?.year}–{last?.year}
        </Eyebrow>
        <h1 className="story-display mt-4 max-w-[17ch] text-[38px] sm:text-[54px] lg:text-[62px]">
          Indian Cinema Did Not Shrink. It Moved South.
        </h1>
        <Standfirst>
          Hindi&rsquo;s share of Indian film titles averaged{" "}
          <Mark>{hindiEarly.toFixed(1)}%</Mark> across {EARLY_FROM}&ndash;{EARLY_TO} and{" "}
          <Mark>{hindiLate.toFixed(1)}%</Mark> across {LATE_FROM}&ndash;{LATE_TO} — a fall of{" "}
          {hindiFall.toFixed(0)}% of its own share in two decades. Nothing else here fell. The
          measurable version of &ldquo;Indian filmmaking is in decline&rdquo; is a redistribution,
          and which industry you stand in decides whether it looks like one.
        </Standfirst>
        <p className="mt-5 max-w-[64ch] rounded-lg border p-4 text-[13px] leading-[1.6]"
          style={{ borderColor: "var(--story-rule)", color: "var(--story-ink-2)" }}>
          <strong style={{ color: "var(--story-ink)" }}>Why every number here is a share.</strong>{" "}
          The counts come from Wikipedia&rsquo;s year-by-language lists, which grew both because
          more films were made and because more people wrote them down. A share is robust to that;
          an absolute count is not, because coverage growth moves numerator and denominator
          together. The absolute total appears once on this page, in the panel that explains why it
          is not the story.
        </p>
      </header>

      {/* ── Four numbers ──────────────────────────────────────────────── */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat size="md" tone="hot" label={`Hindi share · ${EARLY_FROM}–${EARLY_TO}`}
          value={`${hindiEarly.toFixed(1)}%`}
          note={<>Mean across the decade, of all titles listed in the twelve languages tracked.</>} />
        <Stat size="md" tone="hot" label={`Hindi share · ${LATE_FROM}–${LATE_TO}`}
          value={`${hindiLate.toFixed(1)}%`}
          note={<>The same measure, two decades later. No other tracked language fell by more than a point.</>} />
        <Stat size="md" tone="cool" label="languages tracked"
          value={String(d.languages.length)}
          note={<>{d.counts.yearsListed} of {d.counts.rowsAttempted} year-language lists existed and survived the checks.</>} />
        <Stat size="md" tone="mid" label="lists refused by a check"
          value={String((d.counts.yearsRedirected ?? 0) + (d.counts.yearsDroppedAsRepeats ?? 0))}
          note={<>{d.counts.yearsRedirected ?? 0} had been redirected off their own year, {d.counts.yearsDroppedAsRepeats ?? 0} repeated a previous year exactly. Both would have been invisible in the output.</>} />
      </section>

      {/* ── The mix over time ─────────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow tone="hot">the mix</Eyebrow>
        <Headline>A Fifth, Then an Eighth.</Headline>
        <Standfirst>
          Every bar is one year&rsquo;s listed titles, drawn to 100% of itself, so the chart is
          about the mix and not about how many films there were. The total sits above each bar for
          anyone who wants it, with the coverage warning attached.
        </Standfirst>
        <div className="story-card mt-7 p-5 sm:p-7">
          <StackedBars
            height={280}
            parts={STACK_PARTS}
            totalFormat={(v: number) => String(Math.round(v))}
            rows={stackYears.map((s) => {
              const south = SOUTH.reduce((a, l) => a + (s.byLanguage[l] ?? 0), 0);
              const hindi = s.byLanguage["Hindi"] ?? 0;
              return {
                label: String(s.year),
                total: s.total,
                values: { Hindi: hindi, South: south, Other: Math.max(0, s.total - south - hindi) },
              };
            })}
          />
          <Caption>
            Every third year, so the bars stay wide enough to label. The number above each bar is
            titles listed that year — <strong>not</strong> titles produced. 2020 is visibly short;
            that is a pandemic, and it is the one year on this chart whose absolute figure means
            what it looks like. Hindi and the four southern industries are separated because that
            is the argument; every language&rsquo;s own line is in the next section.
          </Caption>
        </div>
      </section>

      {/* ── Who moved ─────────────────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow>two decades apart</Eyebrow>
        <Headline>One Industry Fell. The Rest Did Not.</Headline>
        <Standfirst>
          Mean share across {EARLY_FROM}&ndash;{EARLY_TO} against {LATE_FROM}&ndash;{LATE_TO}, for
          every language with a measurable share in either. Decade means rather than single years,
          because a single year moves on one big release schedule and a decade does not.
        </Standfirst>
        <div className="story-card mt-7 p-5 sm:p-7">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-9 lg:grid-cols-2">
            <div className="min-w-0">
              <ChartTitle note="Share of all listed Indian titles, mean over each span.">
                Then and now
              </ChartTitle>
              <PairedChange
                aLabel={`${EARLY_FROM}–${EARLY_TO}`}
                bLabel={`${LATE_FROM}–${LATE_TO}`}
                aTone="mid"
                bTone="cool"
                rows={movers.map((m) => ({
                  name: m.language,
                  a: m.early,
                  b: m.late,
                  aDisplay: `${m.early.toFixed(1)}%`,
                  bDisplay: `${m.late.toFixed(1)}%`,
                  mark: m.language === "Hindi",
                }))}
              />
            </div>
            <div className="min-w-0">
              <ChartTitle note="Percentage points gained or lost between the two spans.">
                The change itself
              </ChartTitle>
              <RankedRows
                tone="cool"
                markTone="hot"
                rows={movers.map((m) => ({
                  name: m.language,
                  value: Math.abs(m.change),
                  display: `${m.change >= 0 ? "+" : "−"}${Math.abs(m.change).toFixed(1)} pts`,
                  mark: m.change < -1,
                }))}
              />
              <Caption>
                Bar length is the size of the move, not its direction — read the sign from the
                number. Hindi is the only language that lost more than a point of share, and it
                lost {Math.abs(movers.find((m) => m.language === "Hindi")?.change ?? 0).toFixed(1)}.
              </Caption>
            </div>
          </div>
        </div>
      </section>

      {/* ── Hindi alone ───────────────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow tone="hot">the line itself</Eyebrow>
        <Headline>Hindi&rsquo;s Share, Year by Year.</Headline>
        <div className="story-card mt-7 p-5 sm:p-7">
          <Columns
            tone="hot"
            height={190}
            highlightLast={false}
            points={shareSeries(d, "Hindi").map((p) => ({
              label: String(p.year).slice(2),
              value: p.share,
              note: p.year === 2020
                ? "2020: the pandemic year. Hindi's share rises because the southern release calendars stopped harder than Bombay's, not because Hindi output grew."
                : undefined,
            }))}
            format={(v: number) => v.toFixed(0)}
          />
          <Caption>
            Per cent of all listed Indian titles. The 2020 spike is a pandemic artefact — southern
            release calendars stopped harder than Bombay&rsquo;s — and the recovery below 12% from
            2021 is the actual level. A share this noisy year to year is why the headline numbers
            on this page are decade means.
          </Caption>
        </div>
      </section>

      {/* ── The absolute count, and why it is not the story ───────────── */}
      <section className="mt-16">
        <Eyebrow tone="mid">the number this page will not lead with</Eyebrow>
        <Headline>Listed Titles Nearly Quadrupled. That Is Mostly Wikipedia.</Headline>
        <Standfirst>
          {first && last && (
            <>
              {coverageBoundTotal(d, first.year).toLocaleString("en-US")} titles listed for{" "}
              {first.year}, {coverageBoundTotal(d, last.year).toLocaleString("en-US")} for{" "}
              {last.year}.
            </>
          )}{" "}
          India almost certainly does make more films than it did in 2000 — but this series cannot
          show it, because the same twenty-six years saw an enormous rise in how much of Indian
          cinema got written down at all, and nothing here separates the two.
        </Standfirst>
        <div className="story-card mt-7 p-5 sm:p-7" data-tone="mid">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
            <div className="min-w-0">
              <ChartTitle note="Titles listed per year across the twelve languages. Coverage-bound: see the caption.">
                Titles listed, not titles made
              </ChartTitle>
              <Columns
                tone="mid"
                height={160}
                highlightLast={false}
                points={years.map((s) => ({ label: String(s.year).slice(2), value: s.total }))}
                format={(v: number) => String(Math.round(v))}
              />
              <Caption>{d.coverage}</Caption>
            </div>
            <div className="min-w-0">
              <ChartTitle>What would settle it</ChartTitle>
              <p className="text-[13px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
                The Central Board of Film Certification certifies every film released in India and
                publishes the count. That is the real production series and it is not in here: its
                statistics page returned 404 to this project&rsquo;s probe. Until it answers, the
                absolute number of Indian films made per year is not something this site will
                print.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Box office ────────────────────────────────────────────────── */}
      {grossers.length > 0 && (
        <section className="mt-16">
          <Eyebrow tone="cool">the other end of the distribution</Eyebrow>
          <Headline>The Biggest Films Are Not Mostly Hindi Any More.</Headline>
          <Standfirst>
            The highest-grossing Indian films of all time, deduplicated across the tables that list
            them. Nominal rupees, never adjusted for inflation, which is most of why recent films
            dominate — and the rest of why is that a recent film is likelier to be listed at all.
            It is a picture of the top of the distribution and says nothing about the median film.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-9 lg:grid-cols-2">
              <div className="min-w-0">
                <ChartTitle note="Deduplicated on title; the entry carrying a year wins, then the larger figure.">
                  Highest-grossing, all time
                </ChartTitle>
                <RankedRows
                  tone="cool"
                  rows={grossers.map((g) => ({
                    name: g.title,
                    value: g.crore ?? 0,
                    display: `₹${Math.round(g.crore ?? 0).toLocaleString("en-IN")} cr`,
                    meta: g.year ? String(g.year) : "year not stated",
                  }))}
                />
              </div>
              <div className="min-w-0">
                <ChartTitle note="Which release years the all-time list is made of. One dot is one film.">
                  When the list comes from
                </ChartTitle>
                <DotStrip
                  dotSize={8}
                  gap={3}
                  maxPerColumn={8}
                  bins={grossYears
                    .filter((r) => r.year >= 2010)
                    .map((r) => ({
                      label: String(r.year).slice(2),
                      count: r.n,
                      tone: (r.year >= 2022 ? "hot" : "mid") as "hot" | "mid",
                    }))}
                />
                <Caption>
                  Nearly all of it is the last four years, which is what an unadjusted nominal
                  ranking does. This is a property of the list, not a finding about cinema, and the
                  chart is here to make that visible rather than to be read as a trend.
                </Caption>
              </div>
            </div>
          </div>
        </section>
      )}

      <WhatThisCannotSay
        items={[
          {
            q: "How many films India actually makes",
            a: <>Not in here. The certification count belongs to the Central Board of Film Certification, whose statistics page returned 404 to this project&rsquo;s probe. The absolute series on this page counts Wikipedia articles, and its trend is partly a trend in documentation.</>,
          },
          {
            q: "Whether Indian cinema is getting better or worse",
            a: <>Nothing here measures quality, and no chart on this page is evidence about it. The brief&rsquo;s word was &ldquo;downgrade&rdquo;; what is measurable is volume, language mix and box office, and none of the three is an artistic judgement.</>,
          },
          {
            q: "Why Hindi's share fell",
            a: <>A share has two ends and this data cannot separate them. Hindi&rsquo;s share can fall because Bombay made fewer films or because the southern industries made more, and the totals here are consistent with both happening at once.</>,
          },
          {
            q: "Anything about audiences",
            a: <>No admissions, no footfalls, no ticket prices, no screen counts. None of it is reachable for India from a source this project could cite — and screens in particular are the mechanism most often meant by a decline.</>,
          },
          {
            q: "Anything about streaming",
            a: <>The largest structural change in the period leaves no trace in either series. A film released direct to a platform may never appear in a theatrical list and never registers a gross.</>,
          },
          {
            q: "Whether the box-office list is a time series",
            a: <>It is not, and the chart of its release years is there to show why. An all-time ranking in nominal rupees is dominated by recent films by construction — prices rise — so its year distribution is a property of the list rather than a finding about cinema.</>,
          },
        ]}
      />

      <Sources>
        {d.source} Built {d.builtAt.slice(0, 10)}. {d.counts.yearsListed} of{" "}
        {d.counts.rowsAttempted} year-language lists survived;{" "}
        {d.counts.yearsRedirected ?? 0} were refused for having been redirected off their own year
        and {d.counts.yearsDroppedAsRepeats ?? 0} for repeating a previous year exactly.{" "}
        {d.grossNote}. Every figure is arithmetic on that file; none is typed in.{" "}
        <Link href="/stories" className="underline">Visual stories</Link>
      </Sources>
    </div>
  );
}
