/**
 * NFHS-6 (2023–24) fact sheets: reading a key-indicators page into rows, and
 * the shape of what is published from them. No node imports — the map reads
 * the types in the browser, and the parser runs in the connector and tests.
 *
 * ── How a page is read ────────────────────────────────────────────────────
 *
 * A fact-sheet page is a table with numbered indicator labels on the left —
 * wrapping onto indented continuation lines — and value columns on the right:
 * Urban, Rural, Total for NFHS-6 and Total for NFHS-5 on the India and state
 * sheets. Lines do not line up (a two-line label's values sit between its
 * lines; a footnote mark sits beside the label), so this reads by position,
 * not by line: the header row fixes each column's x; a value belongs to the
 * column whose header it sits under, and to the indicator whose numbered label
 * is the nearest one above it. Footnote marks in the label area are dropped.
 *
 * ── Markings, as the fact sheets define them ──────────────────────────────
 *
 * "(7.5)" — based on 25–49 unweighted cases: kept, flagged small.
 * "*"     — fewer than 25 unweighted cases: suppressed, kept as null.
 * "na"    — not available for that round: null.
 */

export interface Fragment { text: string; x: number; y: number }

export type Mark = "" | "small" | "suppressed" | "na";
export interface Cell { v: number | null; mark: Mark }

export interface ParsedRow {
  n: number;
  label: string;
  unit: string;
  section: string;
  /** Cells by column name: urban, rural, total, prev (NFHS-5 total). */
  cells: Partial<Record<Column, Cell>>;
}
export type Column = "urban" | "rural" | "total" | "prev";

export interface ParsedPage { geo: string | null; columns: Column[]; rows: ParsedRow[]; problems: string[] }

const VALUE = /^\(?\d{1,4}(?:\.\d+)?\)?$|^\*$|^na$/i;
const FOOTNOTE = /^(?:\d{1,2}|\+|\*|†|‡)$/;

export function parseCell(t: string): Cell {
  const s = t.trim();
  if (s === "*") return { v: null, mark: "suppressed" };
  if (/^na$/i.test(s)) return { v: null, mark: "na" };
  const small = /^\(.*\)$/.test(s);
  const v = Number(s.replace(/[()]/g, ""));
  return Number.isFinite(v) ? { v, mark: small ? "small" : "" } : { v: null, mark: "na" };
}

/** Column names for a header row of n value columns: the last is always NFHS-5's total. */
function columnsFor(n: number): Column[] {
  if (n >= 4) return ["urban", "rural", "total", "prev"];
  if (n === 3) return ["rural", "total", "prev"];
  if (n === 2) return ["total", "prev"];
  return ["total"];
}

export function parsePage(frags: Fragment[]): ParsedPage {
  const problems: string[] = [];
  const all = frags.filter((f) => f.text.trim());
  const geoFrag = all.find((f) => /-\s*Key Indicators\s*$/i.test(f.text));
  const geo = geoFrag ? geoFrag.text.replace(/\s*-\s*Key Indicators\s*$/i, "").replace(/\s+/g, " ").trim() : null;
  // The header row: Urban / Rural / Total labels, or failing that, the round labels.
  const top = Math.max(...all.map((f) => f.y));
  let heads = all.filter((f) => /^(Urban|Rural|Total)$/i.test(f.text.trim()) && f.y > top - 70);
  const headY = heads.length ? Math.max(...heads.map((h) => h.y)) : top - 40;
  heads = heads.filter((h) => Math.abs(h.y - headY) < 4).sort((a, b) => a.x - b.x);
  if (heads.length < 2) {
    // District sheets may head their two columns with the rounds' years only.
    const rounds = all.filter((f) => /\(20\d\d\s*-\s*\d\d\)/.test(f.text) && f.y > top - 70).sort((a, b) => a.x - b.x);
    if (rounds.length >= 2) heads = rounds;
  }
  if (heads.length < 2) return { geo, columns: [], rows: [], problems: ["no header row found"] };
  const columns = columnsFor(heads.length);
  const colMin = heads[0]!.x;
  // The body: below the header row, except that a section heading may sit level with it, left of the columns.
  const body = all.filter((f) => f.y < headY - 2 || (f.y < headY + 1.5 && f.x < colMin - 60 && !/^Indicators$/i.test(f.text.trim())));
  const values = body.filter((f) => f.x >= colMin - 14 && VALUE.test(f.text.trim()));
  const labels = body.filter((f) => f.x < colMin - 14);

  // Label fragments grouped into lines: a number and its text are sometimes separate fragments.
  type Line = { text: string; x: number; y: number };
  const lines: Line[] = [];
  for (const f of [...labels].sort((p, q) => q.y - p.y || p.x - q.x)) {
    const ln = lines.find((l) => Math.abs(l.y - f.y) < 1.6);
    if (ln) { ln.text = ln.x <= f.x ? `${ln.text} ${f.text.trim()}` : `${f.text.trim()} ${ln.text}`; ln.x = Math.min(ln.x, f.x); }
    else lines.push({ text: f.text.trim(), x: f.x, y: f.y });
  }
  // Some pages set an indicator number's digits as separate glyphs ("1 1 . Children…"): join them.
  for (const l of lines) l.text = l.text.replace(/\s+/g, " ").trim().replace(/^((?:\d\s?){1,3})\s?\./, (_m, g: string) => `${g.replace(/\s/g, "")}.`);
  // A line that is only footnote marks (a superscript set off its baseline) is not part of any label.
  const isMark = (t: string) => t.split(" ").every((w) => FOOTNOTE.test(w.replace(/,$/, "")));
  const textLines = lines.filter((l) => !isMark(l.text));

  const NUM = /^(\d{1,3})\s*\.\s*(.*)$/;
  const starts = textLines.map((l) => ({ l, m: NUM.exec(l.text) })).filter((s): s is { l: Line; m: RegExpExecArray } => !!s.m).sort((a, b) => b.l.y - a.l.y);
  if (!starts.length) return { geo, columns, rows: [], problems: ["no numbered indicators found"] };
  const numberedX = Math.min(...starts.map((s) => s.l.x));
  // Section headings sit left of the numbers and are not numbered.
  const sections = textLines.filter((l) => l.x < numberedX - 1 && !NUM.test(l.text)).sort((a, b) => b.y - a.y);

  const rows: ParsedRow[] = starts.map((s, i) => {
    const y0 = s.l.y, y1 = starts[i + 1]?.l.y ?? -Infinity;
    const head = sections.filter((h) => h.y > y0).at(-1);
    // "Women" and "Men" sub-head a block: name them with the block's heading above them on the page.
    const parent = head && /^(Women|Men)$/i.test(head.text) ? sections.filter((h) => h.y > head.y && !/^(Women|Men)$/i.test(h.text)).at(-1) : undefined;
    const section = head ? (parent ? `${parent.text} · ${head.text}` : head.text) : "";
    const stopAt = sections.find((h) => h.y < y0 && h.y > y1)?.y ?? -Infinity;
    // A label wraps onto indented lines, two or three at most; footnotes start flush with the numbers and are not part of it.
    const cont = textLines.filter((l) => l !== s.l && l.y < y0 && l.y > Math.max(y1, stopAt, y0 - 26) && l.x > numberedX + 6 && !NUM.test(l.text));
    let text = [s.m[2]!, ...cont.map((l) => l.text)].join(" ").replace(/\s+/g, " ").trim();
    // Trailing footnote marks ("10,", "+") come off before the unit is read.
    for (let k = 0; k < 4; k++) text = text.replace(/\s+(?:\d{1,2},?|\+|†|‡)$/, "").trim();
    const unitMatch = /\(([^()]*)\)\s*$/.exec(text);
    const unit = unitMatch ? unitMatch[1]!.trim() : "";
    const label = (unitMatch ? text.slice(0, unitMatch.index) : text).replace(/kg\/m\s*\)/g, "kg/m²)").replace(/\s+-\s+/g, "-").trim();
    // Values: below the midpoint to the previous start (or the header), above the next start.
    const upper = i === 0 ? headY - 2 : Math.min((y0 + starts[i - 1]!.l.y) / 2, y0 + 2.5);
    const mine = values.filter((v) => v.y <= upper && v.y > y1 + 2.5);
    const cells: ParsedRow["cells"] = {};
    for (const v of mine) {
      let best = 0, bestD = Infinity;
      heads.forEach((h, k) => { const d = Math.abs(v.x - h.x - 8); if (d < bestD) { bestD = d; best = k; } });
      const col = columns[best]!;
      if (cells[col]) problems.push(`${s.m[1]}: two values under ${col}`);
      else cells[col] = parseCell(v.text);
    }
    return { n: Number(s.m[1]), label, unit, section, cells };
  });
  return { geo, columns, rows, problems };
}

/* ── What is published ─────────────────────────────────────────────────── */

export interface Nfhs6Indicator { n: number; label: string; unit: string; section: string }

/** One geography's values: [n, urban, rural, total, nfhs5 total], and the marks on any of them. */
export type Nfhs6Row = [number, number | null, number | null, number | null, number | null, string?];

export interface Nfhs6States {
  source: { url: string; title: string; released: string; publisher: string };
  fetchedAt: string;
  pages: number;
  indicators: Nfhs6Indicator[];
  /** By geography name as the fact sheet prints it; "India" is the national row. */
  geos: Record<string, Nfhs6Row[]>;
  problems: string[];
}

/** Units that are shares, so values must lie between 0 and 100. */
export const isPercent = (unit: string) => /^%$/.test(unit.trim());

/** Encode a row's marks compactly: one letter per column, "-" for none. */
export function marksOf(cells: ParsedRow["cells"]): string {
  const code = (m?: Mark) => (m === "small" ? "s" : m === "suppressed" ? "x" : m === "na" ? "n" : "-");
  const s = (["urban", "rural", "total", "prev"] as Column[]).map((c) => code(cells[c]?.mark)).join("");
  return s === "----" ? "" : s;
}

/* ── Reading published rows, for the map ───────────────────────────────── */

export type Area = "total" | "urban" | "rural";
const AREA_INDEX: Record<Area | "prev", number> = { urban: 1, rural: 2, total: 3, prev: 4 };

export function cellOf(rows: Nfhs6Row[] | undefined, n: number, area: Area | "prev"): number | null {
  const r = rows?.find((x) => x[0] === n);
  const v = r?.[AREA_INDEX[area]];
  return typeof v === "number" ? v : null;
}

/** The mark on one cell: "s" small sample, "x" suppressed, "n" not available, "" none. */
export function markOf(rows: Nfhs6Row[] | undefined, n: number, area: Area | "prev"): string {
  const m = rows?.find((x) => x[0] === n)?.[5];
  if (typeof m !== "string") return "";
  const ch = m[AREA_INDEX[area] - 1];
  return ch && ch !== "-" ? ch : "";
}

/** Change from NFHS-5 to NFHS-6 in the unit's own points — derived. Null unless both rounds have a value. */
export function changeOf(rows: Nfhs6Row[] | undefined, n: number): number | null {
  const now = cellOf(rows, n, "total"), then = cellOf(rows, n, "prev");
  return now === null || then === null ? null : Math.round((now - then) * 10) / 10;
}

/**
 * How an indicator is coloured. Stunting and wasting use WHO–UNICEF's
 * prevalence thresholds and underweight plain ten-point bands, as on the
 * NFHS-5 map; every other indicator is binned into quintiles of the
 * geographies shown (derived) on a neutral ramp — colour shows magnitude, not
 * a verdict on whether more is better.
 */
export type Scale = { kind: "who-stunting" | "who-wasting" | "plain-underweight" | "quintile"; bounds: number[]; labels: string[] };

export function scaleFor(ind: Nfhs6Indicator, values: number[]): Scale {
  const l = ind.label.toLowerCase();
  if (/\bstunted\b/.test(l)) return { kind: "who-stunting", bounds: [0, 2.5, 10, 20, 30], labels: ["Very low", "Low", "Medium", "High", "Very high"] };
  if (/\bwasted\b/.test(l) && !/severely/.test(l)) return { kind: "who-wasting", bounds: [0, 2.5, 5, 10, 15], labels: ["Very low", "Low", "Medium", "High", "Very high"] };
  if (/\bunderweight\b/.test(l)) return { kind: "plain-underweight", bounds: [0, 10, 20, 30, 40], labels: ["Under 10%", "10–20%", "20–30%", "30–40%", "40% and over"] };
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return { kind: "quintile", bounds: [0], labels: ["—"] };
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
  const bounds = [...new Set([s[0]!, q(0.2), q(0.4), q(0.6), q(0.8)])];
  const unit = isPercent(ind.unit) ? "%" : "";
  return { kind: "quintile", bounds, labels: bounds.map((b, i) => `${fmtNum(b)}${i < bounds.length - 1 ? `–${fmtNum(bounds[i + 1]!)}` : "+"}${unit}`) };
}

/** Change bands, symmetric about zero, in points. */
export const CHANGE_BOUNDS = [-Infinity, -5, -2, -0.5, 0.5, 2, 5];
export const CHANGE_LABELS = ["Fell 5+", "Fell 2–5", "Fell 0.5–2", "Within ±0.5", "Rose 0.5–2", "Rose 2–5", "Rose 5+"];

export function fmtNum(v: number): string {
  const a = Math.abs(v);
  return a >= 100 ? v.toFixed(0) : v.toFixed(1);
}

/** An indicator's label for display: blocks sub-headed by sex share wording, so say whose it is. */
export function displayLabel(ind: Nfhs6Indicator): string {
  const m = / · (Women|Men)$/.exec(ind.section);
  return m ? `${ind.label} (${m[1]!.toLowerCase()})` : ind.label;
}
