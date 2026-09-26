/**
 * Types and pure helpers for the Project Maven piece, safe to import from a
 * client component. The reader that touches the filesystem is `maven-book.ts`;
 * this file must never import from it (`npm run test:client` enforces that no
 * node builtin reaches the browser bundle).
 */

export type Claim = "reported" | "participant" | "document" | "public" | "contested";

export interface Cited { chapter: string; page: number | null }

export interface Figure extends Cited {
  id: string;
  group: string;
  label: string;
  value: number;
  unit: string;
  qualifier: string;
  when: string;
  who: string;
  claim: Claim;
  what: string;
}

export interface Beat extends Cited {
  id: string; date: string; part: string; label: string; what: string; claim: Claim;
}

export interface Account extends Cited { who: string; says: string }

export interface Scene extends Cited {
  id: string; date: string; place: string; title: string;
  ai: "found" | "missed" | "off" | "failed" | "helped";
  what: string;
  accounts: Account[];
}

export interface Voice extends Cited {
  id: string; who: string; role: string; quote: string; stance: "for" | "against" | "doubt";
}

export interface Where extends Cited {
  iso: string; name: string; kind: "deployed" | "support" | "watched";
  position: [number, number] | null;
}

export interface Phase extends Cited { id: string; label: string }

export interface Cycle {
  phases: Phase[];
  removed: Cited & { what: string };
  remaining: Cited & { what: string };
  policy: Cited & { what: string };
}

export interface MavenBook {
  present: boolean;
  builtAt: string;
  book: { title: string; author: string; publisher: string; year: number; isbn: string; note: string };
  parts: Array<{ id: string; title: string; chapters: string[] }>;
  method: string;
  claims: Record<Claim, string>;
  cannotSay: string[];
  figures: Figure[];
  layers: Array<Cited & { id: string; label: string; quote: string }>;
  cycle: Cycle;
  beats: Beat[];
  scenes: Scene[];
  voices: Voice[];
  where: Where[];
}

export const CLAIM_LABEL: Record<Claim, string> = {
  reported: "The author's reporting",
  participant: "A participant's account",
  document: "A document the author reviewed",
  public: "Public record",
  contested: "Accounts conflict",
};

/** "p. 197" or "ch. 16" when the page could not be read. */
export function cite(c: Cited): string {
  return c.page ? `p. ${c.page}` : c.chapter;
}

/** A figure as the book states it, hedge included: "under 100". */
export function stated(f: Pick<Figure, "value" | "qualifier" | "unit">, withUnit = false): string {
  const v = f.unit.startsWith("million dollars") ? `$${fmt(f.value)}m`
    : f.unit.startsWith("billion dollars") ? `$${fmt(f.value)}bn`
      : f.unit.startsWith("percent") ? `${fmt(f.value)}%`
        : fmt(f.value);
  const unit = withUnit && !/dollars|percent/.test(f.unit) ? ` ${f.unit}` : "";
  return `${f.qualifier ? `${f.qualifier} ` : ""}${v}${unit}`;
}

export function fmt(n: number): string {
  if (n >= 1e9) return `${fmt(n / 1e9)} billion`;
  if (n >= 1e6 && Number.isInteger(n / 1e6)) return `${fmt(n / 1e6)} million`;
  return n.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

export function byId<T extends { id: string }>(xs: T[], id: string): T | undefined {
  return xs.find((x) => x.id === id);
}

/** "2019-10" → "October 2019"; "2020-01-02" → "2 January 2020"; "" → "". */
export function when(date: string): string {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December"];
  const month = m ? MONTHS[Number(m) - 1] : "";
  if (d) return `${Number(d)} ${month} ${y}`;
  if (month) return `${month} ${y}`;
  return y ?? "";
}
