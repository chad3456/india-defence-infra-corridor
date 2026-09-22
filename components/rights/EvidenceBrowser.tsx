"use client";

import { useMemo, useState } from "react";

/**
 * The evidence, browsable rather than summarised.
 *
 * ── Why the list is the visual ───────────────────────────────────────────
 *
 * Every chart above this is a count of something, and a count is the one form
 * this subject is routinely misled by: the acquittal rate is a count, and it
 * is offered as a measurement of abuse that it cannot make. So the page ends
 * on the pieces themselves — headline, outlet, date, link — where a reader can
 * check any number above against the thing it was counted from.
 *
 * ── The two filters, and why they are not one ────────────────────────────
 *
 * Tier and provenance are separate controls because they answer separate
 * questions. Tier is what the piece is about: the law operating, a court
 * acquitting, somebody alleging misuse, a court finding a complaint false.
 * Provenance is how it earned its place in the register: its own headline said
 * so, or it sits in a bibliography that was vouched for. A reader who trusts
 * only the first kind can see exactly that subset, which is the point of
 * recording the difference at all.
 */

export interface Row {
  id: string;
  headline: string;
  outlet: string | null;
  published: string | null;
  url: string | null;
  facet: string;
  matchedOn?: "headline" | "bibliography";
  /** Where a judgment's court goes; absent for press citations. */
  court?: string | null;
  articles?: string[];
}

const PAGE = 40;

/** A URL a reader can read, rather than a hundred characters of query string. */
function label(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

export default function EvidenceBrowser({
  rows,
  facets,
  facetLabel,
  note,
}: {
  rows: Row[];
  facets: string[];
  facetLabel: Record<string, string>;
  note: string;
}) {
  const [facet, setFacet] = useState<string>("all");
  const [prov, setProv] = useState<"all" | "headline" | "bibliography">("all");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (facet !== "all" && r.facet !== facet) return false;
      if (prov !== "all" && r.matchedOn !== prov) return false;
      if (needle !== "" && !`${r.headline} ${r.outlet ?? ""} ${r.court ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, facet, prov, q]);

  const hasProvenance = rows.some((r) => r.matchedOn !== undefined);

  const chip = (active: boolean): string =>
    `story-card px-3 py-1.5 text-[12px] font-medium ${active ? "font-bold" : ""}`;
  const chipStyle = (active: boolean): React.CSSProperties => ({
    borderRadius: 999,
    background: active ? "var(--s-hot)" : undefined,
    color: active ? "var(--story-bg)" : undefined,
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => { setFacet("all"); setShown(PAGE); }}
          className={chip(facet === "all")} style={chipStyle(facet === "all")}>
          All {rows.length}
        </button>
        {facets.map((f) => (
          <button key={f} type="button" onClick={() => { setFacet(f); setShown(PAGE); }}
            className={chip(facet === f)} style={chipStyle(facet === f)}>
            {facetLabel[f] ?? f}
          </button>
        ))}
      </div>

      {hasProvenance && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--story-ink-3)" }}>
            how it qualified
          </span>
          {([["all", "either"], ["headline", "its own headline"], ["bibliography", "the bibliography it sits in"]] as const).map(
            ([k, lbl]) => (
              <button key={k} type="button" onClick={() => { setProv(k); setShown(PAGE); }}
                className={chip(prov === k)} style={chipStyle(prov === k)}>
                {lbl}
              </button>
            ),
          )}
        </div>
      )}

      <label className="mt-3 block">
        <span className="sr-only">Search the register</span>
        <input
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setShown(PAGE); }}
          placeholder="Search headlines, outlets, courts…"
          className="story-card w-full px-3.5 py-2 text-[13px]"
          style={{ borderRadius: 10 }}
        />
      </label>

      <p className="mt-3 text-[12px]" style={{ color: "var(--story-ink-2)" }}>
        {filtered.length === rows.length
          ? `${rows.length} pieces. ${note}`
          : `${filtered.length} of ${rows.length} pieces. ${note}`}
      </p>

      <ol className="mt-4">
        {filtered.slice(0, shown).map((r) => (
          <li key={r.id} className="border-b py-3 last:border-0" style={{ borderColor: "var(--story-rule)" }}>
            <p className="text-[13.5px] font-semibold leading-[1.45]">
              {r.url ? (
                <a href={r.url} target="_blank" rel="noopener noreferrer"
                  style={{ color: "var(--story-ink)", textDecoration: "underline", textUnderlineOffset: 2 }}>
                  {r.headline}
                </a>
              ) : r.headline}
            </p>
            <p className="mono mt-1 text-[10.5px]" style={{ color: "var(--story-ink-3)", overflowWrap: "anywhere" }}>
              {[
                r.outlet ?? r.court ?? null,
                r.published,
                facetLabel[r.facet] ?? r.facet,
                r.matchedOn === "bibliography" ? "cited in a case bibliography" : null,
                r.url ? label(r.url) : null,
              ].filter(Boolean).join("  ·  ")}
            </p>
          </li>
        ))}
      </ol>

      {shown < filtered.length && (
        <button type="button" onClick={() => setShown((s) => s + PAGE * 2)}
          className="story-card mt-4 px-4 py-2 text-[12.5px] font-semibold" style={{ borderRadius: 999 }}>
          Show more — {filtered.length - shown} left
        </button>
      )}
      {filtered.length === 0 && (
        <p className="py-6 text-[13px]" style={{ color: "var(--story-ink-2)" }}>
          Nothing in the register matches that. The register is what the collectors found, not
          everything that was published.
        </p>
      )}
    </div>
  );
}
