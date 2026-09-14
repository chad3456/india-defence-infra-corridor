/**
 * Reading the AI model record from disk.
 *
 * Server-only: imports node:fs. The shapes a client component needs are in
 * lib/ai-shared.ts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AiRecord } from "./ai-shared";

export * from "./ai-shared";

const EMPTY: AiRecord = {
  present: false, builtAt: null, sources: [],
  whatAnAuthorIs: "", noFunding: "", downloadsNote: "", controlsNote: "",
  labCount: 0, indianModelCount: 0, indicModelCount: 0,
  languagesCovered: [], byYear: [], labs: [],
  frontier: {
    columns: [], rowCount: 0, droppedRows: 0, note: "",
    byCountry: [], indiaModels: [], models: [],
  },
};

/**
 * Read the record, tolerating a file written by an older connector.
 *
 * A spread merges the top level only, so `{...EMPTY, ...raw}` replaces the
 * whole `frontier` object with whatever shape the committed file has — and a
 * file built before `byCountry` existed then leaves it undefined, which the
 * page read straight into `.slice` and crashed the prerender.
 *
 * Version skew between a committed artifact and the code that reads it is
 * normal here: the connectors run in CI and a page change lands before the
 * rebuild does. A page rendering an older shape with some sections missing is
 * a fine outcome. A page that fails to build is not.
 */
export function loadAi(): AiRecord {
  try {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "data/ai/models.json"), "utf8"),
    ) as Partial<AiRecord>;
    return {
      ...EMPTY,
      ...raw,
      frontier: { ...EMPTY.frontier, ...(raw.frontier ?? {}) },
      present: (raw.labs?.length ?? 0) > 0,
    };
  } catch {
    return EMPTY;
  }
}
