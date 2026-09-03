/**
 * Atlas loader (server only).
 *
 * Reads the census counts from disk. Types and constants live in
 * `census-shared.ts` so client components can import them without pulling
 * `node:fs` into the browser bundle.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CENSUS_SPECS } from "./census-specs";
import type { MetricCount, AtlasData } from "./census-shared";

export * from "./census-shared";

const FILE = join(process.cwd(), "data/census/counts.json");

let cached: AtlasData | null = null;

export function getAtlas(): AtlasData {
  if (cached) return cached;
  let file: { builtAt?: string; metrics?: Record<string, MetricCount> } = {};
  try {
    if (existsSync(FILE)) file = JSON.parse(readFileSync(FILE, "utf8"));
  } catch { /* treated as absent */ }
  const held = file.metrics ?? {};
  const metrics = CENSUS_SPECS.map((s) => held[s.id]).filter((m): m is MetricCount => !!m);
  cached = {
    present: metrics.length > 0,
    builtAt: file.builtAt ?? null,
    metrics,
    specs: CENSUS_SPECS.filter((s) => held[s.id]),
    counted: metrics.length,
    declared: CENSUS_SPECS.length,
    capped: metrics.filter((m) => m.capped).map((m) => m.id),
  };
  return cached;
}

