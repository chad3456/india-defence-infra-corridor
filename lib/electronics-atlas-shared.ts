/**
 * Types for the electronics atlas on /breakneck/india: who exports each of
 * 200+ electronics lines, and how much of India's supply comes from China.
 * No node imports — the client explorer reads this file.
 */
import type { SectorId } from "./electronics-catalogue";

export interface AtlasExporter { m49: number; name: string; value: number }

export interface AtlasLine {
  hs: string;
  year: number;
  /** Countries that reported exports of this line that year. */
  reporters: number;
  /** Sum of every reporter's exports to the world, US$. */
  world: number;
  china: number;
  chinaRank: number | null;
  india: number;
  indiaRank: number | null;
  top: AtlasExporter[];
  /** India's own customs: imports from the world and from China, US$. */
  indiaImports: { year: number; world: number | null; china: number | null } | null;
  /** China's own customs: exports to India, US$ — the other end of the same trade. */
  chinaToIndia: number | null;
}

export interface ElectronicsAtlas {
  generatedAt: string;
  year: number;
  lines: Record<string, AtlasLine>;
  officialNames: Record<string, string>;
  calls: number;
  errors: string[];
}

/** One row as the explorer shows it: catalogue entry joined to trade data. */
export interface AtlasRow {
  hs: string;
  name: string;
  official: string;
  sector: SectorId;
  sectorLabel: string;
  ai: boolean;
  year: number | null;
  world: number | null;
  chinaShare: number | null;
  chinaRank: number | null;
  indiaShare: number | null;
  indiaRank: number | null;
  indiaExports: number | null;
  /** Share of India's imports of this line that come from China, %. */
  indiaFromChina: number | null;
  indiaImports: number | null;
  top: Array<{ name: string; share: number }>;
}

/** US$ as the page prints it. */
export function usd(v: number): string {
  const n = Math.abs(v);
  const t = (x: number) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)).replace(/\.?0+$/, "");
  if (n >= 1e12) return `$${t(v / 1e12)} trillion`;
  if (n >= 1e9) return `$${t(v / 1e9)}bn`;
  if (n >= 1e6) return `$${t(v / 1e6)}m`;
  if (n >= 1e3) return `$${t(v / 1e3)}k`;
  return `$${Math.round(v)}`;
}
