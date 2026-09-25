"use client";

import { fmt, inTerm, spanWords, TERM_LABEL, type Metric, type Programme, type Stall, type Term } from "@/lib/mela-shared";
import type { TermKey } from "./World";

/**
 * One stall, as a page of manga panels.
 *
 * Header, the guide's line, the programmes, the numbers, the verdict — in
 * that order, because that is the order a reader's trust should be spent in:
 * what was launched, what moved, and what someone who has read the evidence
 * thinks of it. The verdict comes last and is labelled as an opinion.
 *
 * ── The ladder chart ──────────────────────────────────────────────────────
 *
 * Four readings at most, placed on a real time axis from 2013 to 2026, not
 * spaced evenly: evenly spaced rungs would draw a three-year survey gap and a
 * one-year gap as the same distance and make every slope a lie. One axis, one
 * series, every value printed because the four values are the content, and
 * a native tooltip on each dot. A missing rung is simply absent, and the line
 * does not bridge it — the break is the honest drawing of a missing reading.
 */

const TERM_VAR: Record<Term, string> = {
  before: "var(--story-ink-3)",
  I: "var(--term-1)", "I/II": "var(--term-1)",
  II: "var(--term-2)", "II/III": "var(--term-2)",
  III: "var(--term-3)",
};
const TERM_FILL: Record<Term, string> = {
  before: "var(--paper-2)",
  I: "var(--term-1-fill)", "I/II": "var(--term-1-fill)",
  II: "var(--term-2-fill)", "II/III": "var(--term-2-fill)",
  III: "var(--term-3-fill)",
};

const GRADE_MEANING: Record<string, string> = {
  A: "At or near the global frontier.",
  B: "Above its income-group peers, below the frontier.",
  C: "About where a country at this income level would sit.",
  D: "Below what this income level and ambition should produce.",
};

function rungColour(key: string, year: number): string {
  if (key === "start") return "var(--ink)";
  if (key === "termI") return "var(--term-1)";
  if (key === "termII") return "var(--term-2)";
  return year >= 2025 ? "var(--term-3)" : "var(--term-2)";
}

function Ladder({ m }: { m: Metric }) {
  const pts = m.rungs.filter((r) => r.obs !== null).map((r) => ({ key: r.key, label: r.label, ...r.obs! }));
  if (pts.length === 0) return null;
  const W = 320, H = 128, L = 14, R = 14, T = 40, B = 26;
  const x0 = 2013, x1 = 2026.5;
  const vals = pts.map((p) => p.value);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = hi === lo ? Math.max(1, Math.abs(hi) * 0.1) : (hi - lo) * 0.12;
  const X = (y: number) => L + ((Math.min(x1, Math.max(x0, y)) - x0) / (x1 - x0)) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - (lo - pad)) / (hi + pad - (lo - pad))) * (H - T - B);

  /* Segments only between rungs that are both present AND adjacent in the
     rung order — a missing term-end rung breaks the line. */
  const segs: Array<[typeof pts[number], typeof pts[number]]> = [];
  const order = ["start", "termI", "termII", "latest"];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    if (order.indexOf(b.key) - order.indexOf(a.key) === 1) segs.push([a, b]);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block h-auto w-full" role="img"
      aria-label={`${m.title}: ${pts.map((p) => `${p.period} ${fmt(p.value, m.fmt)}`).join(", ")}`}>
      {/* term bands on the time axis */}
      <rect x={X(2014.4)} y={T - 6} width={X(2019.4) - X(2014.4)} height={H - T - B + 12} fill="var(--term-1-fill)" opacity=".55" />
      <rect x={X(2019.4)} y={T - 6} width={X(2024.45) - X(2019.4)} height={H - T - B + 12} fill="var(--term-2-fill)" opacity=".55" />
      <rect x={X(2024.45)} y={T - 6} width={X(x1) - X(2024.45)} height={H - T - B + 12} fill="var(--term-3-fill)" opacity=".55" />
      <path d={`M${L} ${H - B + 6} H${W - R}`} stroke="var(--ink)" strokeWidth="1" opacity=".35" />
      {[2014, 2019, 2024].map((y) => (
        <text key={y} x={X(y)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--story-ink-3)" fontFamily="var(--font-mono)">{y}</text>
      ))}
      {segs.map(([a, b], i) => (
        <path key={i} d={`M${X(a.year)} ${Y(a.value)} L${X(b.year)} ${Y(b.value)}`} stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
      ))}
      {pts.map((p, i) => {
        /*
         * Labels were centred above every dot, and two readings a year apart
         * printed on top of each other — "$3.76tn" through "$3.96tn". A label
         * whose neighbour is close takes the other side of its dot, and a dot
         * near either edge anchors its label inward so it is not clipped.
         */
        const x = X(p.year);
        const prev = pts[i - 1];
        const crowded = prev !== undefined && x - X(prev.year) < 46;
        const anchor = x > W - 44 ? "end" : x < L + 30 ? "start" : "middle";
        const tx = anchor === "end" ? x + 4 : anchor === "start" ? x - 4 : x;
        /* A crowded label stacks one line higher than its neighbour's. */
        const ty = Y(p.value) - (crowded ? 24 : 11);
        return (
          <g key={p.key}>
            <circle cx={x} cy={Y(p.value)} r="6" fill={rungColour(p.key, p.year)} stroke="var(--paper)" strokeWidth="2">
              <title>{`${p.label} · ${p.period}: ${fmt(p.value, m.fmt)}`}</title>
            </circle>
            <text x={tx} y={ty} textAnchor={anchor} fontSize="11" fontWeight="700"
              fill="var(--ink)" fontFamily="var(--font-mono)">
              {fmt(p.value, m.fmt)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function PaceBars({ m }: { m: Metric }) {
  const p = m.pace;
  if (!p) return null;
  const mag = (v: number) => (p.kind === "multiple" ? Math.max(0, v - 1) : Math.abs(v));
  const max = Math.max(1e-9, mag(p.before.value), mag(p.after.value));
  const row = (label: string, s: typeof p.before, tone: string) => (
    <div className="flex items-center gap-2 text-[11.5px]">
      <span className="mono w-[4.6rem] shrink-0 tabular-nums" style={{ color: "var(--story-ink-3)" }}>{label}</span>
      <span className="min-w-0 flex-1">
        <span className="block h-[10px]" style={{ width: `${Math.max(2, (mag(s.value) / max) * 100)}%`, background: tone, borderRadius: "2px 4px 4px 2px" }} />
      </span>
      <span className="w-[9.5rem] shrink-0 text-right font-semibold">{spanWords(p.kind, s, m.diffUnit)}</span>
    </div>
  );
  return (
    <div className="mt-3 border-t pt-2.5" style={{ borderColor: "var(--tone)" }}>
      <p className="mono text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--story-ink-3)" }}>
        derived on this page · the decade before, and since
      </p>
      <div className="mt-1.5 space-y-1">
        {row(`${p.before.from}–${String(p.before.to).slice(2)}`, p.before, "var(--story-ink-3)")}
        {row(`${p.after.from}–${String(p.after.to).slice(2)}`, p.after, "var(--term-2)")}
      </div>
      <p className="mt-1.5 text-[12px] leading-[1.45]"><span className="font-bold">Pace:</span> {p.verdict}.</p>
    </div>
  );
}

function MetricCard({ m }: { m: Metric }) {
  const present = m.rungs.filter((r) => r.obs !== null);
  const first = present[0];
  const last = present[present.length - 1];
  return (
    <div className="manga-panel p-4" style={{ boxShadow: "4px 4px 0 var(--ink)" }}>
      <p className="text-[13.5px] font-bold leading-snug">{m.title}</p>
      <p className="mono text-[10px]" style={{ color: "var(--story-ink-3)" }}>{m.unit}</p>
      {first && last && (
        <p className="manga-title mt-2 text-[22px] leading-none">
          {first !== last && <><span style={{ color: "var(--story-ink-3)" }}>{fmt(first.obs!.value, m.fmt)}</span><span className="mx-1.5 text-[16px]">→</span></>}
          {fmt(last.obs!.value, m.fmt)}
        </p>
      )}
      {first && last && (
        <p className="mono mt-1 text-[10px]" style={{ color: "var(--story-ink-3)" }}>
          {first !== last ? `${first.label.toLowerCase()} ${first.obs!.period} → ${last.obs!.period}` : `${last.obs!.period}, one reading`}
        </p>
      )}
      <Ladder m={m} />
      <PaceBars m={m} />
      {m.note && <p className="mt-2.5 line-clamp-3 text-[11.5px] leading-[1.45]" style={{ color: "var(--story-ink-2)" }}>{m.note}</p>}
      {m.source && (
        <p className="mono mt-2 text-[10px] leading-[1.5]" style={{ color: "var(--story-ink-3)", overflowWrap: "anywhere" }}>
          <a href={m.source.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink)", textDecoration: "underline", textUnderlineOffset: 2 }}>
            {m.source.name}
          </a>
          {m.source.tier !== null ? ` · tier ${m.source.tier}` : ""} · checked {m.source.accessed}
        </p>
      )}
    </div>
  );
}

function ProgrammeChip({ p, active }: { p: Programme; active: boolean }) {
  return (
    <li className="rounded-md border-2 p-3 transition-opacity"
      style={{ borderColor: "var(--ink)", background: TERM_FILL[p.term], opacity: active ? 1 : 0.42 }}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="mono rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: TERM_VAR[p.term] }}>
          {p.year}
        </span>
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[13.5px] font-bold leading-snug"
          style={{ color: "var(--ink)", textDecoration: "underline", textUnderlineOffset: 2 }}>
          {p.name}
        </a>
      </div>
      <p className="mono mt-1 text-[10px] uppercase tracking-[0.06em]" style={{ color: "var(--story-ink-3)" }}>
        {TERM_LABEL[p.term]} · {p.kind}
      </p>
      {p.note && <p className="mt-1 text-[12px] leading-[1.45]" style={{ color: "var(--story-ink-2)" }}>{p.note}</p>}
      {p.continues && (
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--story-ink-2)" }}>
          Continues{" "}
          <a href={p.continues.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink)", textDecoration: "underline", textUnderlineOffset: 2 }}>
            {p.continues.name}
          </a>{" "}({p.continues.year}).
        </p>
      )}
    </li>
  );
}

export default function Panel({ stall, term }: { stall: Stall; term: TermKey }) {
  const shown = stall.programmes;
  const inSel = shown.filter((p) => inTerm(p.term, term));
  return (
    <article className="mela-pop" aria-live="polite" aria-label={`${stall.name}, in detail`}>
      <div className="manga-panel manga-speed relative overflow-hidden px-5 pb-5 pt-6 sm:px-7">
        <p className="mono text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--story-ink-3)" }}>
          {stall.tagline}
        </p>
        <h2 className="manga-title mt-1 text-[38px] sm:text-[52px]">{stall.name}</h2>
        <p className="manga-sfx absolute right-4 top-3 rotate-[-9deg] text-[34px] sm:right-8 sm:text-[48px]" aria-hidden>{stall.sfx}</p>
        <p className="mono mt-1 text-[10px]" style={{ color: "var(--story-ink-3)" }}>
          <span aria-hidden>{stall.sfx}</span> · {stall.sfxReading} · a sound-effect sticker, decoration only
        </p>
      </div>

      {/* ── Programmes ─────────────────────────────────────────── */}
      <section className="mt-6">
        <h3 className="manga-title text-[22px]">
          Launched here
          <span className="mono ml-2 align-middle text-[11px] font-semibold" style={{ color: "var(--story-ink-3)" }}>
            {term === "all" ? `${shown.length} programmes` : `${inSel.length} of ${shown.length} in this term`}
          </span>
        </h3>
        {shown.length > 0 ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {shown.map((p) => <ProgrammeChip key={p.id} p={p} active={inTerm(p.term, term)} />)}
          </ul>
        ) : (
          <p className="mt-2 text-[13px]" style={{ color: "var(--story-ink-2)" }}>
            No programme for this stall has been verified against its source yet.
          </p>
        )}
        <p className="mt-2 text-[11.5px] leading-[1.5]" style={{ color: "var(--story-ink-3)" }}>
          Each programme links to the article it is sourced to, and appears only after a check that its year is
          named in that article&rsquo;s opening. A launch year cannot say which side of a swearing-in a scheme fell,
          so 2019 and 2024 launches are shown under both terms either side.
        </p>
      </section>

      {/* ── Numbers ────────────────────────────────────────────── */}
      <section className="mt-8">
        <h3 className="manga-title text-[22px]">What moved</h3>
        <p className="mt-1 max-w-[68ch] text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>
          Each dot is a real reading, placed on a real time axis, printed with its own date. Coloured bands mark the
          three terms. A gap means no reading exists for that point, and the line does not bridge it.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stall.metrics.map((m) => <MetricCard key={m.id} m={m} />)}
        </div>
      </section>

      {/* ── Verdict ────────────────────────────────────────────── */}
      <section className="mt-8">
        <h3 className="manga-title text-[22px]">The site&rsquo;s verdict</h3>
        {stall.verdicts.length === 0 ? (
          <p className="mt-2 text-[13px]" style={{ color: "var(--story-ink-2)" }}>
            This site has not graded this sector. The numbers above are the evidence; it has not been scored.
          </p>
        ) : (
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {stall.verdicts.map((v) => (
              <div key={v.id} className="manga-panel p-4" style={{ boxShadow: "4px 4px 0 var(--ink)" }}>
                <div className="flex items-center gap-3">
                  <span className="manga-title grid h-11 w-11 shrink-0 place-items-center rounded-full border-[3px] text-[24px]"
                    style={{ borderColor: "var(--ink)", background: "var(--paper-2)" }} aria-label={`Grade ${v.grade}`}>
                    {v.grade}
                  </span>
                  <div>
                    <p className="text-[14px] font-bold">{v.area}</p>
                    <p className="text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>{GRADE_MEANING[v.grade]}</p>
                  </div>
                </div>
                <dl className="mt-3 space-y-2 text-[12.5px] leading-[1.5]">
                  <div><dt className="inline font-bold">Measured against: </dt><dd className="inline" style={{ color: "var(--story-ink-2)" }}>{v.benchmark}</dd></div>
                  <div><dt className="inline font-bold">Working: </dt><dd className="inline" style={{ color: "var(--story-ink-2)" }}>{v.strength}</dd></div>
                  <div><dt className="inline font-bold">Not working: </dt><dd className="inline" style={{ color: "var(--story-ink-2)" }}>{v.weakness}</dd></div>
                  <div><dt className="inline font-bold">The best case against this grade: </dt><dd className="inline" style={{ color: "var(--story-ink-2)" }}>{v.counterpoint}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>
          Grades are editorial judgements, graded against global benchmarks rather than India&rsquo;s own past, and
          each ships with the strongest argument against itself. A reader can reject every grade and still use every
          number.
        </p>
      </section>
    </article>
  );
}
