/**
 * The V-Party anchors for /political-axes, from the committed extract.
 * Node only. Without the file the page still works; it just has no anchors.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ANCHOR_VARS, type AnchorParty } from "./axes-anchors";

export interface VPartyFile {
  source: { title: string; publisher: string; url: string; via: string; commit: string | null; licence: string };
  fetchedAt: string;
  rows: number;
  variables: string[];
  parties: Array<{ id: number; country: string; iso3: string; year: number; name: string; orig?: string; abbr?: string; vote: number | null; seats: number | null; gov: number | null; v: Record<string, number> }>;
}

export function loadVParty(): { file: VPartyFile; parties: AnchorParty[] } | null {
  const f = join(process.cwd(), "data", "axes", "vparty.json");
  if (!existsSync(f)) return null;
  const file = JSON.parse(readFileSync(f, "utf8")) as VPartyFile;
  const parties: AnchorParty[] = file.parties
    .filter((p) => ANCHOR_VARS.some((k) => typeof p.v[k] === "number"))
    .map((p) => ({
      id: p.id, country: p.country, name: p.name, orig: p.orig && p.orig !== p.name ? p.orig : undefined, abbr: p.abbr, year: p.year, vote: p.vote, gov: p.gov,
      v: Object.fromEntries(ANCHOR_VARS.filter((k) => typeof p.v[k] === "number").map((k) => [k, p.v[k]!])),
    }));
  return { file, parties };
}
