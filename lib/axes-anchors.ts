/**
 * Outside anchors for the 12-axis test: V-Dem's V-Party expert survey, which
 * codes 1,800+ parties in 178 countries on their positions at each election.
 * No node imports.
 *
 * ── What maps, and what does not ─────────────────────────────────────────
 *
 * V-Party measures something close to seven of the twelve axes. Each mapping
 * names the exact thing V-Party measured, because "close to" is not "the
 * same as": its economic scale is overall economic ideology, not ownership
 * alone; its religion question is how often a party invokes God to justify
 * itself. Trade, environment, civil liberties, world order and force have no
 * V-Party measure and get no anchor — an empty row, not a borrowed one.
 *
 * ── Which way each scale runs ─────────────────────────────────────────────
 *
 * The package's codebook covers V-Dem's country data, not V-Party, so the
 * direction of each scale was established from the data and is tested on
 * every build (scripts/test-axes.ts): the pluralism and populism components
 * correlate with V-Dem's documented indices in the expected direction, and
 * parties whose stances are not in dispute fall where they must — the AfD
 * against immigration, the German Greens for it; the US Republicans more
 * religious in their appeals than the Democrats; Labour more redistributive
 * than the Conservatives. If a later release flipped a scale, the build fails.
 *
 * ── Scoring ───────────────────────────────────────────────────────────────
 *
 * Response scales are not all the same length — left-right runs 0–6, welfare
 * 0–5, the rest 0–4, the two indices 0–1 — and the tests check each declared
 * range against the values the experts actually gave.
 *
 * Each variable is placed linearly on −100 … +100 between the ends of its
 * response scale, turned so that +100 is the axis's right-hand pole; two
 * variables on one axis are averaged. That is a rescaling of the experts'
 * answers, not a new measurement, and the page says so.
 */
import type { AxisId } from "./axes";

export interface AnchorMap {
  axis: AxisId;
  vars: string[];
  /** The response scale's ends. */
  range: [number, number];
  /** Which pole a higher value means. */
  higher: "left" | "right";
  /** What V-Party actually measured, in plain words. */
  measures: string;
}

export const ANCHOR_MAP: AnchorMap[] = [
  { axis: "economy", vars: ["v2pariglef_osp"], range: [0, 6], higher: "right", measures: "the party's overall economic ideology, far-left to far-right (V-Party's economic left-right scale)" },
  { axis: "welfare", vars: ["v2pawelf_osp"], range: [0, 5], higher: "left", measures: "whether the party backs means-tested or universal welfare" },
  { axis: "pluralism", vars: ["v2xpa_antiplural"], range: [0, 1], higher: "right", measures: "V-Party's anti-pluralism index: weak commitment to free elections and liberties, demonising opponents, disregard for minority rights, tolerance of violence" },
  { axis: "populism", vars: ["v2xpa_popul"], range: [0, 1], higher: "right", measures: "V-Party's populism index: anti-elite and people-centred rhetoric" },
  { axis: "social", vars: ["v2palgbt_osp", "v2pawomlab_osp"], range: [0, 4], higher: "left", measures: "support for LGBT social equality and for women working outside the home" },
  { axis: "religion", vars: ["v2parelig_osp"], range: [0, 4], higher: "left", measures: "how often the party invokes God or religion to justify its positions" },
  { axis: "nation", vars: ["v2paimmig_osp", "v2paculsup_osp"], range: [0, 4], higher: "left", measures: "the party's position on immigration, and whether it promotes the cultural superiority of a group or the nation" },
];

/** A party as the page needs it. */
export interface AnchorParty {
  id: number;
  country: string;
  name: string;
  orig?: string;
  abbr?: string;
  year: number;
  /** Vote share at that election, %. */
  vote: number | null;
  /** V-Party government support: 0 senior partner, 1 junior partner, 2 supports without joining, 3 not in government. */
  gov: number | null;
  /** The variables ANCHOR_MAP uses. */
  v: Record<string, number>;
}

export interface AnchorScore { axis: AxisId; score: number | null; measures: string }

export function anchorScores(p: Pick<AnchorParty, "v">): AnchorScore[] {
  return ANCHOR_MAP.map((m) => {
    const xs = m.vars.map((k) => p.v[k]).filter((x): x is number => typeof x === "number");
    if (xs.length !== m.vars.length) return { axis: m.axis, score: null, measures: m.measures };
    const t = (xs.reduce((s, x) => s + x, 0) / xs.length - m.range[0]) / (m.range[1] - m.range[0]);
    const r = m.higher === "right" ? t : 1 - t;
    return { axis: m.axis, score: Math.round(Math.max(-100, Math.min(100, r * 200 - 100))), measures: m.measures };
  });
}

/** A country's governing party: the senior partner in its latest coded year. */
export function governingParty(parties: AnchorParty[], country: string): AnchorParty | null {
  const own = parties.filter((p) => p.country === country && p.gov === 0);
  if (!own.length) return null;
  const year = Math.max(...own.map((p) => p.year));
  return own.filter((p) => p.year === year).sort((a, b) => (b.vote ?? 0) - (a.vote ?? 0))[0] ?? null;
}

export const ANCHOR_VARS = [...new Set(ANCHOR_MAP.flatMap((m) => m.vars))];
