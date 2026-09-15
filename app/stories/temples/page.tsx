import Link from "next/link";
import {
  loadAtlas, byState, byHeritage, byFigure, byCentury, type Site,
} from "@/lib/sacred";
import footfallRaw from "@/data/sacred/footfall.json";
import {
  Eyebrow, Headline, Standfirst, Mark, Stat, WhatThisCannotSay, Sources,
} from "@/components/stories/Kit";
import {
  ChartTitle, Caption, RankedRows, Waffle, DotMap, GridMap, DotStrip,
  PairedChange, Treemap, Scroller,
} from "@/components/stories/Charts";
import type { Footfall } from "@/lib/sacred";

/**
 * Three thousand temples, and a map of who has been typing.
 *
 * ── The trap this page is built to avoid ─────────────────────────────────
 *
 * An atlas of 3,465 Hindu temples with coordinates looks like a map of Indian
 * temples. It is not, and the difference is not a footnote — it is the largest
 * single feature of the data. Tamil Nadu carries 969 sites and Uttar Pradesh
 * 84. Nobody believes Uttar Pradesh has a twelfth of Tamil Nadu's temples.
 * What the map shows is where volunteers have been entering them into
 * Wikidata, and a page that let the density read as devotion would be
 * publishing a fact about an edit history as a fact about India.
 *
 * So the concentration is shown early and named immediately, and the page then
 * spends its middle third on the one thing that can be measured honestly here:
 * how complete the atlas is against denominators that are actually known.
 *
 * ── The canon sets are the ruler ─────────────────────────────────────────
 *
 * There are twelve Jyotirlingas on every reckoning and a hundred and eight
 * Divya Desams. Those totals do not depend on anyone's editing. Ten of the
 * twelve are placed here and fourteen of the hundred and ten — so the atlas is
 * 83% complete on one canon and 13% on another, and that ratio is a
 * measurement of coverage rather than a guess at it. It is the most useful
 * chart on the page and the least obvious one.
 *
 * ── What the dedication counts are, and are not ──────────────────────────
 *
 * Shiva 438, Vishnu 22. That is not the shape of Hindu dedication. It is the
 * shape of which Wikidata items happen to carry a "deity" statement, and the
 * Shiva number is inflated by one large, well-catalogued regional set. Fifteen
 * per cent of sites have any stated dedication at all. The chart is drawn
 * because the ratio matters; the caption refuses the reading.
 */

export const metadata = {
  title: "Three thousand temples, and a map of who has been typing · Bharat Tracker",
  description:
    "An atlas of 3,465 Hindu temples with coordinates. Half of them are in two states, which " +
    "is a fact about a database before it is a fact about India.",
};

const footfall = footfallRaw as unknown as Footfall;

/** The canon sets, in the order the page reads them: best-covered first. */
export default function TemplesStory() {
  const atlas = loadAtlas();
  const sites: Site[] = atlas.sites;
  const placed = sites.filter((s) => s.state !== null);
  const states = byState(sites);
  const heritage = byHeritage(sites);
  const figures = byFigure(sites, "stated");
  const centuries = byCentury(sites);

  const total = sites.length;
  const withDedication = sites.filter((s) => s.dedications.length > 0).length;
  /**
   * Sites whose dedication an editor actually wrote down.
   *
   * Not the same as `withDedication`, which also counts the handful this build
   * inferred from canon membership. The deity ranking is built from stated
   * dedications only, so its denominator has to be the stated population —
   * dividing a stated count by a mixed total understates every share on the
   * chart by exactly the inferences it excluded.
   */
  const withStated = sites.filter((s) => s.dedications.some((dd) => dd.basis === "stated")).length;
  const withInception = sites.filter((s) => s.inception !== null).length;
  const withHeritage = sites.filter((s) => s.heritage !== null).length;
  const top2 = (states[0]?.n ?? 0) + (states[1]?.n ?? 0);
  const top2Share = (top2 / placed.length) * 100;

  /**
   * Latitude bands of two degrees.
   *
   * The southern concentration is the single strongest signal in the data and
   * a state ranking half-hides it, because it arrives as two names rather than
   * as a shape. Bands make it a distribution: below 14°N — roughly the line
   * through Chennai — sits more of this atlas than the whole of the rest of
   * the country.
   */
  const bands: Array<{ lo: number; n: number }> = [];
  for (const s of sites) {
    if (typeof s.lat !== "number") continue;
    const lo = Math.floor(s.lat / 2) * 2;
    const found = bands.find((b) => b.lo === lo);
    if (found) found.n++;
    else bands.push({ lo, n: 1 });
  }
  bands.sort((a, b) => b.lo - a.lo);
  const southOf14 = bands.filter((b) => b.lo < 14).reduce((a, b) => a + b.n, 0);
  const southShare = (southOf14 / sites.length) * 100;

  /**
   * The canon sets, ordered by how completely the atlas covers them.
   *
   * Optional in the type because the ingest that builds them may not have run.
   * A missing canon costs this page its one measured denominator, so the
   * sections that depend on it are hidden rather than drawn empty.
   */
  const canon = [...(atlas.canon ?? [])]
    .map((c) => ({ ...c, coverage: c.claimed > 0 ? (c.placed / c.claimed) * 100 : 0 }))
    .sort((a, b) => b.coverage - a.coverage);
  const canonClaimed = canon.reduce((a, c) => a + c.claimed, 0);
  const canonPlaced = canon.reduce((a, c) => a + c.placed, 0);

  /** The Jyotirlingas, labelled on the map: twelve points every reader knows. */
  const jyoti = (atlas.canon ?? []).find((c) => c.id === "jyotirlinga");
  const jyotiQids = new Set((jyoti?.members ?? []).map((m) => m.qid).filter((q): q is string => q !== null));
  const jyotiSites = sites
    .filter((s) => jyotiQids.has(s.qid) && typeof s.lat === "number")
    .map((s) => ({ lat: s.lat, lon: s.lon, label: s.name.replace(/ Temple$/, ""), tone: "cool" as const }));

  return (
    <div>
      {/* ── Opening ───────────────────────────────────────────────────── */}
      <header className="pt-10">
        <Eyebrow tone="mid">sacred geography · {total.toLocaleString("en-IN")} sites · {states.length} states</Eyebrow>
        <h1 className="story-display mt-4 max-w-[17ch] text-[38px] sm:text-[54px] lg:text-[64px]">
          Three Thousand Temples, and a Map of Who Has Been Typing.
        </h1>
        <Standfirst>
          This is every Hindu temple in India that Wikidata holds with coordinates:{" "}
          <Mark tone="mid">{total.toLocaleString("en-IN")}</Mark> of them,{" "}
          {placed.length.toLocaleString("en-IN")} resolved to a state. Tamil Nadu carries{" "}
          {states[0]?.n} and Uttar Pradesh {states.find((s) => s.key === "Uttar Pradesh")?.n ?? 0}.
          Nobody thinks Uttar Pradesh has a twelfth of Tamil Nadu&rsquo;s temples — so before this
          is a map of India, it is a map of an edit history, and the rest of the page is about
          telling the two apart.
        </Standfirst>
      </header>

      {/* ── Four numbers ──────────────────────────────────────────────── */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat size="md" tone="mid" label="sites with coordinates" value={total.toLocaleString("en-IN")}
          note={<>Every one placeable to a point. {atlas.rejected.length} more were dropped for coordinates outside India.</>} />
        <Stat size="md" tone="hot" label="in the two largest states"
          value={`${top2Share.toFixed(0)}%`}
          note={<>{states[0]?.key} and {states[1]?.key} between them, of the {placed.length.toLocaleString("en-IN")} that resolved to a state.</>} />
        <Stat size="md" tone="hot" label="carrying a stated dedication"
          value={`${((withDedication / total) * 100).toFixed(0)}%`}
          note={<>{withDedication} sites name the figure they are dedicated to. The other {(total - withDedication).toLocaleString("en-IN")} are silent, not undedicated.</>} />
        <Stat size="md" tone="hot" label="carrying a founding date"
          value={`${((withInception / total) * 100).toFixed(1)}%`}
          note={<>{withInception} sites. Nothing on this page can date the rest, and no chart here fills them in.</>} />
      </section>

      {/* ── The map ───────────────────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow tone="mid">every site, at its own coordinates</Eyebrow>
        <Headline>The Coast Is a Line, Not a Cluster.</Headline>
        <Standfirst>
          One dot per temple, no aggregation. The Kerala shore and the Kaveri delta are continuous
          bands rather than blobs — a shape no state-level summary can show, because a state-level
          summary has already turned them into two numbers. The labelled points are the twelve
          Jyotirlingas, the one set of shrines whose membership is not in dispute.
        </Standfirst>
        <div className="story-card mt-7 p-4 sm:p-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <DotMap
                dots={sites
                  .filter((s) => typeof s.lat === "number")
                  .map((s) => ({ lat: s.lat, lon: s.lon, tone: "mid" as const }))}
                highlights={jyotiSites}
                height={520}
                r={1.6}
                opacity={0.45}
              />
              <Caption>
                {sites.filter((s) => typeof s.lat === "number").length.toLocaleString("en-IN")} dots.
                Overlap is left to read as density rather than merged into a marker.{" "}
                {jyotiSites.length} of the twelve Jyotirlingas are labelled; the other{" "}
                {12 - jyotiSites.length} are not in this atlas under an identifier that could be
                matched, which is itself a coverage fact.
              </Caption>
            </div>
            <div className="min-w-0">
              <ChartTitle note="Two-degree bands of latitude, north at the top. One dot is one temple.">
                The same data, by latitude
              </ChartTitle>
              <Scroller min={300}>
                <div className="pr-2">
                  {bands.map((b) => (
                    <div key={b.lo} className="flex items-center gap-2 py-[3px]">
                      <span className="mono w-[3.6rem] shrink-0 text-right text-[10.5px] tabular-nums"
                        style={{ color: "var(--story-ink-3)" }}>
                        {b.lo}–{b.lo + 2}°N
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block h-[11px] rounded-sm" style={{
                          width: `${(b.n / Math.max(...bands.map((x) => x.n))) * 100}%`,
                          background: b.lo < 14 ? "var(--s-hot)" : "var(--s-mid-fill)",
                          border: b.lo < 14 ? "none" : "1px solid var(--s-mid)",
                        }} />
                      </span>
                      <span className="mono w-[2.6rem] shrink-0 text-right text-[11px] font-semibold tabular-nums">
                        {b.n}
                      </span>
                    </div>
                  ))}
                </div>
              </Scroller>
              <Caption>
                <Mark>{southShare.toFixed(0)}%</Mark> of this atlas lies south of 14°N — roughly the
                line through Chennai — against a strip that is about a seventh of India&rsquo;s
                land. Read as coverage, not as devotion.
              </Caption>
            </div>
          </div>
        </div>
      </section>

      {/* ── States, two ways ──────────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow>state by state</Eyebrow>
        <Headline>Half of It Is in Two States.</Headline>
        <Standfirst>
          A real map gives Rajasthan eleven times Kerala&rsquo;s ink for a fifteenth of its sites,
          so the tile grid below gives every state the same square and lets the number carry the
          whole comparison. Both are shown, because the grid loses the shape and the map loses the
          small states.
        </Standfirst>
        <div className="story-card mt-7 p-5 sm:p-7">
          <div className="grid gap-9 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <div className="min-w-0">
              <ChartTitle>Every state, one tile</ChartTitle>
              <GridMap
                scale="mid"
                values={states.map((s) => ({ state: s.key, value: s.n, display: String(s.n) }))}
                empty="no site in this atlas"
              />
            </div>
            <div className="min-w-0">
              <ChartTitle note={`${placed.length.toLocaleString("en-IN")} sites resolved to a state; ${(total - placed.length).toLocaleString("en-IN")} did not and are absent from this ranking.`}>
                Sites per state
              </ChartTitle>
              <RankedRows
                tone="mid"
                markTone="hot"
                rows={states.slice(0, 18).map((s) => ({
                  name: s.key,
                  value: s.n,
                  display: s.n.toLocaleString("en-IN"),
                  mark: s.key === "Tamil Nadu",
                  meta: `${((s.n / placed.length) * 100).toFixed(1)}% of the atlas`,
                }))}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Coverage, measured against a known denominator ───────────── */}
      {canon.length > 0 && (
      <section className="mt-16">
        <Eyebrow tone="cool">the only honest measure of completeness on this page</Eyebrow>
        <Headline>Against a Total That Is Actually Known.</Headline>
        <Standfirst>
          Almost nothing here has a denominator — nobody knows how many Hindu temples India has.
          The canon sets do. There are twelve Jyotirlingas on every reckoning and a hundred and
          eight Divya Desams, and those totals do not move when an editor loses interest. So how
          many of each this atlas places is a <Mark tone="cool">measurement</Mark> of its coverage
          rather than a guess at it: {canonPlaced} of {canonClaimed} canonical shrines, and the
          spread between the sets is enormous.
        </Standfirst>
        <div className="story-card mt-7 p-5 sm:p-7" data-tone="cool">
          <PairedChange
            aLabel="shrines in the canon"
            bLabel="placed in this atlas"
            aTone="mid"
            bTone="cool"
            rows={canon.map((c) => ({
              name: `${c.label}${c.deity ? ` · ${c.deity}` : ""}`,
              a: c.claimed,
              b: c.placed,
              aDisplay: String(c.claimed),
              bDisplay: `${c.placed} (${c.coverage.toFixed(0)}%)`,
            }))}
          />
          <Caption>
            {canon.map((c) => `${c.label}: ${c.note}`).join(" ")} A set at 0% is not a set with no
            shrines — it is a set none of whose members carry coordinates in Wikidata under an
            identifier this build could match.
          </Caption>
        </div>
      </section>
      )}

      {/* ── What the atlas knows about each site ─────────────────────── */}
      <section className="mt-16">
        <Eyebrow tone="hot">what is actually recorded</Eyebrow>
        <Headline>Of a Hundred Sites, the Atlas Can Name the Deity of Fifteen.</Headline>
        <Standfirst>
          Everything on the map has a position. Almost nothing has anything else. This is the
          ceiling on every claim the rest of this page could make, and it is why there is no chart
          here of &ldquo;India&rsquo;s oldest temples&rdquo; or &ldquo;most-visited shrines&rdquo;.
        </Standfirst>
        <div className="story-card mt-7 p-5 sm:p-7">
          <div className="grid gap-9 lg:grid-cols-2">
            <div className="min-w-0">
              <ChartTitle note={`One square is one site in a hundred, of ${total.toLocaleString("en-IN")}.`}>
                Sites carrying a stated dedication
              </ChartTitle>
              <Waffle
                parts={[
                  { label: "names the figure it is dedicated to", share: withDedication, tone: "cool",
                    display: `${((withDedication / total) * 100).toFixed(0)}%` },
                  { label: "silent — which is not the same as undedicated", share: total - withDedication, tone: "hot",
                    display: `${(((total - withDedication) / total) * 100).toFixed(0)}%` },
                ]}
              />
            </div>
            <div className="min-w-0">
              <ChartTitle note="Each column is one field of the record. Every dot is ten sites.">
                And the other fields
              </ChartTitle>
              <DotStrip
                maxPerColumn={20}
                dotSize={6}
                format={(n) => `${(n * 10).toLocaleString("en-IN")}`}
                bins={[
                  { label: "has coordinates", count: Math.round(sites.filter((s) => typeof s.lat === "number").length / 10), tone: "cool" },
                  { label: "resolved to a state", count: Math.round(placed.length / 10), tone: "cool" },
                  { label: "heritage listing", count: Math.round(withHeritage / 10), tone: "mid" },
                  { label: "stated deity", count: Math.round(withDedication / 10), tone: "mid" },
                  { label: "founding date", count: Math.max(1, Math.round(withInception / 10)), tone: "hot" },
                ]}
              />
              <Caption>
                Rounded to the nearest ten sites so the columns are comparable at a glance. The
                founding-date column is {withInception} sites — {((withInception / total) * 100).toFixed(1)}%
                of the atlas, and one dot wide.
              </Caption>
            </div>
          </div>
        </div>
      </section>

      {/* ── Dedication, with the reading refused ─────────────────────── */}
      {figures.length > 0 && (
        <section className="mt-16">
          <Eyebrow tone="hot">a chart that does not mean what it looks like</Eyebrow>
          <Headline>Shiva {figures[0]?.n}, Vishnu {figures.find((f) => f.key === "Vishnu")?.n ?? 0}.</Headline>
          <Standfirst>
            Among the {withStated} sites that state a dedication. That ratio is{" "}
            <Mark>not the shape of Hindu dedication in India</Mark> and nothing here should be
            quoted as though it were. It is the shape of which Wikidata items happen to carry a
            deity statement, and it is dominated by one well-catalogued regional set of Shaiva
            temples in the south — the same south that supplies half the atlas.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7" data-tone="hot">
            <RankedRows
              tone="hot"
              rows={figures.slice(0, 12).map((f) => ({
                name: f.key,
                value: f.n,
                display: String(f.n),
                meta: `${((f.n / withStated) * 100).toFixed(1)}% of sites that state one`,
              }))}
            />
            <Caption>
              Stated dedications only. The {atlas.coverage.withCanonicalDedication} dedications this
              build inferred from canon membership are counted separately and are not added in:
              mixing an editor&rsquo;s statement with a membership inference produces a number that
              means neither.
            </Caption>
          </div>
        </section>
      )}

      {/* ── Age ───────────────────────────────────────────────────────── */}
      {centuries.length > 0 && (
        <section className="mt-16">
          <Eyebrow tone="mid">the dated few</Eyebrow>
          <Headline>{withInception} Temples Have a Founding Century.</Headline>
          <Standfirst>
            Out of {total.toLocaleString("en-IN")}. Wikidata stores an inception as a full date even
            when the source knew only a century, so these are binned by century and never printed
            as days — a temple recorded as &ldquo;0600-01-01&rdquo; was not founded on the first of
            January.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7">
            <DotStrip
              maxPerColumn={10}
              dotSize={7}
              bins={centuries.map((c) => ({
                label: c.label,
                count: c.n,
                tone: (c.century <= 12 ? "mid" : "cool") as "mid" | "cool",
              }))}
            />
            <Caption>
              One dot is one temple, so this column is the entire dated population of the atlas.
              Amber is the twelfth century and earlier. A gap in a century is not a century without
              temple-building; it is a century nobody has entered.
            </Caption>
          </div>
        </section>
      )}

      {/* ── Heritage ─────────────────────────────────────────────────── */}
      {heritage.length > 0 && (
        <section className="mt-16">
          <Eyebrow tone="cool">surveyed and protected</Eyebrow>
          <Headline>{withHeritage} Carry a Heritage Listing.</Headline>
          <Standfirst>
            The one field on this page filled in by a state body rather than by a volunteer, which
            makes it the most evenly collected thing in the atlas — and shows how uneven everything
            else is. Area is proportional to the number of sites in each designation.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7">
            <Treemap
              height={280}
              items={heritage.map((h, i) => ({
                name: h.key
                  .replace("Monument of National Importance", "National Importance")
                  .replace("State Protected Monument", "State Protected")
                  .replace("PMC Heritage Grade", "Pune Grade")
                  .replace("KMC Heritage Building Grade", "Kolkata Grade"),
                value: h.n,
                display: `${h.n} site${h.n === 1 ? "" : "s"}`,
                tone: "cool" as const,
                mark: i === 0,
              }))}
            />
            <Caption>
              {heritage.length} designations, from the Archaeological Survey&rsquo;s national list
              down to a single INTACH entry. The designations are not a ranking of importance and
              are not comparable across states — a Grade I listing in Pune and a State Protected
              Monument in Odisha are different statutes doing different things.
            </Caption>
          </div>
        </section>
      )}

      {/* ── Footfall, refused ────────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow tone="hot">the chart that is not here</Eyebrow>
        <Headline>Two Visitor Numbers, and They Cannot Be Ranked.</Headline>
        <Standfirst>
          Of {footfall.silent.length + footfall.rows.length} major temples asked for a visitor
          figure, <Mark>{footfall.rows.length}</Mark> returned one whose period the source states.
          They are one daily figure and one annual figure, so there is no bar chart on this page —
          dividing the annual one by 365 would invent a daily average nobody measured, across
          festivals that move the real number by an order of magnitude.
        </Standfirst>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {footfall.rows.map((r) => (
            <div key={r.name} className="story-card p-5 sm:p-6" data-tone="mid">
              <Eyebrow tone="mid">{r.name} · {r.state}</Eyebrow>
              <p className="story-display mt-3 text-[32px] sm:text-[40px]">
                {r.value.toLocaleString("en-IN")}
                <span className="ml-2 align-baseline text-[0.36em] font-semibold tracking-normal"
                  style={{ color: "var(--story-ink-2)" }}>
                  a {r.period}
                </span>
              </p>
              <p className="mt-3 text-[12px] italic leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>
                &ldquo;{r.quote}&rdquo;
              </p>
            </div>
          ))}
        </div>
        <Caption>{footfall.incomparable} {footfall.coverage}</Caption>
      </section>

      <WhatThisCannotSay
        items={[
          {
            q: "Where India's temples are",
            a: <>Not this. {atlas.note} A thinner region on the map is a thinner region of the database. {canon.length > 0 && <>The only place on this page where coverage is measured rather than assumed is the canon-set chart, and it puts the atlas between {Math.min(...canon.map((c) => c.coverage)).toFixed(0)}% and {Math.max(...canon.map((c) => c.coverage)).toFixed(0)}% complete depending on which set you ask about.</>}</>,
          },
          {
            q: "Which deity India dedicates most temples to",
            a: <>Nothing here can say. {withDedication} of {total.toLocaleString("en-IN")} sites state a dedication at all, and those {withDedication} are not a random sample — they are concentrated in the same two southern states that supply half the atlas.</>,
          },
          {
            q: "How old Indian temples are",
            a: <>{withInception} sites carry a founding date, {((withInception / total) * 100).toFixed(1)}% of the atlas. The century chart is a chart of those {withInception} and of nothing else, and an empty century on it means an empty record, not an empty century.</>,
          },
          {
            q: "How many people visit",
            a: <>Two temples, on two incomparable periods. No total, no ranking and no per-day conversion appears anywhere on this page.</>,
          },
          {
            q: "Anything about a contested site",
            a: <>Deliberately nothing. This project holds a separate list of {new Intl.NumberFormat("en-IN").format(1713)} disputed sites whose state names are those of 1990, and it is kept off every modern-boundary map here rather than being silently reprojected onto today&rsquo;s states.</>,
          },
          {
            q: "Whether a listing means a temple is important",
            a: <>No. Heritage designations are statutes, and different ones. A national listing, a state listing and a municipal grade are not tiers of the same scale, and this page does not stack them as though they were.</>,
          },
        ]}
      />

      <Sources>
        {atlas.source} Built {atlas.builtAt.slice(0, 10)}. Footfall: {footfall.source}{" "}
        {footfall.note} Every figure on this page is computed from those two files; none is typed
        in.{" "}
        <Link href="/sacred" className="underline">
          The interactive atlas, with filters and the toponym record
        </Link>
        .
      </Sources>
    </div>
  );
}
