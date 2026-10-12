/**
 * Server-side assembly of what the atlas pages hand to their client
 * components: one row per state for the map, and a compact form of each
 * state's results (candidates as tuples) so a 403-seat state stays small.
 */
import { ATLAS_STATES, atlasState, mainElection, loadGoverns, loadResultsForState, loadSir, type AtlasState, type SirState, type StateResult } from "./elections-atlas";
import type { AtlasMapRow } from "@/components/elections/AtlasMap";
import type { CompactResult, ElectorateMedians, SeatElectorate } from "@/components/elections/StateResults";
import { joinElectors, loadElectors, pcElectors } from "./elections-electors";
import { median } from "./elections-pattern";
import { districtsOfState, profile, seatDistricts, type DistrictProfile } from "./elections-census";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (r: StateResult) => { const [y, m] = r.date.split("-"); return `${MONTHS[Number(m) - 1]} ${y}, ${r.seats.length}${r.expectedSeats ? `/${r.expectedSeats}` : ""} seats`; };

export function sirFor(st: AtlasState): SirState | undefined {
  return loadSir()?.states.find((s) => atlasState(s.state)?.slug === st.slug);
}

export function mapRows(): AtlasMapRow[] {
  const gov = loadGoverns();
  return ATLAS_STATES.map((st) => {
    const g = gov?.states.find((x) => atlasState(x.state)?.slug === st.slug);
    const sir = sirFor(st);
    const results = loadResultsForState(st.eci);
    const ac = mainElection(results.filter((r) => r.house === "AC")), pc = mainElection(results.filter((r) => r.house === "PC"));
    const leftOut = sir?.draft?.leftOut;
    return {
      slug: st.slug, name: st.name, legislature: st.legislature,
      ...(g ? { chiefMinister: g.chiefMinister, party: g.party, alliance: g.alliance, stateAlliance: g.stateAlliance, election: g.election } : {}),
      ...(leftOut != null ? { sirLeftOut: leftOut, sirPhase: sir!.phase, ...(sir!.before?.electors ? { sirShare: (leftOut / sir!.before.electors) * 100 } : {}) } : {}),
      ...(ac ? { assembly: short(ac) } : {}),
      ...(pc ? { lokSabha: short(pc) } : {}),
    };
  });
}

/**
 * ECI's party abbreviations, gathered from every party-wise page read. A
 * state whose own party page was not archived still gets ECI's short names
 * from another state or election rather than ones invented here.
 */
let ABBR: Record<string, string> | null = null;
function allAbbreviations(): Record<string, string> {
  if (ABBR) return ABBR;
  ABBR = {};
  for (const st of ATLAS_STATES) for (const r of loadResultsForState(st.eci)) Object.assign(ABBR, (r as StateResult & { abbreviations?: Record<string, string> }).abbreviations ?? {});
  return ABBR;
}

export function compactResults(st: AtlasState): CompactResult[] {
  const global = allAbbreviations();
  return loadResultsForState(st.eci).map((r) => {
    const joined = r.house === "AC" ? joinElectors(st.eci, r.seats) : null;
    const dists = r.house === "AC" ? seatDistricts(st.eci) : null;
    const electorateOf = (s: { no: number; name: string }): SeatElectorate | undefined => {
      if (joined) {
        const j = joined.get(s.no);
        return j ? { m: j.seg.m, f: j.seg.f, tg: j.seg.tg, nri: j.seg.nri, service: j.seg.serviceM + j.seg.serviceF, electors: j.seg.electors, polledEvm: j.seg.polledEvm, match: j.match, pc: j.seg.pc } : undefined;
      }
      const p = pcElectors(st.eci, s.name);
      return p ? { m: p.m, f: p.f, tg: p.tg, nri: p.nri, service: p.service, electors: p.electors, polledEvm: p.polledEvm, match: "seat" } : undefined;
    };
    const extra = r as StateResult & { abbreviations?: Record<string, string> };
    const used = new Set(r.seats.flatMap((s) => s.candidates.map((c) => c.party)));
    const abbreviations = Object.fromEntries([...used].map((p) => [p, extra.abbreviations?.[p] ?? global[p]]).filter((x): x is [string, string] => !!x[1]));
    return {
      folder: r.folder, house: r.house, label: r.label, date: r.date, expectedSeats: r.expectedSeats, partyTally: r.partyTally,
      abbreviations,
      seats: r.seats.map((s) => ({
        no: s.no, name: s.name, url: s.url, status: s.status, ...(s.language ? { language: s.language } : {}),
        final: !(s.status ?? "").startsWith("not final"),
        c: s.candidates.map((c) => (c.evm != null ? [c.name, c.party, c.votes, c.evm, c.postal] : [c.name, c.party, c.votes]) as CompactResult["seats"][number]["c"][number]),
        ...((): { el?: SeatElectorate } => { const el = electorateOf(s); return el ? { el } : {}; })(),
        ...(dists?.get(s.no) ? { dist: dists.get(s.no)!.district } : {}),
      })),
    };
  });
}

/** Medians across a state's 2024 segments, for the seat panel's comparisons. */
export function electorateMedians(st: AtlasState): ElectorateMedians | null {
  const segs = loadElectors()?.states[st.eci]?.segments ?? [];
  if (!segs.length) return null;
  return {
    turnout: median(segs.map((s) => (s.polledEvm / s.electors) * 100)),
    womenPer1000: median(segs.map((s) => (s.f / s.m) * 1000)),
    electors: median(segs.map((s) => s.electors)),
    n: segs.length,
  };
}

/** Census 2011 profiles of every district in the state, by district name. */
export function districtProfiles(st: AtlasState): Record<string, DistrictProfile> {
  return Object.fromEntries(districtsOfState(st.eci).map((d) => [d.district, profile(d)]));
}
