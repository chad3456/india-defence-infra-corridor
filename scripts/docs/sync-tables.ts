/**
 * Rewrites the counted tables in `docs/data-sources.mdx` from the registry.
 *
 * `npm run docs:sync`. The document is a published page and `npm run test:docs`
 * fails when a number in it disagrees with the code — which is the right guard,
 * but it turns every feed change into a hand-edit of a dozen table cells, and a
 * hand-edit is how three of them ended up wrong in the first place.
 *
 * So the numbers are generated and the test is left to catch anything this does
 * not cover. It rewrites only the count column of tables it identifies by their
 * header row: an earlier attempt matched on row shape and silently rewrote a
 * different table that happened to look the same.
 *
 * ── Counted prose ────────────────────────────────────────────────────────
 *
 * The document also states counts in sentences — how many series, how many at
 * each confidence grade, how many on each reporting frequency — and those were
 * left to be maintained by hand. They drifted every time the pipeline added an
 * indicator, and the failure landed on whoever next ran the tests rather than
 * on whoever changed the data. Each one is now patched from the same registry
 * the test reads, through a narrow pattern that rewrites the digits and nothing
 * else. Prose that states a number is generated; prose that makes an argument
 * is not touched.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_SOURCES, DISCOVERY_SOURCES } from "../../lib/sources";
import { getAllSources } from "../../lib/data";
import { getAllSeries } from "../../lib/data";
import { WDI_INDICATORS } from "../../lib/wdi-catalogue";
import { namesAPublisher, publisherOf } from "../etl/lib/publisher";
import type { Category, EventCategory } from "../../lib/types";

const DOC = join(process.cwd(), "docs/data-sources.mdx");

/** Table label in the document to the sector it stands for. */
const SECTORS: Record<string, EventCategory> = {
  Defence: "defence",
  Infrastructure: "infrastructure",
  Manufacturing: "manufacturing",
  "Roads & airports": "roads-airports",
  Startups: "startups",
  "PSU & MSME": "psu-msme",
  Energy: "energy",
  Exports: "exports",
  "Trade deals": "trade-deals",
  Space: "space",
  Ports: "ports",
  Pipelines: "pipelines",
};

function publisherCount(domain: EventCategory): number {
  return new Set(
    ALL_SOURCES.filter((s) => s.domains.includes(domain) && namesAPublisher(s)).map(publisherOf),
  ).size;
}

const GROUPS: Record<string, () => number> = {
  "Official releases": () => ALL_SOURCES.filter((s) => !s.discovery && s.kind === "official").length,
  "Publisher desks": () => ALL_SOURCES.filter((s) => !s.discovery && s.kind === "press").length,
  "Keyword searches": () => DISCOVERY_SOURCES.length,
  "Site-scoped fallbacks": () => ALL_SOURCES.filter((s) => s.publisherHost).length,
};

/** Domains in the coverage table, which counts series rather than publishers. */
const DOMAINS: Record<string, Category> = {
  Defence: "defence",
  Infrastructure: "infrastructure",
  Trade: "trade",
  Economy: "economy",
  Manufacturing: "manufacturing",
  Social: "social",
  "Quality of life": "quality-of-life",
  Energy: "energy",
  Space: "space",
  "Real estate": "real-estate",
  "Internal security": "security",
  "AI & science": "ai-science",
};

/**
 * Rewrite the second column of every row of the table whose header row starts
 * with `headerCell`, for rows whose label the caller recognises. `column`
 * selects which cell to write, because the coverage table carries two counted
 * columns and both go stale.
 */
function patchTable(
  lines: string[],
  headerCell: string,
  valueFor: (label: string) => number | null,
  column = 2,
): number {
  const header = lines.findIndex((l) => l.startsWith(`| ${headerCell} |`));
  if (header === -1) throw new Error(`no table headed "${headerCell}" in docs/data-sources.mdx`);

  let changed = 0;
  for (let i = header + 2; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!line.startsWith("|")) break; // end of the table
    const cells = line.split("|");
    const label = (cells[1] ?? "").trim();
    const value = valueFor(label);
    if (value === null) continue;
    const replaced = ` ${String(value)} `;
    if (cells[column] === replaced) continue;
    cells[column] = replaced;
    lines[i] = cells.join("|");
    changed++;
  }
  return changed;
}

const lines = readFileSync(DOC, "utf8").split("\n");
const sectors = patchTable(lines, "Sector", (label) => {
  const domain = SECTORS[label];
  return domain ? publisherCount(domain) : null;
});
const groups = patchTable(lines, "Group", (label) => GROUPS[label]?.() ?? null);

// The coverage table: series count and defined data points per domain. These
// move whenever the ETL recategorises an indicator, which is exactly the kind
// of change nobody remembers to mirror by hand.
const series = getAllSeries();
const inDomain = (label: string) => {
  const domain = DOMAINS[label];
  return domain ? series.filter((s) => s.category === domain) : null;
};
const coverageSeries = patchTable(lines, "Domain", (label) => inDomain(label)?.length ?? null, 2);
const coveragePoints = patchTable(
  lines,
  "Domain",
  (label) =>
    inDomain(label)?.reduce((n, s) => n + s.points.filter((p) => p.value !== null).length, 0) ??
    null,
  3,
);

/**
 * Rewrite a single counted claim in the prose.
 *
 * The pattern must capture the digits in group 1 and match once. A pattern that
 * matches nothing is reported rather than ignored, because a silently skipped
 * claim is one the test will fail on later with no clue why.
 */
function patchClaim(all: string[], label: string, re: RegExp, value: number): boolean {
  let matched = 0;
  let rewritten = 0;
  for (let i = 0; i < all.length; i++) {
    const line = all[i];
    if (line === undefined || !re.test(line)) continue;
    matched++;
    // Whether the pattern matched and whether the text changed are different
    // questions. Conflating them made this report "no line matched" for every
    // claim that was already correct, which is the opposite of the truth and
    // exactly the kind of misleading output that sends someone hunting a
    // pattern bug that is not there.
    const next = line.replace(re, (whole, digits: string) => whole.replace(digits, String(value)));
    if (next !== line) {
      all[i] = next;
      rewritten++;
    }
  }
  if (matched === 0) {
    process.stdout.write(`  no line matched the ${label} claim — check the pattern\n`);
  }
  return rewritten > 0;
}

const byConfidence = (g: string) => series.filter((s) => s.confidence === g).length;
const byFrequency = (f: string) => series.filter((s) => s.frequency === f).length;

const sources = getAllSources();
const byTier = (t: 1 | 2 | 3) => sources.filter((x) => x.tier === t).length;

let claims = 0;
claims += patchClaim(lines, "series total", /\*\*(\d+) series\*\*/, series.length) ? 1 : 0;
claims += patchClaim(lines, "source register size", /\*\*(\d+) sources — /, sources.length) ? 1 : 0;
claims += patchClaim(lines, "WDI indicators", /\*\*(\d+) indicators\*\*/, WDI_INDICATORS.length) ? 1 : 0;
for (const tier of [1, 2, 3] as const) {
  claims += patchClaim(lines, `tier ${tier} sources`, new RegExp(`(\\d+) tier ${tier}`), byTier(tier))
    ? 1
    : 0;
}
for (const grade of ["high", "medium", "low"]) {
  claims += patchClaim(
    lines,
    `confidence ${grade}`,
    new RegExp("`" + grade + "` \\((\\d+)(?: series)?\\)"),
    byConfidence(grade),
  )
    ? 1
    : 0;
}
for (const freq of ["annual", "fiscal-year", "point-in-time"]) {
  claims += patchClaim(
    lines,
    `frequency ${freq}`,
    new RegExp("`" + freq + "` \\((\\d+)"),
    byFrequency(freq),
  )
    ? 1
    : 0;
}

writeFileSync(DOC, lines.join("\n"));
process.stdout.write(
  `docs/data-sources.mdx — ${sectors} sector row(s), ${groups} group row(s), ` +
    `${coverageSeries + coveragePoints} coverage cell(s), ${claims} counted claim(s) updated\n`,
);
