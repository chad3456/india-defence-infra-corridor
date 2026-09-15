/**
 * The countrywise half of the semiconductor story.
 *
 * Server-only. Everything here is arithmetic over data/semi/world.json, which
 * a CI job fetched from UN Comtrade. No figure is typed in.
 *
 * ── The one thing a reader has to be told before any ranking ─────────────
 *
 * A chip export is a shipment, not a wafer. Hong Kong is the largest exporter
 * of integrated circuits on earth and fabricates none of them; they arrive and
 * leave. Taiwan, which fabricates most of the world's leading-edge silicon, is
 * in this data under the label "Other Asia, nes" because it has no UN seat.
 *
 * So `NOT_ONE_COUNTRY` is not housekeeping. It is the difference between a
 * chart that says where chips are made and one that says where chips move, and
 * every function here that returns a ranking also returns what it excluded.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface CountryValue { code: number; name: string; value: number }

export interface LineYear {
  exporters: CountryValue[];
  importers: CountryValue[];
  reportersAnswering: number;
  batchesFailed: number;
}

export interface Line {
  code: string;
  label: string;
  short: string;
  means: string;
  years: Record<string, LineYear>;
  indiaImportsBySource: CountryValue[];
  indiaExportsByDestination: CountryValue[];
  indiaPartnerYear: number | null;
}

export interface NotOneCountry {
  label: string;
  kind: "aggregate" | "unnamed" | "entrepot";
  note: string;
}

export interface SemiWorld {
  present: boolean;
  builtAt: string;
  source: string;
  unit: string;
  years: number[];
  reporterUniverse: number;
  refusal: string;
  caveats: string[];
  notOneCountry: Record<string, NotOneCountry>;
  lines: Line[];
  diagnostics?: { calls: number; failed: number; duplicateRowsSummed: number };
}

const EMPTY: SemiWorld = {
  present: false, builtAt: "", source: "", unit: "", years: [], reporterUniverse: 0,
  refusal: "", caveats: [], notOneCountry: {}, lines: [],
};

export function loadSemiWorld(): SemiWorld {
  try {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "data/semi/world.json"), "utf8"),
    ) as Partial<SemiWorld>;
    return { ...EMPTY, ...raw, present: (raw.lines?.length ?? 0) > 0 };
  } catch {
    return EMPTY;
  }
}

export const INDIA_CODE = 699;
/** Comtrade's code for Taiwan, which the source will not name. */
export const TAIWAN_CODE = 490;
export const HONG_KONG_CODE = 344;
export const EU_CODE = 97;

export function line(d: SemiWorld, code: string): Line | undefined {
  return d.lines.find((l) => l.code === code);
}

export function year(l: Line | undefined, y: number): LineYear | undefined {
  return l?.years[String(y)];
}

/**
 * A ranking with the aggregates taken out.
 *
 * `kinds` says which classes of non-country to drop. Aggregates always go: the
 * European Union alongside Germany and Ireland is a double count, full stop.
 * The entrepôt and the unnamed territory are real trade by real ports and are
 * kept by default — a chip ranking without Taiwan is a fiction — but any chart
 * about *fabrication* rather than *shipment* should drop the entrepôt, and
 * passing it here is how that gets said out loud.
 */
export function countriesOnly(
  rows: CountryValue[],
  notOne: Record<string, NotOneCountry>,
  drop: Array<NotOneCountry["kind"]> = ["aggregate"],
): { rows: CountryValue[]; excluded: Array<CountryValue & { why: NotOneCountry }> } {
  const kept: CountryValue[] = [];
  const excluded: Array<CountryValue & { why: NotOneCountry }> = [];
  for (const r of rows) {
    const why = notOne[String(r.code)];
    if (why && drop.includes(why.kind)) excluded.push({ ...r, why });
    else kept.push(r);
  }
  return { rows: kept, excluded };
}

/** Where a country sits in a ranking, one-based. 0 when it is not in it. */
export function rankOf(rows: CountryValue[], code: number): number {
  return rows.findIndex((r) => r.code === code) + 1;
}

export function valueOf(rows: CountryValue[], code: number): number {
  return rows.find((r) => r.code === code)?.value ?? 0;
}

/**
 * Exports as a share of imports, for one country on one line.
 *
 * The single most useful derived number in this file, and the one the India
 * story turns on: a country that sells as many chips as it buys is somewhere
 * in the industry; one that sells one dollar for every hundred it buys is a
 * customer. It is a ratio of two figures the same reporter filed in the same
 * year, so it is immune to the mirror asymmetry that makes cross-country
 * comparisons of levels shaky.
 */
export function cover(ly: LineYear | undefined, code: number): number | null {
  if (!ly) return null;
  const m = valueOf(ly.importers, code);
  const x = valueOf(ly.exporters, code);
  if (m <= 0) return null;
  return (x / m) * 100;
}

/** US dollars, as the story prints them. */
export function usd(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}bn`;
  if (abs >= 1e6) return `$${Math.round(v / 1e6)}m`;
  if (abs >= 1e3) return `$${Math.round(v / 1e3)}k`;
  return `$${Math.round(v)}`;
}

/**
 * Comtrade area code → ISO 3166-1 numeric, for the countries where they differ.
 *
 * The world map joins on the numeric ISO code that world-atlas uses as a
 * feature id. Comtrade's codes are M49 for most of the world and its own for
 * about a dozen reporters, several of which are the largest chip traders
 * there are. Without this, the United States, France and India would simply
 * not appear on the map, and nothing on the page would show the absence.
 *
 * Taiwan is here too. ISO gives it 158; the UN gives it no name. The map can
 * draw it because world-atlas carries the outline, which is the one place in
 * this project where a boundary the source declines to name gets drawn — and
 * the caption says so.
 */
const TO_ISO: Record<number, string> = {
  251: "250", // France
  381: "380", // Italy
  579: "578", // Norway
  757: "756", // Switzerland
  842: "840", // USA
  699: "356", // India
  711: "710", // South African Customs Union → South Africa
  490: "158", // "Other Asia, nes" → Taiwan
  58: "056",  // Belgium-Luxembourg → Belgium
  975: "999", // no outline
};

export function isoOf(code: number): string {
  const mapped = TO_ISO[code];
  if (mapped) return mapped;
  return String(code).padStart(3, "0");
}

/**
 * Places the 110-metre world atlas has no polygon for.
 *
 * Two of them are the first and fifth largest exporters of integrated circuits
 * on earth. A map that joined on outlines alone would omit both and look
 * complete doing it, which is why these are points rather than a smaller
 * ranking.
 */
const POINT_AT: Record<number, [number, number]> = {
  344: [114.17, 22.32], // Hong Kong
  702: [103.82, 1.35],  // Singapore
  470: [14.38, 35.9],   // Malta
  446: [113.55, 22.17], // Macao
  96: [114.72, 4.54],   // Brunei
};

export function pointFor(code: number): [number, number] | undefined {
  return POINT_AT[code];
}
