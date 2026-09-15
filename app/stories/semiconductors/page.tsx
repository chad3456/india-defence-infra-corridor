import Link from "next/link";
import {
  loadSemi, group, latest, at, usd, surplus, inSurplus, worstDeficit, type TradeRow,
} from "@/lib/semi-story";
import {
  loadSemiWorld, line, year, countriesOnly, rankOf, valueOf, cover, isoOf, pointFor,
  usd as wusd, INDIA_CODE, TAIWAN_CODE, HONG_KONG_CODE,
  type CountryValue, type LineYear,
} from "@/lib/semi-world";
import {
  Eyebrow, Headline, Standfirst, Mark, Stat, Columns, BarRow,
  WhatThisCannotSay, Sources,
} from "@/components/stories/Kit";
import {
  ChartTitle, Caption, RankedRows, DivergingRanks, Waffle, PackedBubbles,
  BubbleMap, StageLadder, Treemap, type Grade, type Ladder,
} from "@/components/stories/Charts";

/**
 * India buys the tenth most chips in the world and sells the thirty-fourth most.
 *
 * ── Why the story changed shape ──────────────────────────────────────────
 *
 * The first version of this page compared India only to its own past, because
 * that was all the data could do: data/semi/trade.json is India as reporter
 * with the partner dimension collapsed to the world. It could say the chip
 * bill grew twenty-fold and nothing whatever about anyone else, so the
 * strongest claim available was "large and growing", which is true of most
 * things in a $700bn import bill.
 *
 * data/semi/world.json added the country dimension, and with it the three
 * findings this page is now built on:
 *
 *  1. Among the world's twenty-five largest chip importers, India has the
 *     lowest export cover there is — 1.1 cents sold for every dollar bought.
 *     Not "low". Last. Brazil is next at 1.2%, and the gap to the rest is an
 *     order of magnitude.
 *
 *  2. Five countries are three quarters of all chip exports, and the market in
 *     the machines that make chips is tighter still: three countries are 59%
 *     of it. India is twenty-ninth in that market, on $33m.
 *
 *  3. The two rankings disagree, and the disagreement is the whole lesson. The
 *     largest chip exporter on earth is Hong Kong, which fabricates none — it
 *     is a port. An 8542 export is a shipment. That is why the stage ladder on
 *     this page grades a country on the tools it sells as well as the chips,
 *     and why it does not claim to measure fabrication at all.
 *
 * ── The one chart here that is a judgement, and how it was disarmed ──────
 *
 * A "which countries can do which step" matrix is normally an opinion in a
 * chart's clothes. This one is computed: every grade is a rank threshold in
 * the trade data, the rule is printed under the chart, and a reader can
 * recompute any cell from the same file. Nothing is graded on capability,
 * process node or capacity, because trade data cannot see any of them.
 */

export const metadata = {
  title: "The world's chips, and India's place in them · Bharat Tracker",
  description:
    "Of the twenty-five largest chip importers, India sells the least: 1.1 cents of exports for " +
    "every dollar bought. Five countries are three quarters of world chip exports.",
};

/** Billions, always to one decimal: "$23bn" hides four hundred million. */
function bn(v: number): string {
  return (v / 1e9).toFixed(1);
}

/**
 * The grading rule, printed under the chart and applied here.
 *
 * Top five in a ranking is 3, top fifteen is 2, ranked at all is 1, absent
 * is 0. Deliberately crude: a finer rule would imply the trade data supports a
 * finer reading, and it does not.
 */
function gradeByRank(rows: CountryValue[], code: number): Grade {
  const r = rankOf(rows, code);
  if (r === 0) return 0;
  if (r <= 5) return 3;
  if (r <= 15) return 2;
  return 1;
}

function coverGrade(ly: LineYear | undefined, code: number): Grade {
  const c = cover(ly, code);
  if (c === null) return 0;
  if (c >= 100) return 3;
  if (c >= 50) return 2;
  if (c >= 10) return 1;
  return 0;
}

export default function SemiconductorStory() {
  const d = loadSemi();
  const w = loadSemiWorld();
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
  const swing = surplus(telNow) - surplus(telWorst);

  /* ── The world tables, aggregates removed ─────────────────────────── */
  const chips = line(w, "8542");
  const tools = line(w, "8486");
  const chips24 = year(chips, 2024);
  const tools24 = year(tools, 2024);
  const chipX = countriesOnly(chips24?.exporters ?? [], w.notOneCountry);
  const chipM = countriesOnly(chips24?.importers ?? [], w.notOneCountry);
  const toolX = countriesOnly(tools24?.exporters ?? [], w.notOneCountry);
  const toolM = countriesOnly(tools24?.importers ?? [], w.notOneCountry);
  const disc = line(w, "8541");
  const discX = countriesOnly(year(disc, 2024)?.exporters ?? [], w.notOneCountry);

  const worldChipX = chipX.rows.reduce((a, b) => a + b.value, 0);
  const top5Share = worldChipX > 0
    ? (chipX.rows.slice(0, 5).reduce((a, b) => a + b.value, 0) / worldChipX) * 100 : 0;
  const worldToolX = toolX.rows.reduce((a, b) => a + b.value, 0);
  const top3ToolShare = worldToolX > 0
    ? (toolX.rows.slice(0, 3).reduce((a, b) => a + b.value, 0) / worldToolX) * 100 : 0;

  const indiaXRank = rankOf(chipX.rows, INDIA_CODE);
  const indiaMRank = rankOf(chipM.rows, INDIA_CODE);
  const indiaToolXRank = rankOf(toolX.rows, INDIA_CODE);
  const indiaToolM = valueOf(toolM.rows, INDIA_CODE);
  const indiaToolX = valueOf(toolX.rows, INDIA_CODE);

  /**
   * Export cover among the twenty-five largest importers, worst first.
   *
   * Restricted to large importers on purpose. Cover is a ratio, and a country
   * that buys four million dollars of chips can post a spectacular ratio on a
   * single shipment. Twenty-five is the point at which every member is buying
   * more than a billion dollars a year, so the denominators are all real.
   */
  const coverRows = chipM.rows.slice(0, 25)
    .map((c) => ({ c, cov: cover(chips24, c.code) ?? 0 }))
    .sort((a, b) => a.cov - b.cov);
  const indiaCover = coverRows.find((r) => r.c.code === INDIA_CODE);
  const indiaCoverPlace = coverRows.findIndex((r) => r.c.code === INDIA_CODE) + 1;

  /* ── The ladder. Every grade is a rank threshold, printed below it. ── */
  const ladderCodes = [
    ...chipX.rows.slice(0, 8).map((c) => c.code),
    INDIA_CODE,
  ].filter((c, i, a) => a.indexOf(c) === i);
  const nameOf = (code: number): string =>
    chipX.rows.find((r) => r.code === code)?.name
    ?? chipM.rows.find((r) => r.code === code)?.name
    ?? String(code);
  const ladder: Ladder[] = ladderCodes.map((code) => ({
    name: code === TAIWAN_CODE ? "Taiwan *" : code === HONG_KONG_CODE ? "Hong Kong †" : nameOf(code),
    mark: code === INDIA_CODE,
    // Every column runs the same way: more is further up the chain. An
    // earlier draft had "buys the most chips" as the fourth column and gave
    // India a green cell for it — the scale reads stuck-to-free, so being a
    // leading *buyer* came out looking like an achievement. All four are now
    // about selling or covering, so the colour means one thing across the row.
    grades: [
      gradeByRank(toolX.rows, code),
      gradeByRank(chipX.rows, code),
      gradeByRank(discX.rows, code),
      coverGrade(chips24, code),
    ],
  }));

  /* ── The map ──────────────────────────────────────────────────────── */
  const mapBubbles = chipX.rows.slice(0, 22).map((c) => ({
    id: isoOf(c.code),
    name: c.code === TAIWAN_CODE ? "Taiwan" : c.name.replace("China, Hong Kong SAR", "Hong Kong")
      .replace("Rep. of Korea", "Korea").replace("USA", "United States"),
    value: c.value,
    display: wusd(c.value),
    tone: (c.code === INDIA_CODE ? "cool" : "hot") as "cool" | "hot",
    mark: c.code === INDIA_CODE,
    ...(pointFor(c.code) ? { at: pointFor(c.code) } : {}),
  }));
  // India is 34th and would not otherwise be on the map at all — which is the
  // point of putting it there.
  if (!mapBubbles.some((b) => b.id === isoOf(INDIA_CODE))) {
    const iv = valueOf(chipX.rows, INDIA_CODE);
    mapBubbles.push({
      id: isoOf(INDIA_CODE), name: "India", value: iv, display: wusd(iv), tone: "cool", mark: true,
    });
  }

  const col = (r: TradeRow) => ({
    label: String(r.year),
    value: r.imports / 1e9,
    note: r.suspect
      ? `${r.year}: ${r.suspect}`
      : r.gapBefore > 0
        ? `${r.gapBefore} year${r.gapBefore === 1 ? "" : "s"} before this one were not sampled by the upstream ingest. The gap is real; the line does not cross it.`
        : undefined,
  });

  // Aggregates out of the origin breakdown too: the partner list is drawn from
  // the same area codes as the reporter list, so an EU line would sit beside
  // Germany and Ireland here exactly as it would in a ranking.
  const sources = countriesOnly(chips?.indiaImportsBySource ?? [], w.notOneCountry).rows;
  const sourceTotal = sources.reduce((a, b) => a + b.value, 0);

  return (
    <div>
      {/* ── Opening ───────────────────────────────────────────────────── */}
      <header className="pt-10">
        <Eyebrow tone="hot">semiconductors · {w.present ? `${chipM.rows.length} reporting countries · 2024` : `${icThen.year}–${icNow.year}`}</Eyebrow>
        <h1 className="story-display mt-4 max-w-[16ch] text-[38px] sm:text-[54px] lg:text-[64px]">
          India Buys the World&rsquo;s Chips. It Sells Almost None.
        </h1>
        <Standfirst>
          Every large economy imports integrated circuits; most of them export a lot too. India
          imports <Mark>{usd(icNow.imports)}</Mark> and exports <Mark>{usd(icNow.exports)}</Mark> —{" "}
          {w.present && indiaCover ? (
            <>the lowest export cover of any of the world&rsquo;s twenty-five largest chip
            importers, by a factor of ten against every country except one.</>
          ) : (
            <>{exportCover.toFixed(1)} cents sold for every dollar bought.</>
          )}{" "}
          This page is about where that sits in the world, and about the part of the industry that
          never appears in a chip ranking at all.
        </Standfirst>
      </header>

      {/* ── Four numbers ──────────────────────────────────────────────── */}
      {w.present && (
        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat size="md" tone="hot" label="world rank · chips bought" value={`${indiaMRank}th`}
            note={<>India imported {wusd(valueOf(chipM.rows, INDIA_CODE))} of integrated circuits in 2024, out of {chipM.rows.length} reporting countries.</>} />
          <Stat size="md" tone="hot" label="world rank · chips sold" value={`${indiaXRank}th`}
            note={<>{wusd(valueOf(chipX.rows, INDIA_CODE))} of exports. Twenty-four places below where it buys.</>} />
          <Stat size="md" tone="hot" label="export cover" value={`${exportCover.toFixed(1)}%`}
            note={<>Cents of chips sold per dollar bought. Last of the top twenty-five importers; Brazil, the next worst, is at {(coverRows[1]?.cov ?? 0).toFixed(1)}%.</>} />
          <Stat size="md" tone="mid" label="world rank · fab equipment sold" value={`${indiaToolXRank}th`}
            note={<>{wusd(indiaToolX)} of the machines that make chips, against {wusd(indiaToolM)} bought. This is the market that decides who can fabricate.</>} />
        </section>
      )}

      {/* ── Where the chips move ──────────────────────────────────────── */}
      {w.present && (
        <section className="mt-16">
          <Eyebrow tone="hot">the world, 2024</Eyebrow>
          <Headline>Three Quarters of It Leaves Five Places.</Headline>
          <Standfirst>
            Integrated circuit exports, every reporting country, circles in proportion to value.
            The five largest are <Mark>{top5Share.toFixed(0)}%</Mark> of the{" "}
            {wusd(worldChipX)} world total. India is the green circle.
          </Standfirst>
          <div className="story-card mt-7 p-4 sm:p-6">
            <BubbleMap
              bubbles={mapBubbles}
              height={380}
              note={
                <>
                  Circle area is proportional to export value. Joined on ISO country code, not on
                  name. Aggregates — the European Union line, whose members also report separately —
                  are excluded here and would otherwise sit ninth.
                </>
              }
            />
          </div>
        </section>
      )}

      {/* ── The two things a chip export is not ───────────────────────── */}
      {w.present && (
        <section className="mt-14 grid gap-4 sm:grid-cols-2">
          <div className="story-card p-5 sm:p-6" data-tone="mid">
            <Eyebrow tone="mid">the largest chip exporter fabricates none</Eyebrow>
            <p className="story-display mt-3 text-[32px] sm:text-[38px]">
              {wusd(valueOf(chips24?.exporters ?? [], HONG_KONG_CODE))}
            </p>
            <p className="mt-2.5 text-[13px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
              Hong Kong&rsquo;s chip exports in 2024 — more than anywhere else on earth — against{" "}
              {wusd(valueOf(chips24?.importers ?? [], HONG_KONG_CODE))} of imports. Chips arrive and
              leave. It is a port, not a foundry, and it is the clearest demonstration in this data
              that <strong>an export is a shipment, not a wafer</strong>.
            </p>
          </div>
          <div className="story-card p-5 sm:p-6" data-tone="mid">
            <Eyebrow tone="mid">the second largest exporter has no name</Eyebrow>
            <p className="story-display mt-3 text-[32px] sm:text-[38px]">
              &ldquo;Other Asia, nes&rdquo;
            </p>
            <p className="mt-2.5 text-[13px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
              That is how Taiwan — {wusd(valueOf(chips24?.exporters ?? [], TAIWAN_CODE))} of chip
              exports, and most of the world&rsquo;s leading-edge fabrication — appears in United
              Nations trade statistics, because it has no seat. The label is the source&rsquo;s. What
              it denotes is not in dispute, and every chart here that draws it says both.
            </p>
          </div>
        </section>
      )}

      {/* ── Bought vs sold, per country ───────────────────────────────── */}
      {w.present && chips24 && (
        <section className="mt-16">
          <Eyebrow>what each country does with chips</Eyebrow>
          <Headline>Bought on the Left, Sold on the Right.</Headline>
          <Standfirst>
            The twelve largest chip importers, with what each one sells beside what it buys, on one
            shared scale. Most of them are close to symmetrical: chips come in, get assembled into
            something, and go back out. India&rsquo;s right-hand bar is not short. It is{" "}
            <Mark>invisible</Mark>.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7">
            <DivergingRanks
              leftLabel="imported"
              rightLabel="exported"
              leftTone="hot"
              rightTone="cool"
              rows={chipM.rows.slice(0, 12).map((c) => ({
                name: c.code === TAIWAN_CODE ? "Taiwan *"
                  : c.name.replace("China, Hong Kong SAR", "Hong Kong").replace("Rep. of Korea", "Korea"),
                left: c.value,
                right: valueOf(chipX.rows, c.code),
                leftDisplay: wusd(c.value),
                rightDisplay: wusd(valueOf(chipX.rows, c.code)),
                mark: c.code === INDIA_CODE,
              }))}
            />
            <Caption>
              Both sides share one scale, so a bar&rsquo;s length is comparable across the whole
              chart. * is the source&rsquo;s own label for Taiwan. The mirror asymmetry in these
              figures — the world&rsquo;s reported exports never equal its reported imports — is
              left unreconciled, because reconciling it would mean choosing one country&rsquo;s
              customs over another&rsquo;s.
            </Caption>
          </div>
        </section>
      )}

      {/* ── The cover ranking ─────────────────────────────────────────── */}
      {w.present && indiaCover && (
        <section className="mt-16">
          <Eyebrow tone="hot">the ratio that ranks India last</Eyebrow>
          <Headline>Cents of Chips Sold, per Dollar Bought.</Headline>
          <Standfirst>
            The world&rsquo;s twenty-five largest chip importers, worst cover first. This is a ratio
            of two numbers the same country filed in the same year, so it sidesteps the mirror
            asymmetry entirely. India is <Mark>{indiaCoverPlace}st</Mark> of twenty-five, on{" "}
            <Mark>{indiaCover.cov.toFixed(1)}%</Mark>.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7">
            <RankedRows
              tone="hot"
              markTone="hot"
              rows={coverRows.slice(0, 16).map((r) => ({
                name: r.c.code === TAIWAN_CODE ? "Taiwan *"
                  : r.c.name.replace("China, Hong Kong SAR", "Hong Kong").replace("Rep. of Korea", "Korea"),
                value: r.cov,
                display: `${r.cov.toFixed(1)}%`,
                mark: r.c.code === INDIA_CODE,
                meta: `${wusd(r.c.value)} in`,
              }))}
            />
            <Caption>
              Exports of HS 8542 as a percentage of imports of HS 8542, 2024. Above 100% means a
              country sells more chips than it buys — {coverRows.filter((r) => r.cov >= 100).length}{" "}
              of these twenty-five do. Restricted to large importers because a ratio on a small
              denominator is noise: every country here buys over a billion dollars of chips a year.
            </Caption>
          </div>
        </section>
      )}

      {/* ── The tools ─────────────────────────────────────────────────── */}
      {w.present && tools24 && (
        <section className="mt-16">
          <Eyebrow tone="mid">the market nobody ranks</Eyebrow>
          <Headline>Whoever Sells the Machines Decides Who Can Build.</Headline>
          <Standfirst>
            HS 8486 is the lithography, deposition, etch and test equipment a fab is made of — a{" "}
            {wusd(worldToolX)} market against a {wusd(worldChipX)} one, and far more concentrated.
            Three countries are <Mark tone="mid">{top3ToolShare.toFixed(0)}%</Mark> of it. A country
            can climb the chip ranking by packaging other people&rsquo;s wafers; it cannot climb
            this one that way.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7">
            <ChartTitle note="Exports of semiconductor manufacturing equipment, 2024. Circle area is proportional to value.">
              Who sells fab equipment
            </ChartTitle>
            <PackedBubbles
              height={330}
              bubbles={toolX.rows.slice(0, 14).map((c) => ({
                name: c.code === TAIWAN_CODE ? "Taiwan"
                  : c.name.replace("China, Hong Kong SAR", "Hong Kong").replace("Rep. of Korea", "Korea").replace("USA", "US"),
                value: c.value,
                display: wusd(c.value),
                tone: "mid" as const,
              }))}
            />
            <div className="mt-7 grid gap-5 border-t pt-6 sm:grid-cols-2" style={{ borderColor: "var(--story-rule)" }}>
              <div>
                <Eyebrow tone="hot">India, on the same market</Eyebrow>
                <p className="story-display mt-2 text-[30px] sm:text-[36px]">{wusd(indiaToolX)}</p>
                <p className="mt-2 text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>
                  Exported in 2024 — {indiaToolXRank}th of {toolX.rows.length} reporting countries.
                </p>
              </div>
              <div>
                <Eyebrow tone="mid">and on the buying side</Eyebrow>
                <p className="story-display mt-2 text-[30px] sm:text-[36px]">{wusd(indiaToolM)}</p>
                <p className="mt-2 text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>
                  Imported, {rankOf(toolM.rows, INDIA_CODE)}th in the world. India is buying{" "}
                  {indiaToolX > 0 ? `${Math.round(indiaToolM / indiaToolX)}×` : "vastly"} more fab
                  equipment than it sells — which is exactly what a country building fabs would
                  look like, and is not yet evidence that any are running.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── The stage ladder ──────────────────────────────────────────── */}
      {w.present && (
        <section className="mt-16">
          <Eyebrow>stage by stage</Eyebrow>
          <Headline>Which Countries Sit Where.</Headline>
          <Standfirst>
            Four positions in the semiconductor trade, and where the largest exporters and India
            stand in each. All four run the same way — a fuller, cooler cell is further up the
            chain — and every one of them is a rank in the data on this page, not a judgement about
            capability, which trade statistics cannot see.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7">
            <StageLadder
              stages={["Sells the tools", "Sells chips", "Sells discretes", "Covers its own bill"]}
              gradeLabels={["absent", "present", "significant", "leading"]}
              rows={ladder}
            />
            <Caption>
              <strong>How each cell was computed.</strong> For the three ranking columns — tools
            (HS 8486), chips (HS 8542) and discrete devices (HS 8541): top five
              of 2024 exports is &ldquo;leading&rdquo;, top fifteen is &ldquo;significant&rdquo;,
              ranked at all is &ldquo;present&rdquo;, unranked is &ldquo;absent&rdquo;. For cover:
              at or above 100% is leading, 50% significant, 10% present, below that absent. Deliberately crude — a finer scale would imply this data
              supports a finer reading. * Taiwan appears in the source as &ldquo;Other Asia,
              nes&rdquo;. † Hong Kong is an entrepôt: its high grades are shipments passing through,
              not production, which is the caveat the whole page turns on.
            </Caption>
          </div>
        </section>
      )}

      {/* ── Where India's chips come from ─────────────────────────────── */}
      {w.present && sources.length > 0 && (
        <section className="mt-16">
          <Eyebrow tone="hot">origin</Eyebrow>
          <Headline>Where India&rsquo;s Chips Come From.</Headline>
          <Standfirst>
            India&rsquo;s integrated circuit imports in {chips?.indiaPartnerYear}, by country of
            origin as India&rsquo;s own customs report it, area proportional to value. Three
            origins are <Mark>{(((sources[0]?.value ?? 0) + (sources[1]?.value ?? 0) + (sources[2]?.value ?? 0)) / sourceTotal * 100).toFixed(0)}%</Mark>{" "}
            of the bill, and the second of them is the one the source will not name.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7">
            <Treemap
              items={sources.slice(0, 16).map((c, i) => ({
                name: c.code === TAIWAN_CODE ? "Taiwan"
                  : c.name.replace("China, Hong Kong SAR", "Hong Kong").replace("Rep. of Korea", "Korea").replace("USA", "US"),
                value: c.value,
                display: `${wusd(c.value)} · ${((c.value / sourceTotal) * 100).toFixed(0)}%`,
                tone: "hot" as const,
                mark: i === 0,
              }))}
            />
            <Caption>
              The top {Math.min(16, sources.length)} of {sources.length} reported origins, which are{" "}
              {((sources.slice(0, 16).reduce((a, b) => a + b.value, 0) / sourceTotal) * 100).toFixed(0)}%
              of the total. Country of consignment, not of fabrication: a wafer made in Taiwan,
              packaged in Malaysia and shipped from Singapore arrives as Singaporean.
            </Caption>
          </div>
        </section>
      )}

      {/* ── The flip ──────────────────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow tone="cool">what went right</Eyebrow>
        <Headline>The Phone Bill Flipped.</Headline>
        <Standfirst>
          None of the above is a story of failure, and this is why. Telephones and telecom
          apparatus ran India&rsquo;s largest electronics deficit and now run a surplus — a swing of{" "}
          <Mark tone="cool">{usd(swing)}</Mark> in {telNow.year - telWorst.year} years. The chip
          bill is the price of it: every phone assembled here contains chips bought elsewhere, so
          assembling more phones necessarily buys more chips. Both facts are true at once.
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
          <Caption>
            Bar length is the size of the balance, not its direction — a long red bar and a long
            green bar are equally large and opposite. This heading is only comparable from{" "}
            {telecom.comparableFrom ?? 2012}: before the 2007 tariff revision handsets sat under a
            different code, and those rows are a different measurement.
          </Caption>
        </div>
      </section>

      {/* ── The bill that grew ────────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow tone="hot">what it cost</Eyebrow>
        <Headline>And the Chip Bill Grew With It.</Headline>
        <Standfirst>
          Integrated circuit imports, in billions of dollars. Hover a column for what the gap before
          it means. The {icNow.year} figure is{" "}
          <Mark>{(icNow.imports / icThen.imports).toFixed(0)}×</Mark> the {icThen.year} one.
        </Standfirst>
        <div className="story-card mt-7 p-5 sm:p-7">
          <Columns points={ic.rows.map(col)} tone="hot" height={200} format={(v) => v.toFixed(1)} />
          <Caption>
            US$ billion, nominal, not deflated. {ic.rows.find((r) => r.suspect) && (
              <>The <span style={{ color: "var(--s-hot)" }}>2008 column is visibly wrong</span> —
              imports halve in a year when India&rsquo;s total merchandise imports more than tripled
              against 2004. That is a classification break in the reported data, not a fall in chip
              imports. It is flagged and left alone, because no correction exists that would not be
              a number this project invented.</>
            )}
          </Caption>
        </div>
      </section>

      {/* ── Scale, as a countable share ───────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow>how big is that, really</Eyebrow>
        <Headline>Every Hundred Dollars India Spends on Electronics Abroad.</Headline>
        <div className="story-card mt-7 p-5 sm:p-7">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <ChartTitle note={`HS chapter 85 imports, ${ch85Now.year}: ${usd(ch85Now.imports)} in total. One square is one dollar in a hundred.`}>
                The electronics import bill
              </ChartTitle>
              <Waffle
                parts={[
                  { label: "integrated circuits (HS 8542)", share: icNow.imports, tone: "hot",
                    display: `${icShareOfElectronics.toFixed(0)}%` },
                  { label: "everything else in chapter 85", share: ch85Now.imports - icNow.imports, tone: "cool",
                    display: `${(100 - icShareOfElectronics).toFixed(0)}%` },
                ]}
              />
            </div>
            <div className="grid content-start gap-4">
              <Stat size="sm" tone="hot" label="share of all merchandise imports"
                value={`${icShareOfAll.toFixed(1)}%`}
                note={`Of ${usd(merchNow.imports)} of everything India imported in ${merchNow.year}. One four-digit tariff heading.`} />
              <Stat size="sm" tone="cool" label="electronics exports"
                value={`$${bn(ch85Now.exports)}bn`}
                note={`Chapter 85 exports in ${ch85Now.year}, up from ${usd(ch85.rows[0]!.exports)} in ${ch85.rows[0]!.year}. The assembly build-out is visible here too.`} />
            </div>
          </div>
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
            surge as a semiconductor dependency, and it gets added regularly.
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
          It is not a shortage. Nothing on the shelves is missing because of this number — the chips
          arrive, they are paid for in dollars, and they go into phones increasingly assembled here
          and sold abroad. What the number measures is where the value goes.
        </Standfirst>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <div className="story-card p-5" data-tone="cool">
            <Eyebrow tone="cool">the phone in your hand</Eyebrow>
            <p className="mt-3 text-[13.5px] leading-[1.6]">
              Increasingly assembled in India, and increasingly exported: telecom apparatus exports
              went from {usd(at(telecom, 2017)?.exports ?? 0)} in 2017 to {usd(telNow.exports)} in{" "}
              {telNow.year}. That is jobs, and it is real.
            </p>
          </div>
          <div className="story-card p-5" data-tone="hot">
            <Eyebrow tone="hot">the chips inside it</Eyebrow>
            <p className="mt-3 text-[13.5px] leading-[1.6]">
              Imported. India&rsquo;s IC exports are {exportCover.toFixed(1)}% of its IC imports, and
              that ratio has not improved: in {icThen.year} it was{" "}
              {((icThen.exports / icThen.imports) * 100).toFixed(1)}%.
            </p>
          </div>
          <div className="story-card p-5" data-tone="mid">
            <Eyebrow tone="mid">what a fab would change</Eyebrow>
            <p className="mt-3 text-[13.5px] leading-[1.6]">
              This series, eventually — and not soon. The fab-equipment import line is the first
              place a build-out would show, and nothing in trade data can tell you whether an
              announced plant will run.
            </p>
          </div>
        </div>
      </section>

      <WhatThisCannotSay
        items={[
          {
            q: "Whether a country fabricates the chips it exports",
            a: <>No. Hong Kong is the largest chip exporter on earth and fabricates none; a wafer made in one country, packaged in a second and shipped from a third is counted as the third&rsquo;s export. That is why HS 8486 is on this page and why the stage ladder grades tools separately.</>,
          },
          {
            q: "Whether India makes any of these chips",
            a: <>Customs data records what crossed a border, not what was produced. A fall in imports could be a fab starting up or demand collapsing, and this series cannot tell them apart.</>,
          },
          {
            q: "How much of an assembled phone is Indian",
            a: <>Nothing here measures value added. A phone exported from India carries its imported components in its export value, so the {usd(surplus(telNow))} surplus is a gross figure and not a measure of domestic content.</>,
          },
          {
            q: "Why the world's imports and exports do not match",
            a: <>Because they never do. Exports are valued at the border of departure and imports at the border of arrival, freight and insurance in between, and not every country files every year. Both sides are printed here unreconciled — reconciling them would mean choosing one country&rsquo;s customs over another&rsquo;s.</>,
          },
          {
            q: "What happened in twelve of India's years",
            a: <>{d.unsampledYears.length} of {d.sampledYears.length + d.unsampledYears.length} years between {icThen.year} and {icNow.year} were not sampled by the upstream ingest — {d.unsampledYears.join(", ")}. The charts show the years that exist and do not interpolate across the gaps.</>,
          },
          {
            q: "Whether 2008 is a real fall",
            a: <>No. It is a classification break: the 2008 file carries none of the HS2007 IC codes. Flagged on the chart and left uncorrected.</>,
          },
          {
            q: "Anything about prices, capacity or process nodes",
            a: <>Figures are nominal US dollars and are not deflated. No wafer capacity, fab count or node appears anywhere on this page, because trade data cannot see any of them.</>,
          },
          {
            q: "What the announced fabs are worth",
            a: <>Nothing here carries a fab&rsquo;s sanctioned outlay, because none is sourced yet. The contract ledger this site runs against Press Information Bureau releases filters for defence acquisitions by construction — a fab approval has neither a defence institution nor an acquisition verb in it — so a semiconductor ledger needs its own reader and its own checks. Until it exists, the figures quoted for Dholera, Sanand and Jagiroad are not repeated here.</>,
          },
          {
            q: "Who owns the assembly",
            a: <>Not in this data. Trade statistics name a country, never a firm, so nothing here distinguishes an Indian-owned plant from a contract manufacturer operating in India.</>,
          },
        ]}
      />

      <Sources>
        India&rsquo;s own series: {d.source} Built {d.builtAt.slice(0, 10)}.
        {w.present && <> Countrywise: {w.source} Built {w.builtAt.slice(0, 10)}
          {w.diagnostics && <> from {w.diagnostics.calls} calls, {w.diagnostics.failed} of which
          failed and are listed in the file.</>}</>}{" "}
        Every figure on this page is arithmetic on those two files; none is typed in.{" "}
        <Link href="/made-in-india" className="underline">
          The wider product-by-product picture
        </Link>
        .
      </Sources>
    </div>
  );
}
