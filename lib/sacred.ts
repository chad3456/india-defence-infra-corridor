import raw from "@/data/sacred/atlas.json";

/**
 * The sacred atlas, typed and shaped for the page.
 *
 * Nothing here invents a number. The one thing this module does that the
 * connector does not is aggregate — by state, by figure, by century — and each
 * aggregation carries the denominator it was drawn from, because the whole
 * risk on this subject is a share that reads as a finding about India when it
 * is a finding about a database.
 */

export interface Dedication {
  figure: string;
  basis: "stated" | "canonical" | "named";
  via?: string;
}

export interface Site {
  qid: string;
  name: string;
  lat: number;
  lon: number;
  state: string | null;
  dedications: Dedication[];
  inception: string | null;
  heritage: string | null;
}

export interface CanonMember { name: string; qid: string | null }

export interface CanonSet {
  id: string;
  label: string;
  /** Null where the tradition is a circuit rather than a dedication. */
  deity: string | null;
  note: string;
  /** How many members the tradition's own list names. */
  claimed: number;
  /** How many of those this atlas can place on the map. */
  placed: number;
  members: CanonMember[];
  problems?: string[];
}

export interface Toponym {
  modern: string;
  older: string;
  page: string;
  kind: "phonetic" | "official";
  region: string;
  gloss?: string;
  year?: number;
  /** The sentence in the cited article that carries the claim. */
  evidence: string | null;
  verified: boolean;
}

export interface CensusShare { year: number; group: string; percent: number }

export interface CensusLayer {
  region: string;
  source: string;
  page: string;
  startsAt: number;
  shares: CensusShare[];
  refusal: string;
  problems?: string[];
}

export interface Rejected {
  qid: string; name: string; lat: number; lon: number; why: string;
}

export interface Atlas {
  builtAt: string;
  source: string;
  note: string;
  coverage: {
    mapped: number;
    withStatedDedication: number;
    withCanonicalDedication?: number;
    withInception: number;
    withHeritage: number;
    withState: number;
    rejected: number;
  };
  rejected: Rejected[];
  /** Present only once the ingest that builds it has run. */
  canon?: CanonSet[];
  toponyms?: Toponym[];
  census?: CensusLayer | null;
  sites: Site[];
}

export function loadAtlas(): Atlas {
  return raw as unknown as Atlas;
}

export interface Tally { key: string; n: number }

function tally(pairs: Array<string | null>): Tally[] {
  const m = new Map<string, number>();
  for (const p of pairs) {
    if (!p) continue;
    m.set(p, (m.get(p) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([key, n]) => ({ key, n }))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
}

/** Sites per state, largest first. Sites with no resolved state are omitted. */
export function byState(sites: Site[]): Tally[] {
  return tally(sites.map((s) => s.state));
}

/** Sites per heritage designation. */
export function byHeritage(sites: Site[]): Tally[] {
  return tally(sites.map((s) => s.heritage));
}

/**
 * Sites per dedicated figure, within one basis.
 *
 * Deliberately takes a basis rather than defaulting to "all". Adding a stated
 * dedication to one inferred from a name produces a number with no meaning,
 * and a function that made that easy would eventually be called that way.
 */
export function byFigure(sites: Site[], basis: Dedication["basis"]): Tally[] {
  const out: string[] = [];
  for (const s of sites) {
    for (const d of s.dedications) if (d.basis === basis) out.push(d.figure);
  }
  return tally(out);
}

/**
 * Dated foundations per century.
 *
 * Wikidata stores an inception as a full date even when the source knew only a
 * century, so "0600-01-01" means the 7th century, not the first of January.
 * The page bins by century for that reason and says so; printing these as days
 * would manufacture a precision nobody claimed.
 */
export function byCentury(sites: Site[]): Array<{ century: number; n: number; label: string }> {
  const m = new Map<number, number>();
  for (const s of sites) {
    if (!s.inception) continue;
    const y = Number(s.inception.slice(0, 4));
    if (!Number.isFinite(y) || y === 0) continue;
    const c = Math.floor((y - 1) / 100) + 1;
    m.set(c, (m.get(c) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([century, n]) => ({ century, n, label: ordinal(century) }))
    .sort((a, b) => a.century - b.century);
}

function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  const s = ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${s}`;
}

/**
 * Census shares as one row per year, groups ordered by their latest size.
 *
 * Ordering by the most recent census rather than alphabetically keeps the
 * largest group in the same place across every year, which is what makes a
 * stacked row readable as a change over time rather than as a reshuffle.
 */
export function censusByYear(shares: CensusShare[]): Array<{
  year: number;
  parts: Array<{ group: string; percent: number }>;
}> {
  const years = [...new Set(shares.map((s) => s.year))].sort((a, b) => a - b);
  const latest = years[years.length - 1];
  const order = shares
    .filter((s) => s.year === latest)
    .sort((a, b) => b.percent - a.percent)
    .map((s) => s.group);

  return years.map((year) => ({
    year,
    parts: shares
      .filter((s) => s.year === year)
      .sort((a, b) => {
        const ia = order.indexOf(a.group), ib = order.indexOf(b.group);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      })
      .map((s) => ({ group: s.group, percent: s.percent })),
  }));
}
