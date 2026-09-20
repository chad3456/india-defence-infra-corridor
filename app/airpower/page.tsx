import {
  loadBases, loadInventory, loadTraffic, latestSnapshot, printableTotals, originMix,
  type Origin,
} from "@/lib/airpower";
import { numericOf } from "@/lib/iso";
import {
  Eyebrow, Headline, Standfirst, Mark, Stat, Sources, WhatThisCannotSay,
} from "@/components/stories/Kit";
import {
  ChartTitle, Caption, DotMap, WorldDots, Choropleth, RankedRows, StackedBars, TimeSeries, Treemap,
} from "@/components/stories/Charts";

/**
 * Military airfields, catalogued fleets, and what is actually in the air.
 *
 * ── The number this page is built around ─────────────────────────────────
 *
 * Two independent ADS-B aggregators, asked at the same instant, can see a few
 * hundred military aircraft in the whole world. The catalogues this page also
 * reads list tens of thousands of airframes across thirteen forces.
 *
 * So a "real-time military air traffic tracker" is, on the honest reading, a
 * tracker of about one per cent of military aviation — and not a random one
 * per cent. What broadcasts ADS-B is the traffic with the least reason not to:
 * transports and tankers flying airways under civil rules, trainers in
 * domestic circuits, maritime patrol, government lift. Combat aircraft on
 * operational sorties are systematically absent.
 *
 * That could be buried in a footnote and the page would look far more
 * impressive. Instead it is the headline, because a reader who takes this feed
 * for a picture of military aviation has been misled by the page rather than
 * by the data, and the ratio is itself the most interesting thing here.
 *
 * ── The join that is deliberately missing ────────────────────────────────
 *
 * Bases, fleets and live tracks are three sections that never meet. There is
 * no "what is flying near this airbase" view, and no per-base aircraft count.
 * Not because the raw feeds hide it — ADS-B Exchange will show anyone the
 * traffic around any airfield — but because at a few hundred aircraft
 * worldwide, a count near any one installation is small enough to be noise and
 * precise enough to be believed. A statistic that cannot support the reading
 * it invites should not be printed.
 */

export const metadata = {
  title: "Airpower: bases, fleets and what is actually flying · Bharat Tracker",
  description:
    "Military airfields from OpenStreetMap, catalogued air-force inventories, and a rolling "
    + "snapshot of the military aircraft that broadcast ADS-B — which is a small and "
    + "self-selected fraction of what flies.",
};

const ORIGIN_PARTS: Array<{ key: Origin; label: string; tone: "hot" | "mid" | "cool" }> = [
  { key: "domestic", label: "Domestic", tone: "cool" },
  { key: "russian", label: "Russian / Soviet", tone: "hot" },
  { key: "western", label: "Western", tone: "mid" },
  { key: "chinese", label: "Chinese", tone: "hot" },
  { key: "other", label: "Other or unclassified", tone: "mid" },
];

export default function AirpowerPage() {
  const bases = loadBases();
  const inv = loadInventory();
  const traffic = loadTraffic();
  const snap = latestSnapshot(traffic);

  if (!bases.present && !inv.present && !traffic.present) {
    return (
      <div className="pt-12">
        <Eyebrow>not built</Eyebrow>
        <Headline>None of the airpower sources are in this deployment.</Headline>
        <Standfirst>
          Run <span className="mono">npm run airbases:build</span>,{" "}
          <span className="mono">npm run inventory:build</span> and{" "}
          <span className="mono">npm run traffic:ingest</span> in CI. Every figure on this page is
          computed from those files; none is written by hand.
        </Standfirst>
      </div>
    );
  }

  /* ── The ratio the page leads on ─────────────────────────────────────── */
  const totals = printableTotals(inv);
  const catalogued = totals.reduce((a, f) => a + f.total, 0);
  const visible = snap?.aircraft ?? 0;

  /**
   * The range across snapshots, not the latest one.
   *
   * The first build of this page led on whatever the most recent snapshot
   * happened to hold, and that number swings from 80 to 423 over a day — so
   * the headline ratio was a fact about when the site was built. Worse, it was
   * the extreme version of the page's own argument: a trough reads as "almost
   * nothing is visible" and a peak as five times more, and neither is a
   * property of military aviation.
   *
   * The peak is the honest number for "what a public feed can see", because it
   * is the closest thing to full observation the record contains. The trough
   * is published beside it, because the gap between them is what shows that
   * this measures watching as much as flying.
   */
  const counts = traffic.snapshots.map((x) => x.aircraft);
  const peak = counts.length > 0 ? Math.max(...counts) : 0;
  const trough = counts.length > 0 ? Math.min(...counts) : 0;
  const visibleShare = catalogued > 0 && peak > 0 ? (peak / catalogued) * 100 : null;

  const indiaBases = bases.bases.filter((b) => b.iso === "IND");
  const indiaMix = originMix(inv.airframes, "IND");
  const indiaTypes = inv.airframes
    .filter((a) => a.iso === "IND" && a.inService !== null && a.inService > 0)
    .sort((a, b) => (b.inService ?? 0) - (a.inService ?? 0));

  /** Forces whose origin mix has enough readable rows to draw. */
  const mixRows = totals
    .map((f) => ({ force: f, mix: originMix(inv.airframes, f.iso) }))
    .filter((r) => Object.values(r.mix.counts).reduce((a, b) => a + b, 0) > 0)
    .slice(0, 10);

  const trafficSeries = traffic.snapshots.map((s) => ({
    year: new Date(s.at).getTime(),
    value: s.aircraft,
  }));

  return (
    <div>
      <header className="pt-10">
        <Eyebrow tone="hot">
          airpower · {bases.counts.airfields.toLocaleString("en-US")} airfields ·{" "}
          {inv.counts.forces} forces · {trough}–{peak} aircraft visible
        </Eyebrow>
        <h1 className="story-display mt-4 max-w-[17ch] text-[36px] sm:text-[50px] lg:text-[58px]">
          Almost None of It Is Visible.
        </h1>
        <Standfirst>
          Two independent ADS-B networks, read together every hour, have seen between{" "}
          <Mark>{trough}</Mark> and <Mark>{peak}</Mark> military aircraft in the whole world. The
          catalogues on this page list{" "}
          <Mark tone="cool">{catalogued.toLocaleString("en-US")}</Mark> airframes across{" "}
          {totals.length} air forces
          {visibleShare !== null && (
            <> — so even at its best a public feed watches about{" "}
            <Mark>{visibleShare.toFixed(1)}%</Mark> of what is catalogued</>
          )}
          . That ratio is the finding, not a caveat on it.
        </Standfirst>
        <p className="mt-5 max-w-[66ch] rounded-lg border p-4 text-[13px] leading-[1.6]"
          style={{ borderColor: "var(--s-hot)", color: "var(--story-ink-2)" }}>
          <strong style={{ color: "var(--story-ink)" }}>
            Absence from this feed is not absence from the sky.
          </strong>{" "}
          Military aircraft are not obliged to broadcast ADS-B and routinely do not. What appears
          here is the traffic with the least reason to hide — transports and tankers on airways,
          trainers in circuits, maritime patrol, government lift — while combat aircraft on
          operational sorties are systematically absent. So the composition below is a fact about
          disclosure practice, not about activity, and a country that rarely appears may be flying
          as much as one that always does.
        </p>
      </header>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat size="md" tone="mid" label="military airfields mapped"
          value={bases.counts.airfields.toLocaleString("en-US")}
          note={<>Across {bases.counts.countries} countries, from OpenStreetMap. A floor, not a
            survey: this counts what volunteers have mapped and tagged.</>} />
        <Stat size="md" tone="cool" label="airframes catalogued"
          value={catalogued.toLocaleString("en-US")}
          note={<>Across {totals.length} forces whose tables parsed well enough to total.{" "}
            {inv.counts.totalsWithheld > 0 && <>{inv.counts.totalsWithheld} more are read but their
            totals withheld.</>}</>} />
        <Stat size="md" tone="hot" label="most ever visible at once" value={String(peak)}
          note={snap
            ? <>Across {counts.length} hourly snapshots the count ran between {trough} and {peak}.
              The latest, at {new Date(snap.at).toISOString().replace("T", " ").slice(0, 16)} UTC,
              held {visible}.</>
            : <>No snapshot has been taken yet.</>} />
        <Stat size="md" tone="mid" label="snapshots kept" value={String(traffic.keptSnapshots)}
          note={<>One an hour. A single call is an instant in the sky, which is not a pattern.</>} />
      </section>

      {/* ── What is flying, and how little that is ────────────────────── */}
      {snap && (
        <section className="mt-14">
          <Eyebrow tone="hot">the visible fraction</Eyebrow>
          <Headline>What a Public Feed Can See.</Headline>
          <Standfirst>
            Every military aircraft broadcasting a position that either network picked up, at one
            moment. Positions are rounded to a tenth of a degree — about eleven kilometres — which
            is the resolution the claim &ldquo;there is military air activity over this
            region&rdquo; can carry.
          </Standfirst>

          <div className="story-card mt-7 p-5 sm:p-6">
            <ChartTitle note="One dot per aircraft with a position. Rounded to ~11 km.">
              Military ADS-B, {new Date(snap.at).toISOString().replace("T", " ").slice(0, 16)} UTC
            </ChartTitle>
            <WorldDots
              dots={snap.points.map(([lon, lat]) => ({ lat, lon, tone: "hot" as const }))}
              height={430}
              r={2.6}
              opacity={0.8}
            />
            <Caption>
              {snap.points.length} of {snap.aircraft} aircraft reported a position. The rest were
              seen by a receiver without one — usually a partial message — and are counted but not
              drawn.
            </Caption>
          </div>

          <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
            <div className="story-card min-w-0 p-5 sm:p-6">
              <ChartTitle note="Coarse regions, not countries. See the caption.">
                Where they were
              </ChartTitle>
              <RankedRows
                tone="hot"
                rows={snap.byRegion.map((r) => ({
                  name: r.region,
                  value: r.n,
                  display: String(r.n),
                  mark: r.region === "South Asia",
                }))}
              />
              <Caption>
                Quarters of the planet rather than countries, on purpose. A country breakdown would
                invite &ldquo;how many military aircraft are over X&rdquo;, and at this sample size
                that is a question the data cannot answer. Naming a quarter of the world makes the
                grain of the claim visible in the claim.
              </Caption>
            </div>

            <div className="story-card min-w-0 p-5 sm:p-6">
              <ChartTitle note="Type code as the feed reports it.">
                What they were
              </ChartTitle>
              <RankedRows
                tone="mid"
                rows={snap.byType.slice(0, 12).map((t) => ({
                  name: t.type, value: t.n, display: String(t.n),
                }))}
              />
              <Caption>
                The type comes from the community database behind each feed and is only as good as
                that database. Transports, tankers and trainers dominate this list for the reason
                the page opens with: they are the aircraft with least reason to fly dark.
              </Caption>
            </div>
          </div>

          {snap.agreement && (
            <div className="story-card mt-5 p-5 sm:p-6">
              <ChartTitle note="Two aggregators, one instant.">
                How far the two feeds agree about what &ldquo;military&rdquo; means
              </ChartTitle>
              <RankedRows
                tone="mid"
                showRank={false}
                rows={[
                  { name: "Seen by both", value: snap.agreement.both, display: String(snap.agreement.both), mark: true },
                  { name: `Only ${snap.perFeed[0]?.id ?? "the first"}`, value: snap.agreement.onlyFirst, display: String(snap.agreement.onlyFirst) },
                  { name: `Only ${snap.perFeed[1]?.id ?? "the second"}`, value: snap.agreement.onlySecond, display: String(snap.agreement.onlySecond) },
                ]}
              />
              <Caption>
                Each network decides for itself which ICAO addresses are military, from
                community-maintained lists that do not agree. The overlap is published rather than
                averaged away, so &ldquo;military&rdquo; here carries a measured level of
                corroboration instead of one service&rsquo;s editorial judgement.
              </Caption>
            </div>
          )}

          {trafficSeries.length > 2 && (
            <div className="story-card mt-5 p-5 sm:p-6">
              <ChartTitle note="Aircraft visible at each hourly snapshot.">
                The visible count over time
              </ChartTitle>
              <TimeSeries
                points={trafficSeries}
                tone="hot"
                height={260}
                format={(v) => String(Math.round(v))}
                unit="aircraft"
                xLabel={(t) => new Date(t).toISOString().slice(5, 16).replace("T", " ")}
                xNote="UTC"
              />
              <Caption>
                A rise here is as likely to mean more volunteer receivers were online as more
                aircraft were flying, and the swing across a day is large. Nothing in this line can
                separate the two, which is the main reason no trend is claimed from it.
              </Caption>
            </div>
          )}
        </section>
      )}

      {/* ── Where the airfields are ───────────────────────────────────── */}
      {bases.present && (
        <section className="mt-16">
          <Eyebrow tone="mid">the ground</Eyebrow>
          <Headline>Where the Airfields Are.</Headline>
          <Standfirst>
            Every object OpenStreetMap carries as a military airfield, plus civil aerodromes
            tagged with a military presence. <Mark tone="mid">{bases.counts.airfields.toLocaleString("en-US")}</Mark>{" "}
            of them across {bases.counts.countries} countries, {bases.counts.withIcao} with an ICAO
            code that makes them checkable against another register.
          </Standfirst>

          <div className="story-card mt-7 p-5 sm:p-6">
            <ChartTitle note="One dot per mapped airfield. India in the hot tone.">
              Military airfields, worldwide
            </ChartTitle>
            <WorldDots
              dots={bases.bases.map((b) => ({
                lat: b.lat, lon: b.lon, tone: b.iso === "IND" ? ("hot" as const) : ("mid" as const),
              }))}
              height={440}
              r={1.5}
              opacity={0.65}
              highlightIso="356"
            />
            <Caption>
              A map of OpenStreetMap&rsquo;s coverage as much as of airpower. Where mappers are
              active the field looks dense; where they are not it looks empty, and the difference
              between those two is invisible on a map.
              {bases.counts.boxesFailed > 0 && (
                <> {bases.counts.boxesFailed} regional sweep
                  {bases.counts.boxesFailed === 1 ? "" : "s"} failed on this build, so the countries
                  inside {bases.counts.boxesFailed === 1 ? "it" : "them"} are undercounted by an
                  unknown amount.</>
              )}
            </Caption>
          </div>

          <div className="story-card mt-5 p-5 sm:p-6">
            <ChartTitle note="Mapped military airfields per country.">
              Counted by country
            </ChartTitle>
            <Choropleth
              rows={bases.byCountry
                .map((c) => ({ id: numericOf(c.iso) ?? "", name: c.country, value: c.n }))
                .filter((r) => r.id !== "")}
              height={400}
              unit="airfields"
              marked="356"
            />
            <Caption>
              Read as a floor everywhere. A country with an active OpenStreetMap community will
              show more mapped airfields than one without, whatever either actually operates.
            </Caption>
          </div>

          <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
            <div className="story-card min-w-0 p-5 sm:p-6">
              <ChartTitle note="Top twelve by mapped count.">Most mapped</ChartTitle>
              <RankedRows
                tone="mid"
                rows={bases.byCountry.slice(0, 12).map((c) => ({
                  name: c.country, value: c.n, display: String(c.n), mark: c.iso === "IND",
                }))}
              />
            </div>
            <div className="story-card min-w-0 p-5 sm:p-6">
              <ChartTitle note={`${indiaBases.length} mapped in India.`}>
                India&rsquo;s mapped airfields
              </ChartTitle>
              <DotMap
                dots={indiaBases.map((b) => ({ lat: b.lat, lon: b.lon, tone: "hot" as const }))}
                height={330}
                r={3}
                opacity={0.85}
              />
              <Caption>
                The national projection here, and the world one above — DotMap fits its extent to
                India, which is why the two maps on this page that are about the whole world use a
                different component. {indiaBases.filter((b) => b.icao).length} of these carry an
                ICAO code.
              </Caption>
            </div>
          </div>
        </section>
      )}

      {/* ── What the forces fly ───────────────────────────────────────── */}
      {inv.present && totals.length > 0 && (
        <section className="mt-16">
          <Eyebrow tone="cool">the catalogues</Eyebrow>
          <Headline>What the Forces Are Listed As Flying.</Headline>
          <Standfirst>
            Read from the per-force lists volunteers compile out of IISS&rsquo;s Military Balance
            and FlightGlobal&rsquo;s World Air Forces. Every figure means &ldquo;a public catalogue
            lists this many&rdquo;, which is weaker and more defensible than &ldquo;this country has
            this many&rdquo;.
          </Standfirst>

          <div className="story-card mt-7 p-5 sm:p-6">
            <ChartTitle note="Only forces whose quantity cells parsed well enough to total.">
              Catalogued airframes by force
            </ChartTitle>
            <RankedRows
              tone="cool"
              rows={totals.map((f) => ({
                name: f.force,
                value: f.total,
                display: f.total.toLocaleString("en-US"),
                mark: f.iso === "IND",
                meta: `${f.counted} of ${f.types} rows read`,
              }))}
            />
            <Caption>
              {inv.counts.totalsWithheld > 0 && (
                <>{inv.counts.totalsWithheld} force
                  {inv.counts.totalsWithheld === 1 ? " is" : "s are"} missing from this chart
                  entirely. Where fewer than three in five quantity cells could be read, the total
                  is withheld rather than summed from whichever rows happened to be simple — a bar
                  built that way would sit beside complete ones and compare a fleet against a
                  fragment. </>
              )}
              {inv.counts.unreadable} of {inv.counts.types} rows across all forces carry a quantity
              this parser would not read: a range, a dash, prose, or nothing at all.
            </Caption>
          </div>

          {mixRows.length > 0 && (
            <div className="story-card mt-5 p-5 sm:p-6">
              <ChartTitle note="Share of catalogued airframes by where the design comes from.">
                Who supplied the fleet
              </ChartTitle>
              <StackedBars
                parts={ORIGIN_PARTS.map((p) => ({ key: p.key, label: p.label, tone: p.tone }))}
                rows={mixRows.map((r) => ({
                  label: r.force.country,
                  values: r.mix.counts as unknown as Record<string, number>,
                }))}
                height={260}
                totalFormat={(v) => v.toLocaleString("en-US")}
              />
              <Caption>
                Soviet and Russian origin are one bucket, because an Su-30 is the same supply
                relationship whichever state signed the first contract and splitting them would
                make every post-Soviet fleet look diversified. Anything the classifier does not
                recognise goes to &ldquo;other&rdquo; and is counted there rather than dropped — a
                bucket that quietly absorbs failures turns a chart about fleets into a chart about
                the classifier.
              </Caption>
            </div>
          )}

          {indiaTypes.length > 0 && (
            <div className="story-card mt-5 p-5 sm:p-6">
              <ChartTitle note="Catalogued airframes in Indian service, by type.">
                India, type by type
              </ChartTitle>
              <Treemap
                items={indiaTypes.slice(0, 24).map((a) => ({
                  name: a.type,
                  value: a.inService ?? 0,
                  display: String(a.inService ?? 0),
                  tone: "cool" as const,
                }))}
                width={880}
                height={360}
              />
              <Caption>
                {indiaMix.unreadable} Indian rows carry a quantity that could not be read and are
                absent from this treemap. That is not a small number, and the fleet it draws is
                therefore a lower bound on a catalogue that is itself a year or more behind.
              </Caption>
            </div>
          )}
        </section>
      )}

      <WhatThisCannotSay
        items={[
          {
            q: "How much military flying is happening",
            a: <>Roughly one per cent of catalogued airframes appear in these feeds at any moment,
              and that fraction is self-selected rather than sampled. Nothing here scales up to a
              total, and no trend in the visible count can be separated from a change in how many
              volunteer receivers were online.</>,
          },
          {
            q: "How many airfields a country has",
            a: <>This counts what OpenStreetMap&rsquo;s contributors have mapped and tagged as
              military airfields. Active mapping communities produce dense countries. Every count
              here is a floor.</>,
          },
          {
            q: "What any country actually operates",
            a: <>The inventories are volunteer-compiled from published catalogues with a year or
              more of lag, and two catalogues routinely differ by tens of airframes on the same
              fleet. Nothing here reconciles them, and &ldquo;in service&rdquo; means on strength
              rather than available to fly.</>,
          },
          {
            q: "What is based where",
            a: <>Nothing on this page joins an aircraft to an installation, and there is no
              per-base view. The inventories are national totals, and at a few hundred aircraft
              visible worldwide a count near any one airfield would be small enough to be noise and
              precise enough to be believed.</>,
          },
        ]}
      />

      <Sources>
        Airfields from OpenStreetMap contributors, via the Overpass API, under ODbL; countries
        assigned locally from Natural Earth boundaries via world-atlas, whose depiction of
        contested borders is its own and not this project&rsquo;s. Inventories from English
        Wikipedia&rsquo;s per-force aircraft lists, which compile mostly from IISS&rsquo;s Military
        Balance and FlightGlobal&rsquo;s World Air Forces. Live traffic from adsb.lol and adsb.fi,
        two independent community ADS-B aggregators, read hourly and combined by ICAO address.
        {bases.builtAt && <> Airfields built {bases.builtAt.slice(0, 10)};</>}
        {inv.builtAt && <> inventories {inv.builtAt.slice(0, 10)};</>}
        {snap && <> last snapshot {snap.at.slice(0, 16).replace("T", " ")} UTC.</>}
      </Sources>
    </div>
  );
}
