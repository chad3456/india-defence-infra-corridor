/**
 * Census 2011 district profiles, joined to constituencies. Server-only.
 *
 * Religion and caste are not in any Election Commission record. What exists is
 * the 2011 Census count of religion and of Scheduled Castes and Tribes, by
 * district. A constituency is shown the profile of the district it lies in —
 * a district figure, labelled as one — never an estimate for the constituency.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ATLAS_STATES } from "./elections-atlas";

export interface District2011 {
  code: number; state: string; district: string;
  population: number; male: number; female: number;
  literate: number; maleLiterate: number; femaleLiterate: number;
  sc: number; st: number;
  religion: { hindu: number; muslim: number; christian: number; sikh: number; buddhist: number; jain: number; other: number; notStated: number };
}
interface CensusFile { source: { publisher: string; compiledBy: string; url: string; checked: string }; districts: District2011[] }
interface AcFile { source: { publisher: string; url: string; licence: string; rule: string }; states: Record<string, Array<{ no: number; name: string; district: string; how: string }>> }

const read = <T,>(p: string): T | null => { try { return JSON.parse(readFileSync(join(process.cwd(), p), "utf8")) as T; } catch { return null; } };
let census: CensusFile | null | undefined, acs: AcFile | null | undefined;
export const loadCensus = () => (census === undefined ? (census = read<CensusFile>("data/census/districts-2011.json")) : census);
export const loadAcDistricts = () => (acs === undefined ? (acs = read<AcFile>("data/elections/ac-districts.json")) : acs);

const fold = (s: string) => s.toLowerCase().replace(/\*/g, "").replace(/[^a-z]/g, "");

/** The census's state spelling for each atlas state (2011 names: Orissa, Pondicherry; Telangana was part of Andhra Pradesh). */
const CENSUS_STATE: Record<string, string> = { S29: "andhrapradesh", S18: "orissa", U07: "pondicherry", U05: "nctofdelhi", U08: "jammuandkashmir", U09: "jammuandkashmir", U03: "dadraandnagarhaveli" };

/**
 * Districts renamed or respelled between the constituency layer and the 2011
 * census. Written out rather than guessed, so each one can be checked.
 */
const RENAMED: Record<string, string> = {
  northparganas: "northtwentyfourparganas", southparganas: "southtwentyfourparganas", lahulspiti: "lahulandspiti",
  paschimmedinapur: "paschimmedinipur", purbamedinapur: "purbamedinipur",
  nellore: "sripottisriramulunellore", cuddapah: "ysr", rangareddi: "rangareddy",
  davangere: "davanagere", chamrajnagar: "chamarajanagar", hazaribag: "hazaribagh",
  pachimsinghbhum: "pashchimisinghbhum", saraikela: "saraikelakharsawan", pakaur: "pakur",
  eastnimar: "khandwaeastnimar", westnimar: "khargonewestnimar", maharajganj: "mahrajganj",
  sibsagar: "sivasagar", marigaon: "morigaon", northcacharhills: "dimahasao", baster: "bastar",
  hathras: "mahamayanagar", santravidasnagar: "santravidasnagarbhadohi", nawanshahr: "shahidbhagatsinghnagar",
  sonapur: "subarnapur", east: "eastdistrict", west: "westdistrict", north: "northdistrict", south: "southdistrict",
};

export function censusStateKey(eci: string): string {
  if (CENSUS_STATE[eci]) return CENSUS_STATE[eci]!;
  return fold(ATLAS_STATES.find((s) => s.eci === eci)?.name ?? "");
}

export function districtsOfState(eci: string): District2011[] {
  const key = censusStateKey(eci);
  const all = (loadCensus()?.districts ?? []).filter((d) => fold(d.state) === key);
  // Andhra Pradesh and Telangana were one state in 2011: each gets the census
  // districts its own constituencies lie in, so neither counts the other's.
  if (eci !== "S01" && eci !== "S29") return all;
  const mine = new Set((loadAcDistricts()?.states[eci] ?? []).map((r) => resolveIn(all, r.district)?.code).filter((c): c is number => c != null));
  return all.filter((d) => mine.has(d.code));
}

/** The census district a constituency's district name refers to, or null. */
export function resolveDistrict(eci: string, name: string): District2011 | null {
  return resolveIn(districtsOfState(eci), name);
}
function resolveIn(pool: District2011[], name: string): District2011 | null {
  const f = fold(name);
  if (!f) return null;
  const want = RENAMED[f] ?? f;
  return pool.find((d) => fold(d.district) === want)
    ?? (() => { const c = pool.filter((d) => fold(d.district).includes(want) || want.includes(fold(d.district))); return c.length === 1 ? c[0]! : null; })();
}

/** Seat number → its district's census profile, for one state's assembly seats. */
export function seatDistricts(eci: string): Map<number, District2011> {
  const out = new Map<number, District2011>();
  for (const r of loadAcDistricts()?.states[eci] ?? []) {
    const d = resolveDistrict(eci, r.district);
    if (d) out.set(r.no, d);
  }
  return out;
}

export type { DistrictProfile } from "./elections-census-shared";
import type { DistrictProfile } from "./elections-census-shared";

export function profile(d: District2011): DistrictProfile {
  const p = d.population, r = d.religion;
  // Literacy over the whole population, as the census tables give it here (derived).
  return {
    district: d.district, population: p,
    sexRatio: Math.round((d.female / d.male) * 1000),
    literacy: (d.literate / p) * 100, femaleLiteracy: (d.femaleLiterate / d.female) * 100,
    sc: (d.sc / p) * 100, st: (d.st / p) * 100,
    religion: ([["Hindu", r.hindu], ["Muslim", r.muslim], ["Christian", r.christian], ["Sikh", r.sikh], ["Buddhist", r.buddhist], ["Jain", r.jain], ["Other", r.other], ["Not stated", r.notStated]] as Array<[string, number]>).map(([k, v]) => [k, (v / p) * 100]),
  };
}
