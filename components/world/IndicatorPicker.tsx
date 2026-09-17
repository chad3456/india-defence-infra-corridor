"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PickerRow } from "@/lib/owid-shared";

/**
 * A search box over a thousand indicators.
 *
 * ── Why this is a client component and the map is not ────────────────────
 *
 * The map is one indicator rendered as SVG and belongs on the server, where it
 * costs the reader nothing. The picker is the opposite: filtering a thousand
 * rows as somebody types is the one thing here that genuinely needs to happen
 * in the browser, and round-tripping each keystroke to the server to redraw a
 * list would be slower and ruder.
 *
 * What crosses the wire is `PickerRow` — slug, title, category, unit and
 * whether it can be mapped — and not the registry, which carries descriptions
 * and citations for a thousand indicators and would be a megabyte of payload
 * to populate a dropdown.
 *
 * ── The unit is in the list on purpose ───────────────────────────────────
 *
 * OWID carries several indicators whose titles are near-identical and whose
 * units are not: an absolute count, a per-capita rate and a share of GDP may
 * all be called the same thing in a chart title. In a list of a thousand, the
 * unit is frequently the only thing distinguishing two adjacent rows, so it is
 * part of the row rather than something the reader discovers after clicking.
 */
export default function IndicatorPicker({
  rows, selected, mapOnly = false,
}: {
  rows: PickerRow[];
  selected?: string;
  /** When the caller is a map, an unmappable indicator is a dead end. */
  mapOnly?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (mapOnly && !r.map) continue;
      counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [rows, mapOnly]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const out = rows.filter((r) => {
      if (mapOnly && !r.map) return false;
      if (category && r.category !== category) return false;
      if (terms.length === 0) return true;
      // Every term must appear somewhere in the row. Matching ANY term turns a
      // two-word search into a broader result than a one-word search, which is
      // the opposite of what typing more is for.
      const subject = `${r.title} ${r.slug} ${r.category} ${r.unit}`.toLowerCase();
      return terms.every((t) => subject.includes(t));
    });
    return out;
  }, [rows, query, category, mapOnly]);

  const shown = matches.slice(0, 160);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${rows.length.toLocaleString("en-US")} indicators — trade, missiles, shipping, energy…`}
          className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-[13px]"
          style={{
            borderColor: "var(--story-rule)",
            background: "var(--story-card)",
            color: "var(--story-ink)",
          }}
          aria-label="Search indicators"
        />
        <span className="mono text-[11px]" style={{ color: "var(--story-ink-3)" }}>
          {matches.length.toLocaleString("en-US")} match{matches.length === 1 ? "" : "es"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategory("")}
          className="rounded-full border px-2.5 py-1 text-[11px]"
          style={{
            borderColor: category === "" ? "var(--s-hot)" : "var(--story-rule)",
            color: category === "" ? "var(--s-hot)" : "var(--story-ink-2)",
            fontWeight: category === "" ? 700 : 400,
          }}
        >
          all
        </button>
        {categories.map(([name, n]) => (
          <button
            key={name}
            type="button"
            onClick={() => setCategory(category === name ? "" : name)}
            className="rounded-full border px-2.5 py-1 text-[11px]"
            style={{
              borderColor: category === name ? "var(--s-hot)" : "var(--story-rule)",
              color: category === name ? "var(--s-hot)" : "var(--story-ink-2)",
              fontWeight: category === name ? 700 : 400,
            }}
          >
            {name} <span style={{ opacity: 0.6 }}>{n}</span>
          </button>
        ))}
      </div>

      <ul className="mt-4 m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-0 p-0 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((r) => (
          <li key={r.slug} className="min-w-0 border-b" style={{ borderColor: "var(--story-rule)" }}>
            <Link
              href={`/world?i=${encodeURIComponent(r.slug)}`}
              className="block py-2"
              style={{ color: r.slug === selected ? "var(--s-hot)" : "var(--story-ink)" }}
            >
              <span className="block truncate text-[12.5px]"
                style={{ fontWeight: r.slug === selected ? 700 : 500 }}>
                {r.title}
              </span>
              <span className="mono block truncate text-[10px]" style={{ color: "var(--story-ink-3)" }}>
                {r.unit || "no unit stated"}
                {!r.map && " · series only"}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {matches.length > shown.length && (
        <p className="mt-4 text-[12px]" style={{ color: "var(--story-ink-3)" }}>
          Showing {shown.length} of {matches.length.toLocaleString("en-US")}. Narrow the search to
          see the rest — the list is capped rather than paginated, because a reader scrolling past
          a hundred and sixty indicators wants a better search, not a page two.
        </p>
      )}
      {matches.length === 0 && (
        <p className="mt-4 text-[12.5px]" style={{ color: "var(--story-ink-2)" }}>
          Nothing matches. Every indicator here comes from Our World in Data&rsquo;s own chart
          list, so a subject absent from it is absent here — that is a fact about the index rather
          than about the world.
        </p>
      )}
    </div>
  );
}
