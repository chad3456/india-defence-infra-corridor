import { LIMITS } from "@/lib/security-index";
import Link from "next/link";
import { DATA_COVERAGE, getAllSeries } from "@/lib/data";
import { registryStats } from "@/lib/registry";

export const metadata = { title: "Methodology" };

export default function MethodologyPage() {
  const stats = registryStats();
  const series = getAllSeries();
  const byConfidence = series.reduce<Record<string, number>>((acc, s) => {
    acc[s.confidence] = (acc[s.confidence] ?? 0) + 1;
    return acc;
  }, {});
  const lowConfidence = series.filter((s) => s.confidence === "low");

  return (
    <div className="max-w-[720px]">
      <section className="border-b pb-5">
        <p className="eyebrow">methodology</p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-tight">
          How these numbers were built, and where they are weak
        </h1>
        <p className="mt-2 text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          This page exists because a data site without one is asking to be taken on trust. Read it
          before quoting anything here.
        </p>
      </section>

      <div className="space-y-8 py-7 text-[13px] leading-relaxed">
        <section>
          <h2 className="text-[15px] font-semibold tracking-tight">The core rule</h2>
          <p className="mt-2 text-[color:var(--text-secondary)]">
            Every number rendered on this site must be traceable to a named source with a URL and a
            verification date. This is enforced mechanically, not by good intentions:{" "}
            <span className="mono text-[11px]">scripts/validate.ts</span> runs before every build
            and fails it if any series lacks a definition, a unit, a resolvable source, or a
            confidence grade. A series that cannot satisfy that does not ship.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-tight">Gaps stay gaps</h2>
          <p className="mt-2 text-[color:var(--text-secondary)]">
            Where a figure could not be located, the period is stored as{" "}
            <span className="mono text-[11px]">null</span> and the chart shows a break in the line.
            Nothing is interpolated, smoothed, or back-filled with a plausible estimate. The defence
            exports series is missing FY2014-15 and FY2015-16 for exactly this reason — those two
            years are genuinely absent from the primary releases located during verification, and a
            smooth curve there would be a fabrication.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-tight">Confidence grades</h2>
          <p className="mt-2 text-[color:var(--text-secondary)]">
            Confidence describes the <em>number</em>, not the prestige of the publisher.
          </p>
          <dl className="mt-3 space-y-2">
            <div>
              <dt className="font-medium">
                High <span className="tnum text-[color:var(--text-muted)]">({byConfidence.high ?? 0} series)</span>
              </dt>
              <dd className="text-[color:var(--text-secondary)]">
                Primary document, unambiguous definition, cross-checked against a second source.
              </dd>
            </div>
            <div>
              <dt className="font-medium">
                Medium <span className="tnum text-[color:var(--text-muted)]">({byConfidence.medium ?? 0} series)</span>
              </dt>
              <dd className="text-[color:var(--text-secondary)]">
                Reliable source, but the definition drifts between releases or the figure is
                routinely revised.
              </dd>
            </div>
            <div>
              <dt className="font-medium">
                Low <span className="tnum text-[color:var(--text-muted)]">({byConfidence.low ?? 0} series)</span>
              </dt>
              <dd className="text-[color:var(--text-secondary)]">
                Estimate, single-sourced, or contested methodology. A low-confidence series is
                required to carry a note explaining the uncertainty — the validator enforces this.
              </dd>
            </div>
          </dl>
          {lowConfidence.length > 0 && (
            <div className="mt-3 rounded-lg border p-3">
              <p className="eyebrow mb-1.5">currently graded low</p>
              <ul className="space-y-1">
                {lowConfidence.map((s) => (
                  <li key={s.id} className="text-[12px] text-[color:var(--text-secondary)]">
                    <span className="font-medium text-[color:var(--text-primary)]">{s.title}</span> —{" "}
                    {s.notes?.[0]}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-tight">Source tiers</h2>
          <p className="mt-2 text-[color:var(--text-secondary)]">
            Tier 1 is the primary record holder for that quantity — a PIB release, a ministry
            document, a SIPRI fact sheet. Tier 2 is a credible secondary compiler. Tier 3 is a press
            report of a primary claim. A series resting only on tier-3 sources cannot be graded
            above low confidence, and the validator raises this automatically.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-tight">Derived charts are labelled</h2>
          <p className="mt-2 text-[color:var(--text-secondary)]">
            Year-on-year, indexed, growth-rate and share views are computed here from the stored
            series, and every one says so beneath its title. Derived views are only generated where
            they are meaningful — a year-on-year chart is never drawn across non-adjacent periods,
            and an index chart is never drawn off a zero base. Of {stats.total} charts,{" "}
            {stats.live} are live on currently-loaded data and {stats.pending} await the pipeline
            backfill; the pending ones are shown with an explicit &ldquo;awaiting data&rdquo; state
            rather than an empty axis.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-tight">
            The two constructed indices
          </h2>
          <p className="mt-2 text-[color:var(--text-secondary)]">
            Every other number here reports something somebody else published. The{" "}
            <strong className="font-medium text-[color:var(--text-primary)]">Tonality Score</strong>{" "}
            and the{" "}
            <strong className="font-medium text-[color:var(--text-primary)]">Action Index</strong>{" "}
            do not. They are constructed on this site, they carry a judgement in their names, and
            they are graded low confidence for that reason. This section is here so you can decide
            whether to trust them, or reject them and keep the fatality counts underneath, which
            stand on their own.
          </p>

          <h3 className="mt-5 text-[13px] font-semibold">Tonality Score, −100 to +100</h3>
          <p className="mt-2 text-[color:var(--text-secondary)]">
            A proxy for the state&rsquo;s posture in a given year. Negative reads accommodative —
            talks first, threat downplayed. Positive reads decisive — security first, an
            eradication mandate. Five dimensions, each bounded to ±20:
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[color:var(--text-secondary)]">
            <li>
              <strong className="font-medium text-[color:var(--text-primary)]">Initiative</strong> —
              the adversary&rsquo;s share of combatant deaths.
            </li>
            <li>
              <strong className="font-medium text-[color:var(--text-primary)]">
                Civilian protection
              </strong>{" "}
              — inverse of the civilian share of all deaths.
            </li>
            <li>
              <strong className="font-medium text-[color:var(--text-primary)]">Containment</strong> —
              direction of travel in total violence against the previous year.
            </li>
            <li>
              <strong className="font-medium text-[color:var(--text-primary)]">Attrition</strong> —
              cadre taken alive by arrest and surrender, as a share of all cadre removed.
            </li>
            <li>
              <strong className="font-medium text-[color:var(--text-primary)]">
                Escalation dominance
              </strong>{" "}
              — this year&rsquo;s exchange ratio against its own three-year baseline.
            </li>
          </ol>

          <h3 className="mt-5 text-[13px] font-semibold">Action Index, −1.6 to +1.6</h3>
          <p className="mt-2 text-[color:var(--text-secondary)]">
            A performance measure rather than a posture one. Four components, each bounded to ±0.4
            and each measured against the series&rsquo; own average: neutralisations and
            arrests-plus-surrenders push it up, civilian deaths and total incident volume push it
            down.
          </p>

          <h3 className="mt-5 text-[13px] font-semibold">Why nothing here is hand-scored</h3>
          <p className="mt-2 text-[color:var(--text-secondary)]">
            The obvious way to build a &ldquo;willpower&rdquo; index is to read the year&rsquo;s
            policy documents and code doctrine and framing by judgement. That would track the
            stated posture more directly — and it would be unfalsifiable, unreproducible and
            impossible for you to check. So posture is inferred from what the state did, not from
            what it said: every dimension above is computed from published fatality counts, and you
            can recompute all of it from the series on this site.
          </p>
          <p className="mt-2 text-[color:var(--text-secondary)]">
            That choice has a cost, and it is the first item below.
          </p>

          <h3 className="mt-5 text-[13px] font-semibold">What these numbers cannot tell you</h3>
          <ul className="mt-2 space-y-2 text-[color:var(--text-secondary)]">
            {LIMITS.map((l) => (
              <li key={l} className="flex gap-2">
                <span aria-hidden className="text-[color:var(--text-muted)]">
                  —
                </span>
                <span>{l}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-[color:var(--text-muted)]">
            These are ordinal, not cardinal. A year at +60 is more security-first than one at +30;
            it is not twice anything. Differences under about 10 points are inside the noise of the
            underlying compilations.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-tight">Known weaknesses</h2>
          <ul className="mt-2 space-y-2 text-[color:var(--text-secondary)]">
            <li>
              <strong className="text-[color:var(--text-primary)]">Nominal rupees.</strong> Indian
              financial series are stored as published — nominal, not inflation-adjusted. A large
              share of the apparent growth in defence exports, production and budget is rupee
              inflation and depreciation. Treat every rupee series as an upper bound on real growth.
            </li>
            <li>
              <strong className="text-[color:var(--text-primary)]">Definitional drift.</strong> Airport
              counts vary between releases (157, 159, 160, 163) because &ldquo;operational&rdquo;
              sometimes includes heliports and water aerodromes. Highway network length grows partly
              through re-designation of existing state roads. These are flagged per series.
            </li>
            <li>
              <strong className="text-[color:var(--text-primary)]">Estimates presented as data.</strong>{" "}
              Nuclear warhead counts are external inferences — India publishes nothing. That series
              is graded low and should be read as order-of-magnitude only.
            </li>
            <li>
              <strong className="text-[color:var(--text-primary)]">Commitments versus delivery.</strong>{" "}
              Investment figures for defence corridors are MoU commitments. Grounded investment runs
              at roughly 15% of that. Where both exist, both are shown.
            </li>
            <li>
              <strong className="text-[color:var(--text-primary)]">Schematic map geometry.</strong>{" "}
              Corridor lines on the map are straight segments between real geocoded endpoint cities,
              not surveyed alignments. The opening years are the load-bearing fact; the geometry is
              indicative.
            </li>
            <li>
              <strong className="text-[color:var(--text-primary)]">Fiscal versus calendar years.</strong>{" "}
              Indian data is mostly fiscal-year (April-March); World Bank data is calendar-year.
              They are never plotted on a shared axis.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-tight">The pipeline</h2>
          <p className="mt-2 text-[color:var(--text-secondary)]">
            Two connectors run on a schedule. The World Bank connector pulls full 2001-present
            history for 66 indicators across India and five comparator countries, rewriting each
            series in full rather than appending — the World Bank revises history, and appending
            would freeze stale revisions in. The news connector aggregates seven outlets purely as a
            change-detection signal.
          </p>
          <p className="mt-2 text-[color:var(--text-secondary)]">
            Connectors never throw. A failed connector leaves the previous committed data in place
            and marks the run partial, so the site keeps serving last-known-good values rather than
            blanking a chart. Output is written only after validation passes, so a malformed
            upstream response cannot land in the repository.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-tight">What this site is not</h2>
          <p className="mt-2 text-[color:var(--text-secondary)]">
            Not affiliated with any government body, party or contractor. The{" "}
            <Link href="/benchmark" className="link-underline">
              assessment page
            </Link>{" "}
            carries editorial judgements and says so plainly; each grade ships with the strongest
            argument against itself. The data underneath is separable from those judgements — you
            can reject every grade and still use every number.
          </p>
        </section>

        <section className="rounded-lg border p-4">
          <p className="eyebrow">current coverage</p>
          <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <dt className="text-[11px] text-[color:var(--text-muted)]">series</dt>
              <dd className="tnum text-[18px] font-semibold">{DATA_COVERAGE.seriesCount}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-[color:var(--text-muted)]">data points</dt>
              <dd className="tnum text-[18px] font-semibold">{DATA_COVERAGE.pointCount}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-[color:var(--text-muted)]">sources</dt>
              <dd className="tnum text-[18px] font-semibold">{DATA_COVERAGE.sourceCount}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-[color:var(--text-muted)]">charts</dt>
              <dd className="tnum text-[18px] font-semibold">{stats.total}</dd>
            </div>
          </dl>
          <Link href="/sources" className="link-underline mt-3 inline-block text-[11px]">
            Full source register →
          </Link>
        </section>
      </div>
    </div>
  );
}
