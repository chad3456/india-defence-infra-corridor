/**
 * Reading the election atlas files from disk. Server-only (node:fs); client
 * components import lib/elections-atlas-shared.ts.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ElectionIndexEntry, GovernsFile, SirFile, StateResult } from "./elections-atlas-shared";

export * from "./elections-atlas-shared";

const DIR = join(process.cwd(), "data", "elections");

function readJson<T>(path: string): T | null {
  try { return JSON.parse(readFileSync(path, "utf8")) as T; } catch { return null; }
}

export function loadGoverns(): GovernsFile | null { return readJson<GovernsFile>(join(DIR, "governs.json")); }
export function loadSir(): SirFile | null { return readJson<SirFile>(join(DIR, "sir.json")); }

/** Every election the results connector has read, newest first, listed from what is on disk. */
export function loadResultIndex(): ElectionIndexEntry[] {
  const root = join(DIR, "results");
  if (!existsSync(root)) return [];
  const out: ElectionIndexEntry[] = [];
  for (const folder of readdirSync(root, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    const entry: ElectionIndexEntry = { folder: folder.name, house: "AC", label: "", date: "", states: {} };
    for (const f of readdirSync(join(root, folder.name)).filter((f) => f.endsWith(".json"))) {
      const r = readJson<StateResult>(join(root, folder.name, f));
      if (!r || r.seats.length === 0) continue;
      Object.assign(entry, { house: r.house, label: r.label, date: r.date });
      entry.states[r.state] = r.seats.length;
    }
    if (Object.keys(entry.states).length) out.push(entry);
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** One state's results in one election, or null if not read. */
export function loadStateResult(folder: string, eci: string): StateResult | null {
  const p = join(DIR, "results", folder, `${eci}.json`);
  return existsSync(p) ? readJson<StateResult>(p) : null;
}

/** All results the atlas holds for one state, newest first per house. */
export function loadResultsForState(eci: string): StateResult[] {
  const root = join(DIR, "results");
  if (!existsSync(root)) return [];
  const out: StateResult[] = [];
  for (const folder of readdirSync(root, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    const r = loadStateResult(folder.name, eci);
    if (r && r.seats.length > 0) out.push(r);
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
