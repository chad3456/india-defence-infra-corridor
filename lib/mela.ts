/**
 * The Vikas Mela, assembled from what the site already holds.
 *
 * Server-only. Every number on the mela comes from a series committed to this
 * repository — the World Bank, PIB and ministry releases, SIPRI, the Jan Dhan
 * portal — through the same loaders every other page uses. Nothing here types
 * a figure. The stall definitions below choose WHICH series each stall shows
 * and how to read their direction; they carry no values.
 *
 * ── The editorial choices this file makes, stated ────────────────────────
 *
 * Which series sit on which stall, and which direction counts as better. Most
 * are uncontroversial: more households with electricity is better. A few are
 * not, and are marked "neither": defence spending as a share of GDP, and
 * mobile subscriptions per hundred people, which fell after 2017 as dual SIMs
 * were consolidated rather than because fewer people had phones. A series
 * marked "neither" is shown and its movement described, never scored.
 *
 * Every stall carries the numbers that did not go the government's way beside
 * the ones that did. Manufacturing's share of GDP is on the factory stall. R&D
 * spending is on the rocket ride. The defence corridors' grounded share is on
 * the fort. A tour that dropped them would be the kind of page this site
 * exists to be the opposite of.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSeries, sourcesForSeries } from "./data";
import { VERDICTS } from "./assessment";
import { PROGRAMMES, type StallId } from "./mela-programmes";
import {
  obsYear, rungsOf, paceOf, termOf,
  type Better, type Fmt, type Metric, type MelaPayload, type Obs, type PaceKind,
  type Programme, type SourceRef, type Stall, type VerdictRef,
} from "./mela-shared";

const VERIFIED_PATH = join(process.cwd(), "data", "mela", "verified.json");
const JANDHAN_PATH = join(process.cwd(), "data", "schemes", "jan-dhan.json");

interface MetricSpec { id: string; fmt: Fmt; better: Better; pace?: PaceKind; title?: string; diffUnit?: string }

interface StallSpec {
  id: StallId;
  name: string;
  sfx: string;
  sfxReading: string;
  tagline: string;
  narration: string;
  core: boolean;
  metrics: MetricSpec[];
  verdicts: string[];
  /** Metrics that are not a single committed series, built by name below. */
  special?: Array<"jan-dhan" | "corridor-grounded">;
}

/*
 * The five the brief put at the centre — defence, finance, manufacturing,
 * innovation, education — are `core` and stand in the front row of the world.
 */
const STALLS: StallSpec[] = [
  {
    id: "infrastructure", name: "Infrastructure", sfx: "グルグル", sfxReading: "guru guru — spinning",
    tagline: "The big wheel", core: false,
    narration: "The big wheel! Every car on it is a road, a runway, a metro line or a port. The board shows where each started and where it has got to.",
    metrics: [
      { id: "nh-network-length", fmt: "int", better: "up" },
      { id: "expressway-length", fmt: "int", better: "up" },
      { id: "airports-operational", fmt: "int", better: "up" },
      { id: "metro-network-length", fmt: "int", better: "up" },
      { id: "port-capacity", fmt: "int", better: "up" },
    ],
    verdicts: ["highways", "aviation", "ports", "urban-transit"],
  },
  {
    id: "defence", name: "Defence", sfx: "ドーン", sfxReading: "dōn — boom",
    tagline: "The fort", core: true,
    narration: "Step up to the fort! Production and exports on one wall, imports and the budget on the other, and the corridors round the back.",
    metrics: [
      { id: "defence-production", fmt: "inr-cr", better: "up" },
      { id: "defence-exports", fmt: "inr-cr", better: "up" },
      { id: "arms-imports-russia-share", fmt: "pct1", better: "neither" },
      { id: "wdi-milex-gdp", fmt: "pct1", better: "neither", pace: "pp" },
    ],
    special: ["corridor-grounded"],
    verdicts: ["defence-exports", "defence-industrial-base", "defence-budget-quality", "defence-corridors"],
  },
  {
    id: "finance", name: "Finance", sfx: "チャリン", sfxReading: "charin — a coin landing",
    tagline: "The coin stall", core: true,
    narration: "The coin stall, right in the middle of the mela. Bank accounts, the size of the economy, and jobs — each with the place it came from.",
    metrics: [
      { id: "wdi-account-ownership", fmt: "pct1", better: "up", pace: "gap-up" },
      { id: "wdi-gdp-current-usd", fmt: "usd-tn", better: "up", pace: "multiple" },
      { id: "wdi-gdp-per-capita", fmt: "int", better: "up", pace: "multiple" },
      { id: "wdi-unemployment", fmt: "pct1", better: "down", pace: "pp" },
    ],
    special: ["jan-dhan"],
    verdicts: [],
  },
  {
    id: "manufacturing", name: "Manufacturing", sfx: "ガチャン", sfxReading: "gachan — machinery clanking",
    tagline: "The toy factory", core: true,
    narration: "The toy factory! One dial shows output. The other shows manufacturing's share of the whole economy. Read both dials.",
    metrics: [
      { id: "wdi-manufacturing-gdp", fmt: "pct1", better: "up", pace: "pp" },
      { id: "wdi-manufacturing-usd", fmt: "usd-bn", better: "up", pace: "multiple" },
      { id: "wdi-industry-gdp", fmt: "pct1", better: "up", pace: "pp" },
    ],
    verdicts: ["manufacturing"],
  },
  {
    id: "innovation", name: "Innovation", sfx: "ビューン", sfxReading: "byūn — whoosh",
    tagline: "The rocket ride", core: true,
    narration: "All aboard the rocket! Patents, research spending and high-tech exports are in the queue, and the space programme is up front.",
    metrics: [
      { id: "wdi-patents-resident", fmt: "int", better: "up", pace: "multiple" },
      { id: "wdi-rd-spending", fmt: "pct1", better: "up", pace: "pp" },
      { id: "wdi-hightech-exports-share", fmt: "pct1", better: "up", pace: "pp" },
    ],
    verdicts: ["space"],
  },
  {
    id: "education", name: "Education", sfx: "ペラペラ", sfxReading: "pera pera — pages turning",
    tagline: "The book tent", core: true,
    narration: "The book tent. How many young people are in secondary school and in college, then and now.",
    metrics: [
      { id: "wdi-secondary-enrolment", fmt: "pct1", better: "up", pace: "pp" },
      { id: "wdi-tertiary-enrolment", fmt: "pct1", better: "up", pace: "pp" },
    ],
    verdicts: ["human-capital"],
  },
  {
    id: "rural", name: "Rural India", sfx: "ポタポタ", sfxReading: "pota pota — water dripping",
    tagline: "The village well", core: false,
    narration: "Down the lane to the village! Water, toilets and electric light, counted household by household.",
    metrics: [
      { id: "wdi-sanitation-access", fmt: "pct1", better: "up", pace: "gap-up" },
      { id: "wdi-water-access", fmt: "pct1", better: "up", pace: "gap-up" },
      { id: "wdi-electricity-access", fmt: "pct1", better: "up", pace: "gap-up" },
      { id: "wdi-extreme-poverty", fmt: "pct1", better: "down", pace: "gap-down" },
    ],
    verdicts: ["energy-access"],
  },
  {
    id: "women", name: "Women", sfx: "キラキラ", sfxReading: "kira kira — sparkling",
    tagline: "The kitchen stall", core: false,
    narration: "The kitchen stall. Clean cooking fuel, women's bank accounts, women at work and mothers' health. Read all four together.",
    metrics: [
      { id: "wdi-clean-cooking", fmt: "pct1", better: "up", pace: "gap-up" },
      { id: "wdi-account-ownership-female", fmt: "pct1", better: "up", pace: "gap-up" },
      { id: "wdi-female-labour-participation", fmt: "pct1", better: "up", pace: "pp" },
      { id: "wdi-maternal-mortality", fmt: "int", better: "down", pace: "gap-down" },
    ],
    verdicts: [],
  },
  {
    id: "health", name: "Health", sfx: "ドキドキ", sfxReading: "doki doki — a heartbeat",
    tagline: "The health tent", core: false,
    narration: "The health tent. How many babies survive their first year, and how long people live.",
    metrics: [
      { id: "wdi-infant-mortality", fmt: "dec1", better: "down", pace: "gap-down" },
      { id: "wdi-life-expectancy", fmt: "dec1", better: "up", pace: "pp", diffUnit: "years" },
    ],
    verdicts: ["human-capital"],
  },
  {
    id: "digital", name: "Digital India", sfx: "ピコピコ", sfxReading: "piko piko — beeping",
    tagline: "The phone tower", core: false,
    narration: "The phone tower! How many people are online, and how many phone connections there are.",
    metrics: [
      { id: "wdi-internet-users", fmt: "pct1", better: "up", pace: "gap-up" },
      /* Per hundred people, not a share, and it fell after 2017 as dual SIMs
         were consolidated — so it is shown, described, and neither scored nor
         paced. */
      { id: "wdi-mobile-subscriptions", fmt: "dec1", better: "neither" },
    ],
    verdicts: [],
  },
  {
    id: "trade", name: "Trade", sfx: "ザブーン", sfxReading: "zabūn — waves breaking",
    tagline: "The harbour", core: false,
    narration: "The harbour! Cargo through the ports, what India sells abroad, and what the world invests here.",
    metrics: [
      { id: "all-ports-cargo", fmt: "int", better: "up" },
      { id: "wdi-exports-gdp", fmt: "pct1", better: "up", pace: "pp" },
      { id: "wdi-fdi-gdp", fmt: "pct1", better: "up", pace: "pp" },
    ],
    verdicts: ["trade"],
  },
];

export const INTRO_NARRATION =
  "Welcome to the Vikas Mela! Eleven stalls, three terms, and one house rule: every number here has a source. Pick a stall, or take the tour.";

/* ── Building metrics ─────────────────────────────────────────────────── */

function sourceOf(id: string): SourceRef | null {
  const s = getSeries(id);
  if (!s) return null;
  const src = sourcesForSeries(s)[0];
  return src ? { name: src.name, url: src.url, accessed: src.accessed, tier: src.tier ?? null } : null;
}

function metricOf(spec: MetricSpec): Metric | null {
  const s = getSeries(spec.id);
  if (!s) return null;
  const obs: Obs[] = [];
  for (const p of s.points) {
    if (p.value === null || p.value === undefined) continue;
    const y = obsYear(p.period);
    if (y === null) return null; // categorical: not a time series, not a rung chart
    obs.push({ period: p.period, year: y, value: Number(p.value) });
  }
  if (obs.length === 0) return null;
  return {
    id: s.id,
    title: spec.title ?? s.title,
    unit: s.unit,
    fmt: spec.fmt,
    better: spec.better,
    rungs: rungsOf(obs),
    pace: spec.pace ? paceOf(obs, spec.pace, spec.better) : null,
    diffUnit: spec.diffUnit ?? "pp",
    source: sourceOf(s.id),
    note: s.definition,
  };
}

/**
 * Jan Dhan accounts, from the scheme's own portal.
 *
 * One reading, as of the date the portal states. There is no committed
 * history, so there is no ladder — a single rung, labelled with its date.
 */
function janDhan(): Metric | null {
  try {
    const j = JSON.parse(readFileSync(JANDHAN_PATH, "utf8")) as {
      builtAt?: string; source?: string; asOf?: string;
      rows?: Array<{ totalAccounts?: number }>;
    };
    const total = (j.rows ?? []).reduce((a, r) => a + (r.totalAccounts ?? 0), 0);
    if (total <= 0) return null;
    const asOf = j.asOf ?? "";
    const y = obsYear(asOf) ?? new Date(j.builtAt ?? Date.now()).getUTCFullYear();
    return {
      id: "jan-dhan-accounts",
      title: "Jan Dhan accounts opened",
      unit: "accounts",
      fmt: "crore",
      better: "up",
      rungs: [
        { key: "start", label: "Start", obs: null },
        { key: "termI", label: "End of Term I", obs: null },
        { key: "termII", label: "End of Term II", obs: null },
        { key: "latest", label: "Latest", obs: { period: asOf || String(y), year: y, value: total } },
      ],
      pace: null,
      diffUnit: "",
      source: {
        name: "PMJDY state-wise statistics (sum of all states)",
        url: j.source ?? "https://pmjdy.gov.in/statewise-statistics",
        accessed: (j.builtAt ?? "").slice(0, 10),
        tier: 1,
      },
      note: "Accounts opened under the scheme since 2014, summed across every state row the portal publishes. Opened is not the same as used; the portal does not say how many are active.",
    };
  } catch {
    return null;
  }
}

/**
 * The share of committed defence-corridor investment actually on the ground.
 *
 * Derived, and labelled so: two committed state-by-state series summed and
 * divided. It is on the fort because it is the number the corridors are
 * judged by, and it is roughly fifteen per cent.
 */
function corridorGrounded(): Metric | null {
  const c = getSeries("defence-corridor-committed");
  const g = getSeries("defence-corridor-grounded");
  if (!c || !g) return null;
  const sum = (s: typeof c): number => s.points.reduce((a, p) => a + (p.value === null ? 0 : Number(p.value)), 0);
  const committed = sum(c);
  const grounded = sum(g);
  if (committed <= 0) return null;
  const share = (grounded / committed) * 100;
  const y = new Date().getUTCFullYear();
  return {
    id: "corridor-grounded-share",
    title: "Defence corridors: committed investment actually grounded",
    unit: "% of committed",
    fmt: "pct1",
    better: "up",
    rungs: [
      { key: "start", label: "Start", obs: null },
      { key: "termI", label: "End of Term I", obs: null },
      { key: "termII", label: "End of Term II", obs: null },
      { key: "latest", label: "Latest", obs: { period: "latest reported", year: y, value: share } },
    ],
    pace: null,
    diffUnit: "pp",
    source: sourceOf("defence-corridor-grounded"),
    note: `Derived on this page: ₹${Math.round(grounded).toLocaleString("en-IN")} crore grounded of ₹${Math.round(committed).toLocaleString("en-IN")} crore committed, across the Uttar Pradesh and Tamil Nadu corridors.`,
  };
}

/* ── Programmes, verified only ────────────────────────────────────────── */

interface VerifiedFile {
  builtAt?: string;
  results?: Array<{
    id: string; status: string; url: string | null; checkedOn: string;
    continues: null | { name: string; year: number; url: string; status: string };
  }>;
}

function readVerified(): VerifiedFile {
  try { return JSON.parse(readFileSync(VERIFIED_PATH, "utf8")) as VerifiedFile; } catch { return {}; }
}

/* ── The payload ──────────────────────────────────────────────────────── */

export function loadMela(): MelaPayload {
  const verified = readVerified();
  const byId = new Map((verified.results ?? []).map((r) => [r.id, r]));
  const unverified: Array<{ name: string; reason: string }> = [];

  const programmesFor = (stall: StallId): Programme[] =>
    PROGRAMMES.filter((p) => p.stall === stall)
      .flatMap((p): Programme[] => {
        const r = byId.get(p.id);
        if (!r || r.status !== "verified" || !r.url) {
          unverified.push({
            name: p.name,
            reason: !r ? "not yet checked" : r.status === "missing-article"
              ? "the named article could not be found" : `the article's opening does not mention ${p.year}`,
          });
          return [];
        }
        const c = r.continues && r.continues.status === "verified" && r.continues.url
          ? { name: r.continues.name, year: r.continues.year, url: r.continues.url } : null;
        return [{
          id: p.id, name: p.name, year: p.year, term: termOf(p.year), kind: p.kind,
          url: r.url, verifiedOn: r.checkedOn, continues: c, note: p.note,
        }];
      })
      .sort((a, b) => a.year - b.year || a.name.localeCompare(b.name));

  const verdictsFor = (ids: string[]): VerdictRef[] =>
    ids.flatMap((id) => {
      const v = VERDICTS.find((x) => x.id === id);
      return v ? [{
        id: v.id, area: v.area, grade: v.grade, benchmark: v.benchmark,
        strength: v.strength, weakness: v.weakness, counterpoint: v.counterpoint,
      }] : [];
    });

  const stalls: Stall[] = STALLS.map((s) => {
    const metrics = [
      ...(s.special?.includes("jan-dhan") ? [janDhan()] : []),
      ...s.metrics.map(metricOf),
      ...(s.special?.includes("corridor-grounded") ? [corridorGrounded()] : []),
    ].filter((m): m is Metric => m !== null);
    return {
      id: s.id, name: s.name, sfx: s.sfx, sfxReading: s.sfxReading, tagline: s.tagline,
      narration: s.narration, core: s.core, metrics,
      programmes: programmesFor(s.id), verdicts: verdictsFor(s.verdicts),
    };
  });

  const sources = new Set(stalls.flatMap((s) => s.metrics.map((m) => m.source?.url).filter(Boolean)));
  const programmesVerified = stalls.reduce((a, s) => a + s.programmes.length, 0);

  return {
    stalls,
    counts: {
      programmesVerified,
      programmesCurated: PROGRAMMES.length,
      metrics: stalls.reduce((a, s) => a + s.metrics.length, 0),
      sources: sources.size,
      verifiedOn: verified.builtAt ? verified.builtAt.slice(0, 10) : null,
    },
    unverified,
  };
}

/** Exported for the tests: the stall specs, without any values in them. */
export const STALL_SPECS = STALLS;
