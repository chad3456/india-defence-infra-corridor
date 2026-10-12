/**
 * Joining ECI's 2024 assembly-segment electorate to the constituencies on the
 * results pages. Server-only.
 *
 * The report names segments but does not number them, so the join is by name
 * within a state, in three steps, each used only where it is unambiguous:
 *
 *   1. exact, after folding case, spacing, punctuation and "(SC)/(ST)";
 *   2. near-exact spelling (Kukatpalle / Kukatpally): the one unmatched segment
 *      within a small edit distance, and only if no other is as close;
 *   3. order: the report lists each seat's segments in constituency-number
 *      order, so a run of unmatched segments between two matched ones is
 *      assigned in order — only when the run's length equals the gap in
 *      constituency numbers, and every number in the gap is itself unmatched.
 *      This is what places seats read from ECI's Hindi pages.
 *
 * Anything else stays unmatched and the page says so.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface SegmentElectors {
  ac: string; pc: string; page: number;
  m: number; f: number; tg: number; nri: number; serviceM: number; serviceF: number;
  electors: number; polledEvm: number;
}
export interface ElectorsFile {
  source: { publisher: string; title: string; url: string; file: string; pages: number };
  states: Record<string, { name: string; segments: SegmentElectors[] }>;
  problems: string[];
}
export type Match = "name" | "spelling" | "order";

let cache: ElectorsFile | null | undefined;
export function loadElectors(): ElectorsFile | null {
  if (cache !== undefined) return cache;
  try { cache = JSON.parse(readFileSync(join(process.cwd(), "data/elections/electors-ge2024.json"), "utf8")) as ElectorsFile; }
  catch { cache = null; }
  return cache;
}

const fold = (s: string) => s.toLowerCase().replace(/\((sc|st)\)/g, "").replace(/[^a-z]/g, "");

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length]![b.length]!;
}

/** Seat number → its segment's electorate and how the match was made. */
export function joinElectors(stateCode: string, seats: Array<{ no: number; name: string }>): Map<number, { seg: SegmentElectors; match: Match }> {
  const out = new Map<number, { seg: SegmentElectors; match: Match }>();
  const segs = loadElectors()?.states[stateCode]?.segments ?? [];
  if (!segs.length) return out;
  const used = new Set<number>();
  const byName = new Map<string, number[]>();
  segs.forEach((s, i) => byName.set(fold(s.ac), [...(byName.get(fold(s.ac)) ?? []), i]));

  // 1. exact
  for (const seat of seats) {
    const hits = byName.get(fold(seat.name)) ?? [];
    if (hits.length === 1 && !used.has(hits[0]!)) { out.set(seat.no, { seg: segs[hits[0]!]!, match: "name" }); used.add(hits[0]!); }
  }
  // 2. near-exact spelling
  for (const seat of seats) {
    if (out.has(seat.no)) continue;
    const f = fold(seat.name);
    if (f.length < 5) continue;
    const scored = segs.map((s, i) => ({ i, d: used.has(i) ? 99 : distance(f, fold(s.ac)) })).sort((a, b) => a.d - b.d);
    const best = scored[0], next = scored[1];
    const limit = Math.max(1, Math.floor(f.length / 6));
    if (best && best.d <= limit && (!next || next.d > best.d)) { out.set(seat.no, { seg: segs[best.i]!, match: "spelling" }); used.add(best.i); }
  }
  // 3. order, between anchors on both sides
  const segToNo = new Map<number, number>();
  for (const [no, { seg }] of out) segToNo.set(segs.indexOf(seg), no);
  const free = new Set(seats.map((s) => s.no).filter((n) => !out.has(n)));
  let prev: number | null = null;
  for (let i = 0; i < segs.length; i++) {
    if (!segToNo.has(i)) continue;
    if (prev !== null && segs[prev]!.pc === segs[i]!.pc) {
      const run = i - prev - 1, a = segToNo.get(prev)!, b = segToNo.get(i)!;
      if (run > 0 && b - a - 1 === run && Array.from({ length: run }, (_, k) => a + 1 + k).every((n) => free.has(n))) {
        for (let k = 0; k < run; k++) { out.set(a + 1 + k, { seg: segs[prev + 1 + k]!, match: "order" }); free.delete(a + 1 + k); }
      }
    }
    prev = i;
  }
  return out;
}

/** A Lok Sabha seat's electorate: its segments added up, matched by the seat's name. */
export function pcElectors(stateCode: string, pcName: string): { segments: SegmentElectors[]; m: number; f: number; tg: number; nri: number; service: number; electors: number; polledEvm: number } | null {
  const all = loadElectors()?.states[stateCode]?.segments ?? [];
  const pcs = [...new Set(all.map((s) => s.pc))];
  const want = fold(pcName);
  // Exact; else a unique prefix either way (a wrapped heading can be cut short:
  // "TONK-SAWAI" for Tonk-Sawai Madhopur); else one name within a small spelling distance.
  const pick = pcs.find((p) => fold(p) === want)
    ?? (() => { const c = pcs.filter((p) => fold(p).length >= 5 && (want.startsWith(fold(p)) || fold(p).startsWith(want))); return c.length === 1 ? c[0] : undefined; })()
    ?? (() => { const c = pcs.map((p) => ({ p, d: distance(want, fold(p)) })).sort((a, b) => a.d - b.d); return c[0] && c[0].d <= Math.max(1, Math.floor(want.length / 6)) && (!c[1] || c[1].d > c[0].d) ? c[0].p : undefined; })();
  const segs = pick ? all.filter((s) => s.pc === pick) : [];
  if (!segs.length) return null;
  const sum = (k: keyof SegmentElectors) => segs.reduce((a, s) => a + (s[k] as number), 0);
  return { segments: segs, m: sum("m"), f: sum("f"), tg: sum("tg"), nri: sum("nri"), service: sum("serviceM") + sum("serviceF"), electors: sum("electors"), polledEvm: sum("polledEvm") };
}
