import raw from "@/data/global/drones.json";

/**
 * The drone operator record, typed for the page.
 *
 * Aggregates and nothing else. The one computation with any judgement in it is
 * `supplierOf`, and it exists because a country that flies types from three
 * suppliers is the interesting case and a map can only paint it one colour.
 */

export interface Operator {
  country: string;
  asWritten: string;
  /** The subsection it sat under — "Former operators", "Potential operators". */
  via?: string;
}

export interface DroneType {
  page: string;
  name: string;
  /** The producer as this project writes it: "Türkiye", "United States". */
  origin: string;
  /** The same producer as the world atlas writes it: "Turkey", "United States of America". */
  originCountry?: string;
  klass: "combat" | "reconnaissance" | "loitering munition";
  operators: Operator[];
  nonState: string[];
  read: boolean;
  note?: string;
  sample?: string[];
  /** Whether operators came from list entries or a looser template scan. */
  method?: "list" | "templates" | "headings";
  /** The article counting its own operators, where it does. */
  statedReach?: string;
}

export interface Drones {
  builtAt: string;
  source: string;
  note: string;
  gap: string;
  originNote: string;
  readCount: number;
  typeCount: number;
  countryCount: number;
  faults: string[];
  /** Rows read from a Former or Potential subsection. Absent on older files. */
  provisionalRows?: number;
  viaNote?: string;
  types: DroneType[];
  countries: Array<{ country: string; types: string[]; origins: string[] }>;
  suppliers: Array<{
    origin: string;
    /** Absent on files built before the atlas spelling was recorded. */
    originCountry?: string;
    operators: number;
    countries: string[];
  }>;
}

export function loadDrones(): Drones {
  return raw as unknown as Drones;
}

/**
 * The supplier a country's fleet leans on, for colouring one mark.
 *
 * A country flying types from three suppliers cannot be painted three colours,
 * and picking the first alphabetically would be arbitrary in a way a reader
 * would never see. So the rule is: the supplier of the most of that country's
 * types, and where two tie, the country is "mixed" rather than assigned to
 * either. Mixed is a real category here — it is what buying from everyone
 * looks like, and it is the thing a single-colour map most easily hides.
 */
export function supplierOf(origins: string[], types: string[], all: DroneType[]): string {
  if (origins.length === 1) return origins[0]!;
  const counts = new Map<string, number>();
  for (const t of types) {
    const type = all.find((x) => x.name === t);
    if (!type) continue;
    counts.set(type.origin, (counts.get(type.origin) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return "mixed";
  const top = ranked[0]!;
  if (ranked.length > 1 && ranked[1]![1] === top[1]) return "mixed";
  return top[0];
}

/** Operator countries per class of type, each with its denominator. */
export function byClass(d: Drones): Array<{ klass: string; countries: number; types: number }> {
  const m = new Map<string, { c: Set<string>; t: number }>();
  for (const t of d.types) {
    if (!t.read) continue;
    const e = m.get(t.klass) ?? { c: new Set<string>(), t: 0 };
    e.t += 1;
    for (const o of t.operators) e.c.add(o.country);
    m.set(t.klass, e);
  }
  return [...m.entries()]
    .map(([klass, v]) => ({ klass, countries: v.c.size, types: v.t }))
    .sort((a, b) => b.countries - a.countries);
}

/** Types whose operator list could not be read, with the reason. */
export function unread(d: Drones): DroneType[] {
  return d.types.filter((t) => t.operators.length === 0);
}

/**
 * One colour per producing country, in a fixed order that must not be sorted.
 *
 * The palette was validated as a sequence — the colour-vision check tests
 * adjacent pairs, and the first ordering tried failed deutan at ΔE 5.7 because
 * red sat next to green. Assigning by rank, or by whatever order the data
 * happens to arrive in, would quietly undo that. So the order is declared here
 * and the map reads it.
 *
 * "Mixed" is achromatic on purpose. It is not an eighth supplier; it is the
 * absence of a leading one, and giving it a hue would put it in the same
 * visual class as the seven.
 */
export const SUPPLIER_ORDER = [
  "Türkiye", "United States", "China", "Israel", "Iran", "Russia", "India",
] as const;

export function supplierColour(origin: string): string {
  const i = SUPPLIER_ORDER.indexOf(origin as (typeof SUPPLIER_ORDER)[number]);
  return i >= 0 ? `var(--sup-${i + 1})` : "var(--text-muted)";
}

/**
 * A country's leading supplier and how clear-cut it is.
 *
 * Returns the count as well as the name, because "four of five types from one
 * supplier" and "two of three" are different facts and the panel should be
 * able to say which. A tie is "mixed" rather than a coin flip.
 */
export function leadSupplier(
  types: string[], all: DroneType[],
): { origin: string; of: number; total: number } {
  const counts = new Map<string, number>();
  for (const t of types) {
    const type = all.find((x) => x.name === t);
    if (!type) continue;
    counts.set(type.origin, (counts.get(type.origin) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const top = ranked[0];
  if (!top) return { origin: "mixed", of: 0, total: 0 };
  if (ranked.length > 1 && ranked[1]![1] === top[1]) return { origin: "mixed", of: top[1], total };
  return { origin: top[0], of: top[1], total };
}

/** Operator rows read from a Former or Potential subsection, per type. */
export function provisionalOf(t: DroneType): number {
  return t.operators.filter((o) => o.via && /\b(former|potential|prospective)\b/i.test(o.via)).length;
}
