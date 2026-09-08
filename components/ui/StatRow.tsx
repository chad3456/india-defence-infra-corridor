/**
 * The headline figures, before the charts that explain them.
 *
 * A dashboard that opens with a chart makes the reader do the summarising. A
 * stat tile is the right form when the job is a single number rather than a
 * comparison or a shape — so these carry the number, the unit it is in, and
 * the qualification it needs, because every one of them is easy to overstate
 * and the qualification is not decoration.
 */
export interface Stat {
  /** The figure, already formatted — units differ too much to format here. */
  value: string;
  label: string;
  /** What the number cannot say. Never optional: every figure here has one. */
  caveat: string;
  /** Small print under the value, e.g. the period it covers. */
  meta?: string;
}

export default function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-lg border border-gridline bg-gridline sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-surface-1 p-4">
          <dt className="text-[11px] uppercase tracking-wide text-ink-muted">{s.label}</dt>
          <dd className="mt-1.5 font-mono text-2xl font-semibold leading-none tabular-nums text-ink">
            {s.value}
          </dd>
          {s.meta && <p className="mt-1 text-[11px] tabular-nums text-ink-muted">{s.meta}</p>}
          <p className="mt-2 border-t border-gridline pt-2 text-[11px] leading-snug text-ink-2">
            {s.caveat}
          </p>
        </div>
      ))}
    </dl>
  );
}
