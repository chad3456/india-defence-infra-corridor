import type { ReactNode } from "react";
import { TimeSeries, ChartTitle, Caption } from "@/components/stories/Charts";
import type { Tone } from "@/components/stories/Kit";

/**
 * One numbered chart, its caption, and its own caveat.
 *
 * Twenty charts on one page is a form with a specific failure: the reader
 * stops reading captions around the fourth one and starts reading shapes. So
 * each card carries its number, states in one line what the series IS rather
 * than what it means, and — where the series can be misread — says how.
 *
 * `n` is printed because on a page that promises twenty graphs, a reader is
 * entitled to count them.
 */
export default function GraphCard({
  n, title, note, points, tone = "mid", unit = "%", caption, height = 210, format,
}: {
  n: number;
  title: string;
  note: string;
  points: Array<{ year: number; value: number }>;
  tone?: Tone;
  unit?: string;
  caption?: ReactNode;
  height?: number;
  format?: (v: number) => string;
}) {
  const enough = points.length >= 2;
  return (
    <figure className="story-card p-5" data-tone={tone}>
      <div className="flex items-baseline gap-2">
        <span className="mono text-[11px] font-bold tabular-nums" style={{ color: `var(--s-${tone})` }}>
          {String(n).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <ChartTitle note={note}>{title}</ChartTitle>
        </div>
      </div>
      <div className="mt-3">
        {enough ? (
          <TimeSeries
            points={points}
            tone={tone}
            height={height}
            unit={unit}
            format={format ?? ((v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1)))}
          />
        ) : (
          <p className="mono py-8 text-[11px]" style={{ color: "var(--story-ink-3)" }}>
            Awaiting data — fewer than two years measured.
          </p>
        )}
      </div>
      {caption && <figcaption><Caption>{caption}</Caption></figcaption>}
    </figure>
  );
}
