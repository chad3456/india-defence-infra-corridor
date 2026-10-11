/**
 * Who governs each state today: chief minister, party and alliance.
 *
 * `npm run governs:ingest`. Writes data/elections/governs.json. Runs in GitHub
 * Actions weekly; the editing sandbox cannot reach Wikipedia.
 *
 * The Election Commission publishes results, not governments: who became
 * chief minister, and which alliance their party sits in, is not in any ECI
 * dataset. The maintained public record of it is the current-office-holders
 * table in Wikipedia's "Chief minister (India)" article, which carries a
 * citation per row. This reads that table and nothing else.
 *
 * Written only if every state with a legislature parses with a chief minister,
 * a party and an alliance; otherwise the previous file stays.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { parseTables, plain } from "../lib/wikitext";
import { isEntryPoint } from "../lib/entry";
import type { Alliance, Governs, GovernsFile } from "../../../lib/elections-atlas-shared";

const OUT = join(process.cwd(), "data", "elections", "governs.json");
const PAGE = "Chief minister (India)";
const URL = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(PAGE)}&prop=wikitext&formatversion=2&format=json&redirects=1`;

/** Wikipedia's spellings mapped to this site's boundary file. */
const ALIASES: Record<string, string> = {
  Keralam: "Kerala",
  Delhi: "NCT of Delhi",
  Odisha: "Odisha",
  Puducherry: "Puducherry",
};

/** Union territories without a legislature: run by an administrator or lieutenant governor. */
export const NO_LEGISLATURE = ["Ladakh", "Chandigarh", "Andaman and Nicobar Islands", "Lakshadweep", "Dadra and Nagar Haveli and Daman and Diu"];

/** States and UTs that elect a legislature, and so must each have a chief minister. */
export const WITH_LEGISLATURE = 31;

function alliance(raw: string): Alliance {
  const s = raw.trim().toUpperCase();
  if (s.startsWith("NDA")) return "NDA";
  if (s.startsWith("INDIA")) return "INDIA";
  if (s === "NONE" || s === "") return "None";
  return "Other";
}

export function parseGoverns(wikitext: string): Governs[] {
  const table = parseTables(wikitext).find((t) => t.headers.some((h) => /officeholder/i.test(h)) && t.headers.some((h) => /national alliance/i.test(h)) && t.headers.some((h) => /^state/i.test(h)));
  if (!table) return [];
  const col = (re: RegExp) => table.headers.findIndex((h) => re.test(h));
  const iState = col(/^state/i), iName = col(/officeholder/i), iParty = col(/political party|^party$/i), iNat = col(/national alliance/i);
  const iReg = col(/state\/ut alliance|regional/i), iCons = col(/constituency/i), iElec = col(/^election/i);
  const out: Governs[] = [];
  for (const r of table.rows) {
    const name = plain(r[iName] ?? "").trim();
    const stateRaw = plain(r[iState] ?? "").trim();
    if (!stateRaw || !name) continue;
    // The party column is "TDP" followed by an unclosed template tail; keep the abbreviation.
    const party = plain(r[iParty] ?? "").split(/[|}]/)[0]!.trim();
    // Rows where a party name spills into the next cell shift the alliance one
    // to the right; the national alliance is the first NDA/INDIA/None after the party.
    const tail = r.slice(iParty + 1).map((c) => plain(c).trim());
    const natCell = tail.find((c) => /^(NDA|INDIA|None)\b/i.test(c)) ?? plain(r[iNat] ?? "");
    const natIdx = tail.indexOf(natCell);
    const yearCell = r.slice(iParty + 1).map((c) => plain(c).trim()).find((c) => /^(19|20)\d{2}$/.test(c));
    out.push({
      state: ALIASES[stateRaw] ?? stateRaw,
      chiefMinister: name,
      party,
      alliance: alliance(natCell),
      stateAlliance: natIdx >= 0 ? (tail[natIdx + 1] ?? "") : plain(r[iReg] ?? ""),
      cmConstituency: natIdx >= 0 ? (tail[natIdx + 3] ?? "") : plain(r[iCons] ?? ""),
      election: yearCell ? Number(yearCell) : (iElec >= 0 && /^\d{4}$/.test(plain(r[iElec] ?? "")) ? Number(plain(r[iElec]!)) : null),
    });
  }
  return out;
}

export function validateGoverns(states: Governs[]): string[] {
  const problems: string[] = [];
  if (states.length < WITH_LEGISLATURE) problems.push(`only ${states.length} of ${WITH_LEGISLATURE} states and UTs with legislatures parsed`);
  for (const s of states) {
    if (!s.party || s.party.length > 12) problems.push(`${s.state}: party "${s.party}"`);
    if (!/^[A-Z][\w.' -]+$/.test(s.chiefMinister)) problems.push(`${s.state}: chief minister "${s.chiefMinister}"`);
  }
  if (new Set(states.map((s) => s.state)).size !== states.length) problems.push("a state appears twice");
  return problems;
}

export function buildFile(wikitext: string, fetchedAt: string): GovernsFile {
  return {
    fetchedAt,
    source: { publisher: "Wikipedia", title: "Chief minister (India): current office holders", url: "https://en.wikipedia.org/wiki/Chief_minister_(India)#Current_list" },
    states: parseGoverns(wikitext),
    noLegislature: NO_LEGISLATURE,
  };
}

export async function run(): Promise<void> {
  const res = await getText(URL, { timeoutMs: 40_000, retries: 3, cacheMs: 0 });
  if (!res.ok || !res.data) throw new Error(`Wikipedia did not answer: ${res.error}`);
  const wt = (JSON.parse(res.data) as { parse?: { wikitext?: string } }).parse?.wikitext ?? "";
  const file = buildFile(wt, new Date().toISOString());
  const problems = validateGoverns(file.states);
  if (problems.length) {
    const kept = existsSync(OUT) ? (JSON.parse(await readFile(OUT, "utf8")) as GovernsFile).fetchedAt : "none";
    throw new Error(`refusing to write (keeping the file of ${kept}):\n  ${problems.join("\n  ")}`);
  }
  await mkdir(join(process.cwd(), "data", "elections"), { recursive: true });
  await writeFile(OUT, JSON.stringify(file, null, 2) + "\n", "utf8");
  console.log(`wrote ${OUT}: ${file.states.length} governments`);
}

if (isEntryPoint(import.meta.url)) run().catch((e) => { console.error(e); process.exit(1); });
