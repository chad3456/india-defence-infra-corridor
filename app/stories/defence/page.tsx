import Link from "next/link";
import { getSeries, latestPoint, firstPoint } from "@/lib/data";
import { loadDeals, MEASURE_LABEL, asWritten } from "@/lib/deals";
import {
  Eyebrow, Headline, Standfirst, Mark, Stat, Columns, BarRow, pct,
  WhatThisCannotSay, Sources,
} from "@/components/stories/Kit";

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
