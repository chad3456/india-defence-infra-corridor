/**
 * Server-side loader for /breakneck/india: India on the metrics Breakneck uses
 * for China and the United States.
 *
 * India's figures come from data/global/india-breakneck.json, each cited to the
 * publisher it was read from; the book's from data/global/breakneck-book.json
 * through `loadBreakneck().fig`; World Bank comparisons from
 * data/series/wdi.json at render time, so they move when the World Bank revises.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Comparable = "direct" | "approximate" | "context";

export interface InValue { label: string; value: number; unit: string; year?: string; hedge?: string; src: number }
export interface InSource { publisher: string; title: string; url: string }

export interface InMetric {
  id: string;
  theme: "build" | "make" | "people";
  title: string;
  book: string[];
  comparable: Comparable;
  india: InValue[];
  note: string;
  sources: InSource[];
  perCapita?: { series: string; period: string; per: number };
  invert?: { per: number; unit: string };
}

export interface InWdi { series: string; book: string[]; title: string; note?: string }
export interface InContext { id: string; title: string; india: InValue[]; note: string; sources: InSource[] }

export interface IndiaBreakneck {
  about: string;
  accessed: string;
  metrics: InMetric[];
  wdi: InWdi[];
  electronics: InContext[];
}

export interface WdiReading { country: string; iso3: string; value: number; period: string }
export interface WdiView { id: string; title: string; unit: string; india: WdiReading | null; peers: WdiReading[]; lastVerified: string }

interface WdiSeries {
  id: string; title: string; unit: string; lastVerified: string;
  points: Array<{ period: string; value: number | null }>;
  peers?: Array<{ country: string; iso3: string; value: number | null; period: string }>;
}

export function loadIndiaBreakneck(): IndiaBreakneck {
  return JSON.parse(readFileSync(join(process.cwd(), "data", "global", "india-breakneck.json"), "utf8")) as IndiaBreakneck;
}

let wdiCache: WdiSeries[] | null = null;
function wdiAll(): WdiSeries[] {
  if (!wdiCache) {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "data", "series", "wdi.json"), "utf8")) as WdiSeries[] | { series: WdiSeries[] };
    wdiCache = Array.isArray(raw) ? raw : raw.series;
  }
  return wdiCache;
}

/** India's latest reading and every peer's, from the committed World Bank file. */
export function wdi(id: string): WdiView {
  const s = wdiAll().find((x) => x.id === id);
  if (!s) throw new Error(`india-breakneck: no World Bank series "${id}"`);
  const last = [...s.points].reverse().find((p) => typeof p.value === "number");
  return {
    id, title: s.title, unit: s.unit, lastVerified: s.lastVerified,
    india: last ? { country: "India", iso3: "IND", value: last.value!, period: last.period } : null,
    peers: (s.peers ?? []).filter((p): p is WdiReading => typeof p.value === "number"),
  };
}

/** A World Bank reading for one period, for per-head arithmetic. */
export function wdiAt(id: string, period: string): number | null {
  const s = wdiAll().find((x) => x.id === id);
  return s?.points.find((p) => p.period === period)?.value ?? null;
}

/** An India value as the page prints it. */
export function fmtIn(v: InValue | { value: number; unit: string }): string {
  const { value, unit } = v;
  const num = (x: number) => x.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (unit === "year") return String(value);
  if (unit === "%") return `${num(value)}%`;
  if (unit === "% of GDP") return `${num(value)}% of GDP`;
  if (unit.startsWith("Rs ")) return `Rs ${num(value)} ${unit.slice(3)}`;
  if (unit === "US$ bn") return `$${num(value)}bn`;
  if (value >= 1e6 && !unit.includes("MW")) {
    const m = value / 1e6;
    return `${m.toLocaleString("en-US", { maximumFractionDigits: 1 })} million ${unit}`;
  }
  return `${num(value)} ${unit}`;
}
