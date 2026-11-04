/**
 * The BJP and the NDA in every election since the pandemic, for
 * /elections/since-2020. Node only.
 *
 * ── Where each number comes from ─────────────────────────────────────────
 *
 * Counted: elections in data/elections/results, read seat by seat from ECI's
 * own pages. Seats won are counted winners — or ECI's own party tally where
 * the archive missed seats — and vote shares are summed over the seats read,
 * NOTA included. A vote share is computed only when at least 98% of a
 * house's seats were read; with fewer it would describe part of a state.
 *
 * Reported: Bihar 2020 and the 2021 round predate the archive's coverage,
 * so their figures come from data/elections/since-2020.json with two sources
 * each and are marked as reported.
 *
 * The NDA is the BJP's pre-poll alliance in that election, as listed in the
 * same file. Where the line-up could not be confirmed the BJP is shown
 * alone, never a guessed alliance.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ATLAS_STATES, loadResultIndex, loadStateResult, monthLabel } from "./elections-atlas";
import { allSummaries, nationalLokSabha, summarise } from "./elections-summary";

const BJP = "Bharatiya Janata Party";

export interface SinceFile {
  accessed: string;
  note: string;
  alliances: Record<string, string[] | string>;
  allianceUnverified: Record<string, string>;
  reportedNda: Array<{ key: string; seats: number; source: string }>;
  ndaGovernment: Record<string, boolean | string>;
  governmentNotes: Record<string, string>;
  uncounted: Array<{ id: string; state: string; date: string; house: number; bjpSeats: number; bjpShare: number | null; ndaSeats: number | null; ndaGovernment: boolean; note?: string; sources: string[] }>;
  lokSabha2019: { bjpSeats: number; bjpShare: number; ndaSeats: number; sources: string[] };
  turnoutByGender2024: { women: number; men: number; note: string; sources: string[] };
  rajyaSabha: Array<{ date: string; text: string; nda?: number; bjp?: number; majority?: number; sources: string[] }>;
  events: Array<{ date: string; kind: "pandemic" | "war" | "economy"; text: string; url: string }>;
  demographics?: Demographics;
  lokniti2024?: {
    title: string; publisher: string; pdf: string; url: string; sample: number;
    voteCheck: { page: number; bjp: number; congress: number };
    anotherChance: { pages: number[]; question: string; yes: number; no: number; dontKnow: number };
    reasonsYes: { page: number; base: string; rows: Array<[string, number]> };
    reasonsNo: { page: number; base: string; rows: Array<[string, number]> };
  };
}

export interface Demographics {
  survey: string;
  sample?: string;
  url: string;
  checkedVia?: string[];
  groups: Array<{ dimension: string; rows: Array<{ group: string; bjp: number; nda?: number; congress?: number; india?: number }> }>;
  /** Tables known to exist but not yet read from a primary copy. */
  pending?: string;
}

export type Basis = "counted" | "tally" | "reported";

export interface Election {
  key: string;
  state: string;
  slug: string | null;
  date: string;
  label: string;
  house: number;
  basis: Basis;
  bjpSeats: number;
  bjpShare: number | null;
  ndaSeats: number | null;
  ndaShare: number | null;
  partners: string[];
  allianceNote?: string;
  ndaGovernment: boolean | null;
  governmentNote?: string;
  note?: string;
  sources: Array<{ label: string; url: string }>;
}

export function loadSinceFile(): SinceFile {
  return JSON.parse(readFileSync(join(process.cwd(), "data", "elections", "since-2020.json"), "utf8")) as SinceFile;
}

/** Every assembly election since 2020 and the 2024 Lok Sabha, oldest first. */
export function loadSince2020() {
  const f = loadSinceFile();
  const eciPortal = (folder: string) => ({ label: "ECI results, via the Internet Archive", url: `https://web.archive.org/web/2026/https://results.eci.gov.in/${folder}/` });
  const out: Election[] = [];

  for (const e of loadResultIndex()) {
    if (e.house !== "AC") continue;
    for (const [code, read] of Object.entries(e.states)) {
      const r = loadStateResult(e.folder, code) as (ReturnType<typeof loadStateResult> & { abbreviations?: Record<string, string>; partyTally?: Array<{ party: string; won: number }> }) | null;
      if (!r) continue;
      const st = ATLAS_STATES.find((s) => s.eci === code);
      const house = r.expectedSeats ?? read;
      // A separately held adjourned poll (one seat) is not a general election of the house.
      if (house < 5 || read < house / 2 && !(r.partyTally?.length)) continue;
      if (read === 1 && house > 1 && !(r.partyTally?.length)) continue;
      const key = `${e.folder}:${code}`;
      const s = summarise(r, r.abbreviations ?? {});
      const complete = s.seatsRead >= house * 0.98;
      const tally = r.partyTally?.length ? new Map(r.partyTally.map((t) => [t.party, t.won])) : null;
      const won = (p: string) => (tally && !complete ? tally.get(p) ?? 0 : s.parties.find((x) => x.party === p)?.won ?? 0);
      const share = (p: string) => (complete ? s.parties.find((x) => x.party === p)?.share ?? 0 : null);
      const listed = f.alliances[key];
      const partners = Array.isArray(listed) ? listed : [BJP];
      const ndaSeats = partners.reduce((a, p) => a + won(p), 0);
      const ndaShare = complete ? partners.reduce((a, p) => a + (share(p) ?? 0), 0) : null;
      const gov = f.ndaGovernment[key];
      if (s.seatsRead < house && !complete && !tally) continue;
      out.push({
        key, state: st?.name ?? code, slug: st?.slug ?? null, date: r.date, label: monthLabel(r.date), house,
        basis: complete ? "counted" : "tally",
        bjpSeats: won(BJP), bjpShare: share(BJP), ndaSeats, ndaShare, partners,
        allianceNote: f.allianceUnverified[key],
        ndaGovernment: typeof gov === "boolean" ? gov : null,
        governmentNote: f.governmentNotes[key],
        note: complete ? undefined : `ECI's party tally gives the seats; the archive holds ${s.seatsRead} of ${house} seat pages, too few for a vote share.`,
        sources: [eciPortal(e.folder)],
      });
    }
  }
  for (const u of f.uncounted) {
    const st = ATLAS_STATES.find((s) => s.name === u.state);
    out.push({
      key: u.id, state: u.state, slug: st?.slug ?? null, date: u.date, label: monthLabel(u.date), house: u.house, basis: "reported",
      bjpSeats: u.bjpSeats, bjpShare: u.bjpShare, ndaSeats: u.ndaSeats, ndaShare: null, partners: [BJP],
      ndaGovernment: u.ndaGovernment, note: u.note,
      sources: u.sources.map((url) => ({ label: new URL(url).hostname.replace(/^www\./, ""), url })),
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.state.localeCompare(b.state));

  // The 2024 Lok Sabha, added up from 543 seat pages.
  const { lokSabha, abbr } = allSummaries();
  const nat = nationalLokSabha(lokSabha, abbr);
  const lsPartners = (f.alliances.PcResultGenJune2024 as string[]) ?? [BJP];
  const lsParty = (p: string) => nat.parties.find((x) => x.party === p);
  const ls2024 = {
    seats: nat.seats,
    bjpSeats: lsParty(BJP)?.won ?? 0,
    bjpShare: lsParty(BJP)?.share ?? 0,
    ndaSeats: lsPartners.reduce((a, p) => a + (lsParty(p)?.won ?? 0), 0),
    ndaShare: lsPartners.reduce((a, p) => a + (lsParty(p)?.share ?? 0), 0),
    partners: lsPartners.map((p) => ({ party: p, abbr: lsParty(p)?.abbr ?? p, won: lsParty(p)?.won ?? 0 })).filter((p) => p.won > 0).sort((a, b) => b.won - a.won),
    parties: nat.parties,
    byState: lokSabha.map((s) => {
      const b = s.parties.find((p) => p.party === BJP);
      return { state: s.stateName, slug: s.slug, seats: s.seatsRead, bjpSeats: b?.won ?? 0, bjpShare: b?.share ?? 0, ndaSeats: lsPartners.reduce((a, p) => a + (s.parties.find((x) => x.party === p)?.won ?? 0), 0) };
    }).sort((a, b) => b.seats - a.seats),
  };

  return { file: f, elections: out, ls2024 };
}

/** Tile positions for a grid map of India: [column, row]. Roughly geographic, every state the same size. */
export const TILES: Record<string, [number, number, string]> = {
  "Jammu and Kashmir": [2, 0, "JK"], Ladakh: [3, 0, "LA"],
  Chandigarh: [0, 1, "CH"], Punjab: [1, 1, "PB"], "Himachal Pradesh": [2, 1, "HP"], Uttarakhand: [3, 1, "UK"], "Arunachal Pradesh": [7, 1, "AR"],
  Rajasthan: [0, 2, "RJ"], Haryana: [1, 2, "HR"], Delhi: [2, 2, "DL"], "Uttar Pradesh": [3, 2, "UP"], Bihar: [4, 2, "BR"], Sikkim: [5, 2, "SK"], Assam: [6, 2, "AS"], Nagaland: [7, 2, "NL"],
  Gujarat: [0, 3, "GJ"], "Madhya Pradesh": [1, 3, "MP"], Chhattisgarh: [2, 3, "CG"], Jharkhand: [3, 3, "JH"], "West Bengal": [4, 3, "WB"], Meghalaya: [5, 3, "ML"], Manipur: [7, 3, "MN"],
  "Dadra and Nagar Haveli and Daman and Diu": [0, 4, "DD"], Maharashtra: [1, 4, "MH"], Telangana: [2, 4, "TS"], Odisha: [3, 4, "OD"], Tripura: [5, 4, "TR"], Mizoram: [6, 4, "MZ"],
  Goa: [0, 5, "GA"], Karnataka: [1, 5, "KA"], "Andhra Pradesh": [2, 5, "AP"],
  Lakshadweep: [0, 6, "LD"], Kerala: [1, 6, "KL"], "Tamil Nadu": [2, 6, "TN"], Puducherry: [3, 6, "PY"], "Andaman and Nicobar Islands": [5, 6, "AN"],
};
