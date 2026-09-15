import Link from "next/link";
import { getSeries, latestPoint, firstPoint } from "@/lib/data";
import { loadDeals, MEASURE_LABEL, asWritten, croreValue, type Measure } from "@/lib/deals";
import { getDefenceTrade, scaleComparison, usd } from "@/lib/defence-trade";
import { loadDrones } from "@/lib/drones";
import {
  Eyebrow, Headline, Standfirst, Mark, Stat, Columns, BarRow, pct,
  WhatThisCannotSay, Sources,
} from "@/components/stories/Kit";
import {
  ChartTitle, Caption, RankedRows, DivergingRanks, Waffle, BubbleMap,
  Treemap, PairedChange, isoForCountryName,
} from "@/components/stories/Charts";

/**
 * The fastest-growing number in Indian industry, and what it counts.
 *
 * ── The argument ─────────────────────────────────────────────────────────
 *
 * Defence exports went from ₹686 crore in FY2013-14 to ₹38,424 crore in
 * FY2025-26. That is a real and very large increase, it is the number every
 * account of Indian defence manufacturing leads with, and almost nobody who
 * quotes it can say what it measures.
 *
 * Three things it is not. It is nominal rupees, and roughly a third of the
 * growth is inflation and depreciation rather than volume. It counts export
 * *authorisations* — permissions to ship — rather than completed shipments.
 * And 64.5% of its value is private-sector, most of which is components and
 * sub-assemblies feeding foreign prime contractors rather than finished
 * platforms sold under an Indian badge.
 *
 * None of that makes it a bad number. It makes it a specific one, and the
 * story is better for saying which.
 *
 * ── The number that is more interesting than the headline ────────────────
 *
 * Russia's share of Indian arms imports halved from 72% in 2010-14 to 36% in
 * 2020-24. That is the clearest structural shift in Indian procurement in a
 * generation and it gets a fraction of the attention the export figure does,
 * partly because it is a share rather than a total and nothing about it makes
 * a headline.
 */

export const metadata = {
  title: "The defence export number · Bharat Tracker",
  description:
    "Defence exports are up more than fiftyfold in a decade. The figure is real, it counts " +
    "authorisations rather than shipments, and a third of it is inflation.",
};

/** Rupee crore as the story prints it: ₹38,424 cr, ₹1.78 lakh cr. */
function cr(v: number): string {
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(2)} lakh cr`;
  return `₹${Math.round(v).toLocaleString("en-IN")} cr`;
}

export default function DefenceStory() {
  const exports = getSeries("defence-exports");
  const production = getSeries("defence-production");
  const auth = getSeries("defence-export-authorisations");
  const privExp = getSeries("defence-export-private-share");
  const privProd = getSeries("defence-production-private-share");
  const dests = getSeries("defence-export-destinations");
  const russia = getSeries("arms-imports-russia-share");
  const globalShare = getSeries("arms-imports-global-share");
  const budget = getSeries("defence-budget");
  const capital = getSeries("defence-capital-outlay");
  const deals = loadDeals();
  const trade = getDefenceTrade();
  const drones = loadDrones();

  if (!exports) {
    return (
      <div className="pt-12">
        <Eyebrow>not built</Eyebrow>
        <Headline>The defence series are not in this deployment.</Headline>
      </div>
    );
  }

  const expFirst = firstPoint(exports)!;
  const expLast = latestPoint(exports)!;
  const multiple = (expLast.value ?? 0) / (expFirst.value ?? 1);
  const prodFirst = production ? firstPoint(production) : undefined;
  const prodLast = production ? latestPoint(production) : undefined;

  const rusPoints = russia?.points.filter((p) => p.value !== null) ?? [];
  const rusFrom = rusPoints[0];
  const rusTo = rusPoints[rusPoints.length - 1];

  // Contracts the government announced itself, from the PIB ledger. Kept as a
  // separate count from the export figure because they are different things:
  // one is what India sold abroad, the other what it bought at home.
  const contracts = deals.deals.filter((x) => x.measure === "contract");
  const aons = deals.deals.filter((x) => x.measure === "acceptance-of-necessity");

  /* ── What customs can see of all this ─────────────────────────────── */
  const tradeYear = trade.years[trade.years.length - 1] ?? 2024;
  const scale = scaleComparison(trade, tradeYear);
  /**
   * The one heading the tariff itself calls military.
   *
   * HS 9301 plus 930591 — weapons of war and their parts. This is as close as
   * the customs classification gets to naming defence equipment, and putting
   * it beside the Ministry's export figure is the whole point of the section
   * it drives: they differ by a factor of hundreds, and neither is wrong.
   */
  const military = trade.groups.find((g) => g.id === "ch93-military-weapons");
  const milYear = military?.years.find((y) => y.year === tradeYear);
  const milExports = milYear?.reported ? (milYear.exports ?? 0) : 0;
  /**
   * The Ministry's figure converted at a stated rate, once, to make one
   * comparison possible — and labelled everywhere it appears.
   *
   * Nothing else on this site converts currency. It is done here because the
   * comparison is the finding, and a reader cannot compare ₹38,424 crore with
   * US$16.3m without it. The rate is printed, so the arithmetic is checkable
   * and the reader can redo it at whatever rate they prefer.
   */
  const RATE = 83;
  const officialUsd = ((expLast.value ?? 0) * 1e7) / RATE;
  const customsShare = officialUsd > 0 ? (milExports / officialUsd) * 100 : 0;

  /**
   * The announced figures that can be put on one scale.
   *
   * A release may print several figures — a total and its parts — and the
   * ledger keeps all of them. For a chart, the largest is the event's own
   * headline number and the rest are its breakdown, so summing them would
   * double-count. Anything `croreValue` cannot size (a dollar figure, an
   * unrecognised unit) is dropped from the chart and stays in the list.
   */
  const sized = [...contracts, ...aons]
    .map((x) => {
      const values = x.money.map(croreValue).filter((v): v is number => v !== null);
      const crore = values.length > 0 ? Math.max(...values) : null;
      return crore === null ? null : {
        crore,
        measure: x.measure,
        short: x.title
          .replace(/^(Aatmanirbhar Bharat:\s*|Further boost to [^;]*;\s*)/i, "")
          .replace(/^MoD /, "")
          .slice(0, 46),
      };
    })
    .filter((x): x is { crore: number; measure: Measure; short: string } => x !== null)
    .sort((a, b) => b.crore - a.crore);

  /* ── Armed and reconnaissance drones, worldwide ───────────────────── */
  const droneOperators = [...drones.countries]
    .sort((a, b) => b.types.length - a.types.length);
  const indiaDrones = droneOperators.find((c) => c.country === "India");
  const indiaSupplies = drones.suppliers.find((s) => s.originCountry === "India"
    || s.origin === "India");

  return (
    <div>
      <header className="pt-10">
        <Eyebrow tone="mid">
          defence · manufacturing · {expFirst.period}–{expLast.period}
        </Eyebrow>
        <h1 className="story-display mt-4 max-w-[19ch] text-[38px] sm:text-[54px] lg:text-[62px]">
          The Fastest-Growing Number in Indian Industry, and What It Counts.
        </h1>
        <Standfirst>
          Defence exports went from <Mark tone="mid">{cr(expFirst.value ?? 0)}</Mark> in{" "}
          {expFirst.period} to <Mark tone="mid">{cr(expLast.value ?? 0)}</Mark> in{" "}
          {expLast.period}. That is real, it is large, and it is the figure every account of
          Indian defence manufacturing leads with. It is also an authorisation rather than a
          shipment, a third of it is inflation, and most of its value is parts.
        </Standfirst>
      </header>

      {/* ── The headline ──────────────────────────────────────────────── */}
      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <Stat
          tone="mid"
          label={`defence exports · ${expLast.period}`}
          value={cr(expLast.value ?? 0)}
          note={<>Up from {cr(expFirst.value ?? 0)} in {expFirst.period} — a factor of{" "}
            {multiple.toFixed(0)} in {exports.points.length - 1} years.</>}
        />
        {prodLast && (
          <Stat
            tone="cool" size="md"
            label={`defence production · ${prodLast.period}`}
            value={cr(prodLast.value ?? 0)}
            note={<>From {cr(prodFirst?.value ?? 0)} in {prodFirst?.period}. Production value
              includes imported content, so it is output made here rather than content made here.</>}
          />
        )}
        {dests && latestPoint(dests) && (
          <Stat
            tone="cool" size="md"
            label={`destinations · ${latestPoint(dests)!.period}`}
            value={String(latestPoint(dests)!.value)}
            note="Reported as around eighty countries. Breadth includes small consignments of parts and ammunition, so a country count overstates strategic reach."
          />
        )}
      </section>

      {/* ── The series ────────────────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow tone="mid">the curve everyone quotes</Eyebrow>
        <Headline>Twelve Years, Fifty-Six Times.</Headline>
        <Standfirst>
          Nominal rupee crore. Two years are missing rather than estimated:{" "}
          <Mark tone="mid">FY2014-15 and FY2015-16</Mark> have no primary figure this project
          could find, and a straight line drawn through them would have looked exactly like data.
        </Standfirst>
        <div className="story-card mt-7 p-5 sm:p-7">
          <Columns
            points={exports.points.map((p) => ({
              label: p.period.replace("FY", "").replace("20", ""),
              value: p.value ?? 0,
              note: p.value === null
                ? `${p.period}: no primary figure. Omitted rather than interpolated.`
                : undefined,
            }))}
            tone="mid"
            height={200}
            format={(v) => (v === 0 ? "—" : v >= 10000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v)))}
          />
          <p className="mt-6 text-[12px] leading-[1.6]" style={{ color: "var(--story-ink-3)" }}>
            ₹ crore, nominal, not deflated. Roughly a third of the growth between {expFirst.period}{" "}
            and {expLast.period} is rupee inflation and depreciation rather than volume. Columns
            marked &ldquo;—&rdquo; are years with no figure.
          </p>
        </div>
      </section>

      {/* ── What the number counts ────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow tone="hot">read the label</Eyebrow>
        <Headline>What That Figure Actually Measures.</Headline>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {auth && latestPoint(auth) && (
            <div className="story-card p-5" data-tone="hot">
              <Eyebrow tone="hot">authorisations, not shipments</Eyebrow>
              <p className="story-display mt-3 text-[38px]">{latestPoint(auth)!.value}</p>
              <p className="mt-2.5 text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>
                export authorisations issued in {latestPoint(auth)!.period}. An authorisation is a
                permission to export, not a completed sale — it counts how many exporters are
                participating, which is a different and also useful thing.
              </p>
            </div>
          )}
          {privExp && latestPoint(privExp) && (
            <div className="story-card p-5" data-tone="hot">
              <Eyebrow tone="hot">mostly components</Eyebrow>
              <p className="story-display mt-3 text-[38px]">{pct(latestPoint(privExp)!.value)}</p>
              <p className="mt-2.5 text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>
                of export value is private sector, in {latestPoint(privExp)!.period}. Much of that
                is components and sub-assemblies feeding foreign prime contractors, not finished
                platforms sold under an Indian badge.
              </p>
            </div>
          )}
          <div className="story-card p-5" data-tone="hot">
            <Eyebrow tone="hot">nominal rupees</Eyebrow>
            <p className="story-display mt-3 text-[38px]">~⅓</p>
            <p className="mt-2.5 text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>
              of the growth since {expFirst.period} is inflation and rupee depreciation rather than
              volume. The rise is still large after that. It is not {multiple.toFixed(0)}× in real
              terms.
            </p>
          </div>
        </div>
      </section>

      {/* ── The structural shift ──────────────────────────────────────── */}
      {/* ── What customs can see ─────────────────────────────────────── */}
      {military && milYear?.reported && (
        <section className="mt-16">
          <Eyebrow tone="hot">two measurements of the same industry</Eyebrow>
          <Headline>Customs Can See Half a Per Cent of It.</Headline>
          <Standfirst>
            The Ministry&rsquo;s {expLast.period} export figure is {cr(expLast.value ?? 0)}. In the
            same period, the one tariff heading the classification itself calls military —
            weapons of war and their parts — recorded <Mark>{usd(milExports)}</Mark> of Indian
            exports. Neither number is wrong. They are measuring different things, and the gap
            between them is the most useful thing on this page.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7" data-tone="hot">
            <div className="grid gap-7 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
              <div className="min-w-0">
                <Eyebrow tone="hot">customs as a share of the official figure</Eyebrow>
                <p className="story-display mt-3 text-[48px] sm:text-[58px]">
                  {customsShare < 1 ? customsShare.toFixed(2) : customsShare.toFixed(1)}%
                </p>
                <p className="mt-3 text-[12.5px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
                  {usd(milExports)} against {cr(expLast.value ?? 0)}, converted once at ₹{RATE} to
                  the dollar purely so the two can sit on one line. Nothing else on this site
                  converts currency; the rate is printed so you can redo it.
                </p>
              </div>
              <div className="min-w-0">
                <ChartTitle note={`Why: a defence export authorisation covers services, offsets, licensed production and platforms that never cross a customs border. And the tariff scatters what does cross it across chapters 88, 89 and 93 — most of them civil lines with military content inside.`}>
                  Where the hardware actually sits in the tariff, {tradeYear}
                </ChartTitle>
                <DivergingRanks
                  leftLabel="imported"
                  rightLabel="exported"
                  leftTone="hot"
                  rightTone="cool"
                  rows={scale.filter((r) => r.imports !== null || r.exports !== null).map((r) => ({
                    name: r.label
                      .replace(/ \(HS [^)]*\)/, "")
                      .replace("Aircraft: helicopters and aeroplanes", "Aircraft")
                      .replace("Aircraft and spacecraft parts", "Aircraft parts")
                      .replace("Other vessels, explicitly NOT warships", "Non-warship vessels")
                      .replace("Spacecraft and launch vehicles", "Spacecraft")
                      .replace("Machines for making semiconductor devices", "Fab equipment")
                      .replace("Military weapons only", "Military weapons")
                      .replace(", in full", ""),
                    left: r.imports ?? 0,
                    right: r.exports ?? 0,
                    leftDisplay: usd(r.imports),
                    rightDisplay: usd(r.exports),
                    mark: r.military === "military",
                  }))}
                />
                <Caption>
                  Bold rows are the groups the classification calls military outright. Everything
                  else is a civil-dominant line that happens to contain the defence-relevant
                  hardware — which is why the biggest bar here is aircraft, and why almost all of
                  it is airliners. {trade.caveat.slice(0, 200)}…
                </Caption>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Drones: operated, not supplied ───────────────────────────── */}
      {droneOperators.length > 0 && (
        <section className="mt-16">
          <Eyebrow tone="mid">one class of equipment, traced end to end</Eyebrow>
          <Headline>India Flies Five Types. It Supplies None.</Headline>
          <Standfirst>
            {drones.countryCount} countries are publicly recorded as operating one of{" "}
            {drones.typeCount} major armed or reconnaissance drone types. India operates{" "}
            <Mark tone="mid">{indiaDrones?.types.length ?? 0}</Mark> of them, from{" "}
            {(indiaDrones?.origins ?? []).join(" and ")} — and appears nowhere on the supplier
            side. It is the clearest single case of the gap between manufacturing and exporting,
            because here both ends of the chain are visible.
          </Standfirst>
          <div className="story-card mt-7 p-4 sm:p-6">
            <BubbleMap
              height={360}
              maxRadius={22}
              bubbles={droneOperators
                .map((c) => ({
                  id: isoForCountryName(c.country) ?? "",
                  name: c.country === "United States of America" ? "United States" : c.country,
                  value: c.types.length,
                  display: `${c.types.length} type${c.types.length === 1 ? "" : "s"}`,
                  tone: (c.country === "India" ? "cool" : "mid") as "cool" | "mid",
                  mark: c.country === "India",
                }))
                .filter((b) => b.id !== "")}
              note={
                <>
                  Circle area is proportional to the number of distinct types a country is recorded
                  as operating — not to how many airframes it has, which no public source states.
                  {" "}{drones.gap.slice(0, 180)}…
                </>
              }
            />
            <div className="mt-7 grid gap-7 border-t pt-6 lg:grid-cols-2" style={{ borderColor: "var(--story-rule)" }}>
              <div className="min-w-0">
                <ChartTitle note="Countries recorded as operating at least one type from each producer.">
                  Who supplies them
                </ChartTitle>
                <RankedRows
                  tone="mid"
                  markTone="hot"
                  rows={drones.suppliers.map((sp) => ({
                    name: sp.origin,
                    value: sp.operators,
                    display: String(sp.operators),
                    mark: sp.origin === "India" || sp.originCountry === "India",
                    meta: sp.operators === 0 ? "no recorded export operator" : undefined,
                  }))}
                />
                <Caption>
                  {indiaSupplies
                    ? `India's own type in this set, DRDO's Rustom / TAPAS, has no recorded operator outside India — which is what a zero here means: a type that exists and has not been sold.`
                    : "India does not appear on this list."}
                </Caption>
              </div>
              <div className="min-w-0">
                <ChartTitle note="The types India is recorded as operating, and where each comes from.">
                  What India flies
                </ChartTitle>
                <ul className="m-0 list-none p-0">
                  {(indiaDrones?.types ?? []).map((name) => {
                    const t = drones.types.find((x) => x.name === name);
                    return (
                      <li key={name} className="flex items-baseline justify-between gap-3 border-b py-2.5 last:border-0"
                        style={{ borderColor: "var(--story-rule)" }}>
                        <span className="text-[13px] font-semibold">{name}</span>
                        <span className="mono shrink-0 text-[11px]" style={{ color: "var(--story-ink-3)" }}>
                          {t?.origin ?? "—"} · {t?.klass ?? "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <Caption>
                  All of them bought. None of them built here, and none of them exported from here.
                </Caption>
              </div>
            </div>
          </div>
        </section>
      )}

      {rusFrom && rusTo && (
        <section className="mt-16">
          <Eyebrow tone="cool">the number that matters more</Eyebrow>
          <Headline>Russia&rsquo;s Share of India&rsquo;s Arms Imports Halved.</Headline>
          <Standfirst>
            From <Mark tone="hot">{pct(rusFrom.value, 0)}</Mark> in {rusFrom.period} to{" "}
            <Mark tone="cool">{pct(rusTo.value, 0)}</Mark> in {rusTo.period}. This is the clearest
            structural change in Indian procurement in a generation, and it gets a fraction of the
            attention the export figure does — partly because it is a share rather than a total,
            and nothing about a share makes a headline.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7">
            <div className="space-y-2">
              <BarRow label={rusFrom.period} value={rusFrom.value ?? 0} max={100}
                display={pct(rusFrom.value, 0)} tone="hot" sub="Russian share" />
              <BarRow label={rusTo.period} value={rusTo.value ?? 0} max={100}
                display={pct(rusTo.value, 0)} tone="cool" sub="Russian share" />
            </div>
            <p className="mt-5 text-[12px] leading-[1.6]" style={{ color: "var(--story-ink-3)" }}>
              SIPRI shares of India&rsquo;s major-arms imports over five-year windows. Legacy
              Russian platforms still dominate the in-service fleet — supplier diversification in
              new orders is not the same as fleet composition, and the two are routinely confused.
              {globalShare && latestPoint(globalShare) && (
                <> India remained {pct(latestPoint(globalShare)!.value)} of global major-arms imports
                  in {latestPoint(globalShare)!.period}: still among the largest importers in the
                  world.</>
              )}
            </p>
          </div>
        </section>
      )}

      {/* ── Buying at home ───────────────────────────────────────────── */}
      {deals.present && (
        <section className="mt-16">
          <Eyebrow tone="mid">the other direction</Eyebrow>
          <Headline>What the Government Signed, in Its Own Words.</Headline>
          <Standfirst>
            {contracts.length} signed contracts and {aons.length} acceptances of necessity, each
            read from the press release that announced it. These are separate events and are never
            added: an acceptance of necessity is permission to begin procuring, and many never
            become contracts.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7">
            {sized.length > 0 && (
              <div className="mb-8">
                <ChartTitle note={`Area is proportional to the rupee figure the release printed. ${sized.length} of ${contracts.length + aons.length} events carry a figure this chart could size; the rest are in the ledger and not drawn.`}>
                  Every announced figure, on one scale
                </ChartTitle>
                <Treemap
                  height={320}
                  items={sized.slice(0, 18).map((x) => ({
                    name: x.short,
                    value: x.crore,
                    display: `₹${x.crore >= 100000 ? `${(x.crore / 100000).toFixed(2)} lakh cr` : `${Math.round(x.crore).toLocaleString("en-IN")} cr`}`,
                    tone: (x.measure === "contract" ? "cool" : "mid") as "cool" | "mid",
                    mark: x.measure === "contract",
                  }))}
                />
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px]">
                  <li className="flex items-center gap-1.5">
                    <span className="inline-block h-[10px] w-[16px] rounded-[2px]" style={{ background: "var(--s-cool)" }} />
                    signed contract — money committed
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="inline-block h-[10px] w-[16px] rounded-[2px]"
                      style={{ background: "var(--s-mid-fill)", border: "1px solid var(--s-mid)" }} />
                    acceptance of necessity — permission to begin
                  </li>
                </ul>
                <Caption>
                  The two are never added, and the chart puts them on one scale precisely so the
                  difference in size is visible: the largest rectangles here are permissions, not
                  purchases. {MEASURE_LABEL["acceptance-of-necessity"].means}
                </Caption>
              </div>
            )}
            <ul className="m-0 list-none space-y-0 p-0">
              {contracts.slice(0, 8).map((x) => (
                <li key={x.prid} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b py-2.5 last:border-b-0"
                  style={{ borderColor: "var(--story-rule)" }}>
                  <span className="mono w-[5.5rem] shrink-0 text-[11px]" style={{ color: "var(--story-ink-3)" }}>
                    {x.date}
                  </span>
                  {x.money[0] && (
                    <span className="mono shrink-0 text-[13px] font-bold" style={{ color: "var(--s-mid)" }}>
                      {asWritten(x.money[0])}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 text-[12.5px] leading-snug">
                    <a href={x.url} rel="noopener noreferrer nofollow" target="_blank" className="underline">
                      {x.title.slice(0, 110)}
                    </a>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] leading-[1.6]" style={{ color: "var(--story-ink-3)" }}>
              {contracts.length > 8 && <>Eight of {contracts.length} shown. </>}
              {MEASURE_LABEL["acceptance-of-necessity"].means}{" "}
              <Link href="/deals" className="underline">The full ledger, and what refused to answer</Link>.
            </p>
          </div>
        </section>
      )}

      {/* ── Budget reality ───────────────────────────────────────────── */}
      {budget && capital && latestPoint(budget) && latestPoint(capital) && (
        <section className="mt-16">
          <Eyebrow>where the money is</Eyebrow>
          <Headline>The Budget Line That Actually Buys Equipment.</Headline>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <Stat
              size="md" tone="mid"
              label={`total MoD budget · ${latestPoint(budget)!.period}`}
              value={cr(latestPoint(budget)!.value ?? 0)}
              note="Includes pensions, which are roughly a fifth of the total and buy no new capability. Comparisons with China's or America's budgets that ignore this overstate India's usable defence spend."
            />
            <Stat
              size="md" tone="cool"
              label={`capital outlay · ${latestPoint(capital)!.period}`}
              value={cr(latestPoint(capital)!.value ?? 0)}
              note="The single most informative line: it is what modernises the force. It has hovered near 26–27% of the defence budget for a decade, and that ratio is more telling than the headline total."
            />
          </div>
        </section>
      )}

      {/* ── Private share ─────────────────────────────────────────────── */}
      {privProd && latestPoint(privProd) && (
        <section className="mt-16">
          <Eyebrow>the industrial base</Eyebrow>
          <Headline>Private Industry Is {pct(latestPoint(privProd)!.value, 0)} of Production and{" "}
            {pct(privExp ? latestPoint(privExp)?.value : null)} of Exports.</Headline>
          <Standfirst>
            The gap between those two numbers is the interesting part: private firms punch far
            above their production weight in exports, because what they export is components into
            foreign supply chains rather than platforms. Whether a higher private share is good is
            genuinely contested — it signals a broader base, and says nothing about whether the
            output is indigenous or competitively priced.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7">
            <BarRow label="Share of production" value={latestPoint(privProd)!.value ?? 0} max={100}
              display={pct(latestPoint(privProd)!.value, 0)} tone="mid" sub={latestPoint(privProd)!.period} />
            {privExp && latestPoint(privExp) && (
              <BarRow label="Share of exports" value={latestPoint(privExp)!.value ?? 0} max={100}
                display={pct(latestPoint(privExp)!.value)} tone="cool" sub={latestPoint(privExp)!.period} />
            )}
          </div>
        </section>
      )}

      <WhatThisCannotSay
        items={[
          {
            q: "Whether anything was actually shipped",
            a: <>The export figure is a Ministry of Defence measure of authorised value covering services, offsets and platforms that never cross a customs frontier. It is not reconcilable with customs data and this project does not try.</>,
          },
          {
            q: "How much of it is Indian",
            a: <>Nothing here measures indigenous content. Production value includes imported components, so &ldquo;made in India&rdquo; in this series means assembled here, not designed or sourced here.</>,
          },
          {
            q: "What the startup ecosystem has produced",
            a: <>Not in this data. iDEX grants, DRDO technology transfers and the count of recognised defence startups are announced in press releases and are not published as a series anyone can read; the deals ledger picks up only what PIB announced as a contract.</>,
          },
          {
            q: "Whether a falling import share means self-reliance",
            a: <>Not necessarily. A falling share of global arms imports can equally mean delayed procurement. India remained one of the world&rsquo;s largest importers throughout the period this page covers.</>,
          },
          {
            q: "What any of it is worth in real terms",
            a: <>Every rupee figure here is nominal. Two years of the export series are missing and are shown as gaps rather than interpolated.</>,
          },
          {
            q: "How the corridors are doing",
            a: <>Committed and grounded investment are tracked separately on the defence tracker, and the difference between them is large. A commitment is not a factory.</>,
          },
        ]}
      />

      <Sources>
        Series from this site&rsquo;s defence catalogue, each with its own source and confidence
        grade; contracts from Press Information Bureau releases read by release id. Rupee figures
        are nominal.{" "}
        <Link href="/defence-tracker" className="underline">The full defence tracker</Link>
        {" · "}
        <Link href="/deals" className="underline">The contract ledger</Link>.
      </Sources>
    </div>
  );
}
