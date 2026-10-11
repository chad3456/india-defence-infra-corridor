"use client";

import { useMemo, useState } from "react";
import HoverCard, { useHoverCard } from "@/components/charts/HoverCard";

/** A seat as the page receives it: candidates as [name, party, votes, evm?, postal?]. */
export interface CompactSeat {
  no: number;
  name: string;
  final: boolean;
  status?: string;
  url: string;
  c: Array<[string, string, number, number?, number?]>;
}
export interface CompactResult {
  folder: string;
  house: "AC" | "PC";
  label: string;
  date: string;
  expectedSeats?: number;
  partyTally?: Array<{ party: string; won: number }>;
  abbreviations: Record<string, string>;
  seats: CompactSeat[];
}

const NOTA = "None of the Above";
const SLOTS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];
const OTHER = "var(--color-ink-muted)";
const fmt = (n: number) => n.toLocaleString("en-IN");
const pct = (n: number) => `${n.toFixed(1)}%`;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function electionName(r: { house: "AC" | "PC"; date: string }): string {
  const [y, m] = r.date.split("-");
  return `${r.house === "PC" ? "Lok Sabha" : "Assembly"} ${MONTHS[Number(m) - 1] ?? ""} ${y}`.replace(/\s+/g, " ");
}

interface SeatView {
  seat: CompactSeat;
  winner: { name: string; party: string; votes: number };
  runner?: { name: string; party: string; votes: number };
  total: number;
  /** Winner's lead over the runner-up, as a share of all votes polled in the seat (derived). */
  marginPct: number;
}

function analyse(r: CompactResult) {
  const seats: SeatView[] = r.seats.map((seat) => {
    const real = seat.c.filter((c) => c[1] !== NOTA).sort((a, b) => b[2] - a[2]);
    const total = seat.c.reduce((a, c) => a + c[2], 0);
    const w = real[0]!, ru = real[1];
    return {
      seat,
      winner: { name: w[0], party: w[1], votes: w[2] },
      runner: ru ? { name: ru[0], party: ru[1], votes: ru[2] } : undefined,
      total,
      marginPct: total > 0 && ru ? ((w[2] - ru[2]) / total) * 100 : 100,
    };
  });
  const won = new Map<string, number>();
  const votes = new Map<string, number>();
  let allVotes = 0;
  for (const s of seats) {
    won.set(s.winner.party, (won.get(s.winner.party) ?? 0) + 1);
    for (const c of s.seat.c) { votes.set(c[1], (votes.get(c[1]) ?? 0) + c[2]); allVotes += c[2]; }
  }
  const parties = [...new Set([...won.keys(), ...votes.keys()])]
    .map((p) => ({ party: p, won: won.get(p) ?? 0, votes: votes.get(p) ?? 0, share: allVotes ? ((votes.get(p) ?? 0) / allVotes) * 100 : 0 }))
    .sort((a, b) => b.won - a.won || b.votes - a.votes);
  // Colours: the four parties with most seats (Independents and NOTA never take
  // a slot). BJP and INC keep the same hue wherever they place, so a reader
  // moving between states does not have to relearn them.
  const top = parties.filter((p) => p.won > 0 && p.party !== "Independent" && p.party !== NOTA).slice(0, 4).map((p) => p.party);
  const colour = new Map<string, string>();
  const fixed: Record<string, number> = { "Indian National Congress": 0, "Bharatiya Janata Party": 1 };
  const free = [0, 1, 2, 3].filter((i) => !top.some((p) => fixed[p] === i));
  for (const p of top) colour.set(p, fixed[p] !== undefined ? SLOTS[fixed[p]!]! : SLOTS[free.shift()!]!);
  return { seats, parties, allVotes, colour: (p: string) => colour.get(p) ?? OTHER, top };
}

export default function StateResults({ results, stateName }: { results: CompactResult[]; stateName: string }) {
  const houses = (["AC", "PC"] as const).filter((h) => results.some((r) => r.house === h));
  const [house, setHouse] = useState<"AC" | "PC">(houses[0] ?? "AC");
  const ofHouse = results.filter((r) => r.house === house).sort((a, b) => b.date.localeCompare(a.date));
  const [folder, setFolder] = useState<string | null>(null);
  const r = ofHouse.find((x) => x.folder === folder) ?? ofHouse[0];
  const [picked, setPicked] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"no" | "margin">("no");
  const [partyFilter, setPartyFilter] = useState<string | null>(null);
  const card = useHoverCard();

  const a = useMemo(() => (r ? analyse(r) : null), [r]);
  if (!r || !a) {
    return <p className="rounded-lg border border-gridline bg-surface-2 p-5 text-sm text-ink-2">No archived ECI results have been read for {stateName} yet.</p>;
  }
  const abbr = (p: string) => r.abbreviations[p] || (p === "Independent" ? "IND" : p === NOTA ? "NOTA" : p.length > 18 ? p.replace(/[^A-Za-z\s]/g, " ").split(/\s+/).filter((w) => w && !/^(of|and|the)$/i.test(w)).map((w) => w[0]).join("").toUpperCase() : p);
  const notFinal = a.seats.filter((s) => !s.seat.final).length;
  const leader = a.parties[0]!;
  const majority = r.expectedSeats ? Math.floor(r.expectedSeats / 2) + 1 : null;
  const pickedSeat = a.seats.find((s) => s.seat.no === picked);

  // ECI's own tally, compared seat for seat with what was read.
  const tallyCheck = r.partyTally ? r.partyTally.every((t) => (a.parties.find((p) => p.party === t.party)?.won ?? 0) === t.won) && r.seats.length === r.expectedSeats : null;

  const grid = [...a.seats].sort((x, y) => {
    const px = a.parties.findIndex((p) => p.party === x.winner.party), py = a.parties.findIndex((p) => p.party === y.winner.party);
    return px - py || x.seat.no - y.seat.no;
  });
  const cols = r.seats.length > 200 ? 25 : r.seats.length > 80 ? 20 : r.seats.length > 30 ? 12 : 8;
  const cell = 18, gap = 3;
  const gridW = cols * (cell + gap), gridH = Math.ceil(grid.length / cols) * (cell + gap);

  const rows = a.seats
    .filter((s) => (!partyFilter || s.winner.party === partyFilter) && (!query || `${s.seat.no} ${s.seat.name} ${s.winner.name} ${s.winner.party} ${s.runner?.name ?? ""}`.toLowerCase().includes(query.toLowerCase())))
    .sort((x, y) => (sort === "no" ? x.seat.no - y.seat.no : x.marginPct - y.marginPct));

  const shown = a.parties.filter((p) => p.won > 0 || p.share >= 1).slice(0, 12);
  const maxShare = Math.max(...shown.map((p) => Math.max(p.share, (p.won / r.seats.length) * 100)));

  const BINS = [[0, 1, "under 1 pt"], [1, 5, "1–5"], [5, 10, "5–10"], [10, 20, "10–20"], [20, 101, "20+"]] as const;
  const bins = BINS.map(([lo, hi, label]) => {
    const inBin = a.seats.filter((s) => s.marginPct >= lo && s.marginPct < hi);
    const byParty = new Map<string, number>();
    for (const s of inBin) byParty.set(s.winner.party, (byParty.get(s.winner.party) ?? 0) + 1);
    return { label, n: inBin.length, byParty: [...byParty.entries()].sort((x, y) => a.parties.findIndex((p) => p.party === x[0]) - a.parties.findIndex((p) => p.party === y[0])) };
  });
  const maxBin = Math.max(...bins.map((b) => b.n));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3">
        <div role="tablist" aria-label="House" className="flex gap-1">
          {houses.map((h) => (
            <button key={h} role="tab" aria-selected={house === h} onClick={() => { setHouse(h); setFolder(null); setPicked(null); setPartyFilter(null); }}
              className={`rounded-full border px-3 py-1 text-xs ${house === h ? "border-ink bg-ink text-[color:var(--surface-1)]" : "border-gridline text-ink-2 hover:text-ink"}`}>
              {h === "AC" ? "Assembly" : "Lok Sabha"}
            </button>
          ))}
        </div>
        {ofHouse.length > 1 && (
          <select value={r.folder} onChange={(e) => { setFolder(e.target.value); setPicked(null); }} className="rounded border border-gridline bg-surface-1 px-2 py-1 text-sm text-ink">
            {ofHouse.map((x) => <option key={x.folder} value={x.folder}>{electionName(x)}</option>)}
          </select>
        )}
        <p className="text-xs text-ink-muted">ECI: &ldquo;{r.label}&rdquo;</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Seats read" value={`${r.seats.length}${r.expectedSeats ? ` / ${r.expectedSeats}` : ""}`} note={r.expectedSeats ? (r.seats.length < r.expectedSeats ? `${r.expectedSeats - r.seats.length} not in the archive` : "every seat in the house") : "house size not on the archived pages"} />
        <Kpi label="Largest party" value={`${abbr(leader.party)} ${leader.won}`} note={majority ? `majority is ${majority}` : leader.party} colour={a.colour(leader.party)} />
        <Kpi label="Votes counted" value={fmt(a.allVotes)} note="sum over seats read, NOTA included" />
        {(() => {
          const c = a.seats.filter((s) => s.runner).reduce((m, s) => (s.marginPct < m.marginPct ? s : m), a.seats[0]!);
          return <Kpi label="Closest seat" value={c.runner ? `${fmt(c.winner.votes - c.runner.votes)} votes` : "—"} note={`${c.seat.name}, ${c.marginPct.toFixed(2)} pts`} />;
        })()}
      </div>

      {(notFinal > 0 || tallyCheck !== null) && (
        <div className="space-y-1 text-xs text-ink-2">
          {tallyCheck === true && <p>✓ Seat for seat, this matches ECI&rsquo;s own party-wise tally for the state.</p>}
          {tallyCheck === false && <p>△ This does not exactly match ECI&rsquo;s party-wise tally page; see the comparison below the party chart.</p>}
          {notFinal > 0 && <p>△ {notFinal} seat{notFinal > 1 ? "s were" : " was"} archived only mid-count; {notFinal > 1 ? "their" : "its"} figures are a lead, not a result, and {notFinal > 1 ? "are" : "is"} marked in the table.</p>}
        </div>
      )}

      <section>
        <h3 className="text-sm font-semibold text-ink">Every seat, by winning party</h3>
        <p className="mt-1 text-xs text-ink-2">One square per constituency. Hover for the result; click to open it.</p>
        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${gridW} ${gridH}`} width={gridW} className="max-w-full" role="img" aria-label={`${r.seats.length} seats coloured by winning party`}>
            {grid.map((s, i) => (
              <rect key={s.seat.no} x={(i % cols) * (cell + gap)} y={Math.floor(i / cols) * (cell + gap)} width={cell} height={cell} rx={3}
                fill={a.colour(s.winner.party)} opacity={s.seat.final ? 1 : 0.45}
                stroke={picked === s.seat.no ? "var(--color-ink)" : "none"} strokeWidth={2} className="cursor-pointer"
                onClick={() => setPicked(s.seat.no)}
                onMouseMove={(e) => card.show(e, {
                  title: `${s.seat.no}. ${s.seat.name}`,
                  subtitle: `${s.winner.name} (${abbr(s.winner.party)})`,
                  rows: s.total === 0 ? [{ label: "Result", value: "returned unopposed", colour: a.colour(s.winner.party) }] : [
                    { label: "Votes", value: `${fmt(s.winner.votes)} · ${pct((s.winner.votes / s.total) * 100)}`, colour: a.colour(s.winner.party) },
                    ...(s.runner ? [{ label: `Runner-up (${abbr(s.runner.party)})`, value: fmt(s.runner.votes), colour: a.colour(s.runner.party) }] : []),
                    { label: "Margin", value: s.runner ? `${fmt(s.winner.votes - s.runner.votes)} · ${s.marginPct.toFixed(1)} pts` : "uncontested" },
                  ],
                  note: s.seat.final ? undefined : `Archived mid-count (${s.seat.status}).`,
                })}
                onMouseLeave={card.hide} />
            ))}
          </svg>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-ink-2">
          {a.top.map((p) => (
            <button key={p} onClick={() => setPartyFilter(partyFilter === p ? null : p)} className={`inline-flex items-center gap-1 ${partyFilter && partyFilter !== p ? "opacity-50" : ""}`}>
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: a.colour(p) }} />{abbr(p)} {a.parties.find((x) => x.party === p)?.won}
            </button>
          ))}
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: OTHER }} />Other parties and independents</span>
        </div>
      </section>

      {pickedSeat && <SeatDetail s={pickedSeat} abbr={abbr} colour={a.colour} onClose={() => setPicked(null)} />}

      <section>
        <h3 className="text-sm font-semibold text-ink">Seats won against votes won</h3>
        <p className="mt-1 text-xs text-ink-2">
          Seat share is of seats read; vote share is of every vote counted in them, NOTA included. Both are computed here from ECI&rsquo;s seat figures (derived).
          First-past-the-post turns small vote leads into large seat leads, and this is where to see it.
        </p>
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-ink-muted"><span className="mr-1 inline-block h-2.5 w-4 rounded-sm bg-[color:var(--color-ink-2)] align-middle" />seat share <span className="ml-3 mr-1 inline-block h-2 w-4 rounded-sm border border-[color:var(--color-ink-2)] align-middle" />vote share</p>
          {shown.map((p) => {
            const seatShare = (p.won / r.seats.length) * 100;
            return (
              <div key={p.party} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[7rem_minmax(0,1fr)]"
                onMouseMove={(e) => card.show(e, { title: p.party, rows: [{ label: "Seats", value: `${p.won} (${pct(seatShare)})`, colour: a.colour(p.party) }, { label: "Votes", value: `${fmt(p.votes)} (${pct(p.share)})` }] })} onMouseLeave={card.hide}>
                <span className="truncate text-right text-xs text-ink-2" title={p.party}>{abbr(p.party)}</span>
                <div className="min-w-0">
                  <div className="h-3 rounded-sm" style={{ width: `${Math.max(0.4, (seatShare / maxShare) * 100)}%`, background: a.colour(p.party) }} />
                  <div className="mt-0.5 h-2 rounded-sm border-[1.5px]" style={{ width: `${Math.max(0.4, (p.share / maxShare) * 100)}%`, borderColor: a.colour(p.party) }} />
                  <p className="mt-0.5 text-[11px] tabular-nums text-ink-2">{p.won} seat{p.won === 1 ? "" : "s"} ({pct(seatShare)}) · {pct(p.share)} of votes</p>
                </div>
              </div>
            );
          })}
        </div>
        {tallyCheck === false && r.partyTally && (
          <table className="mt-3 text-xs">
            <thead><tr className="text-ink-muted"><th className="pr-4 text-left font-normal">Party</th><th className="pr-4 text-right font-normal">ECI tally</th><th className="text-right font-normal">Read here</th></tr></thead>
            <tbody>{r.partyTally.map((t) => <tr key={t.party}><td className="pr-4">{t.party}</td><td className="pr-4 text-right tabular-nums">{t.won}</td><td className="text-right tabular-nums">{a.parties.find((p) => p.party === t.party)?.won ?? 0}</td></tr>)}</tbody>
          </table>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-ink">How close the seats were</h3>
        <p className="mt-1 text-xs text-ink-2">Winner&rsquo;s lead over the runner-up, in percentage points of the votes cast in the seat (derived).</p>
        <svg viewBox="0 0 360 190" className="mt-3 w-full max-w-[520px]" role="img" aria-label="Seats by winning margin">
          {bins.map((b, i) => {
            const x = 8 + i * 70, h = (b.n / (maxBin || 1)) * 140;
            let y = 160;
            return (
              <g key={b.label}>
                {b.byParty.map(([party, n]) => {
                  const hh = (n / (maxBin || 1)) * 140;
                  y -= hh;
                  return <rect key={party} x={x} y={y} width={60} height={hh} fill={a.colour(party)} stroke="var(--surface-1)" strokeWidth={0.5}
                    onMouseMove={(e) => card.show(e, { title: `Margin ${b.label}`, rows: [{ label: party, value: `${n} seats`, colour: a.colour(party) }, { label: "All parties", value: `${b.n} seats` }] })} onMouseLeave={card.hide} />;
                })}
                <text x={x + 30} y={160 - h - 5} textAnchor="middle" fontSize="11" fill="var(--color-ink)">{b.n}</text>
                <text x={x + 30} y={178} textAnchor="middle" fontSize="11" fill="var(--color-ink-2)">{b.label}</text>
              </g>
            );
          })}
        </svg>
      </section>

      <section>
        <div className="flex flex-wrap items-end gap-3">
          <h3 className="text-sm font-semibold text-ink">All {r.seats.length} seats</h3>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search seat, candidate or party" aria-label="Search seats"
            className="ml-auto w-full rounded border border-gridline bg-surface-1 px-2 py-1 text-sm text-ink sm:w-64" />
          <select value={sort} onChange={(e) => setSort(e.target.value as "no" | "margin")} aria-label="Sort" className="rounded border border-gridline bg-surface-1 px-2 py-1 text-sm text-ink">
            <option value="no">By seat number</option>
            <option value="margin">Closest first</option>
          </select>
          {partyFilter && <button onClick={() => setPartyFilter(null)} className="text-xs underline">Clear party filter ({abbr(partyFilter)})</button>}
        </div>
        <div className="mt-3 max-h-[480px] overflow-auto rounded border border-gridline">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-[11px] uppercase tracking-wide text-ink-muted">
              <tr><th className="px-2 py-1 text-left">#</th><th className="px-2 py-1 text-left">Seat</th><th className="px-2 py-1 text-left">Winner</th><th className="hidden px-2 py-1 text-left sm:table-cell">Runner-up</th><th className="px-2 py-1 text-right">Margin</th></tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.seat.no} onClick={() => setPicked(s.seat.no)} className={`cursor-pointer border-t border-gridline hover:bg-surface-2 ${picked === s.seat.no ? "bg-surface-2" : ""}`}>
                  <td className="px-2 py-1 tabular-nums text-ink-muted">{s.seat.no}</td>
                  <td className="px-2 py-1 text-ink">{s.seat.name}{!s.seat.final && <span className="ml-1 text-[10px] text-ink-muted">(mid-count)</span>}</td>
                  <td className="px-2 py-1"><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: a.colour(s.winner.party) }} /><span className="text-ink">{s.winner.name}</span> <span className="text-ink-muted">{abbr(s.winner.party)}</span></td>
                  <td className="hidden px-2 py-1 text-ink-2 sm:table-cell">{s.runner ? `${s.runner.name} (${abbr(s.runner.party)})` : "—"}</td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums text-ink">{s.runner ? fmt(s.winner.votes - s.runner.votes) : s.total === 0 ? "unopposed" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <HoverCard hover={card.hover} />
    </div>
  );
}

function Kpi({ label, value, note, colour }: { label: string; value: string; note?: string; colour?: string }) {
  return (
    <div className="rounded-lg border border-gridline bg-surface-1 p-3">
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-xl font-semibold tabular-nums text-ink">
        {colour && <span className="inline-block h-3 w-3 rounded-sm" style={{ background: colour }} />}{value}
      </p>
      {note && <p className="mt-0.5 truncate text-[11px] text-ink-2">{note}</p>}
    </div>
  );
}

function SeatDetail({ s, abbr, colour, onClose }: { s: SeatView; abbr: (p: string) => string; colour: (p: string) => string; onClose: () => void }) {
  const cands = [...s.seat.c].sort((a, b) => b[2] - a[2]);
  const max = cands[0]?.[2] ?? 1;
  const postal = cands.reduce((a, c) => a + (c[4] ?? 0), 0);
  return (
    <section className="rounded-lg border border-gridline bg-surface-1 p-4" aria-live="polite">
      <div className="flex items-start gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Constituency {s.seat.no}</p>
          <h3 className="text-lg font-semibold text-ink">{s.seat.name}</h3>
          <p className="text-xs text-ink-2">
            {s.total === 0 ? "Returned unopposed: no poll was held" : `${fmt(s.total)} votes counted${postal ? `, ${fmt(postal)} of them postal` : ""}`} · {s.seat.final ? "count complete" : `archived mid-count (${s.seat.status})`}
          </p>
        </div>
        <button onClick={onClose} className="ml-auto text-xs underline">Close</button>
      </div>
      <ol className="mt-3 space-y-1.5">
        {cands.map((c, i) => (
          <li key={`${c[0]}-${i}`} className="grid grid-cols-1 gap-0.5 sm:grid-cols-[16rem_minmax(0,1fr)] sm:items-center sm:gap-3">
            <span className="truncate text-xs text-ink"><strong className={i === 0 ? "" : "font-normal"}>{c[0]}</strong> <span className="text-ink-muted">{abbr(c[1])}</span></span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-3 shrink-0 rounded-sm" style={{ width: `${Math.max(0.5, (c[2] / max) * 70)}%`, background: c[1] === "None of the Above" ? "var(--gridline)" : colour(c[1]), opacity: i === 0 ? 1 : 0.75 }} />
              <span className="whitespace-nowrap text-[11px] tabular-nums text-ink-2">{fmt(c[2])} · {s.total ? ((c[2] / s.total) * 100).toFixed(1) : "—"}%{c[4] != null ? ` · ${fmt(c[4])} postal` : ""}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-ink-muted">
        Read from <a href={s.seat.url} className="underline" target="_blank" rel="noopener noreferrer">ECI&rsquo;s result page as archived</a> on{" "}
        {`${s.seat.url.match(/\/web\/(\d{4})(\d{2})(\d{2})/)?.slice(1).reverse().join("/") ?? ""}`}. ECI notes these pages are as filled in by Returning Officers; the final record is Form-20.
      </p>
    </section>
  );
}
