/**
 * Aggregates over the seat-by-seat results, for the election dashboards.
 * Server-only. Every figure here is computed from ECI's seat pages as read by
 * the results connector: seats won are counted winners, vote shares are sums
 * of candidates' votes over the seats read, NOTA included. Derived, and the
 * pages that show them say so.
 */
import { ATLAS_STATES, loadResultsForState, mainElection, type PartyRow, type ResultSummary, type StateResult } from "./elections-atlas";

const NOTA = "None of the Above";

function abbreviations(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const st of ATLAS_STATES) for (const r of loadResultsForState(st.eci)) Object.assign(out, (r as StateResult & { abbreviations?: Record<string, string> }).abbreviations ?? {});
  return out;
}

export function shortParty(p: string, abbr: Record<string, string>): string {
  if (abbr[p]) return abbr[p]!;
  if (p === "Independent") return "IND";
  if (p === NOTA) return "NOTA";
  if (p.length <= 18) return p;
  const initials = p.replace(/[^A-Za-z\s]/g, " ").split(/\s+/).filter((w) => w && !/^(of|and|the)$/i.test(w)).map((w) => w[0]).join("").toUpperCase();
  return initials || `${p.slice(0, 14)}…`;
}

export function summarise(r: StateResult, abbr: Record<string, string>): ResultSummary {
  const st = ATLAS_STATES.find((s) => s.eci === r.state)!;
  const won = new Map<string, number>(), votes = new Map<string, number>();
  let all = 0;
  const margins: ResultSummary["closestTen"] = [];
  for (const s of r.seats) {
    const ranked = s.candidates.filter((c) => c.party !== NOTA).sort((a, b) => b.votes - a.votes);
    const w = ranked[0];
    if (!w) continue;
    won.set(w.party, (won.get(w.party) ?? 0) + 1);
    const total = s.candidates.reduce((a, c) => a + c.votes, 0);
    for (const c of s.candidates) { votes.set(c.party, (votes.get(c.party) ?? 0) + c.votes); all += c.votes; }
    const ru = ranked[1];
    if (ru && total > 0) {
      const margin = w.votes - ru.votes;
      margins.push({ no: s.no, name: s.name, winner: w.name, party: w.party, margin, marginPct: (margin / total) * 100 });
    }
  }
  const parties: PartyRow[] = [...new Set([...won.keys(), ...votes.keys()])]
    .map((p) => ({ party: p, abbr: shortParty(p, abbr), won: won.get(p) ?? 0, votes: votes.get(p) ?? 0, share: all ? ((votes.get(p) ?? 0) / all) * 100 : 0 }))
    .sort((a, b) => b.won - a.won || b.votes - a.votes);
  const tallyMatches = r.partyTally
    ? r.partyTally.every((t) => (won.get(t.party) ?? 0) === t.won) && r.seats.length === r.expectedSeats
    : null;
  return {
    folder: r.folder, house: r.house, state: r.state, slug: st.slug, stateName: st.name, date: r.date,
    seatsRead: r.seats.length, expectedSeats: r.expectedSeats, votes: all, parties, tallyMatches,
    closest: margins.sort((a, b) => a.margin - b.margin)[0] ?? null, closestTen: margins.slice(0, 10),
    notFinal: r.seats.filter((s) => (s.status ?? "").startsWith("not final")).length,
    hindi: r.seats.filter((s) => s.language === "hi").length,
  };
}

/** The latest Assembly election read for every state, and Lok Sabha 2024 per state. */
export function allSummaries(): { assemblies: ResultSummary[]; lokSabha: ResultSummary[]; abbr: Record<string, string> } {
  const abbr = abbreviations();
  const assemblies: ResultSummary[] = [], lokSabha: ResultSummary[] = [];
  for (const st of ATLAS_STATES) {
    const rs = loadResultsForState(st.eci);
    const ac = mainElection(rs.filter((r) => r.house === "AC")), pc = mainElection(rs.filter((r) => r.house === "PC"));
    if (ac) assemblies.push(summarise(ac, abbr));
    if (pc) lokSabha.push(summarise(pc, abbr));
  }
  return { assemblies, lokSabha, abbr };
}

/** Lok Sabha 2024 added up across states. */
export function nationalLokSabha(lokSabha: ResultSummary[], abbr: Record<string, string>) {
  const won = new Map<string, number>(), votes = new Map<string, number>();
  let all = 0, seats = 0;
  for (const s of lokSabha) {
    seats += s.seatsRead;
    for (const p of s.parties) { won.set(p.party, (won.get(p.party) ?? 0) + p.won); votes.set(p.party, (votes.get(p.party) ?? 0) + p.votes); all += p.votes; }
  }
  const parties: PartyRow[] = [...new Set([...won.keys()])]
    .map((p) => ({ party: p, abbr: shortParty(p, abbr), won: won.get(p) ?? 0, votes: votes.get(p) ?? 0, share: all ? ((votes.get(p) ?? 0) / all) * 100 : 0 }))
    .filter((p) => p.won > 0)
    .sort((a, b) => b.won - a.won || b.votes - a.votes);
  return { seats, votes: all, parties, nota: votes.get(NOTA) ?? 0 };
}
