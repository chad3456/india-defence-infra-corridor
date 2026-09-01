/**
 * Loader for the HS6 trade data.
 *
 * Read from disk rather than imported as a module, for two reasons. The year
 * files are named dynamically and a static import list would have to be edited
 * every time the sampled years change. And the ingest is resumable by design,
 * so at any moment some year files exist and others do not — the page has to
 * render honestly against a partial dataset rather than fail to build.
 *
 * That last point is the whole posture of this site: a dashboard that only
 * works when everything arrived is a dashboard that lies about what arrived.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  classifyLine, assemblySignature, CONCORDANCES,
  type LocalisationLine, type LineVerdict, type Stage,
} from "./localisation";
import { SECTORS, type Sector } from "./localisation-sectors";

const DIR = join(process.cwd(), "data/trade");

interface Universe { builtAt: string; source: string; codes: string[]; names: Record<string, string> }
interface YearRow { code: string; m: number; x: number }

export interface Product extends LineVerdict {
  code: string;
  name: string;
  chapter: string;
  years: Array<{ year: number; m: number; x: number }>;
  /** Set on merged lines: which codes contributed, and why they were merged. */
  merged?: { codes: string[]; note: string; byYear: Record<number, string[]> };
}

export interface TradeDataset {
  /** True when the ingest has produced anything at all. */
  present: boolean;
  builtAt: string | null;
  /** Years actually on disk, ascending. */
  years: number[];
  products: Product[];
  /** Codes in the universe that carry no trade data yet. */
  missing: number;
  universeSize: number;
}

function readJson<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

let cached: TradeDataset | null = null;

export function getTradeData(): TradeDataset {
  if (cached) return cached;

  const universe = readJson<Universe>(join(DIR, "hs6-universe.json"));
  if (!universe) {
    cached = { present: false, builtAt: null, years: [], products: [], missing: 0, universeSize: 0 };
    return cached;
  }

  const years: number[] = [];
  try {
    for (const f of readdirSync(DIR)) {
      const m = /^hs6-(\d{4})\.json$/.exec(f);
      if (m?.[1]) years.push(Number(m[1]));
    }
  } catch {
    // Directory unreadable: treated the same as no data.
  }
  years.sort((a, b) => a - b);

  // code -> year -> {m,x}
  const byCode = new Map<string, Map<number, { m: number; x: number }>>();
  for (const y of years) {
    const rows = readJson<YearRow[]>(join(DIR, `hs6-${y}.json`)) ?? [];
    for (const r of rows) {
      if (!r || typeof r.code !== "string") continue;
      const entry = byCode.get(r.code) ?? new Map<number, { m: number; x: number }>();
      entry.set(y, { m: Number(r.m) || 0, x: Number(r.x) || 0 });
      byCode.set(r.code, entry);
    }
  }

  // Fold successive HS vintages of one product into a single line before
  // anything is graded. See CONCORDANCES for why summing these is safe.
  const mergedMeta = new Map<string, Product["merged"]>();
  for (const con of CONCORDANCES) {
    const present = con.codes.filter((c) => byCode.has(c));
    if (present.length < 2) continue;
    const summed = new Map<number, { m: number; x: number }>();
    const byYear: Record<number, string[]> = {};
    for (const c of present) {
      for (const [year, v] of byCode.get(c) ?? []) {
        if (v.m === 0 && v.x === 0) continue;
        const cur = summed.get(year) ?? { m: 0, x: 0 };
        summed.set(year, { m: cur.m + v.m, x: cur.x + v.x });
        (byYear[year] ??= []).push(c);
      }
      byCode.delete(c);
    }
    byCode.set(con.id, summed);
    mergedMeta.set(con.id, { codes: present, note: con.note, byYear });
  }

  const conById = new Map(CONCORDANCES.map((c) => [c.id, c]));

  const products: Product[] = [];
  for (const [code, yearMap] of byCode) {
    // Chapter 99 is the residual bucket -- "commodities not specified
    // according to kind" and the confidential/special lines. It is not a
    // product, and it is large: grading it would put a $4bn nothing-in-
    // particular near the top of the table as if it were a thing India buys.
    if (code.startsWith("99")) continue;
    const rows = [...yearMap.entries()]
      .map(([year, v]) => ({ year, m: v.m, x: v.x }))
      .sort((a, b) => a.year - b.year);
    const con = conById.get(code);
    const name = con?.label ?? universe.names[code] ?? `HS ${code}`;
    const line: LocalisationLine = {
      code,
      description: name,
      chapter: code.slice(0, 2),
      years: rows,
    };
    const merged = mergedMeta.get(code);
    products.push({
      ...classifyLine(line),
      code,
      name,
      chapter: code.slice(0, 2),
      years: rows,
      ...(merged ? { merged } : {}),
    });
  }

  // Biggest trade first, so the default view leads with what matters.
  products.sort((a, b) => (b.closeM + b.closeX) - (a.closeM + a.closeX));

  cached = {
    present: products.length > 0,
    builtAt: universe.builtAt,
    years,
    products,
    universeSize: universe.codes.length,
    missing: Math.max(0, universe.codes.length - byCode.size),
  };
  return cached;
}

export function stageCounts(products: Product[]): Record<Stage, number> {
  const out: Record<Stage, number> = {
    reversed: 0, narrowing: 0, holding: 0, "import-reliant": 0, deepening: 0, slipping: 0, thin: 0,
  };
  for (const p of products) out[p.stage]++;
  return out;
}

export interface SectorView {
  sector: Sector;
  outputs: Product[];
  inputs: Product[];
  /** Null when there are no usable input lines to check against. */
  assembly: ReturnType<typeof assemblySignature>;
}

/**
 * Build the sector views, pairing each finished good with its inputs.
 *
 * The assembly check runs against the largest output line by current trade,
 * because a sector's headline claim is about its headline product — running it
 * against an average across outputs would let a small integrated line cancel
 * out a large assembled one.
 */
export function getSectorViews(data: TradeDataset): SectorView[] {
  const byCode = new Map(data.products.map((p) => [p.code, p]));
  return [...SECTORS]
    .sort((a, b) => a.rank - b.rank)
    .map((sector) => {
      const outputs = sector.outputs
        .map((c) => byCode.get(c.code))
        .filter((p): p is Product => p !== undefined);
      const inputs = sector.inputs
        .map((c) => byCode.get(c.code))
        .filter((p): p is Product => p !== undefined);
      const headline = [...outputs].sort((a, b) => (b.closeM + b.closeX) - (a.closeM + a.closeX))[0];
      return {
        sector,
        outputs,
        inputs,
        assembly: headline ? assemblySignature(headline, inputs) : null,
      };
    });
}

/** HS chapter names, for grouping the explorer. Chapter numbers are stable. */
export const CHAPTER_NAMES: Record<string, string> = {
  "01": "Live animals", "02": "Meat", "03": "Fish", "04": "Dairy and eggs", "05": "Animal products",
  "06": "Live trees and plants", "07": "Vegetables", "08": "Fruit and nuts", "09": "Coffee, tea and spices",
  "10": "Cereals", "11": "Milling products", "12": "Oil seeds", "13": "Gums and resins", "14": "Vegetable plaiting",
  "15": "Fats and oils", "16": "Prepared meat and fish", "17": "Sugar", "18": "Cocoa", "19": "Cereal preparations",
  "20": "Prepared vegetables and fruit", "21": "Miscellaneous edibles", "22": "Beverages and spirits",
  "23": "Food residues and fodder", "24": "Tobacco", "25": "Salt, earth and stone", "26": "Ores and ash",
  "27": "Mineral fuels and oils", "28": "Inorganic chemicals", "29": "Organic chemicals",
  "30": "Pharmaceuticals", "31": "Fertilisers", "32": "Dyes and pigments", "33": "Perfumery and cosmetics",
  "34": "Soaps and waxes", "35": "Glues and enzymes", "36": "Explosives", "37": "Photographic goods",
  "38": "Miscellaneous chemicals", "39": "Plastics", "40": "Rubber", "41": "Raw hides and leather",
  "42": "Leather articles", "43": "Furskins", "44": "Wood", "45": "Cork", "46": "Straw and basketware",
  "47": "Wood pulp", "48": "Paper and paperboard", "49": "Printed books", "50": "Silk", "51": "Wool",
  "52": "Cotton", "53": "Other vegetable fibres", "54": "Man-made filaments", "55": "Man-made staple fibres",
  "56": "Wadding and nonwovens", "57": "Carpets", "58": "Special woven fabrics", "59": "Coated textiles",
  "60": "Knitted fabrics", "61": "Knitted apparel", "62": "Woven apparel", "63": "Other textile articles",
  "64": "Footwear", "65": "Headgear", "66": "Umbrellas", "67": "Prepared feathers", "68": "Stone and cement articles",
  "69": "Ceramics", "70": "Glass", "71": "Pearls, gems and precious metals", "72": "Iron and steel",
  "73": "Iron and steel articles", "74": "Copper", "75": "Nickel", "76": "Aluminium", "78": "Lead",
  "79": "Zinc", "80": "Tin", "81": "Other base metals", "82": "Tools and cutlery", "83": "Miscellaneous metal",
  "84": "Machinery and mechanical appliances", "85": "Electrical machinery and electronics",
  "86": "Railway vehicles", "87": "Vehicles", "88": "Aircraft", "89": "Ships and boats",
  "90": "Optical and medical instruments", "91": "Clocks and watches", "92": "Musical instruments",
  "93": "Arms and ammunition", "94": "Furniture and bedding", "95": "Toys and sports equipment",
  "96": "Miscellaneous manufactures", "97": "Works of art", "99": "Unclassified",
};

export function chapterName(chapter: string): string {
  return CHAPTER_NAMES[chapter] ?? `Chapter ${chapter}`;
}
