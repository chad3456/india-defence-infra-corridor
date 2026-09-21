"use client";

import { useMemo, useState } from "react";
import type { SindoorEntry, Claimant } from "@/lib/warroom-shared";
import { CLAIMANT_LABEL, CLAIMANT_TONE } from "@/lib/warroom-shared";

/**
 * The interactive part: pick a day, filter by who is speaking, read the
 * statements with their citations.
 *
 * ── Why filtering by claimant is the first control, not the last ─────────
 *
 * This is a record of two incompatible accounts of the same week. The most
 * useful thing a reader can do with it is look at one side's version, then the
 * other's, and see where they diverge — which a single merged scroll makes
 * almost impossible. So the claimant filter sits at the top and the four tiers
 * are always visible with their counts, including the one that is three
 * quarters of the record.
 *
 * ── The tier that needs the loudest label ────────────────────────────────
 *
 * Most sentences in an encyclopedia article assert rather than attribute, so
 * most entries here name no source inside the sentence. Those read as settled
 * fact and are not — they are statements whose origin the article placed in a
 * footnote rather than in the text. They keep their own tier, their own
 * colour is deliberately not one of the two national ones, and the control
 * says what they are rather than calling them "other".
 */
/**
 * What to show for a citation: its publisher, else its title, else its host.
 *
 * Never the full URL. A bare link is unreadable, unbreakable and — on a phone —
 * wider than the screen, and the host alone tells a reader who carried it,
 * which is the only thing the label is for.
 */
function label(c: { publisher: string | null; title: string | null; url: string | null }): string {
  if (c.publisher) return c.publisher;
  if (c.title) return c.title.length > 70 ? `${c.title.slice(0, 68)}…` : c.title;
  if (!c.url) return "cited, no link";
  try { return new URL(c.url).hostname.replace(/^www\./, ""); } catch { return "cited"; }
}

export default function Timeline({ entries }: { entries: SindoorEntry[] }) {
  const [claimants, setClaimants] = useState<Set<Claimant>>(
    new Set<Claimant>(["India", "Pakistan", "third-party", "unattributed"]),
  );
  /**
   * Opens on the day the record says most about, not on all of it.
   *
   * Showing every statement by default made the page thirty-two thousand
   * pixels tall — two hundred cards a reader has to scroll past before
   * reaching anything else, which is not a timeline so much as a transcript.
   * The busiest day is derived from the entries rather than named here, so the
   * page opens where the sources concentrate and would move if they did.
   */
  const busiestDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.date, (m.get(e.date) ?? 0) + 1);
    return [...m].sort((a, b) => (b[1] - a[1]) || b[0].localeCompare(a[0]))[0]?.[0] ?? null;
  }, [entries]);
  const [day, setDay] = useState<string | null>(busiestDay);

  const counts = useMemo(() => {
    const c: Record<Claimant, number> = { India: 0, Pakistan: 0, "third-party": 0, unattributed: 0 };
    for (const e of entries) c[e.claimant]++;
    return c;
  }, [entries]);

  const days = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) if (claimants.has(e.claimant)) m.set(e.date, (m.get(e.date) ?? 0) + 1);
    return [...m].map(([date, n]) => ({ date, n })).sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, claimants]);

  const shown = useMemo(
    () => entries
      .filter((e) => claimants.has(e.claimant) && (day === null || e.date === day))
      .sort((a, b) => (a.date === b.date ? 0 : a.date.localeCompare(b.date))),
    [entries, claimants, day],
  );

  const maxDay = Math.max(1, ...days.map((d) => d.n));

  const toggle = (c: Claimant): void => {
    const next = new Set(claimants);
    if (next.has(c)) next.delete(c); else next.add(c);
    // Never leave every tier off: an empty timeline reads as no data rather
    // than as a filter nobody meant to apply.
    if (next.size > 0) setClaimants(next);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {(["India", "Pakistan", "third-party", "unattributed"] as Claimant[]).map((c) => {
          const on = claimants.has(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggle(c)}
              aria-pressed={on}
              className="rounded-full border px-3 py-1.5 text-left text-[11.5px] leading-tight"
              style={{
                borderColor: on ? `var(--s-${CLAIMANT_TONE[c]})` : "var(--story-rule)",
                color: on ? `var(--s-${CLAIMANT_TONE[c]})` : "var(--story-ink-3)",
                fontWeight: on ? 700 : 400,
              }}
            >
              {CLAIMANT_LABEL[c]}{" "}
              <span className="mono" style={{ opacity: 0.75 }}>{counts[c]}</span>
            </button>
          );
        })}
      </div>

      {/*
        The day rail. Height is the number of statements recorded for that day,
        which is a measure of how much was WRITTEN about it and not of how much
        happened — a distinction the caption under this has to carry, because
        the shape reads like intensity.
      */}
      <div className="-mx-1 mt-5 w-full min-w-0 max-w-full overflow-x-auto px-1 pb-1">
        <div className="flex items-end gap-[3px]" style={{ minWidth: days.length * 13 }}>
          {days.map((d) => {
            const on = day === d.date;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setDay(on ? null : d.date)}
                title={`${d.date} — ${d.n} statement${d.n === 1 ? "" : "s"}`}
                aria-label={`${d.date}, ${d.n} statements`}
                aria-pressed={on}
                className="group relative flex w-[10px] shrink-0 flex-col justify-end"
                style={{ height: 76 }}
              >
                <span
                  className="block w-full"
                  style={{
                    height: `${Math.max(6, (d.n / maxDay) * 100)}%`,
                    background: on ? "var(--s-hot)" : "var(--s-mid)",
                    opacity: on ? 1 : 0.55,
                    borderRadius: "2px 2px 0 0",
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <p className="mono mt-2 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>
        {days.length} days carry a statement. Bar height is how many statements the record holds
        for that day — how much was written, not how much happened.
        {day !== null ? (
          <>
            {" "}Showing <span style={{ color: "var(--s-hot)" }}>{day}</span> only — the day the
            record says most about.{" "}
            <button type="button" onClick={() => setDay(null)} className="underline">
              show every day
            </button>
          </>
        ) : (
          <>{" "}Showing every day. Click a bar to narrow to one.</>
        )}
      </p>

      <ol className="mt-6 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0">
        {shown.slice(0, 60).map((e, i) => (
          <li
            key={`${e.date}-${i}`}
            className="story-card min-w-0 p-4"
            data-tone={CLAIMANT_TONE[e.claimant]}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="mono text-[11.5px] font-bold" style={{ color: `var(--s-${CLAIMANT_TONE[e.claimant]})` }}>
                {e.date}
              </span>
              {e.yearInferred && (
                <span className="mono text-[10px]" style={{ color: "var(--story-ink-3)" }}>
                  year inferred
                </span>
              )}
              <span className="mono text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--story-ink-3)" }}>
                {e.claimant === "unattributed" ? "no source named" : e.claimant}
                {e.claimantCue ? ` · ${e.claimantCue}` : ""}
              </span>
              <span className="mono text-[10px]" style={{ color: "var(--story-ink-3)" }}>
                {e.section}
              </span>
            </div>
            <p className="mt-2 text-[13.5px] leading-[1.6]">{e.text}</p>
            {e.citations.length > 0 ? (
              /*
               * `break-words` because a citation without a publisher falls back
               * to its own URL, and a URL is one unbreakable token. Three of
               * them on a phone pushed the document 183 pixels wide — and not
               * from inside a scroll container, so nothing on the page looked
               * wrong except that it scrolled sideways.
               */
              <p className="mt-2 break-words text-[11px] leading-[1.5]"
                style={{ color: "var(--story-ink-3)", overflowWrap: "anywhere" }}>
                {e.citations.map((c, j) => (
                  <span key={j}>
                    {j > 0 && " · "}
                    {c.url
                      ? <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline">
                        {label(c)}
                      </a>
                      : label(c)}
                  </span>
                ))}
              </p>
            ) : (
              <p className="mono mt-2 text-[10.5px]" style={{ color: "var(--s-hot)" }}>
                no citation inside this sentence
              </p>
            )}
          </li>
        ))}
      </ol>
      {shown.length > 60 && (
        <p className="mono mt-3 text-[11px]" style={{ color: "var(--story-ink-3)" }}>
          Showing 60 of {shown.length}. Narrow by day or by source above — the list is capped
          rather than paginated, because a reader scrolling past sixty statements wants a filter,
          not another page.
        </p>
      )}
      {shown.length === 0 && (
        <p className="mt-4 text-[13px]" style={{ color: "var(--story-ink-2)" }}>
          Nothing recorded for that day from the sources selected.
        </p>
      )}
    </div>
  );
}
