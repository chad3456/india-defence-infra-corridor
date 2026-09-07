/**
 * Reading the box office file from disk.
 *
 * Server-only: this imports node:fs. Anything a client component needs lives
 * in lib/cinema-shared.ts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readTrend, type Film, type FilmRow } from "./cinema-shared";

export * from "./cinema-shared";

export interface CinemaData {
  present: boolean;
  builtAt: string | null;
  /** Every day the ingest has run, so gaps in the trend are visible. */
  runs: string[];
  films: FilmRow[];
  /** Films carrying a reported gross — the rest are listed, not ranked. */
  reported: number;
  languages: Array<{ language: string; films: number; reported: number; croreTotal: number }>;
}

interface RawFilm {
  id: string; title: string; language: string; year: number;
  bestRank: number | null;
  snapshots: Array<{ date: string; croreGross: number }>;
}

export function loadCinema(): CinemaData {
  let raw: { builtAt?: string; runs?: string[]; films?: Record<string, RawFilm> };
  try {
    raw = JSON.parse(readFileSync(join(process.cwd(), "data/cinema/box-office.json"), "utf8"));
  } catch {
    return { present: false, builtAt: null, runs: [], films: [], reported: 0, languages: [] };
  }

  const films: FilmRow[] = Object.values(raw.films ?? {}).map((f) => {
    const latest = f.snapshots[f.snapshots.length - 1] ?? null;
    // The trend is read from the daily *change* in cumulative gross, since a
    // cumulative figure only ever rises and would read as growth forever.
    const asFilm: Film = {
      id: f.id, title: f.title, language: f.language, releaseDate: null,
      observations: f.snapshots.map((s, i) => ({
        date: s.date,
        presence: i === 0 ? 0 : Math.max(0, s.croreGross - f.snapshots[i - 1]!.croreGross),
      })).slice(1),
    };
    return {
      id: f.id, title: f.title, language: f.language, year: f.year,
      bestRank: f.bestRank,
      croreGross: latest?.croreGross ?? null,
      trend: readTrend(asFilm),
    };
  });

  const byLanguage = new Map<string, { films: number; reported: number; croreTotal: number }>();
  for (const f of films) {
    const e = byLanguage.get(f.language) ?? { films: 0, reported: 0, croreTotal: 0 };
    e.films++;
    if (f.croreGross !== null) { e.reported++; e.croreTotal += f.croreGross; }
    byLanguage.set(f.language, e);
  }

  return {
    present: films.length > 0,
    builtAt: raw.builtAt ?? null,
    runs: raw.runs ?? [],
    films: films.sort((a, b) => (b.croreGross ?? -1) - (a.croreGross ?? -1)),
    reported: films.filter((f) => f.croreGross !== null).length,
    languages: [...byLanguage.entries()]
      .map(([language, v]) => ({ language, ...v }))
      .sort((a, b) => b.croreTotal - a.croreTotal || b.films - a.films),
  };
}
