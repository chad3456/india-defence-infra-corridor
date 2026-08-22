import type { Category, Confidence } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import type { AttributionShape, AttributionYear, EvidenceMap, Rung } from "@/lib/epistemic";
import { RUNGS } from "@/lib/epistemic";

/**
 * Three figures for the evidence page, sharing one ordinal ramp.
 *
 * ── Why a single-hue ramp rather than five colours ───────────────────────
 *
 * The rungs are ordered: a record is nearer the fact than a compilation, which
 * is nearer than an estimate. Swapping two of them would change the meaning, so
 * this is ordinal encoding, and ordinal encoding takes one hue with monotone
 * lightness steps — the reader should see the order in the colour without
 * consulting a key.
 *
 * The steps are validated as an ordinal ramp in both modes: monotone lightness,
 * every adjacent gap at or above ΔL 0.06, single hue, and the step nearest the
 * surface clearing 2:1 against it. That last check is why the pale end starts
 * at a mid blue rather than the near-white the sequential scale uses — a
 * discrete rung has to stay visible, where a heatmap's lowest bin may recede.
 *
 * Strongest evidence is darkest on light and lightest on dark, so the weakest
 * rung is always the one closest to disappearing into the page. That is the
 * argument the page is making, carried by the encoding rather than stated
 * beside it.
 *
 * Every figure also labels its rungs in text, so nothing depends on telling two
 * blues apart.
 */

const RUNG_VAR: Record<Rung, string> = {
  record: "var(--rung-1)",
  compilation: "var(--rung-2)",
  estimate: "var(--rung-3)",
  construction: "var(--rung-4)",
  unmeasured: "var(--rung-5)",
};

export function RungKey() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
      {RUNGS.map((r) => (
        <li key={r.id} className="flex items-center gap-1.5 text-[11px]">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: RUNG_VAR[r.id] }}
          />
          <span className="text-[color:var(--text-secondary)]">{r.label}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Rung composition by sector, as proportional bars.
 *
 * Shares rather than counts, because the sectors are wildly different sizes and
 * the question is what kind of knowledge each rests on, not how much of it
 * there is. The count sits at the end of every row so the denominator is never
 * hidden — a sector of four series showing 100 per cent records is a different
 * claim from a sector of a hundred.
 */
export function RungByCategory({ rows }: { rows: EvidenceMap["byCategory"] }) {
  return (
    <div className="mt-4 space-y-1.5">
      {rows.map((row) => (
        <div key={row.category} className="flex items-center gap-3">
          <span className="w-[112px] shrink-0 text-right text-[11px] text-[color:var(--text-secondary)]">
            {CATEGORY_LABELS[row.category as Category]}
          </span>
          <div className="flex h-4 flex-1 overflow-hidden rounded-sm">
            {RUNGS.map((r) => {
              const n = row.counts[r.id];
              if (n === 0) return null;
              return (
                <div
                  key={r.id}
                  style={{ background: RUNG_VAR[r.id], width: `${(n / row.total) * 100}%` }}
                  title={`${CATEGORY_LABELS[row.category as Category]} — ${n} ${r.short} of ${row.total}`}
                />
              );
            })}
          </div>
          <span className="tnum w-8 shrink-0 text-[11px] text-[color:var(--text-muted)]">
            {row.total}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const CONFIDENCES: Confidence[] = ["high", "medium", "low"];

/**
 * Rung against confidence, as a counted grid.
 *
 * The whole argument for keeping the two channels separate is visible here: the
 * off-diagonal cells are the interesting ones. A record held at low confidence
 * and a well-documented estimate held at high confidence are both real, and a
 * single quality score would rank one above the other and say nothing true.
 *
 * Cells carry their number, so the tint is a second reading of a value already
 * written down rather than the only way to read it.
 */
export function RungConfidenceGrid({ crossTab }: { crossTab: EvidenceMap["crossTab"] }) {
  const max = Math.max(
    1,
    ...RUNGS.flatMap((r) => CONFIDENCES.map((c) => crossTab[r.id][c])),
  );
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-[420px] border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="pb-1.5 pr-3 text-left font-medium text-[color:var(--text-muted)]">
              evidence
            </th>
            {CONFIDENCES.map((c) => (
              <th
                key={c}
                className="pb-1.5 pl-3 text-right font-medium text-[color:var(--text-muted)]"
              >
                {c} confidence
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RUNGS.map((r) => (
            <tr key={r.id} className="border-t">
              <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ background: RUNG_VAR[r.id] }}
                  />
                  {r.label}
                </span>
              </th>
              {CONFIDENCES.map((c) => {
                const n = crossTab[r.id][c];
                return (
                  <td key={c} className="py-1.5 pl-3 text-right">
                    <span
                      className="tnum inline-block min-w-[34px] rounded-sm px-1.5 py-0.5"
                      style={{
                        background:
                          n === 0
                            ? "transparent"
                            : // Capped low on purpose. The rung colours run to a near-black blue
                              // at one end, and a cell tinted to full strength would put body text
                              // on a ground it cannot be read against. The count is written in the
                              // cell, so the tint is a second reading of a number already legible
                              // rather than the only way to see it.
                              `color-mix(in oklab, ${RUNG_VAR[r.id]} ${Math.round((n / max) * 20) + 6}%, transparent)`,
                      }}
                    >
                      {n === 0 ? (
                        <span className="text-[color:var(--text-muted)]">—</span>
                      ) : (
                        n
                      )}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const W = 620;
const H = 190;
const M = { top: 14, right: 16, bottom: 26, left: 40 };

/**
 * The unattributed share of LWE fatalities, year by year, with the break marked.
 *
 * A column chart rather than a line: the values are a share within each
 * discrete year, and drawing a line through the zeros after 2011 would imply a
 * continuous quantity declining smoothly toward nothing. It does not decline —
 * it stops.
 */
export function AttributionBreak({
  rows,
  shape,
}: {
  rows: AttributionYear[];
  shape: AttributionShape;
}) {
  const breakYear = shape.firstZeroRunYear;
  const max = Math.max(0.02, ...rows.map((r) => r.share));
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const step = innerW / rows.length;
  const barW = Math.min(18, step * 0.62);
  const y = (v: number) => M.top + innerH - (v / max) * innerH;
  const breakIdx = breakYear === null ? -1 : rows.findIndex((r) => r.year === breakYear);
  const collapseIdx =
    shape.lastConsecutiveYear === null ? -1 : rows.findIndex((r) => r.year === shape.lastConsecutiveYear);

  return (
    <figure className="m-0">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={`Share of left-wing-extremism fatalities SATP does not attribute to a side, ${rows[0]?.year ?? ""} to ${rows[rows.length - 1]?.year ?? ""}. The share peaks near ${(shape.peakShare * 100).toFixed(0)} per cent, is populated in every one of the ${shape.consecutiveYears} years to ${shape.lastConsecutiveYear ?? "the mid-2000s"}, and reads exactly zero in every year from ${breakYear ?? "the end of the series"} onward.`}
          className="min-w-[520px]"
        >
          {[0, max / 2, max].map((v) => (
            <g key={v}>
              <line
                x1={M.left}
                x2={W - M.right}
                y1={y(v)}
                y2={y(v)}
                className={v === 0 ? "stroke-[color:var(--baseline)]" : "stroke-[color:var(--gridline)]"}
                strokeWidth="1"
              />
              <text
                x={M.left - 6}
                y={y(v) + 3}
                fontSize="9.5"
                textAnchor="end"
                className="tnum fill-[color:var(--text-muted)]"
              >
                {(v * 100).toFixed(0)}%
              </text>
            </g>
          ))}

          {/* The break, drawn as a boundary rather than as a data mark: what
              changed here is the method, not the violence. */}
          {collapseIdx >= 0 && (
            <line
              x1={M.left + (collapseIdx + 1) * step}
              x2={M.left + (collapseIdx + 1) * step}
              y1={M.top - 4}
              y2={M.top + innerH}
              className="stroke-[color:var(--baseline)]"
              strokeWidth="1"
            />
          )}
          {breakIdx >= 0 && (
            <g>
              <line
                x1={M.left + breakIdx * step}
                x2={M.left + breakIdx * step}
                y1={M.top - 4}
                y2={M.top + innerH}
                className="stroke-[color:var(--text-muted)]"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text
                x={M.left + breakIdx * step + 4}
                y={M.top + 6}
                fontSize="9.5"
                className="fill-[color:var(--text-secondary)]"
              >
                unbroken zeros from {breakYear}
              </text>
            </g>
          )}

          {rows.map((r, i) => (
            <g key={r.year}>
              {r.share > 0 && (
                <rect
                  x={M.left + i * step + (step - barW) / 2}
                  y={y(r.share)}
                  width={barW}
                  height={M.top + innerH - y(r.share)}
                  fill="var(--rung-2)"
                >
                  <title>{`${r.year}: ${r.unattributed} of ${r.total} fatalities unattributed (${(r.share * 100).toFixed(1)}%)`}</title>
                </rect>
              )}
              {i % 3 === 0 && (
                <text
                  x={M.left + i * step + step / 2}
                  y={H - 9}
                  fontSize="9.5"
                  textAnchor="middle"
                  className="tnum fill-[color:var(--text-muted)]"
                >
                  {`'${String(r.year).slice(2)}`}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="mt-2 text-[11px] leading-relaxed text-[color:var(--text-muted)]">
        Computed from the eighteen SATP state datasheets this site already holds — the same rows
        behind every LWE chart here. Bars are the &ldquo;Not Specified&rdquo; column as a share of
        all fatalities that year. The solid rule marks the end of the run in which the column was
        populated every year; the dashed rule marks the start of the unbroken run of zeros. The two are not the same
        year, and the gap between them is where the residual cases sit.
        {shape.residuals.length > 0 && (
          <>
            {" "}
            After {shape.lastConsecutiveYear} the column records{" "}
            {shape.residuals.map((r) => `${r.unattributed} in ${r.year}`).join(" and ")}, then
            nothing.
          </>
        )}
      </figcaption>
    </figure>
  );
}
