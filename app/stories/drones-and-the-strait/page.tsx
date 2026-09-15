import Link from "next/link";
import {
  loadChokepoints, energyLine, energyYear, shareFrom, split, gulfOf, nameOf,
  rankOf, valueOf, usd, INDIA_CODE, ISRAEL_CODE, IRAN_CODE,
  type Chokepoint, type CountryValue, type EnergyYear,
} from "@/lib/chokepoints";
import { loadIndiaUav, STAGES, atStage, pastPaper } from "@/lib/india-uav";
import { loadDrones } from "@/lib/drones";
import {
  Eyebrow, Headline, Standfirst, Mark, Stat, WhatThisCannotSay, Sources,
} from "@/components/stories/Kit";
import {
  ChartTitle, Caption, RankedRows, Waffle, StackedBars, BubbleMap, Treemap,
  DotStrip, PairedChange, isoForCountryName,
} from "@/components/stories/Charts";

/**
 * India's drones, and the water its oil comes through.
 *
 * ── Why these two subjects are one page ──────────────────────────────────
 *
 * Because they are the same exposure seen from two ends. The unmanned aircraft
 * India flies are bought, and bought from one party to the war now running in
 * West Asia. The energy India runs on arrives past the other. That is not a
 * rhetorical pairing — both halves are customs data, and the page is built so
 * a reader can check either.
 *
 * ── What this page will not do ───────────────────────────────────────────
 *
 * It does not narrate the war. Nothing in this repository sources a timeline
 * of it: there is a rolling news window, which is press reporting and says so,
 * and there is annual trade data, which cannot see a month. A page that
 * inferred a sequence of events from a customs series would be manufacturing
 * history out of arithmetic, and the temptation to do it is exactly why the
 * refusal is written into the data file as well as this comment.
 *
 * So the question it answers is the answerable one: what is actually at stake,
 * measured, and how had that position changed before any of this started.
 *
 * ── The distinction the whole Gulf section turns on ──────────────────────
 *
 * "Gulf oil" and "oil through Hormuz" are different quantities. Iraq, Kuwait,
 * Qatar, Bahrain and Iran load only inside the Strait. Saudi Arabia and the
 * UAE have pipelines to open water whose capacity is a fraction of their
 * exports. Oman's terminals are already past it. Every figure on this page
 * says which of the three sets it used, and the charts draw the uncertain
 * middle as a hatch rather than as a fourth colour — a different hue would
 * say "different thing", and the claim is "same thing, less certain".
 *
 * ── The finding that is not about oil ────────────────────────────────────
 *
 * Crude is the headline and LPG is the story. India's cooking gas — the
 * cylinder in a few hundred million kitchens — is almost entirely Gulf, and
 * unlike crude it has not diversified at all, because there is no Russian LPG
 * arbitrage to take. That is the sentence this page exists to make visible.
 */

export const metadata = {
  title: "India's drones, and the water its gas comes through · Bharat Tracker",
  description:
    "India flies bought drones and burns Gulf gas. What is measurably at stake in West Asia, " +
    "and how the position had already changed before any of it started.",
};

const CRUDE = "270900";
const LNG = "271111";
const PROPANE = "271112";
const BUTANE = "271113";
const REFINED = "2710";

/** Two LPG headings are one product in a kitchen. Summed, once, here. */
function lpgYear(
  d: ReturnType<typeof loadChokepoints>, year: number,
): EnergyYear | undefined {
  const p = energyYear(energyLine(d, PROPANE), year);
  const b = energyYear(energyLine(d, BUTANE), year);
  if (!p || !b) return undefined;
  const m = new Map<number, CountryValue>();
  for (const c of [...p.sources, ...b.sources]) {
    const prev = m.get(c.code);
    m.set(c.code, { code: c.code, name: c.name, value: (prev?.value ?? 0) + c.value });
  }
  return {
    year,
    total: p.total + b.total,
    sources: [...m.values()].sort((a, b2) => b2.value - a.value),
    batchesFailed: p.batchesFailed + b.batchesFailed,
  };
}

const TONE_FOR: Record<Chokepoint, "hot" | "mid" | "cool"> = {
  locked: "hot", bypass: "mid", outside: "cool",
};

export default function DronesAndStrait() {
  const d = loadChokepoints();
  const uav = loadIndiaUav();
  const fleet = loadDrones();

  if (!d.present) {
    return (
      <div className="pt-12">
        <Eyebrow>not built</Eyebrow>
        <Headline>The chokepoint file is not in this deployment.</Headline>
        <Standfirst>
          Run <span className="mono">npm run chokepoints</span> in CI to build{" "}
          <span className="mono">data/global/chokepoints.json</span>. Nothing here is typed in.
        </Standfirst>
      </div>
    );
  }

  const years = (energyLine(d, CRUDE)?.years ?? []).map((y) => y.year);
  const now = years[years.length - 1] ?? 2024;
  const then = years[0] ?? 2014;

  const crudeNow = energyYear(energyLine(d, CRUDE), now);
  const crudeThen = energyYear(energyLine(d, CRUDE), then);
  const lngNow = energyYear(energyLine(d, LNG), now);
  const lpgNow = lpgYear(d, now);
  const lpgThen = lpgYear(d, then);

  const crudeSplitNow = split(d, crudeNow);
  const crudeSplitThen = split(d, crudeThen);
  const lpgSplitNow = lpgNow ? split(d, lpgNow) : null;
  const lngSplitNow = split(d, lngNow);

  const crudeGulfNow = crudeSplitNow.locked + crudeSplitNow.bypass;
  const crudeGulfThen = crudeSplitThen.locked + crudeSplitThen.bypass;
  const lpgGulfNow = lpgSplitNow ? lpgSplitNow.locked + lpgSplitNow.bypass : 0;
  const lpgGulfThen = lpgThen ? split(d, lpgThen).locked + split(d, lpgThen).bypass : 0;

  const refinedNow = energyYear(energyLine(d, REFINED), now);
  const refinedThen = energyYear(energyLine(d, REFINED), then);
  const refinedGulfShare = refinedNow
    ? shareFrom(d, refinedNow, ["locked", "bypass", "outside"]).value : 0;

  /* ── The drone pipeline ───────────────────────────────────────────── */
  const past = pastPaper(uav);
  const droneYearNow = d.drones.years[d.drones.years.length - 1];
  const droneXRank = droneYearNow ? rankOf(droneYearNow.exporters, INDIA_CODE) : 0;
  const droneMRank = droneYearNow ? rankOf(droneYearNow.importers, INDIA_CODE) : 0;
  const droneX = droneYearNow ? valueOf(droneYearNow.exporters, INDIA_CODE) : 0;
  const droneM = droneYearNow ? valueOf(droneYearNow.importers, INDIA_CODE) : 0;
  const droneSources = d.drones.indiaImportsBySource;
  const droneSourceTotal = droneSources.reduce((a, b) => a + b.value, 0) || 1;

  const israeliTypes = fleet.types.filter(
    (t) => t.origin === "Israel" && t.operators.some((o) => o.country === "India"),
  );
  const indiaFleet = fleet.countries.find((c) => c.country === "India");

  /* ── Bilateral, with the two belligerents ─────────────────────────── */
  const bilat = d.bilateral;
  const iranFirst = bilat[0]?.partners.find((p) => p.code === IRAN_CODE);
  const iranLast = bilat[bilat.length - 1]?.partners.find((p) => p.code === IRAN_CODE);

  const stackRows = (line: string, label: (y: number) => string) =>
    (energyLine(d, line)?.years ?? []).map((y) => {
      const s = split(d, y);
      return {
        label: label(y.year),
        values: { locked: s.locked, bypass: s.bypass, outside: s.outside, elsewhere: s.elsewhere },
        total: y.total,
      };
    });

  const STACK_PARTS = [
    { key: "locked", label: "Gulf, no way out but the Strait", tone: "hot" as const },
    { key: "bypass", label: "Gulf, has a pipeline to open water", tone: "mid" as const, hatch: true },
    { key: "outside", label: "Gulf, already past the Strait (Oman)", tone: "cool" as const },
    { key: "elsewhere", label: "Everywhere else", tone: "cool" as const },
  ];

  return (
    <div>
      {/* ── Opening ───────────────────────────────────────────────────── */}
      <header className="pt-10">
        <Eyebrow tone="hot">drones · energy · exposure · {then}–{now}</Eyebrow>
        <h1 className="story-display mt-4 max-w-[18ch] text-[38px] sm:text-[54px] lg:text-[62px]">
          India Flies Bought Drones and Burns Gulf Gas.
        </h1>
        <Standfirst>
          Two things are measurable about India&rsquo;s position in a West Asian war, and both are
          customs data. The unmanned aircraft it operates are bought — {israeliTypes.length} of the{" "}
          {indiaFleet?.types.length ?? 0} types on public record come from Israel. And the cylinder
          in a few hundred million Indian kitchens is filled from the Gulf:{" "}
          <Mark>{lpgGulfNow.toFixed(0)}%</Mark> of India&rsquo;s cooking gas, against{" "}
          {crudeGulfNow.toFixed(0)}% of its crude.
        </Standfirst>
        <p className="mt-5 max-w-[62ch] rounded-lg border p-4 text-[13px] leading-[1.6]"
          style={{ borderColor: "var(--story-rule)", color: "var(--story-ink-2)" }}>
          <strong style={{ color: "var(--story-ink)" }}>What this page does not do.</strong>{" "}
          It does not narrate the war. Nothing in this repository sources a timeline of it, and
          annual customs data cannot see a month. Every figure here describes a position, not an
          event, and no causation is claimed between any number and anything that has happened.
        </p>
      </header>

      {/* ── Four numbers ──────────────────────────────────────────────── */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {lpgSplitNow && (
          <Stat size="md" tone="hot" label={`cooking gas from the Gulf · ${now}`}
            value={`${lpgGulfNow.toFixed(0)}%`}
            note={<>Of {usd(lpgSplitNow.total)} of LPG. It was {lpgGulfThen.toFixed(0)}% in {then} — this is the one line that has not diversified at all.</>} />
        )}
        <Stat size="md" tone="mid" label={`crude from the Gulf · ${now}`}
          value={`${crudeGulfNow.toFixed(0)}%`}
          note={<>Of {usd(crudeSplitNow.total)}. Down from {crudeGulfThen.toFixed(0)}% in {then}, and not because of any policy for this war.</>} />
        <Stat size="md" tone="hot" label="drone types operated, all bought"
          value={String(indiaFleet?.types.length ?? 0)}
          note={<>{israeliTypes.length} Israeli, the rest American. India supplies none to anyone — its own type in that set has no operator outside India.</>} />
        {uav.present && (
          <Stat size="md" tone="mid" label="UAV programmes past the drawing board"
            value={`${past.numerator}/${past.denominator}`}
            note={<>Flying or in service, of {past.denominator} live Indian programmes an encyclopaedia records. Cancelled ones are excluded from the denominator.</>} />
        )}
      </section>

      {/* ══ PART ONE ═════════════════════════════════════════════════════ */}
      <section className="mt-20 border-t pt-10" style={{ borderColor: "var(--story-rule)" }}>
        <Eyebrow tone="mid">part one · the next generation</Eyebrow>
        <Headline>What India Is Actually Building.</Headline>
        <Standfirst>
          &ldquo;Building the next generation of drones&rdquo; is a claim about a pipeline, so the
          useful axis is not how many programmes exist but how far along each one is. Below is
          every Indian unmanned aircraft programme the encyclopaedia&rsquo;s own categories index,
          sorted by the stage its article states — with that statement printed beside it.
        </Standfirst>
      </section>

      {uav.present ? (
        <section className="mt-7">
          <div className="story-card p-5 sm:p-7">
            <ChartTitle note={`${uav.counts.keptAsUnmanned} programmes, from ${uav.counts.articlesIndexed} articles indexed across ${uav.categories.length} categories. One dot is one programme.`}>
              The pipeline, by stage
            </ChartTitle>
            <DotStrip
              dotSize={9}
              gap={3}
              maxPerColumn={8}
              bins={STAGES.map((st) => ({
                label: st.label,
                count: uav.byStage[st.id] ?? 0,
                tone: st.tone,
              }))}
            />
            <Caption>
              The status field is free text and is bucketed, not paraphrased. Cancelled is tested
              first, because a cancelled programme&rsquo;s status line often names the stage it was
              cancelled from. A missing status is recorded as unstated rather than assumed to be in
              development, which is the assumption that would flatter the pipeline.
            </Caption>

            <div className="mt-8 grid gap-5 border-t pt-7 sm:grid-cols-2 lg:grid-cols-3"
              style={{ borderColor: "var(--story-rule)" }}>
              {STAGES.filter((st) => (uav.byStage[st.id] ?? 0) > 0).map((st) => (
                <div key={st.id} className="min-w-0">
                  <p className="story-eyebrow" style={{ color: `var(--s-${st.tone})` }}>
                    {st.label} · {uav.byStage[st.id]}
                  </p>
                  <ul className="mt-2.5 m-0 list-none p-0">
                    {atStage(uav, st.id).slice(0, 8).map((p) => (
                      <li key={p.title} className="border-b py-2 last:border-0"
                        style={{ borderColor: "var(--story-rule)" }}>
                        <span className="block text-[12.5px] font-semibold leading-tight">{p.title}</span>
                        <span className="mono block text-[10px] leading-tight"
                          style={{ color: "var(--story-ink-3)" }}>
                          {[p.role, p.manufacturer, p.firstFlight ? `flew ${p.firstFlight}` : null]
                            .filter(Boolean).join(" · ") || "—"}
                        </span>
                        {p.status && (
                          <span className="mt-0.5 block text-[11px] italic leading-tight"
                            style={{ color: "var(--story-ink-2)" }}>
                            &ldquo;{p.status.slice(0, 70)}&rdquo;
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] leading-[1.5]" style={{ color: "var(--story-ink-3)" }}>
                    {st.means}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-7">
          <div className="story-card p-5 sm:p-7" data-tone="mid">
            <Eyebrow tone="mid">not built</Eyebrow>
            <p className="mt-3 text-[13px] leading-[1.6]">
              The Indian UAV programme index has not been built in this deployment. Nothing is
              shown rather than a placeholder count.
            </p>
          </div>
        </section>
      )}

      {/* ── What it flies now ─────────────────────────────────────────── */}
      <section className="mt-14">
        <Eyebrow tone="hot">what is on strength today</Eyebrow>
        <Headline>Every Type India Flies Comes From Somewhere Else.</Headline>
        <Standfirst>
          The pipeline above is what India is building. This is what it has. Of the{" "}
          {fleet.typeCount} major armed and reconnaissance types on public record, India operates{" "}
          <Mark>{indiaFleet?.types.length ?? 0}</Mark> — and every one of them was designed and
          built abroad, {israeliTypes.length} of them by one party to the current war.
        </Standfirst>
        <div className="story-card mt-7 p-5 sm:p-7" data-tone="hot">
          <ul className="m-0 grid list-none gap-x-7 gap-y-0 p-0 sm:grid-cols-2">
            {(indiaFleet?.types ?? []).map((name) => {
              const t = fleet.types.find((x) => x.name === name);
              const israeli = t?.origin === "Israel";
              return (
                <li key={name} className="flex items-baseline justify-between gap-3 border-b py-2.5"
                  style={{ borderColor: "var(--story-rule)" }}>
                  <span className="text-[13px] font-semibold">{name}</span>
                  <span className="mono shrink-0 text-[11px]"
                    style={{ color: israeli ? "var(--s-hot)" : "var(--story-ink-3)" }}>
                    {t?.origin ?? "—"} · {t?.klass ?? "—"}
                  </span>
                </li>
              );
            })}
          </ul>
          <Caption>
            Operator records from each type&rsquo;s own article, not an inventory: no airframe
            counts, and no statement of whether a given type is armed in Indian service. Types
            whose operator lists are classified or thin do not appear at all, so this is a floor.
          </Caption>
        </div>
      </section>

      {/* ── The trade figure, and why it looks absurd ─────────────────── */}
      {droneYearNow && (
        <section className="mt-14">
          <Eyebrow>the only published drone trade number there is</Eyebrow>
          <Headline>And the Customs Data Sees Almost None of It.</Headline>
          <Standfirst>
            HS 8806 is unmanned aircraft as customs records them, and it has only existed since the
            2022 tariff revision. India&rsquo;s entire declared trade under it in {droneYearNow.year}{" "}
            is <Mark>{usd(droneM)}</Mark> of imports against {usd(droneX)} of exports — for a
            country flying Herons and Reapers. That is not an error in the data. It is what the
            heading measures.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7">
            <div className="grid gap-9 lg:grid-cols-2">
              <div className="min-w-0">
                <ChartTitle note={`Exports of HS 8806, ${droneYearNow.year}. Aggregates such as the European Union line are left in and labelled, because its members also report separately.`}>
                  Who sells drones
                </ChartTitle>
                <RankedRows
                  tone="mid"
                  markTone="hot"
                  rows={droneYearNow.exporters.slice(0, 12).map((c) => ({
                    name: nameOf(d, c),
                    value: c.value,
                    display: usd(c.value),
                    mark: c.code === INDIA_CODE,
                  }))}
                />
                <Caption>
                  India is <strong>{droneXRank}th</strong> of {droneYearNow.exporters.length}{" "}
                  reporting countries on the selling side and {droneMRank}th of{" "}
                  {droneYearNow.importers.length} on the buying side.
                </Caption>
              </div>
              <div className="min-w-0">
                <ChartTitle note={`India's HS 8806 imports by origin, ${d.drones.indiaPartnerYear}. Area is proportional to value.`}>
                  Where India&rsquo;s declared drones come from
                </ChartTitle>
                {droneSources.length > 0 ? (
                  <Treemap
                    height={240}
                    items={droneSources.slice(0, 8).map((c, i) => ({
                      name: nameOf(d, c),
                      value: c.value,
                      display: `${usd(c.value)} · ${((c.value / droneSourceTotal) * 100).toFixed(0)}%`,
                      tone: "hot" as const,
                      mark: i === 0,
                    }))}
                  />
                ) : (
                  <p className="text-[13px]" style={{ color: "var(--story-ink-2)" }}>
                    No origin breakdown was returned for this heading.
                  </p>
                )}
                <Caption>{d.droneNote}</Caption>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ══ PART TWO ═════════════════════════════════════════════════════ */}
      <section className="mt-20 border-t pt-10" style={{ borderColor: "var(--story-rule)" }}>
        <Eyebrow tone="hot">part two · the water</Eyebrow>
        <Headline>Twenty-One Miles Wide at Its Narrowest.</Headline>
        <Standfirst>
          The Strait of Hormuz is the only way out of the Persian Gulf. What matters for India is
          not how much of its energy is &ldquo;Gulf&rdquo; — a headline word that includes Oman,
          whose terminals are already past the Strait — but how much of it has{" "}
          <Mark>no other way out</Mark>. Those are different numbers and the gap between them is
          this section — and the traffic runs both ways, because India refines much of what it
          lands and sells it straight back out through the same water.
        </Standfirst>
      </section>

      <section className="mt-7">
        <div className="story-card p-4 sm:p-6">
          <BubbleMap
            height={380}
            width={760}
            maxRadius={34}
            fitTo={[[44, 11], [78, 33]]}
            marks={[{ lon: 56.3, lat: 26.6, label: "Strait of Hormuz", tone: "hot" }]}
            bubbles={(crudeNow?.sources ?? [])
              .filter((c) => gulfOf(d, c.code) !== undefined)
              .map((c) => {
                const g = gulfOf(d, c.code)!;
                return {
                  id: isoForCountryName(nameOf(d, c)) ?? String(c.code).padStart(3, "0"),
                  name: nameOf(d, c).replace("United Arab Emirates", "UAE"),
                  value: c.value,
                  display: usd(c.value),
                  tone: TONE_FOR[g.chokepoint],
                };
              })}
            note={
              <>
                India&rsquo;s crude imports from each Gulf producer in {now}, circle area
                proportional to value. Red is locked inside the Strait, amber has a pipeline to
                open water, green is already past it. {d.chokepointNote}
              </>
            }
          />
        </div>
      </section>

      {/* ── The three commodities, three shares ───────────────────────── */}
      <section className="mt-14">
        <Eyebrow tone="hot">three fuels, three exposures</Eyebrow>
        <Headline>The Cylinder Is the Problem, Not the Barrel.</Headline>
        <Standfirst>
          Crude has diversified a long way and cooking gas has not moved at all. There is no
          Russian LPG arbitrage to take, no pipeline to India, and Qatar&rsquo;s LNG has no route
          out of the Gulf of any kind. The fuel with the least room to manoeuvre is the one that
          goes into a kitchen.
        </Standfirst>
        <div className="story-card mt-7 p-5 sm:p-7">
          <div className="grid gap-9 lg:grid-cols-3">
            {[
              { y: lpgNow, label: "Cooking gas (LPG)", tone: "hot" as const,
                note: "Propane and butane, the two headings that fill one cylinder, summed." },
              { y: lngNow, label: "Natural gas (LNG)", tone: "mid" as const,
                note: "Qatar alone is most of the locked share, and has no pipeline alternative at all." },
              { y: crudeNow, label: "Crude oil", tone: "cool" as const,
                note: "The one line with a real alternative, and it has been taken." },
            ].map(({ y, label, tone, note }) => {
              if (!y) return null;
              const s = split(d, y);
              return (
                <div key={label} className="min-w-0">
                  <ChartTitle note={`${usd(y.total)} imported in ${now}. ${note}`}>{label}</ChartTitle>
                  <Waffle
                    cell={13}
                    gap={2.5}
                    parts={[
                      { label: "no way out but the Strait", share: s.locked, tone: "hot",
                        display: `${s.locked.toFixed(0)}%` },
                      { label: "Gulf, has a pipeline out", share: s.bypass, tone: "mid",
                        display: `${s.bypass.toFixed(0)}%` },
                      { label: "past the Strait, or not Gulf at all", share: s.outside + s.elsewhere, tone: "cool",
                        display: `${(s.outside + s.elsewhere).toFixed(0)}%` },
                    ]}
                  />
                  <p className="story-display mt-4 text-[30px]" style={{ color: `var(--s-${tone})` }}>
                    {(s.locked + s.bypass).toFixed(0)}%
                    <span className="ml-2 align-baseline text-[0.38em] font-semibold tracking-normal"
                      style={{ color: "var(--story-ink-2)" }}>
                      Gulf in total
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
          <Caption>
            One square is one dollar in a hundred. The amber band is the honest uncertainty: Saudi
            Arabia and the UAE can move some volume to open water by pipeline, and neither can move
            all of it, so those barrels are probably but not certainly Hormuz barrels.
          </Caption>
        </div>
      </section>

      {/* ── How the crude position changed ────────────────────────────── */}
      <section className="mt-14">
        <Eyebrow tone="cool">what already changed, and why it was not about this</Eyebrow>
        <Headline>India&rsquo;s Crude Left the Gulf for a Discount, Not for Safety.</Headline>
        <Standfirst>
          {crudeGulfThen.toFixed(0)}% of India&rsquo;s crude came from the Gulf in {then} and{" "}
          <Mark tone="cool">{crudeGulfNow.toFixed(0)}%</Mark> does now. The barrels went to Russia,
          and they went for price. It is the largest single change in India&rsquo;s energy exposure
          in a generation and no part of it was a response to a war in West Asia — which is exactly
          why it is worth showing beside one.
        </Standfirst>
        <div className="story-card mt-7 p-5 sm:p-7">
          <ChartTitle note={`India's crude imports by origin group, each bar drawn to 100% of that year's total. The total is printed above each bar.`}>
            Crude, by whether it has another way out
          </ChartTitle>
          <StackedBars
            height={250}
            parts={STACK_PARTS}
            rows={stackRows(CRUDE, (y) => String(y))}
            totalFormat={(v) => usd(v)}
          />
          <Caption>
            Nominal dollars. Crude is a price times a volume and the price moved by a factor of
            three across this window, so a falling dollar share can be a rising barrel count. Years
            are sampled, not continuous, and the gaps between them are unmeasured.
          </Caption>
        </div>
      </section>

      {/* ── LPG, unchanged ────────────────────────────────────────────── */}
      {lpgNow && lpgThen && (
        <section className="mt-14">
          <Eyebrow tone="hot">the line that did not move</Eyebrow>
          <Headline>Where the Cylinder Comes From.</Headline>
          <div className="story-card mt-7 p-5 sm:p-7" data-tone="hot">
            <div className="grid gap-9 lg:grid-cols-2">
              <div className="min-w-0">
                <ChartTitle note={`Propane and butane together, ${now}. Area is proportional to value.`}>
                  India&rsquo;s LPG by origin
                </ChartTitle>
                <Treemap
                  height={260}
                  items={lpgNow.sources.slice(0, 8).map((c) => {
                    const g = gulfOf(d, c.code);
                    return {
                      name: nameOf(d, c).replace("United Arab Emirates", "UAE"),
                      value: c.value,
                      display: `${((c.value / lpgNow.total) * 100).toFixed(0)}%`,
                      tone: g ? TONE_FOR[g.chokepoint] : ("cool" as const),
                      mark: g?.chokepoint === "locked",
                    };
                  })}
                />
              </div>
              <div className="min-w-0">
                <ChartTitle note={`The same measure at both ends of the window.`}>
                  Ten years apart
                </ChartTitle>
                <PairedChange
                  aLabel={`${then} share from the Gulf`}
                  bLabel={`${now} share from the Gulf`}
                  aTone="mid"
                  bTone="hot"
                  rows={[
                    { name: "Cooking gas (LPG)", a: lpgGulfThen, b: lpgGulfNow,
                      aDisplay: `${lpgGulfThen.toFixed(0)}%`, bDisplay: `${lpgGulfNow.toFixed(0)}%`, mark: true },
                    { name: "Natural gas (LNG)",
                      a: (() => { const y = energyYear(energyLine(d, LNG), then); const s = split(d, y); return s.locked + s.bypass; })(),
                      b: lngSplitNow.locked + lngSplitNow.bypass,
                      aDisplay: `${(() => { const y = energyYear(energyLine(d, LNG), then); const s = split(d, y); return (s.locked + s.bypass).toFixed(0); })()}%`,
                      bDisplay: `${(lngSplitNow.locked + lngSplitNow.bypass).toFixed(0)}%` },
                    { name: "Crude oil", a: crudeGulfThen, b: crudeGulfNow,
                      aDisplay: `${crudeGulfThen.toFixed(0)}%`, bDisplay: `${crudeGulfNow.toFixed(0)}%` },
                  ]}
                />
                <Caption>
                  Crude fell by a third of its Gulf share in ten years. Cooking gas did not move,
                  and the reason is that nothing else is close enough to ship it: LPG moves by
                  pressurised vessel over short hauls, and the Gulf is the short haul.
                </Caption>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── The return leg ───────────────────────────────────────────── */}
      {refinedNow && refinedThen && crudeNow && (
        <section className="mt-14">
          <Eyebrow tone="mid">the same water, the other way</Eyebrow>
          <Headline>India Is the Refinery at the End of the Strait.</Headline>
          <Standfirst>
            The exposure is not only inbound. India imported {usd(crudeNow.total)} of crude in{" "}
            {now} and exported <Mark tone="mid">{usd(refinedNow.total)}</Mark> of refined
            product to {refinedNow.sources.length} destinations — diesel, jet fuel and petrol made
            on the Gujarat coast. {refinedGulfShare.toFixed(0)}% of it goes straight back into the
            Gulf it came from, and the largest single destination has changed completely.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7">
            <div className="grid gap-9 lg:grid-cols-2">
              <div className="min-w-0">
                <ChartTitle note={`Where India's refined product went in ${then}, share of ${usd(refinedThen.total)}.`}>
                  {then}
                </ChartTitle>
                <RankedRows
                  tone="mid"
                  rows={refinedThen.sources.slice(0, 8).map((c) => ({
                    name: nameOf(d, c).replace("United Arab Emirates", "UAE").replace("United Rep. of Tanzania", "Tanzania"),
                    value: c.value,
                    display: `${((c.value / refinedThen.total) * 100).toFixed(1)}%`,
                  }))}
                />
              </div>
              <div className="min-w-0">
                <ChartTitle note={`And in ${now}, share of ${usd(refinedNow.total)}.`}>
                  {now}
                </ChartTitle>
                <RankedRows
                  tone="cool"
                  markTone="hot"
                  rows={refinedNow.sources.slice(0, 8).map((c) => ({
                    name: nameOf(d, c).replace("United Arab Emirates", "UAE").replace("United Rep. of Tanzania", "Tanzania"),
                    value: c.value,
                    display: `${((c.value / refinedNow.total) * 100).toFixed(1)}%`,
                    mark: c.code === 528,
                  }))}
                />
              </div>
            </div>
            <Caption>
              The Netherlands goes from {(((refinedThen.sources.find((c) => c.code === 528)?.value ?? 0) / refinedThen.total) * 100).toFixed(1)}%
              {" "}of India&rsquo;s refined exports to {(((refinedNow.sources.find((c) => c.code === 528)?.value ?? 0) / refinedNow.total) * 100).toFixed(1)}%,
              {" "}and Rotterdam is Europe&rsquo;s fuel entrepôt. This page will not join that to the
              Russian crude on the inbound chart: customs data cannot trace a molecule from a
              cargo to a product, both things are true of the same years, and asserting the link
              would be a story told over the data rather than read out of it.
            </Caption>
          </div>
        </section>
      )}

      {/* ── The two belligerents as trading partners ──────────────────── */}
      {bilat.length > 0 && (
        <section className="mt-14">
          <Eyebrow>the two parties, as counterparties</Eyebrow>
          <Headline>India Stopped Buying From One of Them Six Years Ago.</Headline>
          <Standfirst>
            India&rsquo;s imports from Iran fell from {usd(iranFirst?.imports ?? 0)} in{" "}
            {bilat[0]?.year} to <Mark>{usd(iranLast?.imports ?? 0)}</Mark> in{" "}
            {bilat[bilat.length - 1]?.year} — almost all of the fall is oil, and it happened when
            the United States ended its sanctions waivers. Whatever India has at stake in this war,
            Iranian energy is not it: that exposure was closed out years before.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7">
            <ChartTitle note="India's total merchandise trade with each, both directions, in the sampled years.">
              Trade with Iran and Israel
            </ChartTitle>
            <div className="grid gap-9 sm:grid-cols-2">
              {[IRAN_CODE, ISRAEL_CODE].map((code) => {
                const rows = bilat
                  .map((b) => ({ year: b.year, p: b.partners.find((x) => x.code === code) }))
                  .filter((r): r is { year: number; p: NonNullable<typeof r.p> } => r.p !== undefined);
                const name = rows[0]?.p.name ?? String(code);
                const max = Math.max(1, ...rows.flatMap((r) => [r.p.imports, r.p.exports]));
                return (
                  <div key={code} className="min-w-0">
                    <p className="story-eyebrow mb-3" style={{ color: "var(--story-ink-3)" }}>{name}</p>
                    {rows.map((r) => (
                      <div key={r.year} className="border-b py-2 last:border-0"
                        style={{ borderColor: "var(--story-rule)" }}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="mono text-[11.5px]">{r.year}</span>
                          <span className="mono text-[11px] tabular-nums" style={{ color: "var(--story-ink-3)" }}>
                            in {usd(r.p.imports)} · out {usd(r.p.exports)}
                          </span>
                        </div>
                        <div className="mt-1.5 space-y-[3px]">
                          <span className="block h-[8px] rounded-sm" style={{
                            width: `${(r.p.imports / max) * 100}%`, background: "var(--s-hot)" }} />
                          <span className="block h-[8px] rounded-sm" style={{
                            width: `${(r.p.exports / max) * 100}%`, background: "var(--s-cool)" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <Caption>
              Red is what India buys, green what it sells; both panels share their own scale, not
              each other&rsquo;s. Total merchandise, so defence equipment is inside these figures
              and cannot be separated out of them — trade statistics name a country and a
              commodity, never a purpose.
            </Caption>
          </div>
        </section>
      )}

      <WhatThisCannotSay
        items={[
          {
            q: "What happened in the war, or when",
            a: <>Nothing on this page. There is no timeline here because this repository sources none: annual customs data cannot see a month, and the news window elsewhere on this site is press reporting on a rolling few days. Every figure describes a position, not an event.</>,
          },
          {
            q: "Whether any of these numbers moved because of the fighting",
            a: <>Unknowable from this data. The most recent year here is {now}, annual, and a share that falls between two sampled years may be a war, a price move, a refinery outage, a sanctions regime or a long-run commercial shift. No causation is asserted anywhere.</>,
          },
          {
            q: "How much oil actually transits the Strait",
            a: <>This is origin, not routing. A cargo lifted in one Gulf state, stored at Fujairah and re-sold arrives as whatever the last seller was, and no tanker position, insurance rate or freight cost appears here because none is sourced. The locked / bypass / outside split is the closest honest approximation and the amber band is its uncertainty.</>,
          },
          {
            q: "What India's military drone fleet actually costs or contains",
            a: <>Not in HS 8806. Military airframes arrive government-to-government, under offset and licensed-production agreements, or as parts in chapter 88 — none of which crosses a border as an unmanned aircraft. The heading measures the commercial drone trade, which is why India&rsquo;s whole declared figure is a few million dollars.</>,
          },
          {
            q: "How many of each Indian programme have been built",
            a: <>{uav.present ? <>A number-built field is present on a handful of the {uav.counts.keptAsUnmanned} programmes and absent on most, and is never estimated here. An encyclopaedia&rsquo;s status field summarises press reporting, and press reporting on defence programmes is optimistic by construction.</> : <>The programme index is not built in this deployment.</>}</>,
          },
          {
            q: "Whether an Indian programme missing from this page exists",
            a: <>{uav.present ? <>Very possibly. The index is {uav.categories.length} Wikipedia categories and {uav.counts.articlesIndexed} articles; a programme nobody has written an article about is invisible here, so the count is a floor and not a census.</> : <>Not applicable — the index is not built.</>}</>,
          },
          {
            q: "Anything about defence trade with either party",
            a: <>Not separately. The bilateral figures are total merchandise. Trade statistics name a country and a commodity and never a purpose, so no defence share can be extracted from them at any level of effort.</>,
          },
        ]}
      />

      <Sources>
        Energy, bilateral trade and HS 8806: {d.source} Built {d.builtAt.slice(0, 10)}
        {d.diagnostics && <> from {d.diagnostics.calls} calls, {d.diagnostics.failed} failed</>}.{" "}
        {uav.present && <>Programme index: {uav.source} Built {uav.builtAt.slice(0, 10)}. </>}
        Fleet: {fleet.source} Every figure here is arithmetic on those files; none is typed in.{" "}
        <Link href="/drones" className="underline">The full drone proliferation map</Link>
        {" · "}
        <Link href="/stories/defence" className="underline">What India&rsquo;s defence export figure counts</Link>
        .
      </Sources>
    </div>
  );
}
