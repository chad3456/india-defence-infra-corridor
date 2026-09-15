import Link from "next/link";
import {
  loadSemi, group, latest, at, usd, surplus, inSurplus, worstDeficit, type TradeRow,
} from "@/lib/semi-story";
import {
  Eyebrow, Headline, Standfirst, Mark, Stat, Columns, BarRow,
  WhatThisCannotSay, Sources,
} from "@/components/stories/Kit";

/**
 * India learned to assemble. It has not learned to fabricate.
 *
 * ── The argument ─────────────────────────────────────────────────────────
 *
 * Two trade headings tell the whole story and they point opposite ways.
 *
 * HS 8517, telephones and telecom apparatus, ran a $19.6bn deficit in 2017 and
 * a $4.4bn surplus in 2024. India stopped importing phones and started
 * exporting them, which is a genuine industrial achievement and the largest
 * single swing in its electronics trade.
 *
 * HS 8542, integrated circuits, went from $340m of imports in 2002 to $23.4bn
 * in 2024, against $268m of exports — chips leaving the country are 1.1% of
 * the chips coming in.
 *
 * The second is not a failure standing beside the first. It is the arithmetic
 * of the first: every phone assembled here contains chips made elsewhere, so
 * assembling more phones necessarily buys more chips. Both facts are true at
 * once and a page that showed either one alone would be propaganda in one
 * direction or the other.
 *
 * ── What this page refuses ───────────────────────────────────────────────
 *
 * The underlying file is careful in ways the register must not undo. HS 8541
 * looks like a semiconductor series and is, since 2017, mostly solar cells —
 * adding it to 8542 would sell India's solar import surge as a chip
 * dependency. HS 8517 is not comparable before 2012 because handsets sat in a
 * different heading. Eleven of twenty-three years were sampled, so every chart
 * here has gaps and shows them rather than joining across.
 *
 * And 2008 is visibly wrong — IC imports halve in a year when total imports
 * tripled — because the reported data changed classification. It is flagged on
 * the chart rather than smoothed, because no correction exists that would not
 * be a number this project invented.
 */

export const metadata = {
  title: "India learned to assemble · Bharat Tracker",
  description:
    "Phones flipped from a $19.6bn deficit to a $4.4bn surplus in seven years. Chips went the " +
    "other way, and the second is the price of the first.",
};

/** Billions, always to one decimal: "$23bn" hides four hundred million. */
function bn(v: number): string {
  return (v / 1e9).toFixed(1);
}

export default function SemiconductorStory() {
  const d = loadSemi();
  const ic = group(d, "ic");
  const telecom = group(d, "telecom");
  const ch85 = group(d, "chapter85");
  const discrete = group(d, "discrete");

  if (!d.present || !ic || !telecom || !ch85) {
    return (
      <div className="pt-12">
        <Eyebrow>not built</Eyebrow>
        <Headline>The trade file is not in this deployment.</Headline>
        <Standfirst>
          Run <span className="mono">npm run semi:trade</span> to build{" "}
          <span className="mono">data/semi/trade.json</span>. Nothing on this page is typed in, so
          without it there is nothing to draw.
        </Standfirst>
      </div>
    );
  }

  const icNow = latest(ic)!;
  const icThen = ic.rows[0]!;
  const telNow = latest(telecom)!;
  const telWorst = worstDeficit(telecom);
  const ch85Now = latest(ch85)!;
  const merchNow = d.allMerchandise[d.allMerchandise.length - 1]!;

  const icShareOfElectronics = (icNow.imports / ch85Now.imports) * 100;
  const icShareOfAll = (icNow.imports / merchNow.imports) * 100;
  const exportCover = (icNow.exports / icNow.imports) * 100;
  // Both on the surplus convention, so the swing is a positive improvement.
  const swing = surplus(telNow) - surplus(telWorst);

  const col = (r: TradeRow) => ({
    label: String(r.year),
    value: r.imports / 1e9,
    note: r.suspect
      ? `${r.year}: ${r.suspect}`
      : r.gapBefore > 0
        ? `${r.gapBefore} year${r.gapBefore === 1 ? "" : "s"} before this one were not sampled by the upstream ingest. The gap is real; the line does not cross it.`
        : undefined,
  });

  return (
    <div>
      {/* ── Opening ───────────────────────────────────────────────────── */}
      <header className="pt-10">
        <Eyebrow tone="hot">electronics · trade · {icThen.year}–{icNow.year}</Eyebrow>
        <h1 className="story-display mt-4 max-w-[17ch] text-[38px] sm:text-[54px] lg:text-[64px]">
          India Learned to Assemble. It Has Not Learned to Fabricate.
        </h1>
        <Standfirst>
          Two headings in the customs data point in opposite directions, and the second is the
          price of the first. Phones went from India&rsquo;s largest electronics deficit to a
          surplus in seven years. Chips went from <Mark>{usd(icThen.imports)}</Mark> of imports to{" "}
          <Mark>{usd(icNow.imports)}</Mark> — because assembling more phones means buying more
          chips.
        </Standfirst>
      </header>

      {/* ── The two headline numbers ──────────────────────────────────── */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <Stat
          tone="cool"
          label={`phones · HS 8517 · ${telNow.year} balance`}
          value={`${inSurplus(telNow) ? "+" : "−"}$${bn(Math.abs(surplus(telNow)))}bn`}
          note={
            <>
              {inSurplus(telNow) ? "A surplus" : "A deficit"}. In {telWorst.year} this heading ran
              a deficit of {usd(telWorst.balance)} — a swing of {usd(swing)} in{" "}
              {telNow.year - telWorst.year} years. India now exports more telephone equipment than
              it imports.
            </>
          }
        />
        <Stat
          tone="hot"
          label={`chips · HS 8542 · ${icNow.year} imports`}
          value={`$${bn(icNow.imports)}bn`}
          note={
            <>
              Against {usd(icNow.exports)} of exports — chips leaving the country are{" "}
              {exportCover.toFixed(1)}% of the chips arriving. This heading is what the
              semiconductor mission is about.
            </>
          }
        />
      </section>

      {/* ── The flip ──────────────────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow tone="cool">what went right</Eyebrow>
        <Headline>The Phone Bill Flipped.</Headline>
        <Standfirst>
          Telephones and telecom apparatus, imports against exports. The bars below are the
          balance: red is a deficit, green is a surplus. This heading is only comparable from{" "}
          <Mark tone="cool">2012</Mark>, because until the 2007 revision of the tariff, handsets
          were reported under a different code — the earlier years are shown, and they are not the
          same measurement.
        </Standfirst>
        <div className="story-card mt-7 p-5 sm:p-7">
          <div className="space-y-1">
            {telecom.rows.map((r) => (
              <BarRow
                key={r.year}
                label={String(r.year)}
                sub={r.year < (telecom.comparableFrom ?? 2012) ? "pre-2007 basis" : undefined}
                value={Math.abs(surplus(r))}
                max={Math.max(...telecom.rows.map((x) => Math.abs(surplus(x))))}
                display={`${inSurplus(r) ? "+" : "−"}$${bn(Math.abs(surplus(r)))}bn`}
                tone={inSurplus(r) ? "cool" : "hot"}
              />
            ))}
          </div>
          <p className="mt-5 text-[12px] leading-[1.6]" style={{ color: "var(--story-ink-3)" }}>
            Bar length is the size of the balance, not its direction — a long red bar and a long
            green bar are equally large and opposite. Eleven of twenty-three years were sampled by
            the upstream ingest; the rows are the years that exist.
          </p>
        </div>
      </section>

      {/* ── The bill that grew ────────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow tone="hot">what it cost</Eyebrow>
        <Headline>And the Chip Bill Grew With It.</Headline>
        <Standfirst>
          Integrated circuit imports, in billions of dollars. Hover a column for what the gap
          before it means. The {icNow.year} figure is{" "}
          <Mark>{(icNow.imports / icThen.imports).toFixed(0)}×</Mark> the {icThen.year} one — and
          most of that is not a policy failure, it is India assembling more electronics than it
          used to and buying the parts.
        </Standfirst>
        <div className="story-card mt-7 p-5 sm:p-7">
          <Columns
            points={ic.rows.map(col)}
            tone="hot"
            height={210}
            format={(v) => v.toFixed(1)}
          />
          <p className="mt-6 text-[12px] leading-[1.6]" style={{ color: "var(--story-ink-3)" }}>
            US$ billion, nominal, not deflated. {ic.rows.find((r) => r.suspect) && (
              <>The <span style={{ color: "var(--s-hot)" }}>2008 column is visibly wrong</span> —
              imports halve in a year when India&rsquo;s total merchandise imports more than
              tripled against 2004. That is a classification break in the reported data, not a
              fall in chip imports. It is flagged and left alone, because no correction exists
              that would not be a number this project invented.</>
            )}
          </p>
        </div>
      </section>

      {/* ── Scale ─────────────────────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow>how big is that, really</Eyebrow>
        <Headline>One Heading, a Twenty-Eighth of Everything India Buys Abroad.</Headline>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <Stat
            size="md" tone="hot"
            label="share of the electronics import bill"
            value={`${icShareOfElectronics.toFixed(0)}%`}
            note={`ICs are ${usd(icNow.imports)} of the ${usd(ch85Now.imports)} India imported under the whole of HS chapter 85 in ${icNow.year}.`}
          />
          <Stat
            size="md" tone="hot"
            label="share of all merchandise imports"
            value={`${icShareOfAll.toFixed(1)}%`}
            note={`Of ${usd(merchNow.imports)} of everything India imported in ${merchNow.year}. One four-digit heading.`}
          />
          <Stat
            size="md" tone="cool"
            label="electronics exports"
            value={`$${bn(ch85Now.exports)}bn`}
            note={`Chapter 85 exports in ${ch85Now.year}, up from ${usd(ch85.rows[0]!.exports)} in ${ch85.rows[0]!.year}. The assembly build-out is visible here too.`}
          />
        </div>
      </section>

      {/* ── The heading that is not chips ─────────────────────────────── */}
      {discrete && (
        <section className="mt-16">
          <Eyebrow tone="mid">the number you will see quoted, and should not use</Eyebrow>
          <Headline>HS 8541 Looks Like Chips. Since 2017 It Is Mostly Solar.</Headline>
          <Standfirst>
            &ldquo;Semiconductor devices&rdquo; in the tariff includes photovoltaic cells and
            modules. Adding this heading to the chip series would show India&rsquo;s solar import
            surge as a semiconductor dependency, and it gets added regularly. It is kept separate
            here and printed so you can see the size of what is being left out.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7" data-tone="mid">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Eyebrow tone="mid">HS 8541 imports, {latest(discrete)!.year}</Eyebrow>
                <p className="story-display mt-2 text-[34px]">{usd(latest(discrete)!.imports)}</p>
                <p className="mt-2 text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>
                  Large, real, and not a chip figure. Its exports —{" "}
                  {usd(latest(discrete)!.exports)} — are mostly modules too.
                </p>
              </div>
              <div>
                <Eyebrow tone="hot">what the chip figure would become</Eyebrow>
                <p className="story-display mt-2 text-[34px]">
                  ${bn(icNow.imports + latest(discrete)!.imports)}bn
                </p>
                <p className="mt-2 text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>
                  If the two were added, which is the mistake. That is{" "}
                  {(((icNow.imports + latest(discrete)!.imports) / icNow.imports - 1) * 100).toFixed(0)}%
                  higher than the real chip number.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Daily life ───────────────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow>where this touches the ground</Eyebrow>
        <Headline>What a Chip Deficit Actually Is.</Headline>
        <Standfirst>
          It is not a shortage. Nothing on the shelves is missing because of this number — the
          chips arrive, they are paid for in dollars, and they go into phones that are increasingly
          assembled here and sold abroad. What the number measures is where the value goes.
        </Standfirst>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <div className="story-card p-5" data-tone="cool">
            <Eyebrow tone="cool">the phone in your hand</Eyebrow>
            <p className="mt-3 text-[13.5px] leading-[1.6]">
              Increasingly assembled in India, and increasingly exported: telecom apparatus exports
              went from {usd(at(telecom, 2017)?.exports ?? 0)} in 2017 to{" "}
              {usd(telNow.exports)} in {telNow.year}. That is jobs, and it is real.
            </p>
          </div>
          <div className="story-card p-5" data-tone="hot">
            <Eyebrow tone="hot">the chips inside it</Eyebrow>
            <p className="mt-3 text-[13.5px] leading-[1.6]">
              Imported. India&rsquo;s IC exports are {exportCover.toFixed(1)}% of its IC imports,
              and that ratio has not improved: in {icThen.year} it was{" "}
              {((icThen.exports / icThen.imports) * 100).toFixed(1)}%.
            </p>
          </div>
          <div className="story-card p-5" data-tone="mid">
            <Eyebrow tone="mid">what a fab would change</Eyebrow>
            <p className="mt-3 text-[13.5px] leading-[1.6]">
              This series, eventually — and not soon. Nothing in the trade data can tell you
              whether an announced plant will move it, which is why no number on this page is a
              forecast.
            </p>
          </div>
        </div>
      </section>

      <WhatThisCannotSay
        items={[
          {
            q: "Whether India makes any of these chips",
            a: <>Customs data records what crossed a border, not what was produced. A fall in imports could be a fab starting up or demand collapsing, and this series cannot tell them apart.</>,
          },
          {
            q: "How much of an assembled phone is Indian",
            a: <>Nothing here measures value added. A phone exported from India carries its imported components in its export value, so the {usd(surplus(telNow))} surplus is a gross figure and not a measure of domestic content.</>,
          },
          {
            q: "What happened in twelve of these years",
            a: <>{d.unsampledYears.length} of {d.sampledYears.length + d.unsampledYears.length} years between {icThen.year} and {icNow.year} were not sampled by the upstream ingest — {d.unsampledYears.join(", ")}. The charts show the years that exist and do not interpolate across the gaps.</>,
          },
          {
            q: "Whether 2008 is a real fall",
            a: <>No. It is a classification break: the 2008 file carries none of the HS2007 IC codes. Flagged on the chart and left uncorrected.</>,
          },
          {
            q: "Anything about prices",
            a: <>Figures are nominal US dollars and are not deflated. A chip bill that doubles over a decade in which chip prices moved is not a doubling of volume.</>,
          },
          {
            q: "What the announced fabs are worth",
            a: <>Nothing on this page carries a fab&rsquo;s sanctioned outlay, because none is sourced yet. The contract ledger this site runs against Press Information Bureau releases filters for defence acquisitions by construction — a fab approval has neither a defence institution nor an acquisition verb in it — so a semiconductor ledger needs its own reader and its own checks. Until it exists, the figures quoted for Dholera, Sanand and Jagiroad are not repeated here.</>,
          },
          {
            q: "Who owns the assembly",
            a: <>Not in this data. Trade statistics name a country, never a firm, so nothing here distinguishes an Indian-owned plant from a contract manufacturer operating in India.</>,
          },
        ]}
      />

      <Sources>
        {d.source} · {d.unit} · built {d.builtAt.slice(0, 10)}. Every figure on this page is
        arithmetic on that file; none is typed in. The heading-level method, and why subheadings
        are not summed across tariff revisions, is described in the file itself.{" "}
        <Link href="/made-in-india" className="underline">
          The wider product-by-product picture
        </Link>
        .
      </Sources>
    </div>
  );
}
