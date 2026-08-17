import { formatNumber } from "@/lib/transforms";

/**
 * Stat tile: label · value · optional delta vs a named period.
 * Delta colour encodes direction × whether up is good, and always ships with
 * an arrow glyph and the period name so colour never carries meaning alone.
 */
export default function StatTile({
  label,
  value,
  unitShort,
  fromValue,
  fromPeriod,
  higherIsBetter,
  footnote,
}: {
  label: string;
  value: number;
  unitShort: string;
  fromValue?: number;
  fromPeriod?: string;
  higherIsBetter?: boolean | null;
  footnote?: string;
}) {
  let delta: { text: string; good: boolean | null } | null = null;
  // A single-observation series has no baseline to compare against — showing
  // "↑ 0.0% vs 2025" against itself would be noise dressed as a finding.
  const hasBaseline =
    fromValue !== undefined && fromValue !== 0 && fromPeriod !== undefined && fromValue !== value;
  if (hasBaseline) {
    const pct = ((value - fromValue) / Math.abs(fromValue)) * 100;
    const up = pct >= 0;
    const good = higherIsBetter === null || higherIsBetter === undefined ? null : up === higherIsBetter;
    delta = {
      text: `${up ? "↑" : "↓"} ${Math.abs(pct).toFixed(pct >= 100 ? 0 : 1)}%`,
      good,
    };
  }

  const deltaColor =
    delta?.good === null || delta?.good === undefined
      ? "var(--text-secondary)"
      : delta.good
        ? "var(--success-text)"
        : "var(--status-critical)";

  return (
    <div className="rounded-lg border bg-[var(--surface-1)] p-3">
      <p className="text-[11px] leading-snug text-[color:var(--text-secondary)]">{label}</p>
      <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-tight">
        {formatNumber(value, unitShort)}
      </p>
      {delta && (
        <p className="mt-1.5 text-[11px]" style={{ color: deltaColor }}>
          {delta.text}
          {fromPeriod && (
            <span className="text-[color:var(--text-muted)]"> vs {fromPeriod}</span>
          )}
        </p>
      )}
      {footnote && (
        <p className="mt-1.5 text-[10px] leading-snug text-[color:var(--text-muted)]">{footnote}</p>
      )}
    </div>
  );
}
