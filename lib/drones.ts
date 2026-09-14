import raw from "@/data/global/drones.json";

/**
 * The drone operator record, typed for the page.
 *
 * Aggregates and nothing else. The one computation with any judgement in it is
 * `supplierOf`, and it exists because a country that flies types from three
 * suppliers is the interesting case and a map can only paint it one colour.
 */

export interface Operator { country: string; asWritten: string }

export interface DroneType {
  page: string;
  name: string;
  origin: string;
  klass: "combat" | "reconnaissance" | "loitering munition";
  operators: Operator[];
  nonState: string[];
  read: boolean;
  note?: string;
  sample?: string[];
  /** Whether operators came from list entries or a looser template scan. */
  method?: "list" | "templates";
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
  types: DroneType[];
  countries: Array<{ country: string; types: string[]; origins: string[] }>;
  suppliers: Array<{ origin: string; operators: number; countries: string[] }>;
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
