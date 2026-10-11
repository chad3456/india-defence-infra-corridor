/**
 * Server-side assembly of what the atlas pages hand to their client
 * components: one row per state for the map, and a compact form of each
 * state's results (candidates as tuples) so a 403-seat state stays small.
 */
import { ATLAS_STATES, atlasState, loadGoverns, loadResultsForState, loadSir, type AtlasState, type SirState, type StateResult } from "./elections-atlas";
import type { AtlasMapRow } from "@/components/elections/AtlasMap";
import type { CompactResult } from "@/components/elections/StateResults";

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
    const ac = results.find((r) => r.house === "AC"), pc = results.find((r) => r.house === "PC");
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
    const extra = r as StateResult & { abbreviations?: Record<string, string> };
    const used = new Set(r.seats.flatMap((s) => s.candidates.map((c) => c.party)));
    const abbreviations = Object.fromEntries([...used].map((p) => [p, extra.abbreviations?.[p] ?? global[p]]).filter((x): x is [string, string] => !!x[1]));
    return {
      folder: r.folder, house: r.house, label: r.label, date: r.date, expectedSeats: r.expectedSeats, partyTally: r.partyTally,
      abbreviations,
      seats: r.seats.map((s) => ({
        no: s.no, name: s.name, url: s.url, status: s.status,
        final: !(s.status ?? "").startsWith("not final"),
        c: s.candidates.map((c) => (c.evm != null ? [c.name, c.party, c.votes, c.evm, c.postal] : [c.name, c.party, c.votes]) as CompactResult["seats"][number]["c"][number]),
      })),
    };
  });
}
