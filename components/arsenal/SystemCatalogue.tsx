"use client";

import { useMemo, useState } from "react";
import type { SystemEntry } from "@/lib/arsenal";

/**
 * The gazetteer, browsable by nation and type.
 *
 * This is a catalogue, not an order of battle, and the difference is the whole
 * reason the panel has no counts in it. Nobody publishes how many of each
 * system a country holds; what the open lists carry is *which* systems a
 * country is reported to field. Showing a count column with blanks in it would
 * invite the reader to fill them in, so there is no count column.
 */

const KINDS = ["all", "mixed", "ICBM", "SLBM", "cruise", "surface-to-air", "anti-ship", "hypersonic"];

export default function SystemCatalogue({
  groups,
}: {
  groups: Array<{ country: string; systems: SystemEntry[] }>;
}) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  /*
   * Collapsed by default.
   *
   * Opening the first country meant opening the United States, whose 489
   * systems pushed every other nation below the fold — the reader met a wall
   * of chips instead of the list of nations the panel exists to show.
   */
  const [open, setOpen] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groups
      .map((g) => ({
        country: g.country,
        systems: g.systems.filter((s) =>
          (kind === "all" || s.kind === kind) &&
          (!needle || s.name.toLowerCase().includes(needle) || g.country.toLowerCase().includes(needle))),
      }))
      .filter((g) => g.systems.length > 0);
  }, [groups, q, kind]);

  const total = shown.reduce((n, g) => n + g.systems.length, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Find a system or country</span>
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Agni, Tomahawk, Japan&hellip;" autoComplete="off"
            className="w-56 rounded border border-[color:var(--baseline)] bg-[var(--surface-1)] px-2.5 py-1.5 text-[13px]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Type</span>
          <select
            value={kind} onChange={(e) => setKind(e.target.value)}
            className="rounded border border-[color:var(--baseline)] bg-[var(--surface-1)] px-2 py-1.5 text-[13px]"
          >
            {KINDS.map((k) => <option key={k} value={k}>{k === "all" ? "All types" : k}</option>)}
          </select>
        </label>
        <p className="mono ml-auto text-[11.5px] text-[color:var(--text-muted)]">
          {total} systems · {shown.length} countries
        </p>
      </div>

      <ul className="divide-y overflow-hidden rounded-md border">
        {shown.map((g) => {
          const isOpen = open === g.country || q.trim().length > 0;
          return (
            <li key={g.country} className="bg-[var(--surface-1)]">
              <button
                type="button"
                onClick={() => setOpen(open === g.country ? null : g.country)}
                aria-expanded={isOpen}
                className="flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)]"
              >
                <span className="text-[14px] font-medium">{g.country}</span>
                <span className="mono text-[11.5px] text-[color:var(--text-muted)]">
                  {g.systems.length} listed
                </span>
              </button>
              {isOpen && (
                <ul className="flex flex-wrap gap-x-2 gap-y-1.5 border-t bg-[var(--surface-2)] px-4 py-3">
                  {g.systems.map((s) => (
                    <li
                      key={s.key}
                      className="rounded border border-[color:var(--gridline)] bg-[var(--surface-1)] px-2 py-0.5 text-[11.5px]"
                      title={`${s.kind} · listed in ${s.source.replace(/_/g, " ")}`}
                    >
                      {s.name}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {shown.length === 0 && (
        <p className="py-6 text-[13px] text-[color:var(--text-secondary)]">Nothing matches that.</p>
      )}
    </div>
  );
}
