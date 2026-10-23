import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Eyebrow, Standfirst, WhatThisCannotSay, Sources } from "@/components/stories/Kit";
import { Awaiting } from "@/components/instagram/Charts";
import { ChartKey, RoundChart, fmtV } from "@/components/nfhs/RoundChart";
import StateExplorer, { type StateMetric } from "@/components/nfhs/StateExplorer";
import { METRICS, METRIC_NOTES, ROUND_NOTES, THEMES, comparableStates, currentStates, perYear, type MetricSeries, type NfhsRounds } from "@/lib/nfhs";

/**
 * India's National Family Health Survey, every round the DHS Program
 * publishes, compared metric by metric. Every value is DHS's own; the only
 * numbers computed here are changes between rounds — totals, per-year pace
 * and the gap between the richest and poorest fifths — and each says so.
 */

export const metadata = {
  title: "Two decades of the National Family Health Survey · Bharat Tracker",
  description: "Every round of India's National Family Health Survey since 1998–99, compared on the same measures: child deaths, stunting, anaemia, births in hospital, vaccination, fertility, child marriage, electricity and sanitation — for India, rich and poor, town and village, and every state.",
};

const load = (): NfhsRounds | null => { try { return JSON.parse(readFileSync(join(process.cwd(), "data", "nfhs", "rounds.json"), "utf8")) as NfhsRounds; } catch { return null; } };
const def = (key: string) => METRICS.find((x) => x.key === key)!;
/** A change between rounds, signed, in the metric's own units: percentage points, children per woman or deaths per 1,000. */
const signedV = (v: number | null, unit: string) => (v === null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmtV(Math.abs(v), unit === "%" ? "pp" : unit)}${unit === "%" ? " pts" : ""}`);
const paceV = (v: number, unit: string) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(unit === "children" ? 2 : 1)}${unit === "%" ? " pts" : ""}`;
const firstLast = (m: MetricSeries) => {
  const i = m.points.findIndex((p) => p.total !== null);
  let j = m.points.length - 1;
  while (j > i && m.points[j]!.total === null) j--;
  return { i, j };
};
/** Better, worse or neither, by the metric's direction. A label always accompanies the colour. */
const verdict = (d: number | null, higherIs: string) => (d === null || d === 0 || higherIs === "neither" ? { word: d === null ? "—" : "moved", tone: "var(--story-ink-2)" } : (d > 0) === (higherIs === "better") ? { word: "better", tone: "var(--s-cool)" } : { word: "worse", tone: "var(--s-hot)" });
const dateOf = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function NfhsPage() {
  const d = load();
  if (!d || !d.metrics.length) {
    return (
      <article className="pt-6">
        <h1 className="story-display mt-3 text-[32px] sm:text-[44px]">Two decades of the National Family Health Survey</h1>
        <div className="mt-6"><Awaiting>The weekly job that reads every NFHS round from the DHS Program&apos;s API has not written its first file yet.</Awaiting></div>
      </article>
    );
  }
  const S = d.surveys;
  const first = S[0]!, last = S.at(-1)!;
  const metric = (k: string) => d.metrics.find((m) => m.key === k);
  const span = `${first.label} to ${last.label}`;

  // Headline numbers: DHS values, first and latest round.
  const head = ["u5mr", "stunting", "facility_births", "sanitation"].map(metric).filter((m): m is MetricSeries => !!m);

  // States, for the explorer: one row per state, one cell per round.
  const stateMetrics: StateMetric[] = d.metrics.filter((m) => m.points.some((p) => Object.keys(p.states).length)).map((m) => {
    const names = new Set(m.points.flatMap((p) => Object.keys(p.states)));
    const rows: StateMetric["rows"] = {};
    for (const n of names) rows[n] = m.points.map((p) => p.states[n] ?? null);
    const w = def(m.key);
    return { key: m.key, title: w.title, unit: w.unit, higherIs: w.higherIs, note: METRIC_NOTES[m.key], rows };
  });

  // The poorest and richest fifths: the gap in the first and the latest round both measured them.
  const gaps = d.metrics.flatMap((m) => {
    const both = m.points.map((p, i) => ({ i, g: p.poorest !== null && p.richest !== null ? p.richest - p.poorest : null, p })).filter((x) => x.g !== null);
    if (both.length < 2) return [];
    const a = both[0]!, b = both.at(-1)!;
    return [{ m, w: def(m.key), a, b }];
  });

  return (
    <article className="pt-6">
      <Eyebrow tone="cool">India · Health · {S.length} survey rounds, {span}</Eyebrow>
      <h1 className="story-display mt-3 max-w-[22ch] text-[32px] sm:text-[44px]">Two decades of the National Family Health Survey</h1>
      <Standfirst>
        The National Family Health Survey is the Health Ministry&apos;s own household survey, run by the International Institute for Population Sciences. Since 1992 its
        interviewers have asked households across every state the same questions about births, deaths, food, care and the home.
        These dashboards set every round of the last quarter-century side by side, on the definitions the DHS Program harmonises across rounds. Each value is the survey&apos;s own.
        Where a round did not measure something, the line breaks rather than guessing.
      </Standfirst>

      <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {S.map((s) => (
          <div key={s.id} className="story-card p-3.5">
            <p className="text-[15px] font-bold">{s.name} <span className="font-normal" style={{ color: "var(--story-ink-3)" }}>· {s.label}</span></p>
            <p className="mt-1 text-[11.5px] leading-[1.5]" style={{ color: "var(--story-ink-2)" }}>{ROUND_NOTES[s.id] ?? ""}</p>
            <p className="mt-1.5 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>DHS survey {s.id}{s.released ? ` · DHS release ${dateOf(s.released)}` : ""}</p>
          </div>
        ))}
      </section>
      <p className="mt-2 text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>
        NFHS-1 (1992–93) falls outside the quarter-century and is not shown. The DHS Program does not yet list a later round for India; the job checks every week and adds one when it appears.
      </p>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {head.map((m) => {
          const w = def(m.key), { i, j } = firstLast(m);
          const a = m.points[i]!.total!, b = m.points[j]!.total!;
          return (
            <div key={m.key} className="story-card p-4">
              <p className="text-[11.5px] font-semibold leading-snug" style={{ color: "var(--story-ink-2)" }}>{w.title}</p>
              <p className="story-display mt-2 text-[34px] leading-none">{fmtV(b, w.unit)}{w.unit === "per 1,000" && <span className="ml-1 text-[13px] font-semibold">per 1,000</span>}</p>
              <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>{S[j]!.label}, from {fmtV(a, w.unit)} in {S[i]!.label}</p>
            </div>
          );
        })}
      </section>

      <section className="mt-12">
        <h2 className="story-display text-[24px]">The scoreboard</h2>
        <p className="mt-1 max-w-[76ch] text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-3)" }}>
          Every measure tracked, in every round. The last two columns are computed here from the survey values: the change from the first round that measured it to the latest, and whether that change is better or worse by the measure&apos;s own direction.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-[12.5px] tabular-nums">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-[0.05em]" style={{ color: "var(--story-ink-3)" }}>
                <th className="py-1.5 pr-2 font-semibold">Measure</th>
                {S.map((s) => <th key={s.id} className="px-1.5 py-1.5 text-right font-semibold">{s.name}<span className="block font-normal normal-case tracking-normal">{s.label}</span></th>)}
                <th className="px-1.5 py-1.5 text-right font-semibold">Change<span className="block font-normal normal-case tracking-normal">derived</span></th>
                <th className="py-1.5 pl-1.5 font-semibold">Direction</th>
              </tr>
            </thead>
            {THEMES.map((t) => {
              const ms = METRICS.filter((x) => x.theme === t).map((x) => metric(x.key)).filter((m): m is MetricSeries => !!m);
              if (!ms.length) return null;
              return (
                <tbody key={t}>
                  <tr><td colSpan={S.length + 3} className="pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--story-ink-2)" }}><a href={`#${t.replace(/\W+/g, "-").toLowerCase()}`} className="hover:underline">{t}</a></td></tr>
                  {ms.map((m) => {
                    const w = def(m.key), { i, j } = firstLast(m);
                    const ch = j > i ? m.points[j]!.total! - m.points[i]!.total! : null;
                    const v = verdict(ch, w.higherIs);
                    return (
                      <tr key={m.key} className="border-t" style={{ borderColor: "var(--story-rule)" }}>
                        <td className="py-1 pr-2">{w.title}{w.unit === "per 1,000" ? <span style={{ color: "var(--story-ink-3)" }}> (per 1,000)</span> : w.unit === "children" ? <span style={{ color: "var(--story-ink-3)" }}> (children per woman)</span> : null}</td>
                        {m.points.map((p) => <td key={p.survey} className="mono px-1.5 py-1 text-right">{p.total === null ? <span style={{ color: "var(--story-ink-3)" }} title="No figure for this round">·</span> : fmtV(p.total, w.unit)}</td>)}
                        <td className="mono px-1.5 py-1 text-right font-semibold">{signedV(ch, w.unit)}</td>
                        <td className="py-1 pl-1.5 text-[11.5px] font-semibold" style={{ color: v.tone }}>{v.word}</td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
        {(d.withheld ?? []).length > 0 && (
          <ul className="mt-2 space-y-1 text-[11.5px] leading-[1.5]" style={{ color: "var(--story-ink-3)" }}>
            {(d.withheld ?? []).map((x) => <li key={x.key + x.survey}><b>Left blank:</b> {def(x.key).title}, {S.find((s) => s.id === x.survey)?.label}. {x.why}</li>)}
          </ul>
        )}
      </section>

      {THEMES.map((t) => {
        const ms = METRICS.filter((x) => x.theme === t).map((x) => metric(x.key)).filter((m): m is MetricSeries => !!m);
        if (!ms.length) return null;
        return (
          <section key={t} id={t.replace(/\W+/g, "-").toLowerCase()} className="mt-12 scroll-mt-20">
            <h2 className="story-display text-[24px]">{t}</h2>
            <div className="mt-2"><ChartKey /></div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {ms.map((m) => {
                const w = def(m.key), { i, j } = firstLast(m);
                // Pace per year, earliest interval against the latest: derived from the survey values.
                const known = m.points.map((p, k) => ({ year: S[k]!.year, v: p.total, label: S[k]!.label })).filter((x) => x.v !== null);
                const early = known.length >= 3 ? perYear(known[0]!, known[1]!) : null, late = known.length >= 3 ? perYear(known.at(-2)!, known.at(-1)!) : null;
                const lp = m.points[j]!;
                return (
                  <div key={m.key} className="story-card min-w-0 p-4">
                    <p className="text-[14px] font-bold leading-snug">{w.title}</p>
                    <p className="mt-0.5 text-[11px]" style={{ color: "var(--story-ink-3)" }}>{w.unit === "per 1,000" ? "Deaths per 1,000 live births" : w.unit === "children" ? "Children per woman" : "Per cent"} · DHS {m.id}: &ldquo;{m.dhsLabel}&rdquo;</p>
                    <div className="mt-2"><RoundChart m={m} surveys={S} unit={w.unit} /></div>
                    <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[11.5px]">
                      {(lp.urban !== null || lp.rural !== null) && (<><dt style={{ color: "var(--story-ink-3)" }}>{S[j]!.label}</dt><dd>Towns {fmtV(lp.urban, w.unit)} · villages {fmtV(lp.rural, w.unit)}</dd></>)}
                      {j > i && (<><dt style={{ color: "var(--story-ink-3)" }}>Change</dt><dd>{signedV(m.points[j]!.total! - m.points[i]!.total!, w.unit)} since {S[i]!.label} <span style={{ color: "var(--story-ink-3)" }}>(derived)</span></dd></>)}
                      {early !== null && late !== null && (<><dt style={{ color: "var(--story-ink-3)" }}>Pace a year</dt><dd>{paceV(early, w.unit)} in {known[0]!.label}→{known[1]!.label}; {paceV(late, w.unit)} in {known.at(-2)!.label}→{known.at(-1)!.label} <span style={{ color: "var(--story-ink-3)" }}>(derived)</span></dd></>)}
                    </dl>
                    {METRIC_NOTES[m.key] && <p className="mt-2 text-[11px] leading-[1.45]" style={{ color: "var(--story-ink-3)" }}>{METRIC_NOTES[m.key]}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {gaps.length > 0 && (
        <section id="rich-poor" className="mt-12 scroll-mt-20">
          <h2 className="story-display text-[24px]">Did the poorest catch up?</h2>
          <p className="mt-1 max-w-[76ch] text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-3)" }}>
            The gap between the richest and the poorest fifth of households, in the first and the latest round that measured both, computed here from the survey&apos;s values. A
            gap can close because the poor gained or because the rich reached a ceiling — the richest homes had electricity at close to 100% in every round, so read the gap beside the two levels, which are shown with it.
            For electricity, drinking water and sanitation the gap is partly built in: DHS ranks households into fifths by an index made from what they own, and that index counts the household&apos;s electricity, water source and toilet among its inputs.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[12.5px] tabular-nums">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-[0.05em]" style={{ color: "var(--story-ink-3)" }}>
                  <th className="py-1.5 pr-2 font-semibold">Measure</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold">Then: poorest · richest</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold">Gap then</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold">Now: poorest · richest</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold">Gap now</th>
                  <th className="py-1.5 pl-1.5 font-semibold">The gap</th>
                </tr>
              </thead>
              <tbody>
                {gaps.map(({ m, w, a, b }) => {
                  const ga = Math.abs(a.g!), gb = Math.abs(b.g!);
                  const word = Math.abs(gb - ga) < (w.unit === "%" ? 1 : w.unit === "children" ? 0.1 : 2) ? "about the same" : gb < ga ? "narrowed" : "widened";
                  return (
                    <tr key={m.key} className="border-t" style={{ borderColor: "var(--story-rule)" }}>
                      <td className="py-1 pr-2">{w.title}</td>
                      <td className="mono px-1.5 py-1 text-right">{fmtV(a.p.poorest, w.unit)} · {fmtV(a.p.richest, w.unit)} <span style={{ color: "var(--story-ink-3)" }}>{S[a.i]!.label}</span></td>
                      <td className="mono px-1.5 py-1 text-right">{fmtV(ga, w.unit === "%" ? "pp" : w.unit)}</td>
                      <td className="mono px-1.5 py-1 text-right">{fmtV(b.p.poorest, w.unit)} · {fmtV(b.p.richest, w.unit)} <span style={{ color: "var(--story-ink-3)" }}>{S[b.i]!.label}</span></td>
                      <td className="mono px-1.5 py-1 text-right">{fmtV(gb, w.unit === "%" ? "pp" : w.unit)}</td>
                      <td className="py-1 pl-1.5 text-[11.5px] font-semibold">{word}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px]" style={{ color: "var(--story-ink-3)" }}>Gaps are absolute: percentage points, deaths per 1,000 or children per woman. 1998–99 has no wealth breakdown for some measures, so the first column then starts at 2005–06.</p>
        </section>
      )}

      {stateMetrics.length > 0 && (
        <section id="states" className="mt-12 scroll-mt-20">
          <h2 className="story-display text-[24px]">Every state, every round</h2>
          <p className="mt-1 max-w-[76ch] text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-3)" }}>
            Pick a measure. The first view keeps the states as they were in 1998–99, which DHS republishes every later round on, so a change is a change and not a redrawn border.
            The second shows today&apos;s states and union territories from the round after each was formed.
          </p>
          <div className="story-card mt-3 p-4">
            <StateExplorer rounds={S.map((s) => ({ id: s.id, name: s.name, label: s.label }))} metrics={stateMetrics} comparable={comparableStates(d)} current={currentStates(d)} />
          </div>
        </section>
      )}

      <WhatThisCannotSay items={[
        { q: "Is every round measuring the same thing?", a: "Mostly, and that is why the DHS versions are used: DHS recomputes each round on one set of definitions. The exceptions are named on each chart — 1998–99 interviewed only ever-married women and measured only children under three, and some measures were not asked in every round." },
        { q: "Why are the rounds unevenly spaced?", a: "Because the survey was. Seven years separate the second and third rounds and nine the third and fourth; the charts place each round at its fieldwork year so the slopes are honest. Pace per year is computed on the same spacing." },
        { q: "Can a state's figure be trusted as much as India's?", a: "Less. State samples are smaller, so their margins of error are wider; a change of a point or two in a small state may be noise. DHS publishes the confidence intervals; this page does not repeat them." },
        { q: "Did NFHS-5 measure a pandemic?", a: "Partly. Its second phase was interrupted by the Covid-19 lockdown and finished in 2020–21, so states surveyed late may show effects that states surveyed in 2019 cannot." },
        { q: "Do these numbers say why anything changed?", a: "No. Sanitation rising during the Swachh Bharat years, or hospital births after Janani Suraksha Yojana's cash incentive, are coincidences in time on this page, not proofs of cause." },
        { q: "Where is the latest round?", a: `The page shows what the DHS Program publishes. As of its last read (${dateOf(d.fetchedAt)}) DHS lists ${S.length} India rounds since 1998; a newer round is added when DHS releases its data, not from press reports of its fact sheets.` },
      ]} />

      <Sources>
        Sources: National Family Health Survey, rounds {S.map((s) => `${s.name} (${s.label})`).join(", ")} — International Institute for Population Sciences (IIPS) and ICF for the Ministry of Health and Family Welfare, Government of India — as
        published by <a className="underline decoration-dotted" href="https://dhsprogram.com/data/available-datasets.cfm" target="_blank" rel="noopener noreferrer">The DHS Program</a> through its
        {" "}<a className="underline decoration-dotted" href="https://api.dhsprogram.com/" target="_blank" rel="noopener noreferrer">indicator API</a>, read {dateOf(d.fetchedAt)}. Survey reports and fact sheets at{" "}
        <a className="underline decoration-dotted" href="https://rchiips.org/nfhs/" target="_blank" rel="noopener noreferrer">rchiips.org/nfhs</a>. Changes, pace and gaps are computed on this page from those values.
        {d.missing.length > 0 && ` Not shown, because DHS returned no national figure: ${d.missing.map((x) => def(x.key)?.title ?? x.key).join("; ")}.`}
      </Sources>
    </article>
  );
}
