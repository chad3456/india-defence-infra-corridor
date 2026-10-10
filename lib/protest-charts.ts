/**
 * The numbers the protest tracker charts, computed from the coverage wire.
 *
 * Every one of them is a count of HEADLINES — what the news index returned for
 * the wire's searches — not of events, people or opinions. A spike in an hour
 * says outlets published a lot then; a theme rising says headlines used those
 * words more. The rules that assign a headline to a theme are listed below and
 * printed on the page, so a reader can check any classification by eye.
 *
 * No node imports: the client chart component reads the types.
 */
import type { ProtestWire, WireItem } from "./protest-shared";

export interface Theme { id: string; label: string; re: RegExp; words: string }

/**
 * Themes, by the words a headline uses. A headline can carry several. Rules
 * are deliberately literal; anything cleverer would be a judgement the reader
 * cannot see.
 */
export const THEMES: Theme[] = [
  { id: "detentions", label: "Naming detentions", re: /detain|detention|held\b|rounded? up|round up|picked up|arrest/i, words: "detain, detention, held, round up, picked up, arrest" },
  { id: "police", label: "Police statements and orders", re: /delhi police (says|said|issues|to file|offers|informs|denies)|\bDCP\b|commissioner|\bFIRs?\b|advisory/i, words: "Delhi Police says / issues / files / offers / informs / denies, DCP, commissioner, FIR, advisory" },
  { id: "restrictions", label: "Restrictions: internet, metro, traffic", re: /internet|shutdown|blackout|metro|section 163|traffic|diversion|barricad|lockdown|sealed|curbs?/i, words: "internet, shutdown, blackout, metro, Section 163, traffic, diversion, barricade, lockdown, sealed, curbs" },
  { id: "opposition", label: "Naming opposition leaders", re: /kejriwal|mamata|rahul|kharge|congress|\bAAP\b|opposition|former CMs?|\bTMC\b|vijayan/i, words: "Kejriwal, Mamata, Rahul, Kharge, Congress, AAP, opposition, former CMs, TMC, Vijayan" },
  { id: "courts", label: "Courts and lawyers", re: /court|chief justice|\bCJI\b|lawyer|bar association|\bplea\b|petition/i, words: "court, Chief Justice, CJI, lawyer, bar association, plea, petition" },
  { id: "organisers", label: "Naming the organisers", re: /dipke|\bCJP (says|alleges|to|founder|leaders?)\b|cockroach janta party (says|alleges)/i, words: "Dipke, CJP says / alleges / to / founder / leaders" },
];

export interface HourBin { t: number; label: string; total: number; byTheme: Record<string, number>; top: string | null }
export interface FigurePoint { t: number; value: number; title: string; publisher: string; url: string }

export interface ProtestCharts {
  hours: HourBin[];
  figures: FigurePoint[];
  publishers: Array<{ name: string; value: number }>;
  totalItems: number;
  from: number;
  to: number;
}

const HOUR = 3_600_000;
/** India Standard Time is UTC+5:30, without daylight saving. */
const IST = 5.5 * HOUR;
const istHourLabel = (t: number) => {
  const d = new Date(t + IST);
  return `${d.getUTCDate()} Oct ${String(d.getUTCHours()).padStart(2, "0")}:00`;
};

/**
 * A detention figure as a headline states it, or null.
 *
 * Only a number standing next to a detention word counts: "over 3,000
 * detained", "7,000 protesters detained", "200 students … detained". Years,
 * flight numbers and other numbers in the headline are ignored, and words
 * like "hundreds" are not turned into numbers.
 */
export function headlineFigure(title: string): number | null {
  if (!/detain|held|rounded? up/i.test(title)) return null;
  const NUM = String.raw`(\d{1,3}(?:,\d{3})+|\d{2,6})(?:\s*[-–]\s*(\d{1,3}(?:,\d{3})+|\d{2,6}))?`;
  const WHO = String.raw`(?:protest(?:e|o)rs|people|students|persons|activists|workers|supporters|volunteers|detained|held)`;
  // "3,000 detained", "200 Punjab students detained", "30-40 people": a number,
  // at most two words, then who; or "detain 2000", "detains more than 3,000".
  const after = new RegExp(String.raw`${NUM}\s*\+?\s*(?:[A-Za-z'’]+\s+){0,2}${WHO}\b`, "i").exec(title);
  const before = new RegExp(String.raw`\bdetain(?:s|ed)?\s+(?:more than|over|around|nearly|about|at least)?\s*${NUM}\b`, "i").exec(title);
  const m = after ?? before;
  if (!m) return null;
  // A range ("30-40") is charted at its upper end; the tooltip shows the headline.
  const raw = (m[2] ?? m[1])!;
  const n = Number(raw.replace(/,/g, ""));
  // A bare four-digit number near 2000 is usually a year — unless it follows
  // "detain", where it can only be a count.
  const yearLike = n >= 1900 && n <= 2100 && !raw.includes(",") && m === after;
  if (!Number.isFinite(n) || n < 10 || yearLike) return null;
  return n;
}

export function buildCharts(wire: ProtestWire, now = Date.now()): ProtestCharts {
  const items: WireItem[] = wire.items;
  // The window charted: the day before the protest to the latest headline.
  const from = Date.parse("2026-10-08T18:30:00Z"); // 9 Oct 00:00 IST
  const last = Math.max(...items.map((i) => Date.parse(i.publishedAt)), from + HOUR);
  const to = Math.min(now, last) ;
  const hours: HourBin[] = [];
  for (let t = from; t <= to; t += HOUR) {
    hours.push({ t, label: istHourLabel(t), total: 0, byTheme: Object.fromEntries(THEMES.map((th) => [th.id, 0])), top: null });
  }
  for (const it of items) {
    const t = Date.parse(it.publishedAt);
    const idx = Math.floor((t - from) / HOUR);
    const bin = hours[idx];
    if (!bin) continue;
    bin.total++;
    bin.top ??= it.title;
    for (const th of THEMES) if (th.re.test(it.title)) bin.byTheme[th.id]!++;
  }
  const figures: FigurePoint[] = items.flatMap((it) => {
    const v = headlineFigure(it.title);
    return v === null ? [] : [{ t: Date.parse(it.publishedAt), value: v, title: it.title, publisher: it.publisher, url: it.url }];
  }).filter((f) => f.t >= from).sort((a, b) => a.t - b.t);
  const pubs = new Map<string, number>();
  for (const it of items) pubs.set(it.publisher, (pubs.get(it.publisher) ?? 0) + 1);
  const publishers = [...pubs.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  return { hours, figures, publishers, totalItems: items.length, from, to };
}
