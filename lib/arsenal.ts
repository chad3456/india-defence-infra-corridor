import raw from "@/data/global/arsenal.json";

/**
 * The arsenal tracker's data, typed and shaped for the page.
 *
 * The connector writes three layers into one file and this reads them back.
 * Nothing here computes a new number: the page's job is to show what the agent
 * found and how well corroborated it is, and a derived score on top of a
 * catalogue of who is arming whom would be exactly the wrong thing to add.
 */

export interface SystemEntry {
  name: string;
  key: string;
  kind: string;
  country: string | null;
  source: string;
}

export interface DealEvent {
  id: string;
  kind: "order" | "delivery" | "test";
  systems: string[];
  countries: string[];
  value: { amount: number; currency: string; asWritten: string } | null;
  date: string;
  outlet: string;
  url: string;
  headline: string;
  primary: boolean;
}

export interface EventGroup {
  key: string;
  systems: string[];
  countries: string[];
  kind: DealEvent["kind"];
  events: DealEvent[];
  outlets: string[];
  value: DealEvent["value"];
  verdict:
    | "a single report, uncorroborated"
    | "corroborated by independent outlets"
    | "from a primary source"
    | "outlets disagree on the value";
}

export interface CountryYear { iso3: string; name: string; year: number; value: number }

export interface SpineSpec {
  id: string; label: string; unit: string; source: string; slug: string;
}

export interface Arsenal {
  builtAt: string;
  note: string;
  gap: string;
  spineSpecs: SpineSpec[];
  spine: Record<string, CountryYear[]>;
  gazetteer: SystemEntry[];
  feeds: Array<{ outlet: string; ok: boolean; items: number; kept: number }>;
  events: DealEvent[];
  groups: EventGroup[];
}

export function loadArsenal(): Arsenal {
  return raw as unknown as Arsenal;
}

/** Latest reading per country for one spine series, largest first. */
export function latestByCountry(rows: CountryYear[]): CountryYear[] {
  const best = new Map<string, CountryYear>();
  for (const r of rows) {
    const prev = best.get(r.iso3);
    if (!prev || r.year > prev.year) best.set(r.iso3, r);
  }
  return [...best.values()].sort((a, b) => b.value - a.value);
}

/** One country's series, ascending by year. */
export function seriesFor(rows: CountryYear[], iso3: string): CountryYear[] {
  return rows.filter((r) => r.iso3 === iso3).sort((a, b) => a.year - b.year);
}

/**
 * Systems per country, for the catalogue.
 *
 * Country strings come from Wikipedia section headings and columns, so they
 * arrive as written — "United States", "USA", "Soviet Union/Russia". They are
 * normalised only where the variant is unambiguous, and left alone otherwise
 * rather than being forced into a list that would silently merge two states.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  "usa": "United States",
  "u.s.": "United States",
  "us": "United States",
  "united states of america": "United States",
  "uk": "United Kingdom",
  "great britain": "United Kingdom",
  "prc": "China",
  "people's republic of china": "China",
  "republic of korea": "South Korea",
  "dprk": "North Korea",
  "ussr": "Soviet Union",
  "soviet union / russia": "Soviet Union",
};

export function normaliseCountry(c: string): string {
  const t = c.trim().replace(/\s+/g, " ");
  return COUNTRY_ALIASES[t.toLowerCase()] ?? t;
}

export function systemsByCountry(gaz: SystemEntry[]): Array<{ country: string; systems: SystemEntry[] }> {
  const by = new Map<string, SystemEntry[]>();
  for (const s of gaz) {
    if (!s.country) continue;
    const c = normaliseCountry(s.country);
    (by.get(c) ?? by.set(c, []).get(c)!).push(s);
  }
  return [...by.entries()]
    .map(([country, systems]) => ({ country, systems: systems.sort((a, b) => a.name.localeCompare(b.name)) }))
    .filter((g) => g.systems.length >= 2)
    .sort((a, b) => b.systems.length - a.systems.length);
}
