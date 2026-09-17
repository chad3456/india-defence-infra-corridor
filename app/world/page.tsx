import Link from "next/link";
import {
  loadRegistry, indicator, seriesFor, mapFor, countrySeries, latestOf, fmt, pickerRows,
} from "@/lib/owid";
import { numericOf } from "@/lib/iso";
import {
  Eyebrow, Headline, Standfirst, Mark, Stat, Columns, Sources,
} from "@/components/stories/Kit";
import {
  ChartTitle, Caption, Choropleth, RankedRows,
} from "@/components/stories/Charts";
import IndicatorPicker from "@/components/world/IndicatorPicker";

/**
 * A map of everything Our World in Data publishes, one indicator at a time.
 *
 * ── What this page is ────────────────────────────────────────────────────
 *
 * The brief asked for a map tracker across a thousand attributes — shipments,
 * trade, missiles and the rest. This is that, built the only way it can be
 * built honestly: the thousand come from OWID's own published chart index, not
 * from a list anyone here typed, and each one carries the unit and the
 * attribution OWID publishes with it.
 *
 * ── The two things it refuses to do ──────────────────────────────────────
 *
 * It does not colour a map by an absolute total. A choropleth shaded by GDP
 * or by tonnes shipped is a map of how large countries are; the component says
 * so and the caller has to know which kind of quantity it is handing over.
 * Where an indicator is an absolute, the ranking beside the map is the honest
 * reading of it.
 *
 * And it does not compare indicators with each other. Two OWID indicators come
 * from different producers with different definitions, coverage and vintages.
 * The page shows one at a time on purpose — every apparatus for putting two on
 * one axis was left out rather than built and caveated.
 *
 * ── Why India is outlined rather than centred ────────────────────────────
 *
 * This is an India site and the temptation is an India-first view of every
 * indicator. But the interesting thing about most of these is where India sits
 * among everyone, which is a question a world map answers and a national one
 * cannot. So the world is the frame, India is outlined, and its rank is
 * printed beside the map in words.
 */

export const metadata = {
  title: "The world, one indicator at a time · Bharat Tracker",
  description:
    "A searchable map over Our World in Data's published chart index — trade, energy, conflict, " +
    "health and the rest — each with the unit and citation its producer gives it.",
};

/** The default, chosen because it is the one most people have a prior about. */
const DEFAULT_SLUG = "gdp-per-capita-worldbank";

export default async function WorldPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.i;
  const wanted = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;

  const reg = loadRegistry();

  if (!reg.present) {
    return (
      <div className="pt-12">
        <Eyebrow>not built</Eyebrow>
        <Headline>The indicator registry is not in this deployment.</Headline>
        <Standfirst>
          Run <span className="mono">npm run owid:build</span> in CI to build{" "}
          <span className="mono">data/owid/</span>. Nothing on this page is typed in, so without it
          there is nothing to draw.
        </Standfirst>
      </div>
    );
  }

  const rows = pickerRows(reg);
  // Fall back to the first mappable indicator rather than to nothing: a page
  // whose default slug has been retired upstream should still draw a map.
  const chosen =
    (wanted ? indicator(reg, wanted) : undefined)
    ?? indicator(reg, DEFAULT_SLUG)
    ?? reg.indicators.find((i) => i.tiers.map)
    ?? reg.indicators[0];

  if (!chosen) {
    return (
      <div className="pt-12">
        <Eyebrow>empty</Eyebrow>
        <Headline>The registry carries no indicators.</Headline>
      </div>
    );
  }

  const series = seriesFor(chosen);
  const mapRows = mapFor(chosen);
  const india = countrySeries(series, "IND");
  const indiaLatest = latestOf(series, "IND");

  /** Map rows joined to the atlas. A code with no outline is counted, not dropped. */
  const choropleth = mapRows
    .map((r) => ({ id: numericOf(r.iso) ?? "", name: r.iso, value: r.value }))
    .filter((r) => r.id !== "");

  /** Where India sits, on the map tier's own latest values. */
  const ranked = [...mapRows].sort((a, b) => b.value - a.value);
  const indiaRank = ranked.findIndex((r) => r.iso === "IND") + 1;
  const indiaMapValue = ranked.find((r) => r.iso === "IND");

  /** The comparator set, latest value each, for the ranking beside the map. */
  const comparatorRows = reg.comparators
    .map((iso) => ({ iso, point: latestOf(series, iso) }))
    .filter((c): c is { iso: string; point: { year: number; value: number } } => c.point !== null)
    .sort((a, b) => b.point.value - a.point.value);

  const unit = chosen.unit || chosen.shortUnit;

  return (
    <div>
      <header className="pt-10">
        <Eyebrow tone="mid">
          world tracker · {reg.counts.indicators.toLocaleString("en-US")} indicators ·{" "}
          {reg.counts.withMapTier} mappable
        </Eyebrow>
        <h1 className="story-display mt-4 max-w-[19ch] text-[34px] sm:text-[46px] lg:text-[54px]">
          The World, One Indicator at a Time.
        </h1>
        <Standfirst>
          Every chart Our World in Data publishes, discovered from its own index rather than chosen
          here — <Mark tone="mid">{reg.counts.slugsDiscovered.toLocaleString("en-US")}</Mark> slugs
          found, {reg.counts.indicators.toLocaleString("en-US")} carrying a unit and a citation this
          site will print. Search below; the map colours by whichever you pick.
        </Standfirst>
      </header>

      {/* ── The picker ────────────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="story-card p-5 sm:p-6">
          <IndicatorPicker rows={rows} selected={chosen.slug} />
        </div>
      </section>

      {/* ── The chosen indicator ──────────────────────────────────────── */}
      <section className="mt-10">
        <Eyebrow tone="hot">{chosen.category}</Eyebrow>
        <Headline>{chosen.title}</Headline>
        {chosen.subtitle && <Standfirst>{chosen.subtitle}</Standfirst>}
        <p className="mono mt-4 text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>
          {unit || "no unit stated"}
          {chosen.timespan ? ` · ${chosen.timespan}` : ""}
          {chosen.attribution ? ` · ${chosen.attribution}` : ""}
        </p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          size="md"
          tone="hot"
          label={`India · ${indiaLatest ? indiaLatest.year : "no value"}`}
          value={indiaLatest ? fmt(indiaLatest.value) : "—"}
          note={
            indiaLatest
              ? <>{unit || "unit not stated by the producer"}.</>
              : <>This indicator carries no value for India. That is a gap in the source, not a zero.</>
          }
        />
        <Stat
          size="md"
          tone="mid"
          label="countries on the map"
          value={choropleth.length > 0 ? String(choropleth.length) : "—"}
          note={
            chosen.tiers.map
              ? <>Of {mapRows.length} with a value. The rest are small states the atlas does not draw.</>
              : <>This indicator is series-only: the registry caps how many are fetched for every country.</>
          }
        />
        <Stat
          size="md"
          tone={indiaRank > 0 ? "cool" : "mid"}
          label="India's rank, latest values"
          value={indiaRank > 0 ? `${indiaRank}` : "—"}
          note={
            indiaRank > 0
              ? <>Of {ranked.length} countries, highest first. Rank on a mixed-vintage snapshot: not every country's latest year is the same year.</>
              : <>Not ranked — no map tier, or no Indian value.</>
          }
        />
        <Stat
          size="md"
          tone="mid"
          label="years covered"
          value={chosen.firstYear && chosen.lastYear ? `${chosen.lastYear - chosen.firstYear}` : "—"}
          note={
            chosen.firstYear && chosen.lastYear
              ? <>{chosen.firstYear} to {chosen.lastYear}, across the comparator set.</>
              : <>No year range in the comparator data.</>
          }
        />
      </section>

      {/* ── The map ───────────────────────────────────────────────────── */}
      <section className="mt-10">
        <div className="story-card p-4 sm:p-6">
          {choropleth.length > 0 ? (
            <>
              <ChartTitle note={chosen.description || undefined}>
                {chosen.title}, latest value per country
              </ChartTitle>
              <Choropleth
                rows={choropleth}
                unit={chosen.shortUnit || undefined}
                marked={numericOf("IND")}
                height={420}
                note={
                  indiaMapValue
                    ? `India is outlined, at ${fmt(indiaMapValue.value)} in ${indiaMapValue.year}.`
                    : "India has no value for this indicator."
                }
              />
            </>
          ) : (
            <div>
              <Eyebrow tone="mid">series only</Eyebrow>
              <p className="mt-3 max-w-[64ch] text-[13px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
                This indicator has no map tier. One full indicator is about 600KB and{" "}
                {reg.counts.indicators.toLocaleString("en-US")} of them is a gigabyte pulled from a
                charity in one job, so every-country data is fetched for a capped subset —{" "}
                {reg.counts.withMapTier} of them. The series below is complete for the comparator
                set, and the indicator is on OWID&rsquo;s own site in full.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── India over time, and against the comparators ──────────────── */}
      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="story-card min-w-0 p-5 sm:p-6">
          <ChartTitle note={`${unit || "Unit not stated"}. India only.`}>
            India, {chosen.firstYear ?? "?"}–{chosen.lastYear ?? "?"}
          </ChartTitle>
          {india.length > 1 ? (
            <Columns
              tone="hot"
              height={170}
              points={india
                // A century of annual points is unreadable as labelled columns,
                // so a long series is thinned to about thirty and the caption
                // says so rather than letting the gaps read as missing years.
                .filter((_, i, arr) => arr.length <= 30 || i % Math.ceil(arr.length / 30) === 0)
                .map((p) => ({ label: String(p.year).slice(2), value: p.value }))}
              format={(v: number) => fmt(v)}
            />
          ) : (
            <p className="text-[13px]" style={{ color: "var(--story-ink-2)" }}>
              Fewer than two Indian points; nothing to draw as a series.
            </p>
          )}
          {india.length > 30 && (
            <Caption>
              {india.length} annual points thinned to about thirty so each column can carry its
              value. The years between are in the data and not on this chart.
            </Caption>
          )}
        </div>

        <div className="story-card min-w-0 p-5 sm:p-6">
          <ChartTitle note="Each country's own latest year, which is not always the same year.">
            The comparator set
          </ChartTitle>
          {comparatorRows.length > 0 ? (
            <RankedRows
              tone="mid"
              markTone="hot"
              rows={comparatorRows.map((c) => ({
                name: c.iso,
                value: Math.abs(c.point.value),
                display: fmt(c.point.value),
                mark: c.iso === "IND",
                meta: String(c.point.year),
              }))}
            />
          ) : (
            <p className="text-[13px]" style={{ color: "var(--story-ink-2)" }}>
              No comparator carries a value for this indicator.
            </p>
          )}
          <Caption>
            Bar length is the absolute value, so a negative figure is drawn at its magnitude and
            read from the number beside it. The comparator set is fixed across every indicator on
            this site, so any two pages compare the same countries.
          </Caption>
        </div>
      </section>

      {/* ── What this cannot say ──────────────────────────────────────── */}
      <section className="mt-12 border-t pt-8" style={{ borderColor: "var(--story-rule)" }}>
        <Eyebrow>what this tracker cannot tell you</Eyebrow>
        <ul className="mt-4 grid list-none grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-3 p-0 sm:grid-cols-2">
          {reg.cannotSay.map((c) => (
            <li key={c} className="min-w-0 text-[13px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
              {c}
            </li>
          ))}
          <li className="min-w-0 text-[13px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
            Whether two indicators here are comparable with each other. They come from different
            producers with different definitions and vintages, so this page shows one at a time and
            provides no way to put two on one axis.
          </li>
        </ul>
      </section>

      <Sources>
        {reg.source} {reg.attribution} Built {reg.builtAt.slice(0, 10)} from{" "}
        {reg.counts.slugsDiscovered.toLocaleString("en-US")} discovered slugs;{" "}
        {reg.counts.skipped} were skipped for carrying no unit, attribution or citation.{" "}
        {chosen.citation && <>This indicator&rsquo;s own citation: {chosen.citation}. </>}
        <a href={`https://ourworldindata.org/grapher/${chosen.slug}`} target="_blank"
          rel="noopener noreferrer" className="underline">
          This chart on Our World in Data
        </a>
        {" · "}
        <Link href="/stories" className="underline">Visual stories</Link>
      </Sources>
    </div>
  );
}
