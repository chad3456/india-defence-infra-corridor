/**
 * Shapes the AI tracker renders, with no node builtins so a client component
 * can import them. See lib/census-shared.ts for why this split exists at all.
 */

export interface AiModel {
  id: string;
  author: string;
  createdAt: string | null;
  lastModified: string | null;
  downloads: number | null;
  likes: number | null;
  task: string | null;
  license: string | null;
  languages: string[];
  gated: boolean;
}

export interface Lab {
  author: string;
  org: string;
  country: "India" | "control";
  note: string;
  /** Present when the account published nothing, saying so in words. */
  note2?: string;
  models: AiModel[];
}

export interface FrontierModel {
  name: string;
  organisation: string;
  country: string;
  countries: string[];
  published: string | null;
  parameters: string | null;
  trainingCompute: string | null;
}

export interface AiRecord {
  present: boolean;
  builtAt: string | null;
  sources: string[];
  whatAnAuthorIs: string;
  noFunding: string;
  downloadsNote: string;
  controlsNote: string;
  labCount: number;
  indianModelCount: number;
  indicModelCount: number;
  languagesCovered: Array<{ code: string; models: number }>;
  byYear: Array<{ year: number; models: number }>;
  labs: Lab[];
  frontier: {
    columns: string[];
    rowCount: number;
    droppedRows: number;
    note: string;
    byCountry: Array<{ country: string; models: number }>;
    indiaModels: FrontierModel[];
    models: FrontierModel[];
  };
}

/**
 * The scheduled languages, by their ISO 639-1 or 639-2 code.
 *
 * Named here rather than looked up, because a code with no name renders as
 * "or" or "as" — which read as English words and make a chart look broken.
 * The list is the Eighth Schedule plus the codes that actually appear on
 * model cards.
 */
export const LANGUAGE_NAME: Record<string, string> = {
  hi: "Hindi", bn: "Bengali", te: "Telugu", mr: "Marathi", ta: "Tamil",
  ur: "Urdu", gu: "Gujarati", kn: "Kannada", ml: "Malayalam", or: "Odia",
  pa: "Punjabi", as: "Assamese", mai: "Maithili", sa: "Sanskrit",
  ne: "Nepali", sd: "Sindhi", kok: "Konkani", doi: "Dogri",
  mni: "Manipuri", sat: "Santali", ks: "Kashmiri", brx: "Bodo",
  bho: "Bhojpuri", awa: "Awadhi", en: "English",
};

export function languageName(code: string): string {
  return LANGUAGE_NAME[code] ?? code;
}

/** The labs that actually published something, largest first. */
export function publishingLabs(d: AiRecord): Lab[] {
  return d.labs
    .filter((l) => l.country === "India" && l.models.length > 0)
    .sort((a, b) => b.models.length - a.models.length);
}

/** The Indian accounts that published nothing, which is its own finding. */
export function silentLabs(d: AiRecord): Lab[] {
  return d.labs.filter((l) => l.country === "India" && l.models.length === 0);
}

export function controls(d: AiRecord): Lab[] {
  return d.labs.filter((l) => l.country === "control");
}

/** Earliest and latest publication date across a lab's models. */
export function span(models: AiModel[]): { first: string | null; last: string | null } {
  const dates = models.map((m) => m.createdAt).filter((d): d is string => Boolean(d)).sort();
  return { first: dates[0] ?? null, last: dates[dates.length - 1] ?? null };
}
