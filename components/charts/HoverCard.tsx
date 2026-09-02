"use client";

import { useCallback, useRef, useState } from "react";

/**
 * One hover surface, shared by every map and chart on the site.
 *
 * Before this, four components each had their own idea of hover: the security
 * choropleth had none, the mobility and Vande maps wrote a line of text into a
 * corner far from the thing being pointed at, and only the chart canvas showed
 * detail where the cursor was. A reader had to learn a different convention per
 * panel.
 *
 * The card follows the pointer and flips across it near the viewport edge, so
 * it never leaves the screen and never covers the mark it is describing.
 * Positioning is in client coordinates against a fixed layer rather than
 * offsets inside an SVG, because an SVG with a viewBox scales its own
 * coordinate space and a tooltip placed in it drifts away from the cursor at
 * any size but one.
 */

export interface HoverRow {
  label: string;
  value: string;
  /** Optional swatch — colour is never the only carrier, the label always shows. */
  colour?: string;
}

export interface HoverPayload {
  title: string;
  subtitle?: string;
  rows?: HoverRow[];
  note?: string;
}

export interface HoverState extends HoverPayload {
  x: number;
  y: number;
}

export function useHoverCard() {
  const [state, setState] = useState<HoverState | null>(null);
  const frame = useRef<number | null>(null);
  const pending = useRef<HoverState | null>(null);

  /** Coalesce to one update per frame: pointermove fires far faster than paint. */
  const show = useCallback((e: { clientX: number; clientY: number }, payload: HoverPayload) => {
    pending.current = { ...payload, x: e.clientX, y: e.clientY };
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      setState(pending.current);
    });
  }, []);

  const hide = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    pending.current = null;
    setState(null);
  }, []);

  return { hover: state, show, hide };
}

export default function HoverCard({ hover }: { hover: HoverState | null }) {
  if (!hover) return null;

  // Flip before the card would overflow, using its own approximate size rather
  // than measuring — a measure would need a layout pass per pointer move.
  const W = 236, H = 132, PAD = 14;
  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const left = hover.x + PAD + W > vw ? hover.x - PAD - W : hover.x + PAD;
  const top = hover.y + PAD + H > vh ? Math.max(8, hover.y - PAD - H) : hover.y + PAD;

  return (
    <div
      role="tooltip"
      aria-live="polite"
      className="pointer-events-none fixed z-50 max-w-[15rem] rounded-md border border-gridline bg-surface-1 px-3 py-2 shadow-lg"
      style={{ left, top }}
    >
      <p className="text-[13px] font-medium leading-tight text-ink">{hover.title}</p>
      {hover.subtitle && (
        <p className="mt-0.5 text-[11px] leading-tight text-ink-muted">{hover.subtitle}</p>
      )}
      {hover.rows && hover.rows.length > 0 && (
        <dl className="mt-1.5 space-y-0.5">
          {hover.rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[11px] text-ink-2">
                {r.colour && (
                  <span aria-hidden="true" className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: r.colour }} />
                )}
                {r.label}
              </dt>
              <dd className="font-mono text-[11px] tabular-nums text-ink">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {hover.note && (
        <p className="mt-1.5 border-t border-gridline pt-1.5 text-[10.5px] leading-snug text-ink-muted">
          {hover.note}
        </p>
      )}
    </div>
  );
}
