import type { ReactNode } from "react";

/**
 * The pieces every visual story is built from.
 *
 * ── Why a kit rather than three pages of bespoke markup ──────────────────
 *
 * Because the register only works if it is consistent. A reader crossing from
 * the semiconductor story to the farm one should meet the same card, the same
 * number size, the same rule about what a coloured edge means. Three hand-laid
 * pages drift within a week, and the drift shows up as a reader wondering
 * whether the amber on this page means what the amber on the last one did.
 *
 * ── The one rule the colours carry ───────────────────────────────────────
 *
 * `tone` is an ordered scale, not a category set: hot means stuck or
 * dependent, mid means in between, cool means free or domestic. It is used the
 * same way on every story. Anything that is not on that scale takes no tone,
 * because a hue with no meaning is worse than none.
 *
 * Every toned element also prints a label. That is not decoration — a status
 * palette is only legible to a colour-blind reader if identity is carried by
 * something other than the hue, and these three are 6–9 ΔE apart under
 * deuteranopia.
 */

export type Tone = "hot" | "mid" | "cool";

const TONE_VAR: Record<Tone, string> = {
  hot: "var(--s-hot)",
  mid: "var(--s-mid)",
  cool: "var(--s-cool)",
};
const FILL_VAR: Record<Tone, string> = {
  hot: "var(--s-hot-fill)",
  mid: "var(--s-mid-fill)",
  cool: "var(--s-cool-fill)",
};

export function toneColour(t: Tone): string { return TONE_VAR[t]; }
export function toneFill(t: Tone): string { return FILL_VAR[t]; }

/**
 * A percentage, to one decimal, never raw.
 *
 * World Bank values carry full float precision, and the farm story printed
 * agriculture's employment share as "41.6251280877573%" before anyone looked.
 * That is fifteen significant figures on a modelled estimate whose *first*
 * decimal is uncertain — a number claiming a confidence nothing supports. It
 * lives in the kit so no story has to remember.
 */
export function pct(v: number | null | undefined, dp = 1): string {
  return v === null || v === undefined ? "—" : `${v.toFixed(dp)}%`;
}

/** The coloured caps-label above a section. */
export function Eyebrow({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return (
    <p className="story-eyebrow" style={{ color: tone ? TONE_VAR[tone] : "var(--story-ink-3)" }}>
      {children}
    </p>
  );
}

/** A section headline, at the size the register uses. */
export function Headline({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`story-display mt-3 text-[30px] sm:text-[40px] lg:text-[46px] max-w-[18ch] ${className}`}>
      {children}
    </h2>
  );
}

/** Standfirst. Wide measure, generous leading, secondary ink. */
export function Standfirst({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 max-w-[62ch] text-[15px] leading-[1.62]" style={{ color: "var(--story-ink-2)" }}>
      {children}
    </p>
  );
}

/** The word a sentence turns on, marked rather than merely bolded. */
export function Mark({ children, tone = "hot" }: { children: ReactNode; tone?: Tone }) {
  return <strong style={{ color: TONE_VAR[tone], fontWeight: 700 }}>{children}</strong>;
}

/**
 * One number, given the room a headline gets.
 *
 * `note` is not optional in spirit: a figure this large without the
 * qualification beside it is the exact format this project exists to correct.
 * It is typed optional only because a handful of counts genuinely need none.
 */
export function Stat({
  value, unit, label, note, tone, size = "lg",
}: {
  value: string;
  unit?: string;
  label: string;
  note?: ReactNode;
  tone?: Tone;
  size?: "lg" | "md" | "sm";
}) {
  const px = size === "lg" ? "text-[46px] sm:text-[58px]"
    : size === "md" ? "text-[34px] sm:text-[42px]"
    : "text-[26px] sm:text-[30px]";
  return (
    <div className="story-card p-5" {...(tone ? { "data-tone": tone } : {})}>
      <Eyebrow tone={tone}>{label}</Eyebrow>
      <p className={`story-display mt-3 ${px}`}>
        {value}
        {unit && (
          <span className="ml-1.5 align-baseline text-[0.42em] font-semibold tracking-normal"
            style={{ color: "var(--story-ink-2)" }}>
            {unit}
          </span>
        )}
      </p>
      {note && (
        <p className="mt-2.5 text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>
          {note}
        </p>
      )}
    </div>
  );
}

/**
 * A horizontal bar row: label, bar, value.
 *
 * Direct-labelled on every row because the rows are few. The 4px rounding is
 * on the data end only — a bar rounded at the baseline too would lift off its
 * own axis and read as floating.
 */
export function BarRow({
  label, value, max, display, tone = "hot", sub,
}: {
  label: string; value: number; max: number; display: string; tone?: Tone; sub?: string;
}) {
  const pct = max > 0 ? Math.max(value > 0 ? 1.5 : 0, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-[8.5rem] shrink-0 text-[12.5px] leading-tight sm:w-[11rem]">
        {label}
        {sub && <span className="block text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{sub}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block h-[14px]" style={{
          width: `${pct}%`,
          background: TONE_VAR[tone],
          borderRadius: "2px 4px 4px 2px",
        }} />
      </span>
      <span className="mono w-[4.5rem] shrink-0 text-right text-[13px] font-semibold tabular-nums">
        {display}
      </span>
    </div>
  );
}

/**
 * A column chart with every column labelled.
 *
 * Years on the axis, values above the columns. Fine for the ten-to-twenty
 * points these stories use and wrong above that — a value on every column of a
 * forty-point series is noise, and the form should change before the label rule
 * does.
 */
export function Columns({
  points, tone = "hot", highlightLast = true, height = 150, format,
}: {
  points: Array<{ label: string; value: number; note?: string }>;
  tone?: Tone;
  highlightLast?: boolean;
  height?: number;
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const fmt = format ?? ((v: number) => String(Math.round(v)));
  /**
   * A floor per column, and the chart scrolls rather than crushing itself.
   *
   * The farm yield chart is twenty-four columns of four-digit numbers. At
   * 400px that is eleven pixels a column for a label twenty-four pixels wide,
   * so the numbers painted over each other and over the page edge — the
   * document scrolled sideways by exactly the overspill and no single element
   * was ever wider than the viewport, which is why an element-by-element check
   * found nothing.
   *
   * Charts are one of the three things allowed to be wider than the page, in
   * their own scroll container. That is the fix here rather than dropping
   * labels, because a column whose value you cannot read is not a cheaper
   * chart, it is a different one.
   */
  /**
   * The width comes from the widest label, not from a constant.
   *
   * It was thirty pixels a column, which is right for the two- and four-digit
   * labels these stories mostly use and badly wrong for anything longer. The
   * world tracker handed it twenty-six columns labelled "12.29 billion" and
   * every one of them painted over its neighbours — inside a scroll container
   * that was working exactly as designed, at a width the component itself had
   * chosen. The chart was legible at no size.
   *
   * Roughly 6.2 pixels per character at the 11–13px the labels are drawn at,
   * plus the gap. An estimate rather than a measurement, because measuring
   * text needs a DOM and this renders on the server — but an estimate from the
   * actual strings beats a constant that cannot see them.
   */
  const widest = Math.max(2, ...points.map((p) => fmt(p.value).length));
  const minWidth = points.length * Math.max(30, Math.ceil(widest * 6.2) + 6);
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="flex items-end gap-1.5 sm:gap-2.5" style={{ minWidth }}>
      {points.map((p, i) => {
        const last = highlightLast && i === points.length - 1;
        return (
          <div key={p.label} className="group relative min-w-0 flex-1">
            {/*
              The value sits on top of its own bar, not at the top of the
              chart. The first version put every label on one line above the
              plot, which for a series spanning $0.2bn to $23bn left most
              labels a hundred and ninety pixels from the bar they described —
              readable as a row of numbers and useless as a chart. Justifying
              the column to the bottom and letting the bar's own height push
              the label up keeps them together at every scale.
            */}
            <div className="flex flex-col justify-end" style={{ height }}>
              <p className="story-display mb-1 text-center text-[11px] sm:text-[13px]"
                style={{ color: last ? TONE_VAR[tone] : "var(--story-ink-2)", letterSpacing: "-0.01em" }}>
                {fmt(p.value)}
              </p>
              <div
                className="w-full"
                style={{
                  height: `${(p.value / max) * 100}%`,
                  minHeight: p.value > 0 ? 3 : 0,
                  background: last ? TONE_VAR[tone] : FILL_VAR[tone],
                  borderRadius: "4px 4px 2px 2px",
                  border: last ? "none" : `1px solid ${TONE_VAR[tone]}22`,
                }}
              />
            </div>
            <p className="mono mt-2 text-center text-[9.5px] sm:text-[10.5px]"
              style={{ color: "var(--story-ink-3)" }}>
              {p.label}
            </p>
            {p.note && (
              <span
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-[15rem] -translate-x-1/2 rounded-md p-2.5 text-[11px] leading-[1.45] shadow-lg group-hover:block"
                style={{ background: "var(--story-card)", color: "var(--story-ink-2)", border: "1px solid var(--story-rule)" }}
              >
                {p.note}
              </span>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}

/** A tile in the flip-to-value grid. */
export interface TileItem {
  name: string;
  value: string;
  tone: Tone;
  meta?: string;
}

/**
 * The tile field: one tile per row of the underlying data, colour by tone,
 * flipping to its value on hover or focus.
 *
 * Every tile is a button so it is reachable by keyboard, and the value is in
 * the DOM rather than a title attribute so a screen reader gets both halves.
 */
export function TileField({ items }: { items: TileItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((t) => (
        <button
          key={`${t.name}-${t.value}`}
          type="button"
          className="story-tile rounded-lg p-3.5 text-left"
          style={{ background: FILL_VAR[t.tone], border: `1px solid ${TONE_VAR[t.tone]}33` }}
        >
          <span className="tile-name block text-[12.5px] font-semibold leading-[1.3]">
            {t.name}
          </span>
          <span className="tile-value absolute inset-0 flex flex-col items-center justify-center rounded-lg p-2 text-center">
            <span className="story-display text-[20px] sm:text-[24px]">{t.value}</span>
            {t.meta && (
              <span className="mono mt-1 text-[9.5px] leading-tight" style={{ color: "var(--story-ink-2)" }}>
                {t.meta}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * The caveat block.
 *
 * Every story has one and it is not a footnote. The register is loud, and a
 * loud page that does not say what its numbers cannot support is a poster.
 */
export function WhatThisCannotSay({ items }: { items: Array<{ q: string; a: ReactNode }> }) {
  return (
    <section className="mt-16 border-t pt-10" style={{ borderColor: "var(--story-rule)" }}>
      <Eyebrow>what these numbers cannot tell you</Eyebrow>
      <dl className="mt-5 grid gap-5 sm:grid-cols-2">
        {items.map((x) => (
          <div key={x.q}>
            <dt className="text-[14px] font-bold">{x.q}</dt>
            <dd className="mt-1.5 text-[13px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
              {x.a}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** The provenance line every story ends on. */
export function Sources({ children }: { children: ReactNode }) {
  return (
    <p className="mt-10 text-[11.5px] leading-[1.65]" style={{ color: "var(--story-ink-3)" }}>
      {children}
    </p>
  );
}
