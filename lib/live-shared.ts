/**
 * The live tracker's instruments, and the parsers for what the live routes
 * read. No node imports: the routes and the client both use these.
 *
 * Nothing here is part of the site's record. The record is the committed,
 * validated pipeline; these are readings taken when a reader opens the page,
 * cached for a minute, never stored, and labelled as such on the page.
 */

export interface IndexInstrument {
  id: string;
  /** Moneycontrol's price-feed symbol. */
  symbol: string;
  label: string;
  what: string;
}

/** India's market indices, from Moneycontrol's public price feed (NSE and BSE prices). */
export const INDICES: IndexInstrument[] = [
  { id: "nifty", symbol: "in;NSX", label: "Nifty 50", what: "NSE's 50 largest listed companies" },
  { id: "sensex", symbol: "in;SEN", label: "Sensex", what: "BSE's 30-company index" },
  { id: "banknifty", symbol: "in;nbx", label: "Nifty Bank", what: "NSE's banking index" },
  { id: "vix", symbol: "in;IDXN", label: "India VIX", what: "expected Nifty volatility over the next 30 days" },
];

/** Currencies against the rupee, from the ECB's daily reference rates. */
export const CURRENCIES: Array<{ code: string; label: string }> = [
  { code: "USD", label: "US dollar" }, { code: "EUR", label: "Euro" }, { code: "GBP", label: "Pound sterling" },
  { code: "CNY", label: "Chinese yuan" }, { code: "JPY", label: "Japanese yen" }, { code: "AED", label: "UAE dirham" },
];

export interface IndexQuote {
  id: string;
  ok: boolean;
  price?: number; previousClose?: number; change?: number; changePct?: number;
  open?: number; high?: number; low?: number; week52High?: number; week52Low?: number;
  /** Percent change over a year, as the feed reports it. */
  oneYearPct?: number;
  /** OPEN or CLOSED, as the exchange reports it. */
  marketState?: string;
  /** When the exchange last printed this price (ISO). */
  updated?: string;
  error?: string;
}

/** A number from a feed field. An empty or blank string is missing, not zero: Number("") is 0. */
const num = (v: unknown): number | undefined => {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

/** One Moneycontrol price-feed answer → a quote, or the reason it could not be read. */
export function parseMoneycontrol(id: string, body: unknown): IndexQuote {
  const d = (body as { code?: string; data?: Record<string, unknown> })?.data;
  if (!d) return { id, ok: false, error: "no data in the response" };
  const price = num(d.pricecurrent);
  if (price == null) return { id, ok: false, error: "no price in the response" };
  const epoch = num(d.lastupd_epoch);
  return {
    id, ok: true, price,
    previousClose: num(d.priceprevclose), change: num(d.pricechange), changePct: num(d.pricepercentchange),
    open: num(d.OPEN), high: num(d.HIGH), low: num(d.LOW), week52High: num(d["52wkhi"]), week52Low: num(d["52wklow"]),
    oneYearPct: num(d.cl1yPerChange),
    marketState: typeof d.market_state === "string" ? d.market_state : undefined,
    updated: epoch ? new Date(epoch * 1000).toISOString() : undefined,
  };
}

export interface FxRate { code: string; label: string; inr: number }
/** Frankfurter's answer (rates per 1 INR when base is INR) → rupees per unit of each currency. */
export function parseFrankfurter(body: unknown): { date?: string; rates: FxRate[] } {
  const b = body as { date?: string; rates?: Record<string, number> };
  const rates: FxRate[] = [];
  for (const c of CURRENCIES) { const r = b?.rates?.[c.code]; if (typeof r === "number" && r > 0) rates.push({ code: c.code, label: c.label, inr: 1 / r }); }
  return { date: b?.date, rates };
}

/* ── Military aircraft over the region ── */

/** The box the live map shows: India and its neighbourhood, from the Gulf of Oman to Myanmar. */
export const REGION = { south: 0, north: 40, west: 60, east: 100 };

export interface LiveAircraft {
  /** Rounded to a tenth of a degree, about 11 km: where, not exactly where. */
  lat: number; lon: number;
  type?: string;
  callsign?: string;
  /** Feet, barometric; "ground" when on the ground. */
  alt?: number | "ground";
  /** Knots over the ground. */
  speed?: number;
  /** Which aggregators saw it. */
  seenBy: string[];
}

interface Ac { hex?: string; flight?: string; t?: string; lat?: number; lon?: number; alt_baro?: number | string; gs?: number }

/** Merge two aggregators' /v2/mil answers, keep the region, round positions. */
export function regionAircraft(feeds: Array<{ id: string; ac: Ac[] }>): { inRegion: LiveAircraft[]; globalByFeed: Record<string, number> } {
  const byHex = new Map<string, LiveAircraft>();
  const globalByFeed: Record<string, number> = {};
  for (const f of feeds) {
    globalByFeed[f.id] = f.ac.length;
    for (const a of f.ac) {
      if (typeof a.lat !== "number" || typeof a.lon !== "number" || !a.hex) continue;
      if (a.lat < REGION.south || a.lat > REGION.north || a.lon < REGION.west || a.lon > REGION.east) continue;
      const prev = byHex.get(a.hex);
      if (prev) { if (!prev.seenBy.includes(f.id)) prev.seenBy.push(f.id); continue; }
      byHex.set(a.hex, {
        lat: Math.round(a.lat * 10) / 10, lon: Math.round(a.lon * 10) / 10,
        ...(a.t ? { type: a.t } : {}),
        ...(a.flight?.trim() ? { callsign: a.flight.trim() } : {}),
        ...(a.alt_baro === "ground" ? { alt: "ground" as const } : typeof a.alt_baro === "number" ? { alt: a.alt_baro } : {}),
        ...(typeof a.gs === "number" ? { speed: Math.round(a.gs) } : {}),
        seenBy: [f.id],
      });
    }
  }
  return { inRegion: [...byHex.values()], globalByFeed };
}

/* ── News ── */

export interface LiveHeadline { title: string; outlet: string; url: string; published: string | null; topic: string }

/** Google News titles end " - Outlet"; split it off. */
export function splitOutlet(title: string): { title: string; outlet: string } {
  const i = title.lastIndexOf(" - ");
  return i > 10 ? { title: title.slice(0, i).trim(), outlet: title.slice(i + 3).trim() } : { title, outlet: "" };
}
