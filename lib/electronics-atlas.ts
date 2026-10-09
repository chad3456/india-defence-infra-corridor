/**
 * Server-side loader for the electronics atlas on /breakneck/india.
 *
 * Joins the catalogue (lib/electronics-catalogue.ts) to the trade data the
 * connector wrote (data/trade/electronics-atlas.json). Shares and ratios are
 * computed here and labelled derived on the page. A catalogue line with no
 * trade data yet comes back with nulls, never with a guess.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOGUE, SECTORS, SECTOR_BY_ID, type SectorId } from "./electronics-catalogue";
import type { AtlasRow, ElectronicsAtlas } from "./electronics-atlas-shared";

export type { AtlasRow };
export { usd } from "./electronics-atlas-shared";

export interface SectorSummary {
  id: SectorId;
  label: string;
  blurb: string;
  lines: number;
  world: number;
  /** China's and India's exports summed over the sector's lines, as a share of the summed world. */
  chinaShare: number | null;
  indiaShare: number | null;
  /** India's imports of the sector's lines from China, as a share of all its imports of them. */
  indiaFromChina: number | null;
  indiaImports: number;
}

export interface AtlasView {
  atlas: ElectronicsAtlas | null;
  rows: AtlasRow[];
  sectors: SectorSummary[];
}

const pct = (a: number, b: number): number | null => (b > 0 ? (a / b) * 100 : null);

export function loadAtlas(): AtlasView {
  const file = join(process.cwd(), "data", "trade", "electronics-atlas.json");
  const atlas = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as ElectronicsAtlas) : null;
  const rows: AtlasRow[] = CATALOGUE.map((c) => {
    const l = atlas?.lines[c.hs];
    const imp = l?.indiaImports;
    return {
      hs: c.hs,
      name: c.name,
      official: atlas?.officialNames[c.hs] ?? "",
      sector: c.sector,
      sectorLabel: SECTOR_BY_ID.get(c.sector)!.label,
      ai: !!c.ai,
      year: l?.year ?? null,
      world: l?.world ?? null,
      chinaShare: l ? pct(l.china, l.world) : null,
      chinaRank: l?.chinaRank ?? null,
      indiaShare: l ? pct(l.india, l.world) : null,
      indiaRank: l?.indiaRank ?? null,
      indiaExports: l ? l.india : null,
      indiaFromChina: imp && imp.world !== null && imp.china !== null ? pct(imp.china, imp.world) : null,
      indiaImports: imp?.world ?? null,
      top: l ? l.top.map((t) => ({ name: t.name, share: (t.value / l.world) * 100 })) : [],
    };
  });

  const sectors: SectorSummary[] = SECTORS.map((s) => {
    const mine = CATALOGUE.filter((c) => c.sector === s.id).map((c) => atlas?.lines[c.hs]).filter((l) => !!l);
    const world = mine.reduce((a, l) => a + l.world, 0);
    const china = mine.reduce((a, l) => a + l.china, 0);
    const india = mine.reduce((a, l) => a + l.india, 0);
    const withImp = mine.filter((l) => l.indiaImports?.world != null && l.indiaImports.china != null);
    const impW = withImp.reduce((a, l) => a + (l.indiaImports!.world ?? 0), 0);
    const impC = withImp.reduce((a, l) => a + (l.indiaImports!.china ?? 0), 0);
    return {
      id: s.id, label: s.label, blurb: s.blurb,
      lines: CATALOGUE.filter((c) => c.sector === s.id).length,
      world, chinaShare: pct(china, world), indiaShare: pct(india, world),
      indiaFromChina: pct(impC, impW), indiaImports: impW,
    };
  });

  return { atlas, rows, sectors };
}
