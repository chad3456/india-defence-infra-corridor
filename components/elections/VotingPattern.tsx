"use client";

import HoverCard, { useHoverCard } from "@/components/charts/HoverCard";
import { median, rankOf, voteShares, type SeatPattern, type StatePattern } from "@/lib/elections-pattern";
import type { CompactResult, ElectorateMedians, SeatElectorate } from "./StateResults";
import type { DistrictProfile } from "@/lib/elections-census-shared";

const pct = (n: number, d = 1) => `${n.toFixed(d)}%`;
const fmt = (n: number) => n.toLocaleString("en-IN");

interface Ctx { colour: (p: string) => string; abbr: (p: string) => string; onPick: (no: number) => void }

/**
 * How the state voted, read across all its seats: how big the winners'
 * shares were, how many-sided the contests were, who fought whom, NOTA and
 * postal votes, and the same parties' standing in the other house's election.
 */
export function PatternSection({ r, other, pattern, ctx, otherLabel }: { r: CompactResult; other?: CompactResult; pattern: StatePattern; ctx: Ctx; otherLabel?: string }) {
  const card = useHoverCard();
  const p = pattern;
  const n = p.contested.length;

  // Winner's share in 5-point bins, each bin stacked by winning party.
  const BIN = 5;
  const bins = Array.from({ length: 20 }, (_, i) => ({ lo: i * BIN, seats: p.contested.filter((s) => s.winnerShare >= i * BIN && s.winnerShare < (i + 1) * BIN + (i === 19 ? 0.01 : 0)) }))
    .filter((b) => b.lo >= 15);
  const maxBin = Math.max(1, ...bins.map((b) => b.seats.length));

  const EFF = [[1, 1.75, "under 1.75"], [1.75, 2.25, "1.75–2.25"], [2.25, 2.75, "2.25–2.75"], [2.75, 3.5, "2.75–3.5"], [3.5, 99, "3.5+"]] as const;
  const eff = EFF.map(([lo, hi, label]) => ({ label, seats: p.contested.filter((s) => s.effective >= lo && s.effective < hi).length }));
  const maxEff = Math.max(1, ...eff.map((e) => e.seats));

  // The same parties' vote share in this house and the other one (derived).
  const here = voteShares(r.seats), there = other ? voteShares(other.seats) : null;
  const compare = there ? [...new Set([...p.parties.slice(0, 6).map((x) => x.party), ...[...there].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k)])]
    .filter((k) => k !== "None of the Above").map((k) => ({ party: k, here: here.get(k) ?? 0, there: there.get(k) ?? 0 })).sort((a, b) => b.here - a.here).slice(0, 8) : [];
  const maxCmp = Math.max(1, ...compare.map((c) => Math.max(c.here, c.there)));
  const topNota = [...p.contested].sort((a, b) => b.notaShare - a.notaShare).slice(0, 5);

  return (
    <section className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold text-ink">How the state voted</h3>
        <p className="mt-1 text-xs text-ink-2">Measures computed here from every seat&rsquo;s votes as ECI printed them (derived). Medians are across the {n} contested seats.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile value={pct(p.medianWinnerShare)} label="median winner's share" note={`${p.majorityWins} of ${n} won with over half the votes`} />
        <Tile value={pct(p.medianMargin)} label="median winning margin" note="lead over the runner-up, in points" />
        <Tile value={p.medianEffective.toFixed(2)} label="median effective candidates" note="2.0 is a clean two-way contest" />
        <Tile value={pct(p.medianNota, 2)} label="median NOTA" note={p.maxNota ? `highest: ${p.maxNota.name}, ${pct(p.maxNota.notaShare, 2)}` : ""} />
        <Tile value={String(p.medianCandidates)} label="median candidates per seat" note={`${Math.min(...p.contested.map((s) => s.candidates))} to ${Math.max(...p.contested.map((s) => s.candidates))}`} />
        {p.postalShare != null && <Tile value={pct(p.postalShare, 2)} label="of votes were postal" note="service voters, staff on duty, home voting" />}
        {p.reserved.marked && <Tile value={`${p.reserved.SC} SC · ${p.reserved.ST} ST`} label="reserved seats" note="as marked on ECI's pages" />}
        {p.seats.length > n && <Tile value={String(p.seats.length - n)} label="returned unopposed" note="no poll held" />}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">How much of the vote winners took</h4>
          <p className="mt-1 text-xs text-ink-2">Seats by the winner&rsquo;s share, in 5-point bands, stacked by winning party. Right of the line is an outright majority.</p>
          <svg viewBox="0 0 360 170" className="mt-2 w-full" role="img" aria-label="Seats by winner's vote share">
            {bins.map((b, i) => {
              const x = 6 + i * (348 / bins.length), w = 348 / bins.length - 2;
              const byParty = new Map<string, number>();
              for (const s of b.seats) byParty.set(s.winnerParty, (byParty.get(s.winnerParty) ?? 0) + 1);
              let y = 140;
              return (
                <g key={b.lo}>
                  {[...byParty].map(([party, k]) => {
                    const h = (k / maxBin) * 125; y -= h;
                    return <rect key={party} x={x} y={y} width={w} height={h} fill={ctx.colour(party)} stroke="var(--surface-1)" strokeWidth={0.5}
                      onMouseMove={(e) => card.show(e, { title: `Winner took ${b.lo}–${b.lo + BIN}%`, rows: [{ label: ctx.abbr(party), value: `${k} seat${k === 1 ? "" : "s"}`, colour: ctx.colour(party) }, { label: "All parties", value: `${b.seats.length}` }] })}
                      onMouseLeave={card.hide} />;
                  })}
                  {b.lo % 10 === 0 && <text x={x} y={156} fontSize="9" fill="var(--color-ink-muted)">{b.lo}%</text>}
                </g>
              );
            })}
            {(() => { const i = bins.findIndex((b) => b.lo === 50); const x = 6 + i * (348 / bins.length) - 1; return i >= 0 ? <line x1={x} x2={x} y1={8} y2={142} stroke="var(--color-ink)" strokeDasharray="3 3" /> : null; })()}
          </svg>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">How many-sided the contests were</h4>
          <p className="mt-1 text-xs text-ink-2">Effective number of candidates, 1 ÷ Σ(vote share²): near 2 is a straight fight, above 3 a scattered field.</p>
          <div className="mt-3 space-y-1.5">
            {eff.map((e) => (
              <div key={e.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 text-xs">
                <span className="text-right text-ink-2">{e.label}</span>
                <span className="flex items-center gap-2"><span className="h-3 rounded-sm bg-[color:var(--seq-400)]" style={{ width: `${(e.seats / maxEff) * 80}%` }} /><span className="tabular-nums text-ink">{e.seats}</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Each party&rsquo;s seats</h4>
          <table className="mt-2 w-full text-sm">
            <thead className="text-[11px] text-ink-muted"><tr><th className="py-1 text-left font-normal">Party</th><th className="py-1 text-right font-normal">Won</th><th className="py-1 text-right font-normal">Outright</th><th className="py-1 text-right font-normal">Median share where won</th><th className="py-1 text-right font-normal">Second</th></tr></thead>
            <tbody>
              {p.parties.slice(0, 10).map((x) => (
                <tr key={x.party} className="border-t border-gridline">
                  <td className="py-1"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: ctx.colour(x.party) }} /><span title={x.party}>{ctx.abbr(x.party)}</span></td>
                  <td className="py-1 text-right tabular-nums">{x.won}</td>
                  <td className="py-1 text-right tabular-nums">{x.outright}</td>
                  <td className="py-1 text-right tabular-nums">{pct(x.medianShareWon)}</td>
                  <td className="py-1 text-right tabular-nums text-ink-2">{x.second}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-ink-muted">Outright: won with more than half the votes. Second: seats where the party was runner-up.</p>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Who fought whom</h4>
          <p className="mt-1 text-xs text-ink-2">The pairings of winner and runner-up that recur most.</p>
          <div className="mt-2 space-y-1.5">
            {p.rivalries.map((x) => (
              <div key={`${x.a}|${x.b}`} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-2 text-xs">
                <span className="truncate text-right text-ink-2"><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: ctx.colour(x.a) }} />{ctx.abbr(x.a)} v <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: ctx.colour(x.b) }} />{ctx.abbr(x.b)}</span>
                <span className="flex items-center gap-2"><span className="h-3 rounded-sm bg-[color:var(--color-ink-2)]" style={{ width: `${(x.seats / (p.rivalries[0]?.seats || 1)) * 80}%` }} /><span className="tabular-nums text-ink">{x.seats}</span></span>
              </div>
            ))}
          </div>
          <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-muted">Where NOTA was highest</h4>
          <ol className="mt-2 space-y-1 text-xs">
            {topNota.map((s) => (
              <li key={s.no}><button onClick={() => ctx.onPick(s.no)} className="flex w-full justify-between gap-2 text-left hover:underline"><span className="truncate text-ink">{s.no}. {s.name}</span><span className="tabular-nums text-ink-2">{pct(s.notaShare, 2)}</span></button></li>
            ))}
          </ol>
        </div>
      </div>

      {compare.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">The same parties in the other election</h4>
          <p className="mt-1 text-xs text-ink-2">Vote share in this state at this election (solid) and at {otherLabel} (outline). Different years and different seats, so a shift mixes change of mind with change of contest (derived).</p>
          <div className="mt-3 space-y-2">
            {compare.map((c) => (
              <div key={c.party} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[7rem_minmax(0,1fr)]">
                <span className="truncate text-right text-xs text-ink-2" title={c.party}>{ctx.abbr(c.party)}</span>
                <div className="min-w-0">
                  <div className="h-3 rounded-sm" style={{ width: `${Math.max(0.4, (c.here / maxCmp) * 100)}%`, background: ctx.colour(c.party) }} />
                  <div className="mt-0.5 h-2 rounded-sm border-[1.5px]" style={{ width: `${Math.max(0.4, (c.there / maxCmp) * 100)}%`, borderColor: ctx.colour(c.party) }} />
                  <p className="mt-0.5 text-[11px] tabular-nums text-ink-2">{pct(c.here)} here · {pct(c.there)} at {otherLabel} · {c.here - c.there >= 0 ? "+" : ""}{(c.here - c.there).toFixed(1)} pts</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <HoverCard hover={card.hover} />
    </section>
  );
}

/** One seat against the rest of its state. */
export function SeatProfile({ seat, pattern }: { seat: SeatPattern; pattern: StatePattern }) {
  const all = pattern.contested;
  if (seat.uncontested) return null;
  const rows: Array<[string, string, string]> = [
    ["Winner's share", pct(seat.winnerShare), `state median ${pct(pattern.medianWinnerShare)} · ${ordinal(rankOf(seat.winnerShare, all.map((s) => s.winnerShare)))} highest of ${all.length}`],
    ["Winning margin", `${seat.marginPct.toFixed(2)} pts`, `median ${pct(pattern.medianMargin)} · ${ordinal(all.length - rankOf(seat.marginPct, all.map((s) => s.marginPct)) + 1)} closest`],
    ["Effective candidates", seat.effective.toFixed(2), `median ${pattern.medianEffective.toFixed(2)}`],
    ["Candidates", String(seat.candidates), `median ${pattern.medianCandidates}`],
    ["NOTA", pct(seat.notaShare, 2), `median ${pct(pattern.medianNota, 2)} · ${ordinal(rankOf(seat.notaShare, all.map((s) => s.notaShare)))} highest`],
    ...(seat.postalShare != null ? [["Postal votes", pct(seat.postalShare, 2), `state ${pct(pattern.postalShare ?? 0, 2)}`] as [string, string, string]] : []),
    ...(seat.reserved ? [["Reserved for", seat.reserved === "SC" ? "Scheduled Castes" : "Scheduled Tribes", "as marked on ECI's page"] as [string, string, string]] : []),
  ];
  return (
    <dl className="mt-4 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
      {rows.map(([k, v, note]) => (
        <div key={k} className="flex items-baseline gap-2 border-b border-gridline pb-1">
          <dt className="w-32 shrink-0 text-ink-2">{k}</dt>
          <dd className="min-w-0"><span className="font-medium tabular-nums text-ink">{v}</span> <span className="text-ink-muted">· {note}</span></dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The seat's electorate, from ECI's 2024 Lok Sabha statistical report: who is
 * on the roll by gender, overseas and service electors, and how many voted on
 * EVMs. An assembly seat is compared with the state's other segments.
 */
export function SeatElectorateView({ el, medians }: { el: SeatElectorate; medians: ElectorateMedians | null }) {
  const turnout = (el.polledEvm / el.electors) * 100;
  const per1000 = (el.f / el.m) * 1000;
  const gen = el.m + el.f + el.tg;
  return (
    <div className="mt-5">
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">The electorate · 2024 Lok Sabha roll{el.pc ? ` · ${el.pc} seat` : ""}</p>
      <div className="mt-2 flex h-4 overflow-hidden rounded-sm" role="img" aria-label={`${fmt(el.m)} men, ${fmt(el.f)} women, ${fmt(el.tg)} third gender electors`}>
        <span style={{ width: `${(el.m / gen) * 100}%`, background: "var(--seq-550)" }} />
        <span style={{ width: `${(el.f / gen) * 100}%`, background: "var(--seq-250)" }} />
        <span style={{ width: `${Math.max(0.3, (el.tg / gen) * 100)}%`, background: "var(--color-ink-muted)" }} />
      </div>
      <p className="mt-1 text-[11px] text-ink-2">
        <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[color:var(--seq-550)]" />{fmt(el.m)} men ·{" "}
        <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[color:var(--seq-250)]" />{fmt(el.f)} women ·{" "}
        <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[color:var(--color-ink-muted)]" />{fmt(el.tg)} third gender
      </p>
      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
        {([
          ["Electors", fmt(el.electors), medians ? `state median ${fmt(Math.round(medians.electors))}` : "general, overseas and service"],
          ["Women per 1,000 men", per1000.toFixed(0), medians ? `state median ${medians.womenPer1000.toFixed(0)} (derived)` : "on the roll (derived)"],
          ["Voted on EVMs", `${pct(turnout)}`, medians ? `state median ${pct(medians.turnout)}; postal ballots not included (derived)` : "postal ballots not included (derived)"],
          ["Overseas electors", fmt(el.nri), "registered NRIs"],
          ["Service electors", fmt(el.service), "armed forces and others posted away"],
        ] as Array<[string, string, string]>).map(([k, v, note]) => (
          <div key={k} className="flex items-baseline gap-2 border-b border-gridline pb-1">
            <dt className="w-32 shrink-0 text-ink-2">{k}</dt>
            <dd className="min-w-0"><span className="font-medium tabular-nums text-ink">{v}</span> <span className="text-ink-muted">· {note}</span></dd>
          </div>
        ))}
      </dl>
      <p className="mt-1.5 text-[11px] text-ink-muted">
        ECI, General Election 2024, statistical report 15 (assembly segment wise electors).
        {el.match === "spelling" ? " Matched to this seat by a near-identical spelling of its name." : el.match === "order" ? " Matched to this seat by its position among its Lok Sabha seat's segments, which ECI lists in constituency order." : ""}
        {medians ? " The roll is the 2024 one; the assembly election shown may be from another year." : ""}
      </p>
    </div>
  );
}

/**
 * The census profile of the district a constituency lies in. ECI records no
 * religion or caste, so this is the only official count there is: the 2011
 * Census, by district. It describes the district, not the constituency.
 */
export function DistrictCensus({ d }: { d: DistrictProfile }) {
  const shades = ["var(--seq-700)", "var(--seq-550)", "var(--seq-400)", "var(--seq-250)", "var(--seq-100)"];
  const ranked = [...d.religion].sort((a, b) => b[1] - a[1]);
  const shown = ranked.filter(([, v]) => v >= 1).slice(0, 4);
  const rest = 100 - shown.reduce((a, [, v]) => a + v, 0);
  const segs: Array<[string, number]> = rest > 0.05 ? [...shown, ["All others", rest]] : shown;
  return (
    <div className="mt-5">
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">The district · {d.district} · Census 2011</p>
      <div className="mt-2 flex h-4 overflow-hidden rounded-sm" role="img" aria-label={`Religion in ${d.district} district, Census 2011`}>
        {segs.map(([k, v], i) => <span key={k} title={`${k}: ${v.toFixed(1)}%`} style={{ width: `${v}%`, background: shades[i] }} />)}
      </div>
      <p className="mt-1 text-[11px] text-ink-2">
        {segs.map(([k, v], i) => <span key={k}>{i > 0 && " · "}<span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: shades[i] }} />{k} {v.toFixed(1)}%</span>)}
      </p>
      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
        {([
          ["Population", fmt(d.population), "2011"],
          ["Scheduled Castes", pct(d.sc), "of the district's population"],
          ["Scheduled Tribes", pct(d.st), "of the district's population"],
          ["Women per 1,000 men", String(d.sexRatio), "whole population, not only electors (derived)"],
          ["Literate", pct(d.literacy), `of all ages, under-7s included, so below the official literacy rate; women ${pct(d.femaleLiteracy)} (derived)`],
        ] as Array<[string, string, string]>).map(([k, v, note]) => (
          <div key={k} className="flex items-baseline gap-2 border-b border-gridline pb-1">
            <dt className="w-32 shrink-0 text-ink-2">{k}</dt>
            <dd className="min-w-0"><span className="font-medium tabular-nums text-ink">{v}</span> <span className="text-ink-muted">· {note}</span></dd>
          </div>
        ))}
      </dl>
      <p className="mt-1.5 text-[11px] text-ink-muted">
        District figures, not this constituency&rsquo;s: the Election Commission records no one&rsquo;s religion or caste, and the census
        publishes religion by district, not by constituency. Scheduled Castes and Tribes are the only castes the census counts.
        Census of India 2011, the last census taken.
      </p>
    </div>
  );
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

function Tile({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="rounded-lg border border-gridline bg-surface-1 p-3">
      <p className="text-lg font-semibold tabular-nums text-ink">{value}</p>
      <p className="text-[11px] text-ink">{label}</p>
      {note && <p className="mt-0.5 truncate text-[11px] text-ink-muted" title={note}>{note}</p>}
    </div>
  );
}

export { median, fmt };
