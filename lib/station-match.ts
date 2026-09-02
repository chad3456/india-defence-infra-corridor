/**
 * Match a station name as written to a station in the gazetteer.
 *
 * Route articles and OpenStreetMap disagree about what a station is called,
 * and neither is wrong: "KSR Bengaluru", "Krantivira Sangolli Rayanna Railway
 * Station" and "Bangalore City" are one place. Without a reconciliation every
 * route is a line with one end missing.
 *
 * The rule this follows is that a match must be earned, not assumed. A name
 * resolves on an exact normalised hit, then on a code, then on token
 * containment where the tokens are distinctive enough that a coincidence is
 * implausible. Anything short of that returns null, because a route drawn to
 * the wrong city is worse than a route not drawn.
 */

export interface StationLike { name: string; code: string | null; lon: number; lat: number }

/** Words that appear in station names and carry no identifying information. */
const NOISE = new Set([
  "railway", "station", "junction", "jn", "terminus", "terminal", "central",
  "city", "cantt", "cantonment", "the", "of", "and",
]);

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s: string): string[] {
  return normalise(s).split(" ").filter((t) => t.length > 2 && !NOISE.has(t));
}

/**
 * Names the same place goes by that no string comparison would connect.
 *
 * Kept small and explicit. Each entry is a rename or an initialism in common
 * use, not a guess at similarity — the whole point of this table is to hold
 * the cases where similarity scoring would be wrong.
 */
const ALIASES: Record<string, string> = {
  "ksr bengaluru": "krantivira sangolli rayanna",
  "smvt bengaluru": "sir m visvesvaraya",
  "bengaluru cantonment": "bangalore cantonment",
  "mumbai csmt": "chhatrapati shivaji maharaj terminus",
  "csmt": "chhatrapati shivaji maharaj terminus",
  "mumbai cst": "chhatrapati shivaji maharaj terminus",
  "howrah": "howrah",
  "ndls": "new delhi",
  "hazur sahib nanded": "nanded",
  "puratchi thalaivar dr mgr chennai central": "chennai central",
  "mgr chennai central": "chennai central",
  "banaras": "varanasi",
  "prayagraj": "prayagraj",
  "vijayawada": "vijayawada",
};

export interface Matcher {
  find(name: string): StationLike | null;
  /** Names that could not be resolved, for reporting rather than silence. */
  misses(): string[];
}

export function buildMatcher(stations: StationLike[]): Matcher {
  const byNorm = new Map<string, StationLike>();
  const byCode = new Map<string, StationLike>();
  const byToken = new Map<string, StationLike[]>();

  for (const st of stations) {
    const n = normalise(st.name);
    if (n && !byNorm.has(n)) byNorm.set(n, st);
    if (st.code && !byCode.has(st.code)) byCode.set(st.code.toUpperCase(), st);
    for (const t of tokens(st.name)) {
      const arr = byToken.get(t) ?? [];
      arr.push(st);
      byToken.set(t, arr);
    }
  }

  const missed = new Set<string>();

  function find(raw: string): StationLike | null {
    if (!raw) return null;
    const cleaned = raw.replace(/\s*railway station\s*$/i, "").trim();

    // 1. a code in the text, e.g. "New Delhi (NDLS)"
    const codeM = /\(([A-Z]{2,5})\)/.exec(raw);
    if (codeM?.[1]) {
      const hit = byCode.get(codeM[1]);
      if (hit) return hit;
    }
    // 2. exact, on the normalised form
    const n = normalise(cleaned);
    const exact = byNorm.get(n);
    if (exact) return exact;
    // 3. a known alias
    const alias = ALIASES[n];
    if (alias) {
      const viaAlias = byNorm.get(normalise(alias));
      if (viaAlias) return viaAlias;
      const partial = [...byNorm.entries()].find(([k]) => k.includes(normalise(alias)));
      if (partial) return partial[1];
    }
    // 4. distinctive tokens: every token of the query must appear in the
    //    candidate, and the query must carry at least one token that is rare
    //    enough for the hit not to be a coincidence.
    const qt = tokens(cleaned);
    if (qt.length > 0) {
      const rare = qt.filter((t) => (byToken.get(t)?.length ?? 0) > 0 && (byToken.get(t)?.length ?? 0) <= 12);
      const pool = rare.length > 0 ? (byToken.get(rare[0]!) ?? []) : [];
      const hit = pool.find((st) => {
        const ct = new Set(tokens(st.name));
        return qt.every((t) => ct.has(t));
      });
      if (hit) return hit;
    }
    missed.add(raw);
    return null;
  }

  return { find, misses: () => [...missed] };
}
