/**
 * Doc tests.
 *
 * `docs/data-sources.mdx` is rendered as a page on the site, so it is no longer
 * just a README that can quietly rot — it is published content, and it makes
 * counted claims. This checks two things:
 *
 *   1. The Markdown reader turns the file into the blocks the page expects,
 *      with no syntax left showing through as literal text.
 *   2. Every number the document claims about this repository is still true.
 *
 * The second half is the point. A source catalogue that overstates its own
 * coverage is the exact failure this project exists to avoid.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDoc, parseInline, inlineText, outline, type Block } from "../lib/markdown";
import { ALL_SOURCES, DISCOVERY_SOURCES, X_HANDLES } from "../lib/sources";
import { publisherOf, namesAPublisher } from "./etl/lib/publisher";
import type { EventCategory } from "../lib/types";
import { WDI_INDICATORS, PEERS } from "../lib/wdi-catalogue";
import { getAllSeries, getAllSources } from "../lib/data";
import placesRaw from "../data/geo/places.json";

const ROOT = process.cwd();
let failed = 0;
let passed = 0;

function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    process.stdout.write(`  pass  ${name}\n`);
  } else {
    failed++;
    process.stdout.write(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}\n`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  check(name, actual === expected, `expected ${String(expected)}, got ${String(actual)}`);
}

function section(title: string) {
  process.stdout.write(`\n${title}\n`);
}

/* ------------------------------------------------------------------ */
/* The Markdown reader                                                 */
/* ------------------------------------------------------------------ */

section("Markdown reader");

{
  const inline = parseInline("plain **bold** `code` [link](https://x.test) *soft*");
  eq("inline splits into every span kind", inline.length, 8);
  check(
    "a link keeps its href",
    inline.some((n) => n.kind === "link" && n.href === "https://x.test"),
  );
  const inCode = parseInline("`**not bold**`");
  check(
    "asterisks inside a code span stay literal",
    inCode.length === 1 && inCode[0]?.kind === "code" && inCode[0].text === "**not bold**",
  );
  // The reverse case shipped broken once: a code span inside a bold run drew
  // its backticks as text on the page.
  const label = parseInline("[`file.json`](https://x.test)");
  check(
    "a code span inside a link label is parsed too",
    label.length === 1 && label[0]?.kind === "link" && inlineText(label) === "file.json",
  );
  const nested = parseInline("**`code` in bold**");
  const strong = nested[0];
  check(
    "a code span inside bold is parsed, not printed",
    nested.length === 1 &&
      strong?.kind === "strong" &&
      strong.content.some((n) => n.kind === "code" && n.text === "code"),
  );
  eq("inlineText drops the markup", inlineText(nested), "code in bold");

  const doc = parseDoc(
    ["---", "title: T", "description: D", "---", "", "## H", "", "| a | b |", "|---|---:|", "| 1 | 2 |", "", "- one", "  continued", "- two", "", "```", "code", "```", "", "---", ""].join("\n"),
  );
  eq("frontmatter title", doc.frontmatter.title, "T");
  eq("frontmatter description", doc.frontmatter.description, "D");
  const kinds = doc.blocks.map((b) => b.kind).join(",");
  eq("blocks in order", kinds, "heading,table,list,code,rule");
  const table = doc.blocks.find((b): b is Extract<Block, { kind: "table" }> => b.kind === "table");
  eq("right alignment is read off the divider", table?.align[1], "right");
  const list = doc.blocks.find((b): b is Extract<Block, { kind: "list" }> => b.kind === "list");
  eq("an indented line continues its item", list?.items.length, 2);
}

/* ------------------------------------------------------------------ */
/* The published document                                              */
/* ------------------------------------------------------------------ */

section("docs/data-sources.mdx renders");

const raw = readFileSync(join(ROOT, "docs/data-sources.mdx"), "utf8");
const doc = parseDoc(raw);

check("the page has a title to render", Boolean(doc.frontmatter.title));
check("the page has a description", Boolean(doc.frontmatter.description));
check("it produces a substantial document", doc.blocks.length > 60, `${doc.blocks.length} blocks`);
check("every h2 gets an anchor", outline(doc).every((s) => s.id.length > 0));

{
  const ids = outline(doc).map((s) => s.id);
  eq("section anchors are unique", new Set(ids).size, ids.length);
}

{
  const tables = doc.blocks.filter((b): b is Extract<Block, { kind: "table" }> => b.kind === "table");
  check("the document has tables", tables.length >= 6, `${tables.length}`);
  const ragged = tables.filter((t) => t.rows.some((r) => r.length !== t.head.length));
  eq("no table row disagrees with its header", ragged.length, 0);
}

{
  // Anything the reader would see as raw syntax means the page is rendering
  // markup the reader did not ask for.
  const text = doc.blocks
    .flatMap((b) => {
      if (b.kind === "paragraph") return [inlineText(b.content)];
      if (b.kind === "list") return b.items.map(inlineText);
      if (b.kind === "table") return b.rows.flatMap((r) => r.map(inlineText));
      return [];
    })
    .join(" ");
  const leak = (needle: string) => {
    const at = text.indexOf(needle);
    return at === -1 ? "" : text.slice(Math.max(0, at - 50), at + 50);
  };
  check("no unrendered bold markers", !text.includes("**"), leak("**"));
  check("no unrendered code fences", !text.includes("`"), leak("`"));
  check("no unrendered table pipes", !text.includes(" | "), leak(" | "));
  check("no unrendered links", !/\]\(/.test(text), leak("]("));
}

/* ------------------------------------------------------------------ */
/* The claims it makes                                                 */
/* ------------------------------------------------------------------ */

section("docs/data-sources.mdx tells the truth");

const series = getAllSeries();
const places = placesRaw as { places: unknown[]; states: Record<string, unknown> };

/** Pull the first capture of a pattern out of the raw document as a number. */
function claim(label: string, re: RegExp): number | null {
  const m = re.exec(raw);
  if (!m || m[1] === undefined) {
    check(`the document still states ${label}`, false, "claim not found — update the test with it");
    return null;
  }
  return Number(m[1].replace(/,/g, ""));
}

function claims(label: string, re: RegExp, actual: number) {
  const stated = claim(label, re);
  if (stated === null) return;
  eq(`${label}: document matches the code`, stated, actual);
}

claims("active feeds", /\*\*(\d+) active feeds\*\*/, ALL_SOURCES.length);
claims("official X handles", /\*\*(\d+) official handles\*\*/, X_HANDLES.length);
claims("series total", /\*\*(\d+) series\*\*/, series.length);
claims("WDI indicators", /\*\*(\d+) indicators\*\*/, WDI_INDICATORS.length);
claims("gazetteer places", /\*\*(\d+) places across/, places.places.length);
claims("gazetteer states", /places across (?:\*\*)?(\d+) states/, Object.keys(places.states).length);
claims("source register size", /\*\*(\d+) sources — /, getAllSources().length);

{
  const comparators = /India and five comparators/.test(raw);
  check("the comparator count matches the catalogue", comparators && PEERS.length === 5, `${PEERS.length} peers`);
}

for (const tier of [1, 2, 3] as const) {
  const re = new RegExp(`(\\d+) tier ${tier}`);
  claims(`tier ${tier} sources`, re, getAllSources().filter((s) => s.tier === tier).length);
}

for (const grade of ["high", "medium", "low"] as const) {
  const re = new RegExp("`" + grade + "` \\((\\d+) series\\)|`" + grade + "` \\((\\d+)\\)");
  const m = re.exec(raw);
  const stated = m ? Number(m[1] ?? m[2]) : null;
  const actual = series.filter((s) => s.confidence === grade).length;
  check(
    `confidence ${grade}: document matches the code`,
    stated === actual,
    `stated ${String(stated)}, actual ${actual}`,
  );
}

for (const freq of ["annual", "fiscal-year", "point-in-time"] as const) {
  const m = new RegExp("`" + freq + "` \\((\\d+)").exec(raw);
  const stated = m && m[1] !== undefined ? Number(m[1]) : null;
  const actual = series.filter((s) => s.frequency === freq).length;
  check(
    `frequency ${freq}: document matches the code`,
    stated === actual,
    `stated ${String(stated)}, actual ${actual}`,
  );
}

{
  // The coverage table, row by row: series count and defined data points.
  const LABELS: Record<string, string> = {
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
  };
  const table = doc.blocks.find(
    (b): b is Extract<Block, { kind: "table" }> => b.kind === "table" && b.head[0] === "Domain",
  );
  check("the coverage table is present", Boolean(table));
  if (table) {
    eq("every domain has a row", table.rows.length, Object.keys(LABELS).length);
    for (const row of table.rows) {
      const label = inlineText(row[0] ?? []).trim();
      const category = LABELS[label];
      if (!category) {
        check(`coverage row "${label}" names a real category`, false);
        continue;
      }
      const inCategory = series.filter((s) => s.category === category);
      const points = inCategory.reduce(
        (n, s) => n + s.points.filter((p) => p.value !== null).length,
        0,
      );
      const num = (i: number) => Number(inlineText(row[i] ?? []).trim());
      check(
        `${label}: series count`,
        num(1) === inCategory.length,
        `stated ${num(1)}, actual ${inCategory.length}`,
      );
      check(`${label}: data points`, num(2) === points, `stated ${num(2)}, actual ${points}`);
    }
  }
}

{
  // The feed-group table: three numbers that drift the moment a feed is added.
  const groups = doc.blocks.find(
    (b): b is Extract<Block, { kind: "table" }> => b.kind === "table" && b.head[0] === "Group",
  );
  check("the feed-group table is present", Boolean(groups));
  if (groups) {
    const stated = Object.fromEntries(
      groups.rows.map((r) => [inlineText(r[0] ?? []).trim(), Number(inlineText(r[1] ?? []).trim())]),
    );
    const desks = ALL_SOURCES.filter((s) => !s.discovery);
    eq("official feed count", stated["Official releases"], desks.filter((s) => s.kind === "official").length);
    eq("publisher desk count", stated["Publisher desks"], desks.filter((s) => s.kind === "press").length);
    eq("keyword search count", stated["Keyword searches"], DISCOVERY_SOURCES.length);
    eq(
      "site-scoped fallback count",
      stated["Site-scoped fallbacks"],
      ALL_SOURCES.filter((s) => s.publisherHost).length,
    );
  }
}

{
  // The per-sector publisher table. These are the numbers that decide whether a
  // sector is covered, so a stale one here is worse than no table at all.
  const LABELS: Record<string, EventCategory> = {
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
  const table = doc.blocks.find(
    (b): b is Extract<Block, { kind: "table" }> => b.kind === "table" && b.head[0] === "Sector",
  );
  check("the sector-coverage table is present", Boolean(table));
  if (table) {
    eq("every sector has a row", table.rows.length, Object.keys(LABELS).length);
    for (const row of table.rows) {
      const label = inlineText(row[0] ?? []).trim();
      const domain = LABELS[label];
      if (!domain) {
        check(`coverage row "${label}" names a real sector`, false);
        continue;
      }
      const actual = new Set(
        ALL_SOURCES.filter((s) => s.domains.includes(domain) && namesAPublisher(s)).map(publisherOf),
      ).size;
      const stated = Number(inlineText(row[1] ?? []).trim());
      check(`${label}: declared publishers`, stated === actual, `stated ${stated}, actual ${actual}`);
      check(`${label}: at least three publishers`, actual >= 3, `${actual}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* AGENTS.md                                                           */
/* ------------------------------------------------------------------ */

section("AGENTS.md");

{
  const agents = readFileSync(join(ROOT, "AGENTS.md"), "utf8");
  // Every npm script AGENTS.md tells an agent to run must actually exist,
  // otherwise the instructions send the next agent down a dead end.
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  const referenced = [...agents.matchAll(/npm run ([a-z:-]+)/g)].map((m) => m[1] ?? "");
  const missing = [...new Set(referenced)].filter((s) => !(s in pkg.scripts));
  eq("every npm script it names exists", missing.join(", "), "");

  // Same for the files it routes an agent to.
  const paths = [...new Set([...agents.matchAll(/`((?:app|lib|components|scripts|data|supabase)\/[\w./-]+)`/g)].map((m) => m[1] ?? ""))];
  const gone = paths.filter((p) => {
    try {
      readFileSync(join(ROOT, p));
      return false;
    } catch {
      return !p.endsWith("/");
    }
  });
  eq("every file it routes to exists", gone.join(", "), "");
}

process.stdout.write(
  failed === 0
    ? `\nAll doc tests passed (${passed}).\n`
    : `\n${failed} doc test(s) failed.\n`,
);
process.exit(failed === 0 ? 0 : 1);
