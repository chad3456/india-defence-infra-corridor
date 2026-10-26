/**
 * Religious structures demolished as encroachments (/demolitions): the shape
 * of the sourced register and the arithmetic done on it. No node imports.
 *
 * No national count exists. The register holds the figures governments,
 * courts and reporters have published, each for its own state and window.
 * Many overlap — a state's August total contains its May total — so they are
 * never summed wholesale. The page adds only the records marked `headline`,
 * chosen so no two cover the same structures, and calls the result a floor.
 */

export type Faith = "temple" | "mazar" | "mosque" | "madrasa" | "eidgah" | "gurdwara" | "church";
export const FAITHS: Array<{ id: Faith; label: string; one: string; colour: string }> = [
  { id: "mazar", label: "Mazars and dargahs", one: "Mazar", colour: "var(--series-1)" },
  { id: "madrasa", label: "Madrasas", one: "Madrasa", colour: "var(--series-2)" },
  { id: "mosque", label: "Mosques", one: "Mosque", colour: "var(--series-3)" },
  { id: "eidgah", label: "Eidgahs", one: "Eidgah", colour: "var(--series-4)" },
  { id: "temple", label: "Temples", one: "Temple", colour: "var(--s-hot)" },
  { id: "gurdwara", label: "Gurdwara encroachments", one: "Gurdwara", colour: "#8b6fd6" },
  { id: "church", label: "Churches", one: "Church", colour: "var(--story-ink-2)" },
];
export const UNSPECIFIED = { label: "Faith not stated", colour: "var(--story-rule)" };

export interface DemSource { id: string; publisher: string; title: string; url: string; published: string | null; accessed: string; tier: 1 | 2 | 3; kind: "press" | "court" | "advocacy" | "partisan" | "research" | "reference" }
export interface DemRecord { id: string; state: string; when: string; window: string; basis: "official" | "reported"; who: string; counts: Partial<Record<Faith, number>>; total: number; approx?: boolean; action: string; sources: string[]; quote: string; headline?: boolean; notes?: string }
export interface DemCase { date: string; state: string; faith: Faith; what: string; sources: string[] }
export interface DemPublished {
  about: string; accessed: string; sources: DemSource[]; records: DemRecord[]; cases: DemCase[];
  compilations: Array<{ id: string; name: string; window: string; value: number; what: string; caveat: string; sources: string[] }>;
  law: Array<{ date: string; what: string; sources: string[] }>;
  views: Array<{ who: string; said: string; sources: string[] }>;
  searches: string[];
}
export interface DemLive { fetchedAt: string; ok: boolean; headlines: Array<{ title: string; outlet: string; url: string; published: string | null; lang: string }> }

/** The part of a record's total no source assigns to a faith. */
export const unspecified = (r: DemRecord) => Math.max(0, r.total - Object.values(r.counts).reduce((a, v) => a + (v ?? 0), 0));

/** The documented floor: the headline records only, which do not overlap, with what is known of their faiths. */
export function floor(records: DemRecord[]) {
  const head = records.filter((r) => r.headline);
  const byFaith = Object.fromEntries(FAITHS.map((f) => [f.id, head.reduce((a, r) => a + (r.counts[f.id] ?? 0), 0)])) as Record<Faith, number>;
  const byState = new Map<string, { total: number; counts: Partial<Record<Faith, number>>; unspecified: number }>();
  for (const r of head) {
    const s = byState.get(r.state) ?? { total: 0, counts: {}, unspecified: 0 };
    s.total += r.total;
    s.unspecified += unspecified(r);
    for (const f of FAITHS) if (r.counts[f.id]) s.counts[f.id] = (s.counts[f.id] ?? 0) + r.counts[f.id]!;
    byState.set(r.state, s);
  }
  return {
    total: head.reduce((a, r) => a + r.total, 0),
    byFaith,
    unspecified: head.reduce((a, r) => a + unspecified(r), 0),
    byState: [...byState].map(([state, v]) => ({ state, ...v })).sort((a, b) => b.total - a.total),
    records: head,
  };
}

/** A headline about these demolitions: a religious structure and a demolition word. */
export const isDemolitionHeadline = (t: string) =>
  /mazar|dargah|mosque|masjid|madrasa|temple|mandir|shrine|church|gurdwara|eidgah|मजार|मस्जिद|मदरसा|मंदिर|दरगाह/i.test(t) &&
  /demolish|raze|bulldoz|encroach|removed|ध्वस्त|बुलडोजर|अतिक्रमण|गिराया/i.test(t);
