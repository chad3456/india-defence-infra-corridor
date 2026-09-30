/**
 * Server-side loader for /namesakes.
 *
 * Reads the ingest's file, applies the hand review, and builds what the page
 * draws: the country as map-unit polygons for the 3D slab, and every place
 * with its evidence. Every count the page prints is computed here from those
 * rows — the page writes no number of its own.
 *
 * ── The hand review ──────────────────────────────────────────────────────
 *
 * `data/namesakes/review.json` holds decisions made by reading the quoted
 * sentence: `reject` removes one figure's evidence from one place (the
 * sentence names someone else, or the rule matched a list), `accept` promotes
 * a held sentence onto the map. Each carries its reason. Nothing is added
 * that the ingest did not find; review only subtracts, or confirms what was
 * held back.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import {
  FIGURES, type Category, type Evidence, type Lookalike, type NameCount, type Namesakes,
  type Place, type RoadSet, type Tier,
} from "./namesakes-shared";

const ROOT = process.cwd();

export interface ReviewEntry { qid: string; figure: string; verdict: "reject" | "accept"; why: string }

/** Projection to map units: a plain equirectangular, squeezed by cos(latitude). */
const LON0 = 82.8, LAT0 = 22.6, SCALE = 0.9, COS = Math.cos((22.6 * Math.PI) / 180);
export function project(lon: number, lat: number): [number, number] {
  return [Math.round((lon - LON0) * COS * SCALE * 1000) / 1000, Math.round((lat - LAT0) * SCALE * 1000) / 1000];
}

export interface NsPlace {
  i: number;
  qid: string;
  name: string;
  what: string | null;
  category: Category;
  state: string | null;
  locatedIn: string | null;
  lat: number | null;
  lon: number | null;
  x: number | null;
  y: number | null;
  /** Figures this place is named after, strongest evidence first. */
  figures: string[];
  evidence: Evidence[];
  wikipedia: string | null;
}

export interface FigureCount {
  id: string;
  name: string;
  kind: "god" | "leader";
  qid: string | null;
  total: number;
  placed: number;
  byTier: Record<Tier, number>;
  byCategory: Partial<Record<Category, number>>;
}

export interface NsView {
  present: boolean;
  generatedAt: string | null;
  shape: {
    polygons: Array<Array<Array<[number, number]>>>;
    outline: Array<Array<[number, number]>>;
    borders: Array<Array<[number, number]>>;
  };
  places: NsPlace[];
  counts: FigureCount[];
  /** Temples dropped from the gods' layer, per god: dedicated, not named after. */
  temples: Record<string, number>;
  /** Schemes, awards and programmes, per figure: named after, but not places. */
  schemes: Record<string, number>;
  held: number;
  reviewed: { rejected: number; accepted: number };
  lookalikes: Lookalike[];
  roads: RoadSet[] | null;
  nameCounts: NameCount[] | null;
  funnel: Record<string, number>;
  errorCount: number;
}

const TIER_ORDER: Tier[] = ["stated", "quoted", "named"];

function ring(r: Position[]): Array<[number, number]> {
  return r.map(([lon, lat]) => project(lon ?? 0, lat ?? 0));
}

function loadShape(): NsView["shape"] {
  const file = join(ROOT, "data", "geo", "india-states.topo.json");
  const t = JSON.parse(readFileSync(file, "utf8")) as Topology<{ india: GeometryCollection<{ name: string | null }> }>;
  const fc = feature(t, t.objects.india);
  const polygons: NsView["shape"]["polygons"] = [];
  for (const f of fc.features as Array<Feature<Polygon | MultiPolygon>>) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const p of polys) polygons.push(p.map(ring));
  }
  const outer = mesh(t, t.objects.india, (a, b) => a === b);
  const inner = mesh(t, t.objects.india, (a, b) => a !== b);
  return {
    polygons,
    outline: outer.coordinates.map(ring),
    borders: inner.coordinates.map(ring),
  };
}

function loadReview(): ReviewEntry[] {
  const file = join(ROOT, "data", "namesakes", "review.json");
  if (!existsSync(file)) return [];
  return (JSON.parse(readFileSync(file, "utf8")) as { entries: ReviewEntry[] }).entries;
}

export function loadNamesakesRaw(): Namesakes | null {
  const file = join(ROOT, "data", "namesakes", "namesakes.json");
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as Namesakes;
}

const GODS = new Set(FIGURES.filter((f) => f.kind === "god").map((f) => f.id));

export function loadNamesakes(): NsView {
  const shape = loadShape();
  const raw = loadNamesakesRaw();
  if (!raw) {
    return {
      present: false, generatedAt: null, shape, places: [], counts: [], temples: {}, schemes: {}, held: 0,
      reviewed: { rejected: 0, accepted: 0 }, lookalikes: [], roads: null, nameCounts: null, funnel: {}, errorCount: 0,
    };
  }
  const review = loadReview();
  const rejected = new Set(review.filter((r) => r.verdict === "reject").map((r) => `${r.qid}:${r.figure}`));
  const accepted = new Set(review.filter((r) => r.verdict === "accept").map((r) => `${r.qid}:${r.figure}`));

  const temples: Record<string, number> = {};
  const schemes: Record<string, number> = {};
  const places: NsPlace[] = [];
  let held = 0;
  for (const p of raw.places as Place[]) {
    let ev = p.evidence.filter((e) => !rejected.has(`${p.qid}:${e.figure}`));
    for (const h of p.held ?? []) {
      if (accepted.has(`${p.qid}:${h.figure}`)) ev.push(h);
      else if (!ev.some((e) => e.figure === h.figure)) held++;
    }
    // A temple is dedicated to its god, which is a different claim from being
    // named after one; it is counted aside, never pinned on the gods' map.
    if (p.category === "religious") {
      for (const e of ev) if (GODS.has(e.figure)) temples[e.figure] = (temples[e.figure] ?? 0) + 1;
      ev = ev.filter((e) => !GODS.has(e.figure));
    }
    if (!ev.length) continue;
    // A scheme or an award carries the name but is not a place or an
    // institution; it is counted to one side, not listed as one.
    if (p.category === "scheme") {
      for (const f of new Set(ev.map((e) => e.figure))) schemes[f] = (schemes[f] ?? 0) + 1;
      continue;
    }
    ev.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
    const figures = [...new Set(ev.map((e) => e.figure))];
    const xy = p.lat !== null && p.lon !== null ? project(p.lon, p.lat) : null;
    places.push({
      i: places.length, qid: p.qid, name: p.name, what: p.description, category: p.category,
      state: p.state, locatedIn: p.locatedIn, lat: p.lat, lon: p.lon,
      x: xy ? xy[0] : null, y: xy ? xy[1] : null,
      figures, evidence: ev,
      wikipedia: p.enwiki ? `https://en.wikipedia.org/wiki/${encodeURIComponent(p.enwiki.replace(/ /g, "_"))}` : null,
    });
  }

  const counts: FigureCount[] = raw.figures.map((f) => {
    const mine = places.filter((p) => p.figures.includes(f.id));
    const byTier: Record<Tier, number> = { stated: 0, quoted: 0, named: 0 };
    const byCategory: Partial<Record<Category, number>> = {};
    for (const p of mine) {
      // Counted once, at its strongest tier for this figure.
      const best = p.evidence.find((e) => e.figure === f.id)!.tier;
      byTier[best]++;
      byCategory[p.category] = (byCategory[p.category] ?? 0) + 1;
    }
    return { id: f.id, name: f.name, kind: f.kind, qid: f.qid, total: mine.length, placed: mine.filter((p) => p.x !== null).length, byTier, byCategory };
  });

  return {
    present: true,
    generatedAt: raw.generatedAt,
    shape,
    places,
    counts,
    temples,
    schemes,
    held,
    reviewed: { rejected: rejected.size, accepted: accepted.size },
    lookalikes: raw.lookalikes,
    roads: raw.roads,
    nameCounts: raw.nameCounts,
    funnel: raw.funnel,
    errorCount: raw.errors.length,
  };
}
