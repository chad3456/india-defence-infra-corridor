import Link from "next/link";
import {
  RungKey,
  RungByCategory,
  RungConfidenceGrid,
  AttributionBreak,
} from "@/components/charts/EvidenceLadder";
import { getAllSeries, getAllSources, getSeries } from "@/lib/data";
import {
  buildEvidenceMap,
  withDeclared,
  gradeDeclared,
  attributionSeries,
  attributionShape,
  RUNGS,
  RULES,
  CONTESTS,
  CONTEST_NATURE,
} from "@/lib/epistemic";
import { ALL_SECURITY_SPECS } from "@/lib/security-catalogue";
import { buildVerification } from "@/lib/verification";
import { INDIA_SERIES } from "@/lib/india-catalogue";
import { CATEGORY_LABELS, type Category } from "@/lib/types";
import lweStates from "@/data/security/lwe-states.json";

/**
 * What this site knows, and how well it knows it.
 *
 * Every other page here answers a question about India. This one answers a
 * question about the pages: which of these numbers is a record somebody keeps,
 * which is a compilation somebody assembled, which is an estimate somebody
 * judged, which was computed here — and which question has no answer at all.
 *
 * It is built entirely from metadata the project already records, so it costs
 * nothing to keep true and it cannot drift away from the charts it describes.
 */

export const metadata = {
  title: "Evidence",
  description:
    "Every figure on this site graded by what kind of claim it is — record, compilation, estimate, construction or unmeasured — with the rule that produced each grade, the gaps inside the record, and where sources cannot be reconciled.",
};

const pct = (n: number, d: number) => (d === 0 ? "0" : Math.round((n / d) * 100).toString());

export default function EvidencePage() {
  const declaredSpecs = [...ALL_SECURITY_SPECS, ...INDIA_SERIES];
  const declared = declaredSpecs.filter((s) => !getSeries(s.id)).map(gradeDeclared);
  const map = withDeclared(buildEvidenceMap(getAllSeries(), getAllSources()), declared);

  const attribution = attributionSeries(lweStates.rows);
  const shape = attributionShape(attribution);
  const verification = buildVerification();
  // Counted, not typed in: these move every time the pipeline adds a series.
  const officialCount = getAllSeries().filter((s) => s.provenance === "official").length;
  const multilateralCount = getAllSeries().filter((s) => s.provenance === "multilateral").length;

  const total = map.totals.series;
  const records = map.byRung.record.length;
  const compilations = map.byRung.compilation.length;

  const stale = map.graded
    .filter((g) => (g.staleYears ?? 0) > 2)
    .sort((a, b) => (b.staleYears ?? 0) - (a.staleYears ?? 0));
  const holed = map.graded.filter((g) => g.holes > 0).sort((a, b) => b.holes - a.holes);

  return (
    <div className="max-w-[1180px]">
      <section className="border-b pb-5">
        <p className="eyebrow">evidence</p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-tight">
          How well we know what we publish
        </h1>
        <p className="mt-2 max-w-[760px] text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
          Every chart on this site answers a question about India. This page answers a question
          about the charts. Each of the {total} series is placed on an evidence ladder — a record
          somebody keeps, a compilation somebody assembled, an estimate somebody judged, a
          construction computed here, or a question nobody publishes an answer to.
        </p>
        <p className="mt-2 max-w-[760px] text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
          The headline is not flattering and is not meant to be:{" "}
          <strong className="font-medium text-[color:var(--text-primary)]">
            {pct(records, total)} per cent of what this site holds is a record
          </strong>{" "}
          — a figure kept by the body that creates it. {pct(compilations, total)} per cent is
          compilation: authoritative, checkable, and one remove from the thing it counts. That is
          the ordinary condition of public data about a country of this size, and a site that hid
          it would be claiming a precision it does not have.
        </p>
      </section>

      {/* ---------------------------------------------------------- */}

      <section className="mt-7">
        <h2 className="border-b pb-2 text-[15px] font-semibold tracking-tight">The ladder</h2>
        <p className="mt-3 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          The rungs are ordered by distance from the fact, not by the prestige of the publisher. A
          careful estimate from a respected institute is still an estimate; a dull administrative
          register is still a record. Each rung also names what a member of the public can actually
          do to check a number sitting on it, because a figure nobody outside the publisher can
          verify is a different kind of object from one anybody can.
        </p>

        <ol className="mt-5 space-y-4">
          {RUNGS.map((r, i) => {
            const n = map.byRung[r.id].length;
            return (
              <li key={r.id} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-[3px] h-3 w-3 shrink-0 rounded-sm"
                  style={{ background: `var(--rung-${i + 1})` }}
                />
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold">
                    {r.label}{" "}
                    <span className="tnum ml-1 font-normal text-[color:var(--text-muted)]">
                      {n} series · {pct(n, total)}%
                    </span>
                  </h3>
                  <p className="mt-1 max-w-[720px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
                    {r.meaning}
                  </p>
                  <p className="mt-1.5 max-w-[720px] text-[12px] leading-relaxed text-[color:var(--text-muted)]">
                    <span className="font-medium text-[color:var(--text-secondary)]">
                      How a citizen checks it:
                    </span>{" "}
                    {r.citizenCheck}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ---------------------------------------------------------- */}

      <section className="mt-9">
        <h2 className="border-b pb-2 text-[15px] font-semibold tracking-tight">
          What each sector rests on
        </h2>
        <p className="mt-3 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          Shares within each sector, with the series count at the end of the row so the denominator
          is never hidden. Sectors covered mainly by multilateral datasets read as compilation
          almost throughout; internal security reads as estimate, because the compiler works from
          press reporting and says so.
        </p>
        <div className="mt-4">
          <RungKey />
        </div>
        <RungByCategory rows={map.byCategory} />
      </section>

      {/* ---------------------------------------------------------- */}

      <section className="mt-9">
        <h2 className="border-b pb-2 text-[15px] font-semibold tracking-tight">
          Evidence and confidence are not the same axis
        </h2>
        <p className="mt-3 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          A rung says what kind of claim a number is. Confidence says how sure this project is of
          that particular figure. Merging them into one quality score would lose the cases worth
          knowing about. Vehicle registrations are a record held at medium confidence, because two
          states do not report into the national register. Transfer values are a meticulous,
          openly-documented estimate that no amount of rigour converts into a record.
        </p>
        <RungConfidenceGrid crossTab={map.crossTab} />
        <p className="mt-3 max-w-[760px] text-[11px] leading-relaxed text-[color:var(--text-muted)]">
          The off-diagonal cells are the useful ones. Read down a column and you are asking how sure
          we are; read across a row and you are asking what would have to be true for the number to
          be wrong. Those are different questions with different remedies.
        </p>
      </section>

      {/* ---------------------------------------------------------- */}

      <section className="mt-9">
        <h2 className="border-b pb-2 text-[15px] font-semibold tracking-tight">
          A break hiding inside a continuous-looking series
        </h2>
        <p className="mt-3 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          SATP records a &ldquo;Not Specified&rdquo; column for deaths it cannot attribute to
          civilians, security forces or insurgents. Summing the eighteen state datasheets behind
          every left-wing-extremism chart on this site shows that column populated in every one of
          the {shape.consecutiveYears} years from {attribution[0]?.year} to{" "}
          {shape.lastConsecutiveYear}, peaking near {(shape.peakShare * 100).toFixed(0)} per cent of
          fatalities — and then, from {shape.firstZeroRunYear}, reading exactly zero every year to
          the present.
        </p>
        <p className="mt-2 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          {shape.residuals.length > 0 ? (
            <>
              The two runs do not meet. Between them the column fires{" "}
              {shape.residuals.length === 1 ? "once" : `${shape.residuals.length} times`} — {" "}
              {shape.residuals.map((r) => `${r.unattributed} in ${r.year}`).join(" and ")} — small
              enough to read as nothing on the chart, and enough to show the category had not been
              retired outright. Describing this as a clean cutover would be tidier and would be
              wrong; the first version of this page did exactly that.
            </>
          ) : (
            <>Nothing sits between the two runs: the column stops being populated and stays that way.</>
          )}
        </p>
        <div className="mt-4">
          <AttributionBreak rows={attribution} shape={shape} />
        </div>
        <p className="mt-3 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          Two readings fit and this project cannot choose between them. Either attribution became
          complete, or the category fell out of use and every death is now assigned somewhere. The
          second would mean the civilian and insurgent splits after {shape.lastConsecutiveYear} carry a
          precision the earlier years never claimed — a change of method in the middle of a line
          that looks unbroken. The charts are published as they are; this is the caveat that belongs
          beside them.
        </p>
      </section>

      {/* ---------------------------------------------------------- */}

      <section className="mt-9">
        <h2 className="border-b pb-2 text-[15px] font-semibold tracking-tight">
          Checked against the government&rsquo;s own numbers
        </h2>
        <p className="mt-3 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          Most of what is here is multilateral — {multilateralCount} World Bank and WHO series
          against {officialCount} from Indian ministries — and a compilation is only as good as the
          record behind it. Where this site
          holds both an Indian government figure and the World Bank&rsquo;s for the same quantity,
          the two are compared year by year and the gap is published. Nobody has to take either on
          trust.
        </p>
        <p className="mt-2 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          None of these should match exactly, and a pair that did would be the suspicious one — it
          would suggest one body is republishing the other rather than compiling independently. What
          matters is whether the gap is small and stable, or large and moving. Each pair states the
          ratio its definitions predict, and the figure reported is the departure from that ratio
          rather than from equality.
        </p>

        <div className="mt-5 space-y-5">
          {verification.map((v) => (
            <article key={v.pair.id} className="border-t pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-[13px] font-semibold">{v.pair.quantity}</h3>
                {v.comparable ? (
                  <span className="tnum text-[11px] text-[color:var(--text-muted)]">
                    {v.years.length} shared year{v.years.length === 1 ? "" : "s"} ·{" "}
                    median departure {v.medianPercent?.toFixed(1)}%
                    {v.outliers.length > 0 ? ` · ${v.outliers.length} beyond tolerance` : ""}
                  </span>
                ) : (
                  <span className="text-[11px] text-[color:var(--text-muted)]">
                    not comparable — {v.reason}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">
                {v.officialTitle} <span className="text-[color:var(--text-muted)]">(India)</span>
                {"  ·vs·  "}
                {v.multilateralTitle}{" "}
                <span className="text-[color:var(--text-muted)]">(World Bank)</span>
                {v.pair.expectedRatio !== 1 && (
                  <span className="text-[color:var(--text-muted)]">
                    {" "}· compared at a ratio of {v.pair.expectedRatio}
                  </span>
                )}
              </p>
              <p className="mt-2 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
                {v.pair.expectedDifference}
              </p>
              {v.comparable && v.years.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-[440px] border-collapse text-[11px]">
                    <thead>
                      <tr className="text-[color:var(--text-muted)]">
                        <th className="pb-1 pr-4 text-left font-medium">year</th>
                        <th className="pb-1 pr-4 text-right font-medium">India</th>
                        <th className="pb-1 pr-4 text-right font-medium">World Bank</th>
                        <th className="pb-1 text-right font-medium">departure</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.years.slice(-6).map((y) => (
                        <tr key={y.year} className="border-t">
                          <td className="tnum py-1 pr-4">{y.year}</td>
                          <td className="tnum py-1 pr-4 text-right">
                            {y.official.toLocaleString("en-IN", { maximumSignificantDigits: 4 })}
                          </td>
                          <td className="tnum py-1 pr-4 text-right">
                            {y.multilateral.toLocaleString("en-IN", { maximumSignificantDigits: 4 })}
                          </td>
                          <td
                            className="tnum py-1 text-right"
                            style={{
                              color:
                                Math.abs(y.excessPercent) > v.pair.tolerancePercent
                                  ? "var(--status-critical)"
                                  : undefined,
                            }}
                          >
                            {y.excessPercent > 0 ? "+" : ""}
                            {y.excessPercent.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-1.5 text-[11px] text-[color:var(--text-muted)]">
                    Both in {v.pair.unit}. Last {Math.min(6, v.years.length)} shared years shown.
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>

        <p className="mt-5 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          Where two sources differ this site does not declare a winner, because it has no standing
          to. Both are published by bodies with better access to the underlying returns than this
          project has. The gap is reported; what it means is the reader&rsquo;s to judge.
        </p>
      </section>

      {/* ---------------------------------------------------------- */}

      <section className="mt-9">
        <h2 className="border-b pb-2 text-[15px] font-semibold tracking-tight">
          Where sources cannot be reconciled
        </h2>
        <p className="mt-3 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          Unlike everything above, this section is declared rather than computed, and the difference
          matters. A disagreement between two publishers is a claim about the world; grading our own
          metadata is arithmetic. Each entry names what kind of disagreement it is, which side this
          project actually holds, and what would settle it. None of them quotes a figure this
          project has not read.
        </p>

        <div className="mt-5 space-y-5">
          {CONTESTS.map((c) => (
            <article key={c.id} className="border-t pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-[13px] font-semibold">{c.claim}</h3>
                <span className="text-[11px] text-[color:var(--text-muted)]">
                  {c.weHold === "both"
                    ? "both sides held here"
                    : c.weHold === "one"
                      ? "one side held here"
                      : "neither side held here"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">
                {c.sides.join("  ·vs·  ")}
              </p>
              <p className="mt-2 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
                {c.detail}
              </p>
              <dl className="mt-2 space-y-1">
                <div className="flex gap-2 text-[11px]">
                  <dt className="shrink-0 font-medium text-[color:var(--text-secondary)]">
                    Nature
                  </dt>
                  <dd className="text-[color:var(--text-muted)]">{CONTEST_NATURE[c.nature]}</dd>
                </div>
                <div className="flex gap-2 text-[11px]">
                  <dt className="shrink-0 font-medium text-[color:var(--text-secondary)]">
                    Settled by
                  </dt>
                  <dd className="text-[color:var(--text-muted)]">{c.settledBy}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- */}

      <section className="mt-9">
        <h2 className="border-b pb-2 text-[15px] font-semibold tracking-tight">
          Gaps inside the record
        </h2>
        <p className="mt-3 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          A series can sit on a good rung and still be thin. These are counted from the stored
          points: a hole is a year missing inside a span that is otherwise covered, not a year
          before the series began.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="tnum text-[20px] font-semibold">{holed.length}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--text-secondary)]">
              series with at least one missing year inside their span. Left as gaps — never
              interpolated, never zero-filled.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="tnum text-[20px] font-semibold">{stale.length}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--text-secondary)]">
              series whose latest value is more than two years old. Usually the publisher&rsquo;s
              lag, not the pipeline&rsquo;s.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="tnum text-[20px] font-semibold">
              {map.totals.lowConfidenceWithoutNote}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--text-secondary)]">
              low-confidence series carrying no published caveat. The build refuses to ship this
              above zero.
            </p>
          </div>
        </div>

        {stale.length > 0 && (
          <>
            <h3 className="mt-6 text-[13px] font-semibold">Furthest behind</h3>
            <ul className="mt-2 space-y-1">
              {stale.slice(0, 10).map((g) => (
                <li
                  key={g.seriesId}
                  className="flex items-baseline justify-between gap-3 text-[12px]"
                >
                  <span className="text-[color:var(--text-secondary)]">
                    {g.title}{" "}
                    <span className="text-[color:var(--text-muted)]">
                      · {CATEGORY_LABELS[g.category as Category]}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-[color:var(--text-muted)]">
                    latest {g.span?.[1]}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ---------------------------------------------------------- */}

      <section className="mt-9 border-t pt-5">
        <h2 className="text-[15px] font-semibold tracking-tight">The rule that produced each grade</h2>
        <p className="mt-2 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          Nothing on this page is graded by hand. The list below runs in order and the first match
          wins, against provenance, source tier and whether the series carries any value at all —
          all of which are published with every chart. A reader can re-run it and get the same
          answer, which is the only reason a page grading its own reliability is worth reading.
        </p>
        <ol className="mt-4 space-y-1.5">
          {RULES.map((r) => (
            <li key={r.n} className="flex gap-3 text-[12px]">
              <span className="tnum w-4 shrink-0 text-[color:var(--text-muted)]">{r.n}</span>
              <span className="text-[color:var(--text-secondary)]">{r.test}</span>
              <span className="ml-auto shrink-0 text-[color:var(--text-muted)]">
                → {r.rung}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          Rule 5 is the one substantive judgement, and it is stated rather than buried: a
          multilateral body is never the record holder for a national statistic. The World Bank does
          not count India&rsquo;s electricity connections — India does, and the Bank republishes
          them. That single rule is why compilation is the largest rung on this site, and the
          consequence is reported rather than smoothed away.
        </p>
        <p className="mt-3 max-w-[760px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          The formulas behind every constructed series, and the limits published with them, are on{" "}
          <Link href="/methodology" className="link-underline">
            methodology
          </Link>
          . Every source, with its tier and the date it was last checked, is on{" "}
          <Link href="/data-sources" className="link-underline">
            data sources
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
