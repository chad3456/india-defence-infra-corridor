import ChartCanvas, { type SeriesInput } from "./ChartCanvas";
import type { RegistryEntry } from "@/lib/registry";
import { getSeries, sourcesForSeries } from "@/lib/data";
import { applyTransform, TRANSFORM_UNITS } from "@/lib/transforms";
import { WDI_BY_ID } from "@/lib/wdi-catalogue";
import ConfidenceBadge from "@/components/ui/ConfidenceBadge";

/**
 * Resolves a registry spec into rendered data. Everything a reader needs to
 * judge the number — confidence, provenance, sources, caveats — travels with
 * the chart rather than living on a separate page.
 */
export default function ChartCard({
  spec,
  compact = false,
}: {
  spec: RegistryEntry;
  compact?: boolean;
}) {
  const resolved = spec.seriesIds.map((id) => getSeries(id)).filter((s) => s !== undefined);

  // Nothing loaded yet — show an explicit pending state, never a blank axis.
  if (resolved.length === 0) {
    const ind = WDI_BY_ID.get(spec.seriesIds[0] ?? "");
    return (
      <figure className="rounded-lg border bg-[var(--surface-1)] p-4">
        <figcaption className="mb-1">
          <h3 className="text-[13px] font-medium leading-snug">{spec.title}</h3>
          {spec.subtitle && (
            <p className="mt-0.5 text-[11px] leading-snug text-[color:var(--text-secondary)]">
              {spec.subtitle}
            </p>
          )}
        </figcaption>
        <div className="flex h-[180px] flex-col items-center justify-center gap-1.5 rounded border border-dashed">
          <span className="eyebrow">awaiting pipeline backfill</span>
          <span className="max-w-[240px] px-3 text-center text-[10px] leading-snug text-[color:var(--text-muted)]">
            {ind
              ? `World Bank indicator ${ind.code}. Populated on the next ETL run.`
              : "Series not yet ingested."}
          </span>
        </div>
      </figure>
    );
  }

  /**
   * A peer chart plots one value per country, not the time axis. Without this
   * branch the comparison charts silently rendered the full time series with
   * country context dropped — the same marks as the level chart beside them,
   * under a heading promising a comparison.
   */
  const peerSeries = spec.peerView ? resolved[0] : undefined;
  const peers = peerSeries?.peers ?? [];

  if (spec.peerView && peers.length < 2) {
    return (
      <figure className="rounded-lg border bg-[var(--surface-1)] p-4">
        <figcaption className="mb-1">
          <h3 className="text-[13px] font-medium leading-snug">{spec.title}</h3>
        </figcaption>
        <div className="flex h-[180px] items-center justify-center rounded border border-dashed">
          <span className="eyebrow">no comparator values available</span>
        </div>
      </figure>
    );
  }

  const inputs: SeriesInput[] = spec.peerView
    ? [
        {
          id: `${peerSeries!.id}-peers`,
          label: peerSeries!.title,
          unitShort: peerSeries!.unitShort,
          // Largest first, so the reader sees the ranking without hunting.
          data: [...peers]
            .sort((a, b) => b.value - a.value)
            .map((p) => ({
              period: p.country,
              value: p.value,
              note: `${p.country}, ${p.period}`,
            })),
        },
      ]
    : resolved.map((s) => ({
        id: s.id,
        label: s.title,
        unitShort: s.unitShort,
        data: applyTransform(s, spec.transform).map((d) => ({
          period: d.period,
          value: d.value,
          note: d.note,
          revised: d.revised,
        })),
      }));

  const primary = resolved[0]!;
  const unitOverride = TRANSFORM_UNITS[spec.transform] ?? null;
  const allSources = [...new Set(resolved.flatMap((s) => sourcesForSeries(s).map((x) => x.id)))];
  const sourceObjs = resolved.flatMap((s) => sourcesForSeries(s));
  const uniqueSources = allSources
    .map((id) => sourceObjs.find((s) => s.id === id))
    .filter((s) => s !== undefined);

  const lowestConfidence = resolved.reduce<"high" | "medium" | "low">((acc, s) => {
    const rank = { high: 3, medium: 2, low: 1 } as const;
    return rank[s.confidence] < rank[acc] ? s.confidence : acc;
  }, "high");

  return (
    <figure className="flex flex-col rounded-lg border bg-[var(--surface-1)] p-4">
      <figcaption className="mb-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[13px] font-medium leading-snug">{spec.title}</h3>
          <ConfidenceBadge level={lowestConfidence} />
        </div>
        {spec.subtitle && (
          <p className="mt-1 text-[11px] leading-snug text-[color:var(--text-secondary)]">
            {spec.subtitle}
          </p>
        )}
      </figcaption>

      <ChartCanvas
        kind={spec.kind}
        series={inputs}
        height={compact ? 190 : 240}
        unitOverride={spec.peerView ? primary.unitShort : (unitOverride ?? primary.unitShort)}
        zeroLine={!spec.peerView && (spec.transform === "yoy" || spec.transform === "delta")}
      />

      {spec.annotation && (
        <p className="mt-3 border-l-2 pl-2.5 text-[11px] leading-snug text-[color:var(--text-secondary)]">
          {spec.annotation}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-2">
        <span className="eyebrow">source</span>
        {uniqueSources.slice(0, 3).map((s) => (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="link-underline text-[10px] text-[color:var(--text-muted)]"
            title={s.name}
          >
            {s.publisher}
          </a>
        ))}
        {uniqueSources.length > 3 && (
          <span className="text-[10px] text-[color:var(--text-muted)]">
            +{uniqueSources.length - 3} more
          </span>
        )}
        <span className="ml-auto text-[10px] text-[color:var(--text-muted)]">
          verified {primary.lastVerified}
        </span>
      </div>
    </figure>
  );
}
