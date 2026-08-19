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
 * header row, and leaves the prose alone: an earlier attempt matched on row
 * shape and silently rewrote a different table that happened to look the same.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_SOURCES, DISCOVERY_SOURCES } from "../../lib/sources";
import { namesAPublisher, publisherOf } from "../etl/lib/publisher";
import type { EventCategory } from "../../lib/types";

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

/**
 * Rewrite the second column of every row of the table whose header row starts
 * with `headerCell`, for rows whose label the caller recognises.
 */
function patchTable(
  lines: string[],
  headerCell: string,
  valueFor: (label: string) => number | null,
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
    if (cells[2] === replaced) continue;
    cells[2] = replaced;
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

writeFileSync(DOC, lines.join("\n"));
process.stdout.write(
  `docs/data-sources.mdx — ${sectors} sector row(s) and ${groups} group row(s) updated\n`,
);
