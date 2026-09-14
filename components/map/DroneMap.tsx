"use client";

import { useMemo, useState } from "react";

/**
 * Who flies what, on a world map.
 *
 * ── Why this component receives paths rather than a topology ─────────────
 *
 * Projecting the world on the client would mean shipping world-atlas, d3-geo
 * and topojson-client to every reader — a couple of hundred kilobytes of
 * library to draw a picture that never changes. The page projects once on the
 * server and hands down finished `d` strings, so the only JavaScript here is
 * the interaction itself.
 *
 * The countries nobody flies these types from are a single merged path drawn
 * by the parent. Only the seventy that do get their own node, which is what
 * makes hover cheap.
 *
 * ── What the colour means, and what it hides ─────────────────────────────
 *
 * A country's leading supplier — the origin of most of the types it operates.
 * A single-colour map can say nothing else, and the thing it most easily hides
 * is a fleet bought from three different countries. So a tie is painted as
 * "mixed" rather than resolved, mixed is achromatic rather than an eighth hue,
 * and the panel states the split as a fraction the moment anyone asks.
 */

export interface MapCountry {
  country: string;
  d: string;
  /** Leading supplier, or "mixed". */
  supplier: string;
  colour: string;
  of: number;
  total: number;
  types: string[];
  origins: string[];
}

export default function DroneMap({
  base, countries, width, height, legend,
}: {
  /** Every non-operator country, as one path. Context, not data. */
  base: string;
  countries: MapCountry[];
  width: number;
  height: number;
  legend: Array<{ origin: string; colour: string; operators: number }>;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const byName = useMemo(
    () => new Map(countries.map((c) => [c.country, c])),
    [countries],
  );
  const shown = picked ?? hover;
  const detail = shown ? byName.get(shown) : undefined;

  return (
    <div>
      {/* ── Legend ────────────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {legend.map((l) => (
          <span key={l.origin} className="flex items-center gap-1.5 text-[12px]">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ background: l.colour }}
            />
            {l.origin}
            <span className="mono text-[10.5px] text-[color:var(--text-muted)]">{l.operators}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[12px]">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-[2px]"
            style={{ background: "var(--text-muted)" }}
          />
          Mixed — no single supplier leads
        </span>
      </div>

      <div className="relative overflow-hidden rounded-lg border bg-[var(--surface-1)]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block w-full"
          role="img"
          aria-label="World map: countries recorded as operating at least one of the drone types listed below, shaded by the supplier most of their types come from."
        >
          {/* The rest of the world, so the operators have somewhere to sit. */}
          <path d={base} fill="var(--surface-2)" stroke="var(--gridline)" strokeWidth={0.4} />
          {countries.map((c) => {
            const on = shown === c.country;
            const dim = shown !== null && !on;
            return (
              <path
                key={c.country}
                d={c.d}
                fill={c.colour}
                stroke="var(--surface-1)"
                strokeWidth={0.4}
                opacity={dim ? 0.45 : 1}
                style={{ cursor: "pointer", transition: "opacity .14s" }}
                onPointerEnter={() => setHover(c.country)}
                onPointerLeave={() => setHover(null)}
                onClick={() => setPicked((p) => (p === c.country ? null : c.country))}
              >
                <title>{`${c.country} — ${c.types.length} type${c.types.length === 1 ? "" : "s"}`}</title>
              </path>
            );
          })}
        </svg>

        {detail && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2 sm:inset-x-auto sm:right-2">
            <div className="glass pointer-events-auto max-w-[22rem] rounded-lg p-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13.5px] font-semibold leading-tight">{detail.country}</p>
                <span
                  className="shrink-0 rounded-[3px] px-1.5 py-px text-[10px] uppercase tracking-[0.06em]"
                  style={{ background: detail.colour, color: "var(--surface-1)" }}
                >
                  {detail.supplier}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] leading-[1.5] text-[color:var(--text-secondary)]">
                {detail.supplier === "mixed"
                  ? `No single supplier leads: ${detail.total} type${detail.total === 1 ? "" : "s"} across ${detail.origins.length} producers.`
                  : `${detail.of} of ${detail.total} type${detail.total === 1 ? "" : "s"} from ${detail.supplier}.`}
              </p>
              <ul className="mono mt-2 m-0 list-none space-y-0.5 p-0 text-[11px] leading-[1.45]">
                {detail.types.map((t) => (
                  <li key={t} className="text-[color:var(--text-secondary)]">{t}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Keyboard and small-screen route to the same panel. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="eyebrow" htmlFor="drone-country">Country</label>
        <select
          id="drone-country"
          value={picked ?? ""}
          onChange={(e) => setPicked(e.target.value || null)}
          className="glass rounded-md px-2 py-1 text-[12.5px]"
        >
          <option value="">— choose one —</option>
          {[...countries].sort((a, b) => a.country.localeCompare(b.country)).map((c) => (
            <option key={c.country} value={c.country}>
              {c.country} ({c.types.length})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
