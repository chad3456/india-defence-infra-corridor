import { VERDICTS, GRADE_MEANING, gradeCounts, type Grade } from "@/lib/assessment";
import { CATEGORY_LABELS } from "@/lib/types";
import { getChart } from "@/lib/registry";
import ChartCard from "@/components/charts/ChartCard";

export const metadata = { title: "Honest assessment" };

const GRADE_COLOR: Record<Grade, string> = {
  A: "var(--status-good)",
  B: "var(--series-1)",
  C: "var(--status-warning)",
  D: "var(--status-critical)",
};

export default function BenchmarkPage() {
  const counts = gradeCounts();

  return (
    <div>
      <section className="border-b pb-6">
        <p className="eyebrow">assessment</p>
        <h1 className="mt-2 max-w-[680px] text-[24px] font-semibold leading-tight tracking-tight">
          How good is this, actually?
        </h1>
        <div className="mt-3 max-w-[640px] space-y-2.5 text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          <p>
            Every grade below is assigned against a <strong>global</strong> reference point, never
            against India&apos;s own past. That choice does most of the work here: almost every
            series on this site rises steeply from its 2001 base, and grading against that base
            would produce straight A&apos;s and tell you nothing.
          </p>
          <p>
            Each verdict names the yardstick, states what is genuinely working, states what is
            genuinely not, and then gives the strongest good-faith argument against its own grade.
            If you disagree with a grade, the counterpoint is where to start.
          </p>
        </div>

        {/* Grade distribution */}
        <div className="mt-5 flex flex-wrap gap-2">
          {(["A", "B", "C", "D"] as Grade[]).map((g) => (
            <div key={g} className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <span
                className="flex h-6 w-6 items-center justify-center rounded text-[12px] font-semibold text-white"
                style={{ background: GRADE_COLOR[g] }}
                aria-hidden
              >
                {g}
              </span>
              <div>
                <p className="tnum text-[13px] font-semibold leading-none">{counts[g]}</p>
                <p className="text-[10px] text-[color:var(--text-muted)]">
                  {g === "A" ? "frontier" : g === "B" ? "above peers" : g === "C" ? "as expected" : "constraint"}
                </p>
              </div>
            </div>
          ))}
        </div>

        <dl className="mt-4 space-y-1 text-[11px]">
          {(["A", "B", "C", "D"] as Grade[]).map((g) => (
            <div key={g} className="flex gap-2">
              <dt className="w-4 shrink-0 font-semibold" style={{ color: GRADE_COLOR[g] }}>
                {g}
              </dt>
              <dd className="text-[color:var(--text-secondary)]">{GRADE_MEANING[g]}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Verdicts */}
      <section className="divide-y">
        {VERDICTS.map((v) => {
          const charts = v.seriesIds
            .map((id) => getChart(`${id}--level`))
            .filter((c) => c !== undefined)
            .slice(0, 2);

          return (
            <article key={v.id} className="py-7" id={v.id}>
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded text-[15px] font-semibold text-white"
                  style={{ background: GRADE_COLOR[v.grade] }}
                  aria-label={`Grade ${v.grade}`}
                >
                  {v.grade}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h2 className="text-[16px] font-semibold tracking-tight">{v.area}</h2>
                    <span className="eyebrow">{CATEGORY_LABELS[v.category]}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-[color:var(--text-muted)]">
                    <span className="eyebrow">measured against</span> {v.benchmark}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border-l-2 bg-[var(--surface-1)] p-3" style={{ borderLeftColor: "var(--status-good)" }}>
                  <p className="eyebrow mb-1.5">what works</p>
                  <p className="text-[12px] leading-relaxed">{v.strength}</p>
                </div>
                <div className="rounded-lg border-l-2 bg-[var(--surface-1)] p-3" style={{ borderLeftColor: "var(--status-critical)" }}>
                  <p className="eyebrow mb-1.5">what does not</p>
                  <p className="text-[12px] leading-relaxed">{v.weakness}</p>
                </div>
                <div className="rounded-lg border-l-2 bg-[var(--surface-1)] p-3" style={{ borderLeftColor: "var(--baseline)" }}>
                  <p className="eyebrow mb-1.5">strongest objection to this grade</p>
                  <p className="text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
                    {v.counterpoint}
                  </p>
                </div>
              </div>

              {charts.length > 0 && (
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {charts.map((c) => (
                    <ChartCard key={c.id} spec={c} compact />
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </section>

      <section className="mt-6 rounded-lg border border-dashed p-4">
        <p className="eyebrow">on these grades</p>
        <p className="mt-1.5 max-w-[660px] text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
          These are editorial judgements, not computed scores — there is no defensible way to
          reduce &ldquo;how good is India&apos;s defence industrial base&rdquo; to arithmetic, and
          pretending otherwise would be the dishonest option. What is not editorial is the
          underlying data: every series cited here carries its source, its verification date and
          its confidence grade, and you can reach the primary document in two clicks from any
          chart. Disagree with the grade, but check the number first.
        </p>
      </section>
    </div>
  );
}
