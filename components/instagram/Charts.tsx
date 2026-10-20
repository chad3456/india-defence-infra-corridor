/**
 * The chart pieces /instagram-politics is built from. Plain SVG, rendered on
 * the server; every mark carries a <title> for its hover tooltip and a direct
 * label, so no value depends on colour alone. Colour follows the party, in a
 * fixed order: Congress, BJP, CJP, AAP; everything else in neutral ink.
 */
import type { ReactNode } from "react";
import type { Party } from "@/lib/instagram";

export const PARTY_COLOUR: Record<Party, string> = {
  INC: "var(--series-1)", BJP: "var(--series-2)", CJP: "var(--series-3)", AAP: "var(--series-4)", AISA: "var(--story-ink-3)",
};
export const colourOf = (p: Party | null) => (p ? PARTY_COLOUR[p] : "var(--story-ink-3)");
const INK3 = "var(--story-ink-3)", RULE = "var(--story-rule)";

export function fmt(n: number | null | undefined, dp = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e7) return `${(n / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${Math.round(n / 1e3)}K`;
  return n.toLocaleString("en-IN", { maximumFractionDigits: dp });
}
export const signed = (n: number | null, dp = 1) => (n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(dp)}%`);

/** One dashboard: a number, a title, what it shows, the chart, and where every number in it came from. */
export function Panel({ n, title, kind, note, children, source }: { n: number; title: string; kind: "published" | "measured" | "derived"; note?: ReactNode; children: ReactNode; source?: ReactNode }) {
  const badge = { published: "Published figure", measured: "Measured by this site", derived: "Derived from published figures" }[kind];
  return (
    <section id={`d${n}`} className="story-card min-w-0 scroll-mt-20 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="mono text-[11px] font-bold" style={{ color: INK3 }}>{String(n).padStart(2, "0")}</span>
        <h3 className="text-[15.5px] font-bold leading-snug">{title}</h3>
        <span className="rounded-[3px] border px-1.5 text-[9.5px] font-semibold uppercase tracking-[0.06em]" style={{ borderColor: RULE, color: INK3 }}>{badge}</span>
      </div>
      {note && <p className="mt-1.5 text-[12px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>{note}</p>}
      <div className="mt-3">{children}</div>
      {source && <div className="mt-3 border-t pt-2 text-[10.5px] leading-[1.5]" style={{ borderColor: RULE, color: INK3 }}>{source}</div>}
    </section>
  );
}

export function Awaiting({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed px-4 py-6 text-center text-[12.5px] leading-[1.55]" style={{ borderColor: RULE, color: INK3 }}>
      <p className="font-semibold" style={{ color: "var(--story-ink-2)" }}>Awaiting data</p>
      <p className="mx-auto mt-1 max-w-[52ch]">{children}</p>
    </div>
  );
}

/** Horizontal bars, labelled at the end. */
export function Bars({ rows, unit = "", max: forced }: { rows: Array<{ label: string; value: number; colour: string; sub?: string; tip?: string }>; unit?: string; max?: number }) {
  const max = forced ?? Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(6.5rem,10rem)_minmax(0,1fr)] items-center gap-2 text-[12.5px]">
          <span className="leading-tight"><span className="font-semibold">{r.label}</span>{r.sub && <span className="block text-[10.5px]" style={{ color: INK3 }}>{r.sub}</span>}</span>
          <span className="flex items-center gap-2" title={r.tip ?? `${r.label}: ${fmt(r.value, 2)}${unit}`}>
            <span className="h-3.5 rounded-r-[4px]" style={{ width: `${Math.max(1.5, (100 * Math.abs(r.value)) / max)}%`, background: r.colour, maxWidth: "78%" }} />
            <span className="mono shrink-0 text-[11.5px] font-semibold tabular-nums">{fmt(r.value, 2)}{unit}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Before and after, as two dots joined by a line, on one shared axis. */
export function Dumbbell({ rows, fromLabel, toLabel }: { rows: Array<{ label: string; from: number; to: number; colour: string; sub?: string }>; fromLabel: string; toLabel: string }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.from, r.to])) * 1.08;
  const W = 640, row = 46, padL = 150, padR = 20, H = rows.length * row + 34;
  const x = (v: number) => padL + ((W - padL - padR) * v) / max;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 460, height: "auto" }} role="img" aria-label={rows.map((r) => `${r.label}: ${fmt(r.from)} to ${fmt(r.to)}`).join("; ")}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}><line x1={x(max * f / 1.08)} x2={x(max * f / 1.08)} y1={8} y2={H - 22} stroke={RULE} strokeDasharray="2 3" /><text x={x(max * f / 1.08)} y={H - 8} fontSize="10" textAnchor="middle" fill={INK3}>{fmt(max * f / 1.08)}</text></g>
        ))}
        {rows.map((r, i) => {
          const y = 20 + i * row, ch = r.from ? ((r.to - r.from) / r.from) * 100 : null;
          return (
            <g key={r.label}>
              <title>{`${r.label}: ${fromLabel} ${fmt(r.from)}, ${toLabel} ${fmt(r.to)}${ch === null ? "" : ` (${signed(ch)})`}`}</title>
              <text x={0} y={y + 4} fontSize="12" fontWeight={600} fill="var(--story-ink)">{r.label}</text>
              {r.sub && <text x={0} y={y + 17} fontSize="10" fill={INK3}>{r.sub}</text>}
              <line x1={x(r.from)} x2={x(r.to)} y1={y} y2={y} stroke={r.colour} strokeWidth={2} />
              <circle cx={x(r.from)} cy={y} r={5} fill="var(--story-card)" stroke={r.colour} strokeWidth={2} />
              <circle cx={x(r.to)} cy={y} r={5.5} fill={r.colour} stroke="var(--story-card)" strokeWidth={2} />
              <text x={x(Math.max(r.from, r.to)) + 9} y={y + 4} fontSize="11" fontWeight={700} fill="var(--story-ink)">{ch === null ? fmt(r.to) : signed(ch, 0)}</text>
              <text x={x(r.from)} y={y - 9} fontSize="9.5" textAnchor="middle" fill={INK3}>{fmt(r.from)}</text>
              <text x={x(r.to)} y={y + 19} fontSize="9.5" textAnchor="middle" fill={INK3}>{fmt(r.to)}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 flex gap-4 text-[11px]" style={{ color: INK3 }}>
        <span className="flex items-center gap-1.5"><svg width="12" height="12" aria-hidden><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="2" /></svg>{fromLabel}</span>
        <span className="flex items-center gap-1.5"><svg width="12" height="12" aria-hidden><circle cx="6" cy="6" r="4.5" fill="currentColor" /></svg>{toLabel}</span>
      </p>
    </div>
  );
}

/** Shares that sum to 100, as one bar per row. Two segments only (positive and negative), each labelled. */
export function Split({ rows }: { rows: Array<{ label: string; a: number; b: number }>; }) {
  return (
    <div>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)] items-center gap-2 text-[12px]">
            <span className="font-semibold leading-tight">{r.label}</span>
            <span className="flex h-6 overflow-hidden rounded-[4px] text-[11px] font-bold" title={`${r.label}: ${r.a}% positive, ${r.b}% negative`}>
              <span className="flex items-center pl-2" style={{ width: `${r.a}%`, background: "var(--s-cool-fill)", borderRight: "2px solid var(--story-card)" }}>{r.a}%</span>
              <span className="flex items-center justify-end pr-2" style={{ width: `${r.b}%`, background: "var(--s-hot-fill)" }}>{r.b}%</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex gap-4 text-[11px]" style={{ color: INK3 }}>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--s-cool-fill)", outline: "1px solid var(--s-cool)" }} />Positive</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--s-hot-fill)", outline: "1px solid var(--s-hot)" }} />Negative</span>
      </p>
    </div>
  );
}

/** Two periods side by side for each category: shares of the same whole in each period. */
export function Paired({ rows, aLabel, bLabel, colour }: { rows: Array<{ label: string; a: number | null; b: number | null }>; aLabel: string; bLabel: string; colour: string }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.a ?? 0, r.b ?? 0]));
  return (
    <div>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[minmax(8rem,13rem)_minmax(0,1fr)] items-center gap-2 text-[11.5px]" title={`${r.label}: ${aLabel} ${r.a ?? "—"}%, ${bLabel} ${r.b ?? "—"}%`}>
            <span className="leading-tight">{r.label}</span>
            <span className="block space-y-[2px]">
              {([[r.a, 0.45], [r.b, 1]] as const).map(([v, op], i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span className="h-2 rounded-r-[3px]" style={{ width: `${v === null ? 0 : Math.max(1, (75 * v) / max)}%`, background: colour, opacity: op }} />
                  <span className="mono text-[10px] tabular-nums" style={{ color: v === null ? INK3 : "var(--story-ink-2)" }}>{v === null ? "not listed" : `${v}%`}</span>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex gap-4 text-[11px]" style={{ color: INK3 }}>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-sm" style={{ background: colour, opacity: 0.45 }} />{aLabel}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-sm" style={{ background: colour }} />{bLabel}</span>
      </p>
    </div>
  );
}

/** Dated points joined by a line: a series with gaps where nobody published a figure, never filled in. */
export function Timeline({ points, colour, unit = "" }: { points: Array<{ d: string; v: number; label?: string; tip?: string }>; colour: string; unit?: string }) {
  if (points.length < 2) return null;
  const W = 640, H = 220, pl = 48, pr = 24, pt = 16, pb = 30;
  const t0 = Date.parse(points[0]!.d), t1 = Date.parse(points.at(-1)!.d);
  const max = Math.max(...points.map((p) => p.v)) * 1.1;
  const x = (d: string) => pl + ((W - pl - pr) * (Date.parse(d) - t0)) / Math.max(1, t1 - t0);
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / max);
  const months = [...new Set(points.map((p) => p.d.slice(0, 7)))];
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 460, height: "auto" }} role="img" aria-label={points.map((p) => `${p.d}: ${fmt(p.v)}`).join("; ")}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}><line x1={pl} x2={W - pr} y1={y((max / 1.1) * f)} y2={y((max / 1.1) * f)} stroke={RULE} strokeDasharray={f ? "2 3" : undefined} /><text x={pl - 6} y={y((max / 1.1) * f) + 3} fontSize="10" textAnchor="end" fill={INK3}>{fmt((max / 1.1) * f)}</text></g>
        ))}
        {months.map((m) => <text key={m} x={x(`${m}-01`) < pl ? pl : x(`${m}-01`)} y={H - 10} fontSize="10" fill={INK3}>{new Date(`${m}-01`).toLocaleDateString("en-GB", { month: "short" })}</text>)}
        <polyline points={points.map((p) => `${x(p.d)},${y(p.v)}`).join(" ")} fill="none" stroke={colour} strokeWidth={2} />
        {points.map((p, i) => (
          <g key={`${p.d}-${i}`}>
            <title>{p.tip ?? `${p.d}: ${fmt(p.v)}${unit}`}</title>
            <circle cx={x(p.d)} cy={y(p.v)} r={5} fill={colour} stroke="var(--story-card)" strokeWidth={2} />
            {p.label && <text x={x(p.d) + (i === points.length - 1 ? -6 : 6)} y={y(p.v) - 9} fontSize="10.5" fontWeight={600} textAnchor={i === points.length - 1 ? "end" : "start"} fill="var(--story-ink)">{p.label}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function SourceLine({ items }: { items: Array<{ publisher: string; url: string; date?: string | null; pending?: string }> }) {
  return (
    <>
      Source{items.length > 1 ? "s" : ""}:{" "}
      {items.map((s, i) => (
        <span key={s.url + i}>{i ? "; " : ""}<a className="underline decoration-dotted" href={s.url} target="_blank" rel="noopener noreferrer">{s.publisher}</a>{s.date ? `, ${s.date}` : ""}{s.pending ? <b> — {s.pending}</b> : ""}</span>
      ))}
      . Accessed 20 Oct 2026.
    </>
  );
}
