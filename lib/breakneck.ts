/**
 * Server-side loader for /breakneck, the visual study guide to Dan Wang's
 * *Breakneck* (2025).
 *
 * Every number the page draws is a figure in data/global/breakneck-book.json,
 * written by scripts/etl/connectors/breakneck-book.ts after it found the
 * figure's sentence in the book. The page reaches figures only through `fig`,
 * which throws on an unknown id, so a chart cannot quietly draw a number that
 * was never checked. Arithmetic on the book's figures (a ratio, a difference)
 * is done here or in the page and labelled as derived where it is shown.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BkChapter, BkEvent, BkFigure, BreakneckBook, ChapterId } from "./breakneck-shared";

export type { BkFigure, BkChapter, BkEvent, ChapterId };

export interface BreakneckView {
  book: BreakneckBook["book"];
  chapters: BkChapter[];
  figures: BkFigure[];
  cohorts: BkEvent[];
  fig: (id: string) => BkFigure;
  byChapter: (ch: ChapterId) => BkFigure[];
}

export function loadBreakneck(): BreakneckView {
  const raw = JSON.parse(readFileSync(join(process.cwd(), "data", "global", "breakneck-book.json"), "utf8")) as BreakneckBook;
  const map = new Map(raw.figures.map((f) => [f.id, f]));
  return {
    book: raw.book,
    chapters: raw.chapters,
    figures: raw.figures,
    cohorts: raw.cohorts,
    fig: (id) => {
      const f = map.get(id);
      if (!f) throw new Error(`breakneck: no verified figure "${id}"`);
      return f;
    },
    byChapter: (ch) => raw.figures.filter((f) => f.ch === ch),
  };
}

/** A value as the page prints it: money in $bn/$m, big counts in words, years plain. */
export function fmt(v: number, unit: string): string {
  const money = unit.startsWith("US$");
  const n = Math.abs(v);
  const trim = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(x < 10 ? 2 : 1).replace(/\.?0+$/, ""));
  if (unit === "year") return String(v);
  if (unit.startsWith("%")) return `${trim(v)}%`;
  if (money) {
    if (n >= 1e12) return `$${trim(v / 1e12)} trillion`;
    if (n >= 1e9) return `$${trim(v / 1e9)}bn`;
    if (n >= 1e6) return `$${trim(v / 1e6)}m`;
    return `$${v.toLocaleString("en-US")}`;
  }
  if (n >= 1e9) return `${trim(v / 1e9)} billion`;
  if (n >= 1e6) return `${trim(v / 1e6)} million`;
  return v.toLocaleString("en-US");
}

/** "p. 34 · World Bank study (2019)" */
export function cite(f: BkFigure): string {
  return `p. ${f.page ?? "?"}${f.credit && f.credit !== "the author" ? ` · ${f.credit}` : ""}`;
}

/** A figure's value with its unit, as a reader would say it: "2 × US length", "$36bn", "one in 7". */
export function show(f: BkFigure, which: 1 | 2 = 1): string {
  const [u1, u2] = f.unit.includes(", ") ? (f.unit.split(", ") as [string, string]) : [f.unit, f.unit];
  const u = which === 1 ? u1 : u2;
  const v = which === 1 ? f.value : f.value2!;
  if (u === "one in") return `one in ${v}`;
  const bare = u.startsWith("US$") || u.startsWith("%") || u === "year" || u === "";
  return `${fmt(v, u)}${bare ? (u.startsWith("US$ per") ? u.slice(3) : u.startsWith("% ") ? u.slice(1) : "") : ` ${u}`}`;
}
