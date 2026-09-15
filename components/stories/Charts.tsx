/**
 * The drawing half of the story register.
 *
 * ── Why this file exists ─────────────────────────────────────────────────
 *
 * The first three stories were built from four shapes: a stat card, a
 * horizontal bar, a column chart and a grid of tiles. Everything got expressed
 * in one of those four, which meant a ranking, a composition, a change between
 * two dates and a geographic concentration all arrived as the same row of
 * rectangles. That is not a styling problem. A reader cannot see a shape that
 * was never drawn, and four shapes can only carry four ideas.
 *
 * These are the shapes that were missing. Each one answers a question the bar
 * chart answers badly:
 *
 *   RankedRows      who is biggest, and where does one particular entry sit
 *   DivergingRanks  who gained and who lost, against a shared spine
 *   Waffle          what share of a whole, at a size the eye can count
 *   PackedBubbles   how concentrated is a market, when the top three are most of it
 *   BubbleMap       where in the world, weighted
 *   SlopeChart      what moved between two dates, and who crossed whom
 *   StageLadder     who can do which step, across a value chain
 *   Treemap         what a total is made of, when the parts are very unequal
 *   DotStrip        the distribution itself, one dot per thing
 *   GridMap         every state at equal visual weight, which a real map denies
 *
 * ── Server-rendered SVG, deliberately ────────────────────────────────────
 *
 * None of these carry "use client". The geometry is computed once at build
 * time and shipped as markup, so a story page costs no JavaScript at all and
 * the charts are present in the HTML for anything that does not run scripts.
 * Interactivity here is CSS hover on an element that already exists.
 *
 * ── Charts scale by width, never by a height attribute ──────────────────
 *
 * An SVG with a viewBox and a fixed `height` letterboxes inside anything wider
 * than its viewBox: the content scales to fit and centres, and the chart sits
 * in the middle of its card with a band of empty surface either side, looking
 * like a layout bug because it is one. `height: auto` lets the width drive it
 * and the `height` prop becomes what it should have been all along — the
 * chart's aspect ratio, not its size.
 *
 * ── The one rule about width ─────────────────────────────────────────────
 *
 * Charts are one of the three things allowed to be wider than the page, and
 * only inside their own scroll container. `Scroller` is that container and
 * every dense chart uses it. This was learnt from a twenty-four column chart
 * that scrolled the whole document sideways by eleven pixels, where no single
 * element was ever wider than the viewport and an element-by-element check
 * found nothing.
 */
import type { ReactNode } from "react";
import { geoNaturalEarth1, geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import worldTopo from "world-atlas/countries-110m.json";
import indiaTopo from "@/data/geo/india-states.topo.json";

export type Tone = "hot" | "mid" | "cool";

const TONE: Record<Tone, string> = {
  hot: "var(--s-hot)",
  mid: "var(--s-mid)",
  cool: "var(--s-cool)",
};
const FILL: Record<Tone, string> = {
  hot: "var(--s-hot-fill)",
  mid: "var(--s-mid-fill)",
  cool: "var(--s-cool-fill)",
};

/**
 * A chart's own horizontal scroll. See the width rule above.
 *
 * `min-w-0` is not cosmetic. A grid or flex item's automatic minimum size is
 * its content's, so a scroll container holding a 468px chart is itself sized
 * to 468px by its parent and never scrolls — it just pushes the page sideways.
 * The temple story's state grid did exactly that: `overflow-x-auto` was set,
 * the chart still hung 109px off a 400px viewport, and the container looked
 * innocent because the rule that failed was on its parent.
 */
export function Scroller({ min, children }: { min: number; children: ReactNode }) {
  return (
    <div className="-mx-1 min-w-0 max-w-full overflow-x-auto px-1 pb-1">
      <div style={{ minWidth: min }}>{children}</div>
    </div>
  );
}

/** The caption under a chart: what it is, and what it is not. */
export function Caption({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 max-w-[70ch] text-[11.5px] leading-[1.6]" style={{ color: "var(--story-ink-3)" }}>
      {children}
    </p>
  );
}

/** A small heading over a chart, so a section can carry several. */
export function ChartTitle({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-[16px] font-bold leading-tight sm:text-[18px]">{children}</h3>
      {note && (
        <p className="mt-1.5 max-w-[68ch] text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>
          {note}
        </p>
      )}
    </div>
  );
}

/* ───────────────────────────── RankedRows ───────────────────────────── */

export interface Rank {
  name: string;
  value: number;
  display: string;
  /** Pulled out of the field: the entry the reader came for. */
  mark?: boolean;
  meta?: string;
}

/**
 * A ranking with the rank printed.
 *
 * The rank number is the point. A bar chart sorted by value implies rank and
 * makes the reader count rows to find it; a league table states it, which is
 * what lets "India is 23rd" be read off the same chart that shows how far 23rd
 * is from 1st. `mark` gives one row the full hue while the rest stay tinted, so
 * the eye lands on it without a legend.
 */
export function RankedRows({
  rows, tone = "hot", markTone = "hot", startRank = 1, showRank = true,
}: {
  rows: Rank[];
  tone?: Tone;
  markTone?: Tone;
  startRank?: number;
  showRank?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div>
      {rows.map((r, i) => {
        const t = r.mark ? markTone : tone;
        return (
          <div key={r.name} className="flex items-center gap-2 border-b py-[7px] last:border-0 sm:gap-3"
            style={{ borderColor: "var(--story-rule)" }}>
            {showRank && (
              <span className="mono w-[1.6rem] shrink-0 text-right text-[11px] tabular-nums"
                style={{ color: r.mark ? TONE[markTone] : "var(--story-ink-3)", fontWeight: r.mark ? 700 : 400 }}>
                {startRank + i}
              </span>
            )}
            {/*
              The name takes what is left and the bar takes a fixed share of
              the row, rather than the other way round.

              With a fixed 10rem name column and a 5rem value column, two of
              these side by side in a half-width card leave the bar negative
              space: the browser does not shrink a fixed-width span, so the
              value slid underneath the name and the chart rendered as
              overlapping text. Making the name the flexible element means the
              row degrades by truncating a country name, which is legible, and
              never by stacking two numbers on top of each other.
            */}
            <span className="min-w-0 flex-1 truncate text-[12px] leading-tight sm:text-[13px]"
              style={{ fontWeight: r.mark ? 700 : 500 }}>
              {r.name}
              {r.meta && (
                <span className="mono block truncate text-[9.5px] font-normal" style={{ color: "var(--story-ink-3)" }}>
                  {r.meta}
                </span>
              )}
            </span>
            <span className="basis-[34%] shrink-0">
              <span className="block h-[12px] rounded-sm" style={{
                width: `${Math.max(r.value > 0 ? 1 : 0, (r.value / max) * 100)}%`,
                background: r.mark ? TONE[t] : FILL[t],
                border: r.mark ? "none" : `1px solid ${TONE[t]}40`,
              }} />
            </span>
            <span className="mono shrink-0 text-right text-[12px] font-semibold tabular-nums sm:text-[13px]"
              style={{ color: r.mark ? TONE[markTone] : "var(--story-ink)", minWidth: "3.2rem" }}>
              {r.display}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── DivergingRanks ─────────────────────────── */

export interface Diverging {
  name: string;
  left: number;
  right: number;
  leftDisplay: string;
  rightDisplay: string;
  mark?: boolean;
}

/**
 * Two quantities per row, growing away from a shared centre.
 *
 * Used where a single bar would need a sign: imports against exports, lost
 * against gained. A signed bar makes the reader hold the convention in their
 * head; two bars from a spine make the comparison a length, which is the one
 * visual judgement people are actually good at.
 *
 * Both sides share one scale. Scaling each side to its own maximum would make
 * a small gain and a large loss the same length — the commonest way this chart
 * is got wrong, and invisible once drawn.
 */
export function DivergingRanks({
  rows, leftLabel, rightLabel, leftTone = "hot", rightTone = "cool",
}: {
  rows: Diverging[];
  leftLabel: string;
  rightLabel: string;
  leftTone?: Tone;
  rightTone?: Tone;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.left, r.right]));
  return (
    <Scroller min={320}>
      <div className="mb-2 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.1em]">
        <span className="flex-1 text-right" style={{ color: TONE[leftTone] }}>{leftLabel}</span>
        <span className="w-[6.5rem] shrink-0 sm:w-[9rem]" />
        <span className="flex-1" style={{ color: TONE[rightTone] }}>{rightLabel}</span>
      </div>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-2 py-[5px]">
          <span className="flex flex-1 items-center justify-end gap-1.5">
            <span className="mono text-[11px] tabular-nums" style={{ color: "var(--story-ink-3)" }}>
              {r.leftDisplay}
            </span>
            <span className="block h-[13px] rounded-l-sm" style={{
              width: `${(r.left / max) * 100}%`,
              background: r.mark ? TONE[leftTone] : FILL[leftTone],
              border: r.mark ? "none" : `1px solid ${TONE[leftTone]}40`,
            }} />
          </span>
          <span className="w-[6.5rem] shrink-0 truncate px-1 text-center text-[11.5px] leading-tight sm:w-[9rem] sm:text-[12.5px]"
            style={{ fontWeight: r.mark ? 700 : 500 }}>
            {r.name}
          </span>
          <span className="flex flex-1 items-center gap-1.5">
            <span className="block h-[13px] rounded-r-sm" style={{
              width: `${(r.right / max) * 100}%`,
              background: r.mark ? TONE[rightTone] : FILL[rightTone],
              border: r.mark ? "none" : `1px solid ${TONE[rightTone]}40`,
            }} />
            <span className="mono text-[11px] tabular-nums" style={{ color: "var(--story-ink-3)" }}>
              {r.rightDisplay}
            </span>
          </span>
        </div>
      ))}
    </Scroller>
  );
}

/* ─────────────────────────────── Waffle ─────────────────────────────── */

/**
 * A hundred cells, coloured by share.
 *
 * The one chart where a percentage is countable rather than asserted. A
 * hundred cells is not decoration: it is the denominator drawn, so "28%" and
 * "the other 72%" occupy the page in the proportion they occupy the total.
 *
 * Shares are floored at one cell if non-zero and the remainder is given to the
 * largest part, so the cells always sum to exactly a hundred. Rounding each
 * part independently produces 99 or 101 cells and a grid with a hole in it.
 */
export function Waffle({
  parts, columns = 10, cell = 15, gap = 3,
}: {
  parts: Array<{ label: string; share: number; tone: Tone; display?: string }>;
  columns?: number;
  cell?: number;
  gap?: number;
}) {
  const total = parts.reduce((a, p) => a + p.share, 0) || 1;
  const raw = parts.map((p) => (p.share / total) * 100);
  const cells = raw.map((v) => (v > 0 ? Math.max(1, Math.floor(v)) : 0));
  let short = 100 - cells.reduce((a, b) => a + b, 0);
  // Hand the rounding remainder to the largest parts, one cell at a time.
  const order = raw.map((v, i) => ({ v: v - Math.floor(v), i })).sort((a, b) => b.v - a.v);
  for (let k = 0; short > 0 && order.length > 0; k++) {
    const slot = order[k % order.length];
    if (!slot) break;
    const idx = slot.i;
    const cur = cells[idx];
    if (cur === undefined) break;
    cells[idx] = cur + 1;
    short--;
  }
  const seq: number[] = [];
  cells.forEach((n, i) => { for (let k = 0; k < n; k++) seq.push(i); });

  const rows = Math.ceil(seq.length / columns);
  const w = columns * (cell + gap) - gap;
  const h = rows * (cell + gap) - gap;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="max-w-full" role="img"
        aria-label={parts.map((p, i) => `${p.label} ${cells[i]} of 100`).join("; ")}>
        {seq.map((pi, i) => {
          const p = parts[pi];
          if (!p) return null;
          return (
            <rect key={i} x={(i % columns) * (cell + gap)} y={Math.floor(i / columns) * (cell + gap)}
              width={cell} height={cell} rx={2} fill={TONE[p.tone]} />
          );
        })}
      </svg>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-baseline gap-1.5 text-[12px]">
            <span className="inline-block h-[9px] w-[9px] shrink-0 rounded-[2px]" style={{ background: TONE[p.tone] }} />
            <span className="font-semibold">{p.display ?? `${cells[i]}%`}</span>
            <span style={{ color: "var(--story-ink-2)" }}>{p.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ────────────────────────────── packing ─────────────────────────────── */

interface Placed { x: number; y: number; r: number; i: number }

/**
 * Deterministic circle packing, by spiral search.
 *
 * Largest first; each circle walks an Archimedean spiral out from the centre
 * and stops at the first position that touches nothing. Not the tightest
 * packing there is — d3's front-chain algorithm beats it — but it is forty
 * lines, has no dependency, and gives the same answer every build, which
 * matters more here: a layout that shifts between builds turns every rebuild
 * into a diff nobody can review.
 */
function packCircles(radii: number[], width: number, height: number): Placed[] {
  const order = radii.map((r, i) => ({ r, i })).sort((a, b) => b.r - a.r);
  const out: Placed[] = [];
  const cx = width / 2;
  const cy = height / 2;
  for (const { r, i } of order) {
    let placed: Placed | null = null;
    // step is small relative to the smallest circle so the spiral cannot
    // step over a gap that would have fitted.
    const step = Math.max(1.2, r * 0.12);
    for (let t = 0; t < 40_000; t++) {
      const angle = t * 0.35;
      const rad = step * Math.sqrt(t) * 1.15;
      const x = cx + Math.cos(angle) * rad;
      const y = cy + Math.sin(angle) * rad * 0.82;
      let clear = true;
      for (const p of out) {
        const dx = p.x - x;
        const dy = p.y - y;
        if (dx * dx + dy * dy < (p.r + r + 1.5) ** 2) { clear = false; break; }
      }
      if (clear) { placed = { x, y, r, i }; break; }
    }
    if (placed) out.push(placed);
  }
  return out.sort((a, b) => a.i - b.i);
}

export interface Bubble { name: string; value: number; display: string; tone: Tone; mark?: boolean }

/**
 * Circles sized by value, area-proportional.
 *
 * Radius is the square root of the value. Sizing by radius directly — which is
 * what a naive chart does — exaggerates the largest by the square, and in a
 * market where the top country is forty times the tenth, that is the difference
 * between "dominant" and "the only one there is".
 *
 * A circle gets its name printed inside only if the circle is big enough to
 * hold it. The rest are in the list underneath, in the same order, so nothing
 * is unreadable and nothing is unlabelled.
 */
export function PackedBubbles({
  bubbles, width = 680, height = 380, unit,
}: {
  bubbles: Bubble[]; width?: number; height?: number; unit?: string;
}) {
  const total = bubbles.reduce((a, b) => a + b.value, 0) || 1;
  // Target roughly 58% areal fill — above that the spiral starts failing to
  // place the tail and circles silently vanish.
  const k = Math.sqrt((width * height * 0.58) / (Math.PI * total));
  const radii = bubbles.map((b) => Math.max(3, Math.sqrt(b.value) * k));
  const placed = packCircles(radii, width, height);
  const missing = bubbles.length - placed.length;
  return (
    <div>
      <Scroller min={Math.min(width, 560)}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }} role="img"
          aria-label={bubbles.map((b) => `${b.name} ${b.display}`).join("; ")}>
          {placed.map((p) => {
            const b = bubbles[p.i];
            if (!b) return null;
            const fits = p.r > 26;
            const tight = p.r > 17;
            return (
              <g key={b.name}>
                <circle cx={p.x} cy={p.y} r={p.r}
                  fill={b.mark ? TONE[b.tone] : FILL[b.tone]}
                  stroke={TONE[b.tone]} strokeWidth={b.mark ? 0 : 1.2} />
                {fits && (
                  <>
                    <text x={p.x} y={p.y - 1} textAnchor="middle"
                      className="story-display"
                      style={{ fontSize: Math.min(15, p.r * 0.34), fill: b.mark ? "var(--story-bg)" : "var(--story-ink)" }}>
                      {b.name.length > 13 ? b.name.slice(0, 12) + "…" : b.name}
                    </text>
                    <text x={p.x} y={p.y + Math.min(15, p.r * 0.34) + 1} textAnchor="middle"
                      style={{ fontSize: Math.min(13, p.r * 0.3), fontWeight: 600,
                        fill: b.mark ? "var(--story-bg)" : "var(--story-ink-2)" }}>
                      {b.display}
                    </text>
                  </>
                )}
                {!fits && tight && (
                  <text x={p.x} y={p.y + 4} textAnchor="middle"
                    style={{ fontSize: 10, fontWeight: 700, fill: b.mark ? "var(--story-bg)" : "var(--story-ink-2)" }}>
                    {b.name.slice(0, 3)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </Scroller>
      <ul className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px]">
        {bubbles.map((b) => (
          <li key={b.name} className="flex items-baseline gap-1">
            <span className="inline-block h-[8px] w-[8px] shrink-0 rounded-full"
              style={{ background: b.mark ? TONE[b.tone] : FILL[b.tone], border: `1px solid ${TONE[b.tone]}` }} />
            <span style={{ fontWeight: b.mark ? 700 : 400 }}>{b.name}</span>
            <span className="mono tabular-nums" style={{ color: "var(--story-ink-3)" }}>{b.display}</span>
          </li>
        ))}
      </ul>
      {missing > 0 && (
        <Caption>
          {missing} of {bubbles.length} circles could not be placed in the space available and are
          listed above but not drawn. {unit ? `Values are ${unit}.` : ""}
        </Caption>
      )}
    </div>
  );
}

/* ───────────────────────────── BubbleMap ────────────────────────────── */

const world = feature(
  worldTopo as unknown as Topology,
  (worldTopo as unknown as Topology).objects.countries as GeometryCollection,
) as FeatureCollection<Geometry, { name: string }>;

const india = feature(
  indiaTopo as unknown as Topology,
  (indiaTopo as unknown as Topology).objects.india as GeometryCollection,
) as FeatureCollection<Geometry, { name: string | null }>;

/**
 * The world atlas's numeric id for a country, by the atlas's own spelling.
 *
 * Exported because some datasets in this repository are already resolved to
 * atlas names — the drone connector writes `originCountry` precisely so the
 * name it records is the one the map uses. For those, a name lookup is not the
 * fragile join it would be against raw trade data; it is a lookup against the
 * same vocabulary. Anything else should still join on a code.
 */
const ISO_BY_NAME = new Map<string, string>(
  world.features
    .map((f) => [f.properties?.name ?? "", String(f.id ?? "")] as const)
    .filter(([n, id]) => n !== "" && id !== "")
    .map(([n, id]) => [n, id]),
);

export function isoForCountryName(name: string): string | undefined {
  return ISO_BY_NAME.get(name);
}

export interface MapBubble {
  id: string;
  name: string;
  value: number;
  display: string;
  tone: Tone;
  mark?: boolean;
  /**
   * An explicit [lon, lat], for a place the world atlas has no polygon for.
   *
   * At 110m resolution Hong Kong, Singapore and Malta have no outline at all —
   * and the first two are the largest and fifth largest exporters of integrated
   * circuits on earth. A centroid join would drop exactly the two city-states
   * the chip trade runs through and leave the map looking complete. A port is
   * a point, so giving it one is not an approximation of anything.
   */
  at?: [number, number];
}

/**
 * Proportional circles on a world map, joined by numeric country id.
 *
 * The join is on ISO 3166-1 numeric, which is what world-atlas uses as a
 * feature id — not on country name. Name joins against trade data fail on
 * exactly the countries that matter most and fail silently: "Korea, Rep." and
 * "South Korea" and "Republic of Korea" are three strings for the third
 * largest chip exporter on earth, and a name join would simply not draw it.
 *
 * Whatever cannot be placed is counted and printed. A world map with a missing
 * country reads as a country with no trade, which is a claim this data never
 * makes.
 */
export function BubbleMap({
  bubbles, height = 360, maxRadius = 30, note,
}: {
  bubbles: MapBubble[]; height?: number; maxRadius?: number; note?: ReactNode;
}) {
  const width = 820;
  const projection = geoNaturalEarth1().fitExtent([[6, 6], [width - 6, height - 6]], world);
  const path = geoPath(projection);
  const centroids = new Map<string, [number, number]>();
  for (const f of world.features) {
    const id = String(f.id ?? "");
    if (id === "") continue;
    const c = path.centroid(f);
    if (Number.isFinite(c[0]) && Number.isFinite(c[1])) centroids.set(id, [c[0], c[1]]);
  }
  const max = Math.max(1, ...bubbles.map((b) => b.value));
  const place = (b: MapBubble): [number, number] | undefined => {
    if (b.at) {
      const p = projection(b.at);
      return p ? [p[0], p[1]] : undefined;
    }
    return centroids.get(b.id);
  };
  const drawn = bubbles
    .map((b) => ({ b, at: place(b) }))
    .filter((x): x is { b: MapBubble; at: [number, number] } => x.at !== undefined)
    // Largest first so a small circle inside a big one stays clickable-looking.
    .sort((a, b) => b.b.value - a.b.value);
  const unplaced = bubbles.filter((b) => place(b) === undefined);
  /**
   * Only the largest few get a label, plus anything marked.
   *
   * Every circle labelled is the right rule on a sparse map and the wrong one
   * here: the chip trade is six overlapping circles inside one thousand-mile
   * square of East Asia, and labelling all of them produced a block of type
   * with no legible attachment to any circle. The sixth largest radius is the
   * floor, so the rule adapts to how concentrated the particular series is
   * rather than to a pixel count that happens to suit this one.
   */
  const radii = drawn.map(({ b }) => Math.sqrt(b.value / max) * maxRadius).sort((a, b) => b - a);
  const labelFloor = radii[Math.min(5, radii.length - 1)] ?? 0;

  return (
    <div>
      <Scroller min={560}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }} role="img"
          aria-label={bubbles.map((b) => `${b.name} ${b.display}`).join("; ")}>
          <g>
            {world.features.map((f, i) => (
              <path key={i} d={path(f) ?? undefined}
                fill="var(--story-rule)" stroke="var(--story-bg)" strokeWidth={0.5} />
            ))}
          </g>
          <g>
            {drawn.map(({ b, at }) => {
              const r = Math.max(2.5, Math.sqrt(b.value / max) * maxRadius);
              return (
                <g key={b.id}>
                  <circle cx={at[0]} cy={at[1]} r={r}
                    fill={TONE[b.tone]} fillOpacity={b.mark ? 0.95 : 0.55}
                    stroke={b.mark ? "var(--story-ink)" : TONE[b.tone]}
                    strokeWidth={b.mark ? 1.6 : 0.9} />
                  {(r >= labelFloor || b.mark) && (
                    <text x={at[0]} y={at[1] - r - 3} textAnchor="middle"
                      style={{ fontSize: 10.5, fontWeight: 700, fill: "var(--story-ink)" }}>
                      {b.name}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </Scroller>
      {(note || unplaced.length > 0) && (
        <Caption>
          {note}
          {unplaced.length > 0 && (
            <>
              {" "}
              {unplaced.length} entr{unplaced.length === 1 ? "y" : "ies"} had no outline on this map and
              {" "}are not drawn: {unplaced.map((u) => u.name).join(", ")}. They are absent from the
              {" "}picture, not from the trade.
            </>
          )}
        </Caption>
      )}
    </div>
  );
}

/* ────────────────────────── India bubble map ────────────────────────── */

export interface StateBubble { state: string; value: number; display: string; tone: Tone }

/** Normalises the several spellings a state arrives under. */
function stateKey(s: string): string {
  return s.toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z]/g, "");
}

/**
 * The same device on India, joined by state name.
 *
 * A name join is acceptable here and was not on the world map, because both
 * sides of this one come from inside this repository: the topology's state
 * names and the connectors' state names are reconciled by the gazetteer, and
 * `test:geo` fails if they drift. `stateKey` absorbs the ampersand and the
 * spacing, which is the whole of the remaining variation.
 */
export function IndiaBubbleMap({
  bubbles, height = 460, maxRadius = 34, showOutline = true,
}: {
  bubbles: StateBubble[]; height?: number; maxRadius?: number; showOutline?: boolean;
}) {
  const width = 400;
  const projection = geoMercator().fitExtent([[8, 8], [width - 8, height - 8]], india);
  const path = geoPath(projection);
  const centroids = new Map<string, [number, number]>();
  for (const f of india.features) {
    const n = f.properties?.name;
    if (!n) continue;
    const c = path.centroid(f);
    if (Number.isFinite(c[0]) && Number.isFinite(c[1])) centroids.set(stateKey(n), [c[0], c[1]]);
  }
  const max = Math.max(1, ...bubbles.map((b) => b.value));
  const drawn = bubbles
    .map((b) => ({ b, at: centroids.get(stateKey(b.state)) }))
    .filter((x): x is { b: StateBubble; at: [number, number] } => x.at !== undefined)
    .sort((a, b) => b.b.value - a.b.value);
  const unplaced = bubbles.filter((b) => !centroids.has(stateKey(b.state)));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }} className="max-w-full" role="img"
        aria-label={bubbles.map((b) => `${b.state} ${b.display}`).join("; ")}>
        {showOutline && india.features.map((f, i) => (
          <path key={i} d={path(f) ?? undefined}
            fill="var(--story-rule)" stroke="var(--story-bg)" strokeWidth={0.6} />
        ))}
        {drawn.map(({ b, at }) => {
          const r = Math.max(2.5, Math.sqrt(b.value / max) * maxRadius);
          return (
            <g key={b.state}>
              <circle cx={at[0]} cy={at[1]} r={r} fill={TONE[b.tone]} fillOpacity={0.6}
                stroke={TONE[b.tone]} strokeWidth={1} />
              {r > 15 && (
                <text x={at[0]} y={at[1] + 3.5} textAnchor="middle"
                  style={{ fontSize: 10, fontWeight: 700, fill: "var(--story-bg)" }}>
                  {b.display}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {unplaced.length > 0 && (
        <Caption>
          {unplaced.length} not drawn, having no outline in this topology:{" "}
          {unplaced.map((u) => u.state).join(", ")}.
        </Caption>
      )}
    </div>
  );
}

/* ─────────────────────────── Dot-density map ────────────────────────── */

/**
 * One dot per thing, at its own coordinates.
 *
 * Where a bubble map aggregates to a state and hides everything inside it, this
 * draws the points. For three thousand temples that difference is the entire
 * finding: the Kerala coast is a line, not a blob, and no state-level summary
 * can show a line.
 */
export function DotMap({
  dots, height = 520, r = 1.5, opacity = 0.5, highlights = [],
}: {
  dots: Array<{ lat: number; lon: number; tone?: Tone }>;
  height?: number;
  r?: number;
  opacity?: number;
  highlights?: Array<{ lat: number; lon: number; label: string; tone: Tone }>;
}) {
  const width = 400;
  const projection = geoMercator().fitExtent([[8, 8], [width - 8, height - 8]], india);
  const path = geoPath(projection);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }} className="max-w-full" role="img"
      aria-label={`${dots.length} mapped sites`}>
      {india.features.map((f, i) => (
        <path key={i} d={path(f) ?? undefined}
          fill="var(--story-card)" stroke="var(--story-rule)" strokeWidth={0.6} />
      ))}
      {dots.map((d, i) => {
        const p = projection([d.lon, d.lat]);
        if (!p) return null;
        return <circle key={i} cx={p[0]} cy={p[1]} r={r} fill={TONE[d.tone ?? "hot"]} fillOpacity={opacity} />;
      })}
      {highlights.map((h) => {
        const p = projection([h.lon, h.lat]);
        if (!p) return null;
        return (
          <g key={h.label}>
            <circle cx={p[0]} cy={p[1]} r={4.2} fill={TONE[h.tone]}
              stroke="var(--story-bg)" strokeWidth={1.4} />
            <text x={p[0] + 6.5} y={p[1] + 3} style={{ fontSize: 9, fontWeight: 700, fill: "var(--story-ink)" }}>
              {h.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ───────────────────────────── SlopeChart ───────────────────────────── */

export interface Slope { name: string; from: number; to: number; fromDisplay: string; toDisplay: string; mark?: boolean }

/**
 * Two dates, one line each.
 *
 * The chart for "who overtook whom". A pair of bar charts side by side shows
 * both states and hides every crossing between them; the slope shows the
 * crossing and nothing else, which is the point when the ranking changed.
 */
export function SlopeChart({
  rows, fromLabel, toLabel, height = 380, tone = "hot", riseTone = "cool", format,
}: {
  rows: Slope[];
  fromLabel: string;
  toLabel: string;
  height?: number;
  tone?: Tone;
  riseTone?: Tone;
  format?: (v: number) => string;
}) {
  const width = 620;
  const padY = 26;
  const x1 = 150;
  const x2 = width - 150;
  const max = Math.max(1, ...rows.flatMap((r) => [r.from, r.to]));
  const y = (v: number): number => height - padY - (v / max) * (height - padY * 2);
  void format;
  return (
    <Scroller min={520}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }} role="img"
        aria-label={rows.map((r) => `${r.name}: ${r.fromDisplay} to ${r.toDisplay}`).join("; ")}>
        <line x1={x1} y1={padY - 14} x2={x1} y2={height - padY + 6} stroke="var(--story-rule)" />
        <line x1={x2} y1={padY - 14} x2={x2} y2={height - padY + 6} stroke="var(--story-rule)" />
        <text x={x1} y={padY - 20} textAnchor="middle" className="mono"
          style={{ fontSize: 11, fontWeight: 700, fill: "var(--story-ink-3)" }}>{fromLabel}</text>
        <text x={x2} y={padY - 20} textAnchor="middle" className="mono"
          style={{ fontSize: 11, fontWeight: 700, fill: "var(--story-ink-3)" }}>{toLabel}</text>
        {rows.map((r) => {
          const t = r.to >= r.from ? riseTone : tone;
          const ya = y(r.from);
          const yb = y(r.to);
          return (
            <g key={r.name}>
              <line x1={x1} y1={ya} x2={x2} y2={yb}
                stroke={TONE[t]} strokeWidth={r.mark ? 2.6 : 1.4} strokeOpacity={r.mark ? 1 : 0.55} />
              <circle cx={x1} cy={ya} r={r.mark ? 4 : 2.8} fill={TONE[t]} />
              <circle cx={x2} cy={yb} r={r.mark ? 4 : 2.8} fill={TONE[t]} />
              <text x={x1 - 9} y={ya + 3.5} textAnchor="end"
                style={{ fontSize: 11, fontWeight: r.mark ? 700 : 500, fill: "var(--story-ink)" }}>
                {r.name} <tspan style={{ fill: "var(--story-ink-3)" }}>{r.fromDisplay}</tspan>
              </text>
              <text x={x2 + 9} y={yb + 3.5}
                style={{ fontSize: 11, fontWeight: r.mark ? 700 : 500, fill: "var(--story-ink)" }}>
                <tspan style={{ fill: "var(--story-ink-3)" }}>{r.toDisplay}</tspan> {r.name}
              </text>
            </g>
          );
        })}
      </svg>
    </Scroller>
  );
}

/* ───────────────────────────── StageLadder ──────────────────────────── */

export type Grade = 0 | 1 | 2 | 3;

export interface Ladder {
  name: string;
  /** One grade per stage, same order as `stages`. */
  grades: Grade[];
  mark?: boolean;
  note?: string;
}

/**
 * Who can do which step of a value chain.
 *
 * Four grades, and the grade is drawn as a filled fraction of the cell rather
 * than as a hue, so the scale is ordinal by area and readable in greyscale.
 * The legend names all four, because an ordinal encoding with no key is a
 * decoration.
 *
 * This is the only chart here whose input is a judgement rather than a measure.
 * Every use of it must say, in the caption, what evidence each grade was read
 * from — otherwise it is an opinion wearing a chart's clothes.
 */
export function StageLadder({
  stages, rows, gradeLabels,
}: {
  stages: string[];
  rows: Ladder[];
  gradeLabels: [string, string, string, string];
}) {
  const cell = 52;
  const labelW = 132;
  /**
   * The viewBox is sized from the rotated headings, not from the grid.
   *
   * These run at 42°, so a long one reaches up and to the right of the column
   * it labels — about two thirds of its length in each direction. Sizing the
   * box to the grid alone clipped "Covers its own bill" at the right edge and
   * the chart still rendered: the column had a heading, and the heading was
   * half off the page. Both the head height and the right margin are therefore
   * computed from the longest label.
   */
  const RAD = (42 * Math.PI) / 180;
  const longest = stages.reduce((m, s) => Math.max(m, s.length), 0);
  const run = longest * 6.2;
  const headH = Math.ceil(26 + run * Math.sin(RAD));
  const rightPad = Math.ceil(run * Math.cos(RAD) - cell / 2 + 8);
  const width = labelW + stages.length * cell + Math.max(0, rightPad);
  const rowH = 34;
  const height = headH + rows.length * rowH + 6;
  return (
    <div>
      <Scroller min={width}>
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img"
          aria-label={rows.map((r) =>
            `${r.name}: ` + stages.map((s, i) => `${s} ${gradeLabels[r.grades[i] ?? 0]}`).join(", ")).join("; ")}>
          {stages.map((s, i) => (
            <text key={s} x={labelW + i * cell + cell / 2} y={headH - 12}
              transform={`rotate(-42 ${labelW + i * cell + cell / 2} ${headH - 12})`}
              style={{ fontSize: 11, fontWeight: 700, fill: "var(--story-ink-2)" }}>
              {s}
            </text>
          ))}
          {rows.map((r, ri) => {
            const y = headH + ri * rowH;
            return (
              <g key={r.name}>
                <text x={labelW - 10} y={y + rowH / 2 + 4} textAnchor="end"
                  style={{ fontSize: 12, fontWeight: r.mark ? 700 : 500, fill: "var(--story-ink)" }}>
                  {r.name}
                </text>
                {stages.map((s, si) => {
                  const g = r.grades[si] ?? 0;
                  const x = labelW + si * cell;
                  const box = 24;
                  const bx = x + (cell - box) / 2;
                  const by = y + (rowH - box) / 2;
                  const tone: Tone = g === 0 ? "hot" : g === 3 ? "cool" : "mid";
                  return (
                    <g key={s}>
                      <rect x={bx} y={by} width={box} height={box} rx={4}
                        fill="none" stroke={TONE[tone]} strokeWidth={1} strokeOpacity={0.55} />
                      {g > 0 && (
                        <rect x={bx} y={by + box * (1 - g / 3)} width={box} height={box * (g / 3)} rx={3}
                          fill={TONE[tone]} fillOpacity={g === 3 ? 1 : 0.75} />
                      )}
                      {g === 0 && (
                        <line x1={bx + 7} y1={by + box / 2} x2={bx + box - 7} y2={by + box / 2}
                          stroke={TONE.hot} strokeWidth={2} strokeLinecap="round" />
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </Scroller>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px]">
        {gradeLabels.map((l, g) => {
          const tone: Tone = g === 0 ? "hot" : g === 3 ? "cool" : "mid";
          return (
            <li key={l} className="flex items-center gap-1.5">
              <svg width={15} height={15} aria-hidden="true">
                <rect x={0.5} y={0.5} width={14} height={14} rx={3} fill="none"
                  stroke={TONE[tone]} strokeOpacity={0.55} />
                {g > 0 && <rect x={0.5} y={0.5 + 14 * (1 - g / 3)} width={14} height={14 * (g / 3)} rx={2.5}
                  fill={TONE[tone]} fillOpacity={g === 3 ? 1 : 0.75} />}
                {g === 0 && <line x1={4} y1={7.5} x2={11} y2={7.5} stroke={TONE.hot} strokeWidth={2} strokeLinecap="round" />}
              </svg>
              <span style={{ color: "var(--story-ink-2)" }}>{l}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ────────────────────────────── Treemap ─────────────────────────────── */

interface TreeRect { x: number; y: number; w: number; h: number; i: number }

/** Squarified treemap. Standard Bruls–Huizing–van Wijk, iterative. */
function squarify(values: number[], width: number, height: number): TreeRect[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v).filter((x) => x.v > 0);
  const total = order.reduce((a, b) => a + b.v, 0) || 1;
  const scale = (width * height) / total;
  const out: TreeRect[] = [];
  let x = 0, y = 0, w = width, h = height;
  let row: Array<{ v: number; i: number }> = [];

  const worst = (r: Array<{ v: number; i: number }>, side: number): number => {
    if (r.length === 0) return Infinity;
    const sum = r.reduce((a, b) => a + b.v, 0) * scale;
    const maxV = Math.max(...r.map((z) => z.v)) * scale;
    const minV = Math.min(...r.map((z) => z.v)) * scale;
    const s2 = side * side;
    return Math.max((s2 * maxV) / (sum * sum), (sum * sum) / (s2 * minV));
  };

  const flush = (): void => {
    if (row.length === 0) return;
    const sum = row.reduce((a, b) => a + b.v, 0) * scale;
    const horizontal = w >= h;
    const thick = sum / (horizontal ? h : w);
    let off = 0;
    for (const item of row) {
      const len = (item.v * scale) / thick;
      out.push(horizontal
        ? { x, y: y + off, w: thick, h: len, i: item.i }
        : { x: x + off, y, w: len, h: thick, i: item.i });
      off += len;
    }
    if (horizontal) { x += thick; w -= thick; } else { y += thick; h -= thick; }
    row = [];
  };

  for (const item of order) {
    const side = Math.min(w, h);
    if (row.length > 0 && worst([...row, item], side) > worst(row, side)) flush();
    row.push(item);
  }
  flush();
  return out;
}

export function Treemap({
  items, width = 700, height = 340,
}: {
  items: Array<{ name: string; value: number; display: string; tone: Tone; mark?: boolean }>;
  width?: number;
  height?: number;
}) {
  const rects = squarify(items.map((i) => i.value), width, height);
  return (
    <Scroller min={Math.min(width, 520)}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }} role="img"
        aria-label={items.map((i) => `${i.name} ${i.display}`).join("; ")}>
        {rects.map((r) => {
          const it = items[r.i];
          if (!it) return null;
          const room = r.w > 62 && r.h > 34;
          const tiny = r.w > 34 && r.h > 18;
          return (
            <g key={it.name}>
              <rect x={r.x} y={r.y} width={Math.max(0, r.w - 2)} height={Math.max(0, r.h - 2)} rx={3}
                fill={it.mark ? TONE[it.tone] : FILL[it.tone]}
                stroke={TONE[it.tone]} strokeWidth={it.mark ? 0 : 1} />
              {room && (
                <>
                  <text x={r.x + 8} y={r.y + 18}
                    style={{ fontSize: 12, fontWeight: 700, fill: it.mark ? "var(--story-bg)" : "var(--story-ink)" }}>
                    {it.name.length > Math.floor(r.w / 7.2) ? it.name.slice(0, Math.floor(r.w / 7.2) - 1) + "…" : it.name}
                  </text>
                  <text x={r.x + 8} y={r.y + 34} className="mono"
                    style={{ fontSize: 11.5, fill: it.mark ? "var(--story-bg)" : "var(--story-ink-2)" }}>
                    {it.display}
                  </text>
                </>
              )}
              {!room && tiny && (
                <text x={r.x + 4} y={r.y + 13}
                  style={{ fontSize: 9.5, fontWeight: 600, fill: it.mark ? "var(--story-bg)" : "var(--story-ink-2)" }}>
                  {it.name.slice(0, Math.max(2, Math.floor(r.w / 6)))}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </Scroller>
  );
}

/* ───────────────────────────── DotStrip ─────────────────────────────── */

/**
 * The distribution, one dot per member.
 *
 * A histogram tells you how many are in each bin. This tells you that and also
 * how many there are altogether, because every dot is a thing. For a few
 * hundred items that is a materially different reading: "most temples in this
 * atlas have no recorded founding date" is a sentence, and a column of eighty
 * dots against a field of three thousand is a picture of it.
 */
export function DotStrip({
  bins, dotSize = 5, gap = 2, maxPerColumn = 26, format,
}: {
  bins: Array<{ label: string; count: number; tone: Tone }>;
  dotSize?: number;
  gap?: number;
  maxPerColumn?: number;
  format?: (n: number) => string;
}) {
  const colW = dotSize + gap;
  const fmt = format ?? ((n: number) => String(n));
  const height = maxPerColumn * (dotSize + gap) + 44;
  /**
   * A group is at least as wide as its own label.
   *
   * Sized to the dots alone, a bin holding nine items is one column of six
   * pixels with "founding date" written under it, and three such bins in a row
   * overprint each other into a single unreadable smear. The labels are the
   * axis here, so they set the spacing and the dots sit inside it.
   */
  let x = 10;
  const groups = bins.map((b) => {
    const cols = Math.max(1, Math.ceil(b.count / maxPerColumn));
    const labelW = Math.max(b.label.length, fmt(b.count).length) * 5.6;
    const span = Math.max(cols * colW, labelW) + 12;
    const at = x;
    x += span;
    return { b, at, cols };
  });
  // Trailing room for the last group's label, which starts at its group's left
  // edge and runs right past it.
  const width = x + 10;
  return (
    <Scroller min={Math.min(width, 560)}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img"
        aria-label={bins.map((b) => `${b.label}: ${b.count}`).join("; ")}>
        {groups.map(({ b, at, cols }) => (
          <g key={b.label}>
            {Array.from({ length: Math.min(b.count, cols * maxPerColumn) }, (_, i) => (
              <circle key={i}
                cx={at + Math.floor(i / maxPerColumn) * colW + dotSize / 2}
                cy={height - 40 - (i % maxPerColumn) * (dotSize + gap)}
                r={dotSize / 2} fill={TONE[b.tone]} fillOpacity={0.8} />
            ))}
            <text x={at} y={height - 22} className="mono"
              style={{ fontSize: 11, fontWeight: 700, fill: "var(--story-ink)" }}>{fmt(b.count)}</text>
            <text x={at} y={height - 8}
              style={{ fontSize: 10.5, fill: "var(--story-ink-3)" }}>{b.label}</text>
          </g>
        ))}
      </svg>
    </Scroller>
  );
}

/* ────────────────────────────── GridMap ─────────────────────────────── */

/**
 * Every state one tile, laid out roughly where it sits.
 *
 * A real map gives Rajasthan eleven times Kerala's ink for a third of its
 * people and, in the temple atlas, a twelfth of its sites. This gives every
 * state the same tile, so the colour carries the whole of the comparison. It
 * is not a substitute for the map — both are shown, because the grid loses
 * shape and the map loses the small states.
 *
 * The layout is hand-placed on a 7×9 lattice. It is approximate by
 * construction and says so; a tile grid that pretends to be a projection is
 * worse than one that admits it is a diagram.
 */
const GRID: Array<[string, number, number]> = [
  ["Jammu & Kashmir", 0, 2], ["Ladakh", 0, 3],
  ["Himachal Pradesh", 1, 3], ["Punjab", 1, 2], ["Chandigarh", 1, 4], ["Uttarakhand", 1, 5],
  ["Rajasthan", 2, 1], ["Haryana", 2, 3], ["NCT of Delhi", 2, 4], ["Uttar Pradesh", 2, 5], ["Sikkim", 2, 7],
  ["Gujarat", 3, 1], ["Madhya Pradesh", 3, 3], ["Bihar", 3, 5], ["West Bengal", 3, 6], ["Assam", 3, 7], ["Arunachal Pradesh", 3, 8],
  ["Daman & Diu", 4, 0], ["Maharashtra", 4, 2], ["Chhattisgarh", 4, 4], ["Jharkhand", 4, 5], ["Meghalaya", 4, 6], ["Nagaland", 4, 7], ["Manipur", 4, 8],
  ["Goa", 5, 1], ["Telangana", 5, 3], ["Odisha", 5, 5], ["Tripura", 5, 6], ["Mizoram", 5, 7],
  ["Karnataka", 6, 2], ["Andhra Pradesh", 6, 4], ["Andaman & Nicobar", 6, 7],
  ["Kerala", 7, 2], ["Tamil Nadu", 7, 3], ["Puducherry", 7, 4], ["Lakshadweep", 7, 0],
];

/**
 * The standard two-letter code for each state.
 *
 * Slicing letters off the name produced "NCOF" for Delhi and "JA" for Jammu &
 * Kashmir. These are the codes on the number plates, which is the abbreviation
 * every Indian reader already knows — a tile grid is only readable if the
 * label needs no decoding.
 */
const CODE: Record<string, string> = {
  "Andhra Pradesh": "AP", "Arunachal Pradesh": "AR", "Assam": "AS", "Bihar": "BR",
  "Chhattisgarh": "CG", "Goa": "GA", "Gujarat": "GJ", "Haryana": "HR",
  "Himachal Pradesh": "HP", "Jharkhand": "JH", "Jammu & Kashmir": "JK", "Karnataka": "KA",
  "Kerala": "KL", "Ladakh": "LA", "Madhya Pradesh": "MP", "Maharashtra": "MH",
  "Manipur": "MN", "Meghalaya": "ML", "Mizoram": "MZ", "Nagaland": "NL",
  "NCT of Delhi": "DL", "Odisha": "OD", "Punjab": "PB", "Puducherry": "PY",
  "Rajasthan": "RJ", "Sikkim": "SK", "Tamil Nadu": "TN", "Telangana": "TS",
  "Tripura": "TR", "Uttar Pradesh": "UP", "Uttarakhand": "UK", "West Bengal": "WB",
  "Chandigarh": "CH", "Andaman & Nicobar": "AN", "Daman & Diu": "DD", "Lakshadweep": "LD",
};

export function GridMap({
  values, format, scale = "hot", empty = "not in this dataset",
}: {
  values: Array<{ state: string; value: number; display?: string }>;
  format?: (v: number) => string;
  scale?: Tone;
  empty?: string;
}) {
  const by = new Map(values.map((v) => [stateKey(v.state), v]));
  const max = Math.max(1, ...values.map((v) => v.value));
  const fmt = format ?? ((v: number) => String(v));
  const cols = 9;
  const rows = 8;
  const cell = 52;
  const width = cols * cell;
  const height = rows * cell;
  return (
    <div>
      <Scroller min={width}>
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img"
          aria-label={values.map((v) => `${v.state} ${v.display ?? fmt(v.value)}`).join("; ")}>
          {GRID.map(([name, row, col]) => {
            const v = by.get(stateKey(name));
            // Square-root so the mid-range states are distinguishable. A linear
            // ramp on a field where one state holds 28% of the total leaves
            // twenty-nine tiles in the bottom tenth of the scale, i.e. one
            // colour.
            const t = v ? Math.sqrt(v.value / max) : 0;
            const short = CODE[name] ?? name.slice(0, 2).toUpperCase();
            return (
              <g key={name}>
                <rect x={col * cell + 2} y={row * cell + 2} width={cell - 4} height={cell - 4} rx={5}
                  fill={v ? TONE[scale] : "transparent"} fillOpacity={v ? 0.12 + t * 0.88 : 1}
                  stroke="var(--story-rule)" strokeWidth={1} />
                <text x={col * cell + cell / 2} y={row * cell + cell / 2 - 2} textAnchor="middle" className="mono"
                  style={{ fontSize: 9.5, fontWeight: 700, fill: t > 0.6 ? "var(--story-bg)" : "var(--story-ink-2)" }}>
                  {short.toUpperCase()}
                </text>
                <text x={col * cell + cell / 2} y={row * cell + cell / 2 + 12} textAnchor="middle"
                  style={{ fontSize: 11, fontWeight: 700, fill: t > 0.6 ? "var(--story-bg)" : "var(--story-ink)" }}>
                  {v ? (v.display ?? fmt(v.value)) : "·"}
                </text>
              </g>
            );
          })}
        </svg>
      </Scroller>
      <Caption>
        A diagram, not a projection: every state gets one tile of equal size, placed roughly where it
        sits. A tile with a dot carries {empty}.
      </Caption>
    </div>
  );
}

/* ──────────────────────────── PairedChange ──────────────────────────── */

/**
 * The same quantity at two dates, as two bars per row.
 *
 * Distinct from the slope chart: this keeps both magnitudes readable and gives
 * up the crossings. Use it when the values matter and the ordering does not.
 */
export function PairedChange({
  rows, aLabel, bLabel, aTone = "mid", bTone = "cool",
}: {
  rows: Array<{ name: string; a: number; b: number; aDisplay: string; bDisplay: string; mark?: boolean }>;
  aLabel: string;
  bLabel: string;
  aTone?: Tone;
  bTone?: Tone;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b]));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[9px] w-[16px] rounded-[2px]" style={{ background: FILL[aTone], border: `1px solid ${TONE[aTone]}` }} />
          {aLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[9px] w-[16px] rounded-[2px]" style={{ background: TONE[bTone] }} />
          {bLabel}
        </span>
      </div>
      {rows.map((r) => (
        <div key={r.name} className="border-b py-2 last:border-0" style={{ borderColor: "var(--story-rule)" }}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12.5px]" style={{ fontWeight: r.mark ? 700 : 500 }}>{r.name}</span>
            <span className="mono text-[11px] tabular-nums" style={{ color: "var(--story-ink-3)" }}>
              {r.aDisplay} → <span style={{ color: TONE[bTone], fontWeight: 700 }}>{r.bDisplay}</span>
            </span>
          </div>
          <div className="mt-1.5 space-y-[3px]">
            <span className="block h-[8px] rounded-sm" style={{
              width: `${(r.a / max) * 100}%`, background: FILL[aTone], border: `1px solid ${TONE[aTone]}55`,
            }} />
            <span className="block h-[8px] rounded-sm" style={{
              width: `${(r.b / max) * 100}%`, background: TONE[bTone],
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}
