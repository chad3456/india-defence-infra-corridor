/**
 * Voting patterns, computed from ECI's seat pages. Pure functions with no node
 * imports: the state page's client components call them on whichever election
 * the reader has selected.
 *
 * Every measure here is derived from the candidates' votes as ECI printed
 * them, and the page says so. Nothing is modelled or estimated: a seat's
 * fragmentation is arithmetic on its own vote shares, and a state's figure is
 * the median of its seats'.
 */

const NOTA = "None of the Above";

/** A candidate as the state page carries it: [name, party, votes, evm?, postal?]. */
export type CandidateTuple = [string, string, number, number?, number?];

export interface SeatPattern {
  no: number;
  name: string;
  /** "SC" or "ST" where ECI's page marks the seat as reserved; null where it does not say. */
  reserved: "SC" | "ST" | null;
  candidates: number;
  winnerParty: string;
  winnerShare: number;
  runnerParty: string | null;
  marginPct: number;
  /** Laakso–Taagepera effective number of candidates: 1 / Σ share². 2.0 is a clean two-way fight. */
  effective: number;
  notaShare: number;
  /** Postal votes as a share of all votes, where the page splits EVM and postal. */
  postalShare: number | null;
  totalVotes: number;
  uncontested: boolean;
}

export function seatPattern(no: number, name: string, c: CandidateTuple[]): SeatPattern {
  const total = c.reduce((a, x) => a + x[2], 0);
  const real = c.filter((x) => x[1] !== NOTA).sort((a, b) => b[2] - a[2]);
  const w = real[0], ru = real[1];
  const nota = c.find((x) => x[1] === NOTA)?.[2] ?? 0;
  const hasPostal = c.some((x) => x[4] != null);
  const postal = c.reduce((a, x) => a + (x[4] ?? 0), 0);
  const realTotal = real.reduce((a, x) => a + x[2], 0);
  const m = /\((SC|ST)\)\s*$/i.exec(name);
  return {
    no, name,
    reserved: m ? (m[1]!.toUpperCase() as "SC" | "ST") : null,
    candidates: real.length,
    winnerParty: w?.[1] ?? "",
    winnerShare: total ? ((w?.[2] ?? 0) / total) * 100 : 100,
    runnerParty: ru?.[1] ?? null,
    marginPct: total && ru ? (((w?.[2] ?? 0) - ru[2]) / total) * 100 : 100,
    effective: realTotal ? 1 / real.reduce((a, x) => a + (x[2] / realTotal) ** 2, 0) : 1,
    notaShare: total ? (nota / total) * 100 : 0,
    postalShare: hasPostal && total ? (postal / total) * 100 : null,
    totalVotes: total,
    uncontested: total === 0,
  };
}

export const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b), mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/** Where a value sits among a state's seats: 1 = highest. */
export function rankOf(value: number, all: number[]): number {
  return all.filter((v) => v > value).length + 1;
}

export interface StatePattern {
  seats: SeatPattern[];
  contested: SeatPattern[];
  medianWinnerShare: number;
  /** Seats won with more than half the votes cast. */
  majorityWins: number;
  medianMargin: number;
  medianEffective: number;
  medianNota: number;
  maxNota: SeatPattern | null;
  medianCandidates: number;
  postalShare: number | null;
  reserved: { SC: number; ST: number; marked: boolean };
  /** For each party that won a seat: seats, seats won outright, its median share where it won, and where it came second. */
  parties: Array<{ party: string; won: number; outright: number; medianShareWon: number; second: number }>;
  /** The contest that recurs most: winner party vs runner-up party, in either order. */
  rivalries: Array<{ a: string; b: string; seats: number }>;
}

export function statePattern(seats: SeatPattern[]): StatePattern {
  const contested = seats.filter((s) => !s.uncontested);
  const byParty = new Map<string, SeatPattern[]>();
  for (const s of contested) byParty.set(s.winnerParty, [...(byParty.get(s.winnerParty) ?? []), s]);
  const second = new Map<string, number>();
  for (const s of contested) if (s.runnerParty) second.set(s.runnerParty, (second.get(s.runnerParty) ?? 0) + 1);
  const pairs = new Map<string, { a: string; b: string; seats: number }>();
  for (const s of contested) {
    if (!s.runnerParty) continue;
    const [a, b] = [s.winnerParty, s.runnerParty].sort();
    const k = `${a}|${b}`;
    pairs.set(k, { a: a!, b: b!, seats: (pairs.get(k)?.seats ?? 0) + 1 });
  }
  const postal = contested.filter((s) => s.postalShare != null);
  const postalVotes = postal.reduce((a, s) => a + (s.postalShare! * s.totalVotes) / 100, 0);
  const postalTotal = postal.reduce((a, s) => a + s.totalVotes, 0);
  return {
    seats, contested,
    medianWinnerShare: median(contested.map((s) => s.winnerShare)),
    majorityWins: contested.filter((s) => s.winnerShare > 50).length,
    medianMargin: median(contested.map((s) => s.marginPct)),
    medianEffective: median(contested.map((s) => s.effective)),
    medianNota: median(contested.map((s) => s.notaShare)),
    maxNota: contested.reduce<SeatPattern | null>((m, s) => (!m || s.notaShare > m.notaShare ? s : m), null),
    medianCandidates: median(contested.map((s) => s.candidates)),
    postalShare: postalTotal ? (postalVotes / postalTotal) * 100 : null,
    reserved: { SC: seats.filter((s) => s.reserved === "SC").length, ST: seats.filter((s) => s.reserved === "ST").length, marked: seats.some((s) => s.reserved) },
    parties: [...byParty].map(([party, ss]) => ({ party, won: ss.length, outright: ss.filter((s) => s.winnerShare > 50).length, medianShareWon: median(ss.map((s) => s.winnerShare)), second: second.get(party) ?? 0 }))
      .sort((a, b) => b.won - a.won),
    rivalries: [...pairs.values()].sort((a, b) => b.seats - a.seats).slice(0, 6),
  };
}

/** Vote share by party across a set of seats, NOTA included in the denominator. */
export function voteShares(seats: Array<{ c: CandidateTuple[] }>): Map<string, number> {
  const v = new Map<string, number>();
  let all = 0;
  for (const s of seats) for (const c of s.c) { v.set(c[1], (v.get(c[1]) ?? 0) + c[2]); all += c[2]; }
  return new Map([...v].map(([p, n]) => [p, all ? (n / all) * 100 : 0]));
}
