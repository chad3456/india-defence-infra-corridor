"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import HoverCard, { useHoverCard } from "@/components/charts/HoverCard";
import { monthLabel, partyColours, type PartyRow, type ResultSummary } from "@/lib/elections-atlas-shared";

const fmt = (n: number) => n.toLocaleString("en-IN");
const pct = (n: number) => `${n.toFixed(1)}%`;

/* ── The section's own tab strip ─────────────────────────────────────── */

export const ELECTION_TABS = [
  { href: "/elections", label: "Overview" },
  { href: "/elections/atlas", label: "Atlas" },
  { href: "/elections/lok-sabha-2024", label: "Lok Sabha 2024" },
  { href: "/elections/assemblies", label: "Assemblies" },
  { href: "/elections/electorate", label: "Electorate" },
  { href: "/elections/sir", label: "SIR" },
  { href: "/elections/turnout", label: "Turnout" },
];

export function ElectionsTabs() {
  const pathname = usePathname() ?? "";
  // The longest tab that prefixes the path wins, so a state page lights "Atlas".
  const active = [...ELECTION_TABS].sort((a, b) => b.href.length - a.href.length)
    .find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.href;
  return (
    <div className="border-b border-[color:var(--hairline)] bg-[var(--surface-1)]">
      <nav aria-label="Elections" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 [scrollbar-width:none]">
        {ELECTION_TABS.map((t) => {
          const on = active === t.href;
          return (
            <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-[13px] transition-colors ${on ? "border-[color:var(--color-ink)] font-medium text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/* ── Parliament hemicycle ────────────────────────────────────────────── */

/**
 * One dot per seat, arranged in concentric arcs and filled left to right in
 * party order, the way a chamber is drawn. Rows hold seats in proportion to
 * their radius so the dots are evenly spaced.
 */
export function Hemicycle({ parties, total, label }: { parties: PartyRow[]; total: number; label: string }) {
  const card = useHoverCard();
  const colour = partyColours(parties.map((p) => p.party));
  const rows = total > 400 ? 12 : total > 200 ? 9 : total > 80 ? 6 : 4;
  const R = 200, r0 = 70;
  const radii = Array.from({ length: rows }, (_, i) => r0 + ((R - r0) * i) / (rows - 1));
  const sumR = radii.reduce((a, b) => a + b, 0);
  let counts = radii.map((r) => Math.round((total * r) / sumR));
  counts[counts.length - 1]! += total - counts.reduce((a, b) => a + b, 0);
  counts = counts.map((c) => Math.max(c, 1));
  const pos: Array<{ x: number; y: number; a: number }> = [];
  radii.forEach((r, i) => {
    const n = counts[i]!;
    for (let k = 0; k < n; k++) {
      const a = Math.PI - (n === 1 ? Math.PI / 2 : (Math.PI * k) / (n - 1));
      // Rounded, so the server and the browser print identical coordinates.
      pos.push({ x: Math.round((220 + r * Math.cos(a)) * 100) / 100, y: Math.round((215 - r * Math.sin(a)) * 100) / 100, a });
    }
  });
  pos.sort((p, q) => q.a - p.a);
  const seats: string[] = parties.flatMap((p) => Array.from({ length: p.won }, () => p.party));
  const dot = Math.min(7.5, ((Math.PI * R) / (counts[counts.length - 1] ?? 1)) * 0.42);
  const majority = Math.floor(total / 2) + 1;
  return (
    <div>
      <svg viewBox="0 0 440 230" className="w-full max-w-[560px]" role="img" aria-label={label}>
        {pos.slice(0, seats.length).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={dot} fill={colour(seats[i]!)}
            onMouseMove={(e) => { const pr = parties.find((x) => x.party === seats[i]); if (pr) card.show(e, { title: pr.party, rows: [{ label: "Seats", value: `${pr.won} of ${total}`, colour: colour(pr.party) }, { label: "Votes", value: `${fmt(pr.votes)} · ${pct(pr.share)}` }] }); }}
            onMouseLeave={card.hide} />
        ))}
        <line x1={220} y1={215 - R - 12} x2={220} y2={215 - r0 + 18} stroke="var(--color-ink-muted)" strokeDasharray="2 3" />
        <text x={220} y={228} textAnchor="middle" fontSize="12" fill="var(--color-ink)" className="tabular-nums">{total} seats · majority {majority}</text>
      </svg>
      <HoverCard hover={card.hover} />
    </div>
  );
}

/* ── Seats against votes ─────────────────────────────────────────────── */

export function SeatsVotes({ parties, total, limit = 12 }: { parties: PartyRow[]; total: number; limit?: number }) {
  const card = useHoverCard();
  const colour = partyColours(parties.map((p) => p.party));
  const shown = parties.slice(0, limit);
  const max = Math.max(...shown.map((p) => Math.max(p.share, (p.won / total) * 100)), 1);
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-ink-muted">
        <span className="mr-1 inline-block h-2.5 w-4 rounded-sm bg-[color:var(--color-ink-2)] align-middle" />seat share
        <span className="ml-3 mr-1 inline-block h-2 w-4 rounded-sm border border-[color:var(--color-ink-2)] align-middle" />vote share
      </p>
      {shown.map((p) => {
        const s = (p.won / total) * 100;
        return (
          <div key={p.party} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[7rem_minmax(0,1fr)]"
            onMouseMove={(e) => card.show(e, { title: p.party, rows: [{ label: "Seats", value: `${p.won} (${pct(s)})`, colour: colour(p.party) }, { label: "Votes", value: `${fmt(p.votes)} (${pct(p.share)})` }] })}
            onMouseLeave={card.hide}>
            <span className="truncate text-right text-xs text-ink-2" title={p.party}>{p.abbr}</span>
            <div className="min-w-0">
              <div className="h-3 rounded-sm" style={{ width: `${Math.max(0.4, (s / max) * 100)}%`, background: colour(p.party) }} />
              <div className="mt-0.5 h-2 rounded-sm border-[1.5px]" style={{ width: `${Math.max(0.4, (p.share / max) * 100)}%`, borderColor: colour(p.party) }} />
              <p className="mt-0.5 text-[11px] tabular-nums text-ink-2">{p.won} seat{p.won === 1 ? "" : "s"} ({pct(s)}) · {pct(p.share)} of votes</p>
            </div>
          </div>
        );
      })}
      <HoverCard hover={card.hover} />
    </div>
  );
}

/* ── One strip per house ─────────────────────────────────────────────── */

/**
 * Each state's house as a single bar split by party, with a tick at the
 * majority mark. Colours are ranked within each state (BJP and Congress
 * fixed), so the legend is the label printed on each strip, not a key.
 */
export function HouseStrips({ results }: { results: ResultSummary[] }) {
  const card = useHoverCard();
  return (
    <div>
    <ol className="space-y-3">
      {results.map((r) => {
        const house = r.expectedSeats ?? r.seatsRead;
        const colour = partyColours(r.parties.map((p) => p.party));
        const winners = r.parties.filter((p) => p.won > 0);
        const lead = winners[0];
        const missing = house - r.seatsRead;
        return (
          <li key={`${r.folder}-${r.state}`} className="grid grid-cols-1 gap-1 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center sm:gap-3">
            <Link href={`/elections/atlas/${r.slug}`} className="min-w-0 hover:underline">
              <span className="block truncate text-sm text-ink">{r.stateName}</span>
              <span className="block text-[11px] text-ink-muted">{monthLabel(r.date)} · {house} seats{r.tallyMatches ? " · ✓ ECI tally" : ""}</span>
            </Link>
            <div className="min-w-0">
              <div className="relative flex h-5 overflow-hidden rounded-sm bg-[var(--surface-2)]">
                {winners.map((p) => (
                  <span key={p.party} className="h-full border-r border-[color:var(--surface-1)]" style={{ width: `${(p.won / house) * 100}%`, background: colour(p.party) }}
                    onMouseMove={(e) => card.show(e, { title: `${r.stateName}: ${p.party}`, subtitle: monthLabel(r.date), rows: [{ label: "Seats", value: `${p.won} of ${house}`, colour: colour(p.party) }, { label: "Votes", value: pct(p.share) }] })}
                    onMouseLeave={card.hide} />
                ))}
                {missing > 0 && <span className="h-full" style={{ width: `${(missing / house) * 100}%`, backgroundImage: "repeating-linear-gradient(135deg, var(--surface-2) 0 3px, var(--color-ink-muted) 3px 4.5px)" }} title={`${missing} seats not in the archive`} />}
                <span className="absolute inset-y-0 w-px bg-[color:var(--color-ink)]" style={{ left: "50%" }} aria-hidden />
              </div>
              <p className="mt-0.5 truncate text-[11px] text-ink-2">
                {winners.slice(0, 4).map((p, i) => (
                  <span key={p.party}>{i > 0 && " · "}<span className="mr-0.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: colour(p.party) }} />{p.abbr} {p.won}</span>
                ))}
                {winners.length > 4 && ` · others ${winners.slice(4).reduce((a, p) => a + p.won, 0)}`}
                {missing > 0 && ` · ${missing} not archived`}
                {lead && lead.won > house / 2 ? "" : " · no single-party majority"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
    <HoverCard hover={card.hover} />
    </div>
  );
}
