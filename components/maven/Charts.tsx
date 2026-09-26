import type { ReactNode } from "react";
import { cite, stated, type Figure } from "@/lib/maven-shared";

/**
 * The flat charts in the Project Maven piece.
 *
 * Every bar is a figure from the verified record and carries its page. There
 * is one axis per chart, values are printed in text ink beside the marks, and
 * nothing is coloured to mean something without a word beside it saying what.
 */

export function Bars({
  rows, max, unit, highlight,
}: {
  rows: Array<{ f: Figure; label?: ReactNode; note?: ReactNode; tone?: "ai" | "human" | "muted" }>;
  max: number;
  unit?: string;
  highlight?: string;
}) {
  return (
    <ul className="space-y-3">
      {rows.map(({ f, label, note, tone }) => {
        const w = Math.max(0.6, (f.value / max) * 100);
        const fill = tone === "human" ? "var(--mv-human)" : tone === "muted" ? "var(--mv-muted)" : "var(--mv-ai)";
        return (
          <li key={f.id} title={`${f.what} (${cite(f)})`}>
            <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
              <span className="font-medium">{label ?? f.label}</span>
              <span className="mono shrink-0 text-[12px] text-[color:var(--mv-ink-3)]">{cite(f)}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-3.5 min-w-0 flex-1 rounded-sm bg-[color:var(--mv-track)]">
                <div
                  className={`h-full rounded-sm ${f.id === highlight ? "mv-hatch" : ""}`}
                  style={{ width: `${w}%`, background: f.id === highlight ? undefined : fill }}
                />
              </div>
              <span className="mono w-[76px] shrink-0 text-right text-[13px] font-semibold leading-tight">
                {f.qualifier && <span className="block text-[10.5px] font-normal text-[color:var(--mv-ink-2)]">{f.qualifier}</span>}
                {stated({ ...f, qualifier: "" })}{unit ? <span className="font-normal text-[color:var(--mv-ink-3)]"> {unit}</span> : null}
              </span>
            </div>
            {note && <p className="mt-1 text-[12.5px] leading-snug text-[color:var(--mv-ink-2)]">{note}</p>}
          </li>
        );
      })}
    </ul>
  );
}

/** A dot for each of `total`, with the first `picked` lit: 1,500 tested, 24 used. */
export function Funnel({ total, picked, labelTotal, labelPicked }: {
  total: Figure; picked: Figure; labelTotal: string; labelPicked: string;
}) {
  const cols = 60;
  const n = total.value;
  const rows = Math.ceil(n / cols);
  const s = 10;
  /* The kept ones are scattered, not stacked in a corner: none of them is the first. */
  const keep = new Set<number>();
  let seed = 17;
  while (keep.size < picked.value) { seed = (seed * 1103515245 + 12345) % 2147483648; keep.add(seed % n); }
  return (
    <figure>
      <svg viewBox={`0 0 ${cols * s} ${rows * s}`} className="block h-auto w-full" role="img"
        aria-label={`${stated(total)} algorithms tested; ${picked.value} used in support of Ukraine`}>
        {Array.from({ length: n }, (_, i) => (
          <circle key={i} cx={(i % cols) * s + s / 2} cy={Math.floor(i / cols) * s + s / 2}
            r={keep.has(i) ? 3.9 : 2.6}
            fill={keep.has(i) ? "var(--mv-ai)" : "var(--mv-muted)"}
            stroke={keep.has(i) ? "var(--mv-ink)" : "none"} strokeWidth={keep.has(i) ? 0.8 : 0} />
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
        <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-2 w-2 rounded-full bg-[color:var(--mv-muted)]" />{labelTotal} ({cite(total)})</span>
        <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full border border-[color:var(--mv-ink)] bg-[color:var(--mv-ai)]" />{labelPicked} ({cite(picked)})</span>
      </figcaption>
    </figure>
  );
}

/** Two rows of squares: what one officer could sign off in an hour, without and with. */
export function PerHour({ without, withM }: { without: Figure; withM: Figure }) {
  const row = (f: Figure, fill: string, label: string) => (
    <div>
      <div className="flex items-baseline justify-between text-[13.5px]">
        <span className="font-medium">{label}</span>
        <span className="mono text-[12px] text-[color:var(--mv-ink-3)]">{cite(f)}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-[3px]">
        {Array.from({ length: f.value }, (_, i) => (
          <span key={i} className="inline-block h-[9px] w-[9px] rounded-[2px]" style={{ background: fill }} />
        ))}
        <span className="mono ml-2 text-[13px] font-semibold">{stated(f)}</span>
      </div>
    </div>
  );
  return (
    <div className="space-y-4">
      {row(without, "var(--mv-human)", "Without Maven")}
      {row(withM, "var(--mv-ai)", "With Maven")}
    </div>
  );
}
