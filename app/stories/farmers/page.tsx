import Link from "next/link";
import { getSeries, latestPoint, firstPoint } from "@/lib/data";
import {
  Eyebrow, Headline, Standfirst, Mark, Stat, Columns, BarRow, pct,
  WhatThisCannotSay, Sources,
} from "@/components/stories/Kit";

/**
 * India feeds itself twice over. The farmer is still waiting.
 *
 * ── Two true things ──────────────────────────────────────────────────────
 *
 * The output story is an unambiguous success and deserves to be told as one.
 * Cereal production is up 62% since 2001, yields up 50%, aquaculture up
 * nearly sixfold, and the share of the population undernourished has fallen
 * from 18.1% to 12%. A country that imported grain within living memory now
 * exports it.
 *
 * The income story is not. India crops 107.7 million hectares of cereals —
 * more land than China — and grows 39% less on it. Value added per
 * agricultural worker is $2,159 against China's $8,631 and Brazil's $14,204.
 * Forty-two per cent of the workforce produces sixteen per cent of the output,
 * and that gap is the definition of low agricultural incomes.
 *
 * The user asked how farmers are excelling. They are, at producing food. The
 * honest version of that story includes why the excellence has not turned into
 * income, because a page that showed only the first half would be the kind of
 * thing this site exists as an alternative to.
 *
 * ── The comparison that makes it concrete ────────────────────────────────
 *
 * Land under cereals is the right denominator for the yield gap, and India
 * against China on that one pairing says more than any index: same scale of
 * land, two-thirds of the output per hectare.
 */

export const metadata = {
  title: "India feeds itself twice over · Bharat Tracker",
  description:
    "Cereal output up 62% since 2001 and yields up half. Forty-two per cent of the workforce " +
    "still produces sixteen per cent of the output.",
};

function mt(v: number): string { return `${(v / 1e6).toFixed(0)} Mt`; }
function mha(v: number): string { return `${(v / 1e6).toFixed(1)} Mha`; }

/** Peer rows, India first, each carrying its own year. */
function peersOf(id: string): Array<{ country: string; value: number; period: string }> {
  const s = getSeries(id);
  const raw = (s as unknown as { peers?: Array<{ country: string; value: number | null; period: string }> })?.peers ?? [];
  return raw
    .filter((p): p is { country: string; value: number; period: string } => p.value !== null)
    .sort((a, b) => (a.country === "India" ? -1 : b.country === "India" ? 1 : b.value - a.value));
}

export default function FarmersStory() {
  const yieldS = getSeries("wdi-ag-yld-crel-kg");
  const prod = getSeries("wdi-ag-prd-crel-mt");
  const land = getSeries("wdi-ag-lnd-crel-ha");
  const gdp = getSeries("wdi-agriculture-gdp");
  const empl = getSeries("wdi-agriculture-employment");
  const perWorker = getSeries("wdi-nv-agr-empl-kd");
  const hunger = getSeries("wdi-undernourishment");
  const aqua = getSeries("wdi-er-fsh-aqua-mt");
  const femEmpl = getSeries("wdi-sl-agr-empl-fe-zs");
  const foodExp = getSeries("wdi-tx-val-food-zs-un");

  if (!yieldS || !prod) {
    return (
      <div className="pt-12">
        <Eyebrow>not built</Eyebrow>
        <Headline>The agricultural series are not in this deployment.</Headline>
      </div>
    );
  }

  const yFirst = firstPoint(yieldS)!;
  const yLast = latestPoint(yieldS)!;
  const pFirst = firstPoint(prod)!;
  const pLast = latestPoint(prod)!;
  const emplLast = empl ? latestPoint(empl) : undefined;
  const gdpLast = gdp ? latestPoint(gdp) : undefined;

  const yieldPeers = peersOf("wdi-ag-yld-crel-kg");
  const workerPeers = peersOf("wdi-nv-agr-empl-kd");
  const landPeers = peersOf("wdi-ag-lnd-crel-ha");
  const india = yieldPeers.find((p) => p.country === "India");
  const china = yieldPeers.find((p) => p.country === "China");
  const indiaLand = landPeers.find((p) => p.country === "India");
  const chinaLand = landPeers.find((p) => p.country === "China");
  const yieldGap = india && china ? (1 - india.value / china.value) * 100 : null;

  return (
    <div>
      <header className="pt-10">
        <Eyebrow tone="cool">agriculture · productivity · {yFirst.period}–{yLast.period}</Eyebrow>
        <h1 className="story-display mt-4 max-w-[18ch] text-[38px] sm:text-[54px] lg:text-[62px]">
          India Feeds Itself Twice Over. The Farmer Is Still Waiting.
        </h1>
        <Standfirst>
          Cereal output is up <Mark tone="cool">
            {(((pLast.value ?? 0) / (pFirst.value ?? 1) - 1) * 100).toFixed(0)}%
          </Mark> since {pFirst.period} and yields by half. That is a genuine and large success.
          It has not become income: {pct(emplLast?.value)} of the workforce produces{" "}
          {pct(gdpLast?.value)} of the output, and an Indian farm worker adds a quarter of what a
          Chinese one does.
        </Standfirst>
      </header>

      {/* ── What went right ───────────────────────────────────────────── */}
      <section className="mt-10 grid gap-4 sm:grid-cols-4">
        <Stat
          tone="cool" size="md"
          label={`cereal output · ${pLast.period}`}
          value={mt(pLast.value ?? 0)}
          note={<>From {mt(pFirst.value ?? 0)} in {pFirst.period}.</>}
        />
        <Stat
          tone="cool" size="md"
          label={`yield · ${yLast.period}`}
          value={`${Math.round(yLast.value ?? 0)}`}
          unit="kg/ha"
          note={<>Up {(((yLast.value ?? 0) / (yFirst.value ?? 1) - 1) * 100).toFixed(0)}% since {yFirst.period}.</>}
        />
        {aqua && latestPoint(aqua) && firstPoint(aqua) && (
          <Stat
            tone="cool" size="md"
            label={`aquaculture · ${latestPoint(aqua)!.period}`}
            value={mt(latestPoint(aqua)!.value ?? 0)}
            note={<>{((latestPoint(aqua)!.value ?? 0) / (firstPoint(aqua)!.value ?? 1)).toFixed(1)}× the {firstPoint(aqua)!.period} figure — the fastest-growing thing on this page.</>}
          />
        )}
        {hunger && latestPoint(hunger) && firstPoint(hunger) && (
          <Stat
            tone="cool" size="md"
            label={`undernourishment · ${latestPoint(hunger)!.period}`}
            value={pct(latestPoint(hunger)!.value)}
            note={<>Down from {pct(firstPoint(hunger)!.value)} in {firstPoint(hunger)!.period}. Still {pct(latestPoint(hunger)!.value)}.</>}
          />
        )}
      </section>

      {/* ── The output curve ──────────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow tone="cool">what went right</Eyebrow>
        <Headline>Half as Much Again Off Every Hectare.</Headline>
        <Standfirst>
          Cereal yield, kilograms per hectare. The rise is steady rather than dramatic, which is
          what a real agronomic gain looks like — seed, irrigation and fertiliser compounding over
          two decades rather than a single reform.
        </Standfirst>
        <div className="story-card mt-7 p-5 sm:p-7">
          <Columns
            points={yieldS.points
              .filter((p) => p.value !== null)
              .map((p) => ({ label: p.period.slice(2), value: p.value ?? 0 }))}
            tone="cool"
            height={190}
            format={(v) => String(Math.round(v))}
          />
          <p className="mt-6 text-[12px] leading-[1.6]" style={{ color: "var(--story-ink-3)" }}>
            kg per hectare, {yFirst.period}–{yLast.period}. World Bank World Development
            Indicators, drawing on FAO. Cereals only — this says nothing about pulses, oilseeds,
            horticulture or milk, and India&rsquo;s gains in the last of those are larger than
            anything shown here.
          </p>
        </div>
      </section>

      {/* ── The comparison that lands ─────────────────────────────────── */}
      {india && china && indiaLand && chinaLand && yieldGap !== null && (
        <section className="mt-16">
          <Eyebrow tone="hot">the gap, in one comparison</Eyebrow>
          <Headline>India Crops More Cereal Land Than China. It Grows Less on It.</Headline>
          <Standfirst>
            <Mark tone="cool">{mha(indiaLand.value)}</Mark> against China&rsquo;s{" "}
            {mha(chinaLand.value)} — and {Math.round(india.value).toLocaleString("en-IN")} kg a
            hectare against {Math.round(china.value).toLocaleString("en-IN")}. Same scale of land,{" "}
            <Mark>{yieldGap.toFixed(0)}% less</Mark> off each hectare of it. That single pairing
            is the productivity story, and it is not about effort.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7">
            <Eyebrow>cereal yield, kg per hectare</Eyebrow>
            <div className="mt-4 space-y-1">
              {yieldPeers.map((p) => (
                <BarRow
                  key={p.country}
                  label={p.country}
                  sub={p.period}
                  value={p.value}
                  max={Math.max(...yieldPeers.map((x) => x.value))}
                  display={Math.round(p.value).toLocaleString("en-IN")}
                  tone={p.country === "India" ? "hot" : "cool"}
                />
              ))}
            </div>
            <p className="mt-5 text-[12px] leading-[1.6]" style={{ color: "var(--story-ink-3)" }}>
              Each bar carries its own year, because the latest available year differs by country
              and comparing 2024 against 2023 without saying so is how peer charts mislead.
            </p>
          </div>
        </section>
      )}

      {/* ── Income ────────────────────────────────────────────────────── */}
      <section className="mt-16">
        <Eyebrow tone="hot">where it does not arrive</Eyebrow>
        <Headline>Forty-Two Per Cent of the Workers, Sixteen Per Cent of the Output.</Headline>
        <Standfirst>
          That ratio is the definition of low farm incomes, and it has improved only slowly:
          agriculture&rsquo;s share of employment fell from{" "}
          {pct(firstPoint(empl!)?.value)} to {pct(emplLast?.value)} while its share of output fell from{" "}
          {pct(firstPoint(gdp!)?.value)} to {pct(gdpLast?.value)}. People are leaving farming more slowly
          than farming is shrinking as a share of the economy.
        </Standfirst>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {empl && gdp && emplLast && gdpLast && (
            <div className="story-card p-5" data-tone="hot">
              <Eyebrow tone="hot">the scissors, {emplLast.period}</Eyebrow>
              <div className="mt-4 space-y-2">
                <BarRow label="Share of employment" value={emplLast.value ?? 0} max={100}
                  display={pct(emplLast.value)} tone="hot" />
                <BarRow label="Share of output" value={gdpLast.value ?? 0} max={100}
                  display={pct(gdpLast.value)} tone="mid" />
              </div>
              <p className="mt-4 text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>
                Two and a half workers on the land for every one unit of output the rest of the
                economy would produce with one.
              </p>
            </div>
          )}
          {workerPeers.length > 0 && (
            <div className="story-card p-5" data-tone="hot">
              <Eyebrow tone="hot">value added per farm worker, constant US$</Eyebrow>
              <div className="mt-4 space-y-1">
                {workerPeers.map((p) => (
                  <BarRow
                    key={p.country}
                    label={p.country}
                    sub={p.period}
                    value={p.value}
                    max={Math.max(...workerPeers.map((x) => x.value))}
                    display={`$${Math.round(p.value).toLocaleString("en-IN")}`}
                    tone={p.country === "India" ? "hot" : "cool"}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        {perWorker && firstPoint(perWorker) && latestPoint(perWorker) && (
          <p className="mt-5 max-w-[64ch] text-[13px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
            It is rising: ${Math.round(firstPoint(perWorker)!.value ?? 0).toLocaleString("en-IN")}{" "}
            in {firstPoint(perWorker)!.period} to $
            {Math.round(latestPoint(perWorker)!.value ?? 0).toLocaleString("en-IN")} in{" "}
            {latestPoint(perWorker)!.period}, a doubling in constant dollars. The gap is to the
            comparators, not to the past.
          </p>
        )}
      </section>

      {/* ── Who is actually farming ───────────────────────────────────── */}
      {femEmpl && latestPoint(femEmpl) && (
        <section className="mt-16">
          <Eyebrow>who is on the land</Eyebrow>
          <Headline>Six in Ten Working Indian Women Work in Agriculture.</Headline>
          <Standfirst>
            <Mark tone="cool">{pct(latestPoint(femEmpl)!.value)}</Mark> of employed women, against{" "}
            {pct(getSeries("wdi-sl-agr-empl-ma-zs") ? latestPoint(getSeries("wdi-sl-agr-empl-ma-zs")!)?.value : null)}{" "}
            of employed men. Agriculture is where the female workforce is concentrated, and it is
            the sector with the lowest output per worker — which means the income gap on this page
            falls disproportionately on women.
          </Standfirst>
          <p className="mt-4 max-w-[64ch] text-[12.5px] leading-[1.6]" style={{ color: "var(--story-ink-3)" }}>
            Down from {pct(firstPoint(femEmpl)!.value)} in {firstPoint(femEmpl)!.period}. These are
            modelled ILO estimates rather than a count, and India&rsquo;s female labour force
            participation is itself measured with wide disagreement between surveys — so read the
            direction, not the decimal.
          </p>
        </section>
      )}

      {/* ── Exports ───────────────────────────────────────────────────── */}
      {foodExp && latestPoint(foodExp) && (
        <section className="mt-16">
          <Eyebrow tone="cool">the surplus that is real</Eyebrow>
          <Headline>Food Is {pct(latestPoint(foodExp)!.value)} of What India Sells Abroad.</Headline>
          <Standfirst>
            A country that imported grain under emergency aid within living memory now earns more
            than a tenth of its merchandise export revenue from food. That is the achievement the
            headline of this page is about, and it is not diminished by the income gap below it.
          </Standfirst>
          <div className="story-card mt-7 p-5 sm:p-7">
            <div className="space-y-1">
              {peersOf("wdi-tx-val-food-zs-un").map((p) => (
                <BarRow
                  key={p.country}
                  label={p.country}
                  sub={p.period}
                  value={p.value}
                  max={Math.max(...peersOf("wdi-tx-val-food-zs-un").map((x) => x.value))}
                  display={`${p.value.toFixed(1)}%`}
                  tone={p.country === "India" ? "cool" : "mid"}
                />
              ))}
            </div>
            <p className="mt-5 text-[12px] leading-[1.6]" style={{ color: "var(--story-ink-3)" }}>
              Food exports as a share of merchandise exports. A high share can mean a strong farm
              sector or a weak manufacturing one — Brazil is above India on this measure and that
              is not straightforwardly better.
            </p>
          </div>
        </section>
      )}

      <WhatThisCannotSay
        items={[
          {
            q: "What any farmer earns",
            a: <>Value added per worker is national output divided by the people in the sector. It is not income, it is not a wage, and it says nothing about distribution between a Punjab wheat farmer and a rain-fed smallholder.</>,
          },
          {
            q: "Anything about most of what India grows",
            a: <>The yield and production series here are cereals. Pulses, oilseeds, cotton, sugarcane, horticulture and milk are not in them — and India is the world&rsquo;s largest milk producer, which is a bigger agricultural achievement than anything on this page.</>,
          },
          {
            q: "Whether the water lasts",
            a: <>Nothing here measures groundwater. A substantial part of the yield gain shown above is irrigated, and the aquifers under Punjab and Haryana are falling. A yield series cannot tell you whether it is sustainable.</>,
          },
          {
            q: "How it varies by state",
            a: <>Not at all. These are national figures, and the range inside them is enormous — a Punjab hectare and a Jharkhand hectare are not the same measurement in anything but name.</>,
          },
          {
            q: "Whether MSP, PM-KISAN or credit reached anyone",
            a: <>Those are scheme questions and the schemes mostly do not publish coverage a script can read. <Link href="/schemes" className="underline">What refused, and what it said</Link>.</>,
          },
          {
            q: "The 2025 figures",
            a: <>Employment and GDP-share series run to 2025 and are modelled estimates; production and yield run to 2024 and are measured. The two should not be read as one year&rsquo;s snapshot.</>,
          },
        ]}
      />

      <Sources>
        World Bank World Development Indicators, drawing on FAO and modelled ILO estimates, as
        ingested into this site&rsquo;s series catalogue with a confidence grade on each. Peer
        values carry their own year because the latest available year differs by country.{" "}
        <Link href="/global" className="underline">India against its comparators, across a hundred indicators</Link>.
      </Sources>
    </div>
  );
}
