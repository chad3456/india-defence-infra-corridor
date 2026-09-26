/**
 * Reader for the verified Project Maven record.
 *
 * The connector that writes this file checks every fact against the book
 * before publishing it, and `npm run test:maven-book` repeats the check on
 * every commit. Nothing here re-verifies, because that would need the book in
 * the deployment, and the book must not ship.
 *
 * A missing file returns an empty record with `present: false`, and the page
 * says the record is not built rather than drawing empty charts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MavenBook } from "./maven-shared";

const PATH = join(process.cwd(), "data", "defence", "maven-book.json");

const EMPTY: MavenBook = {
  present: false,
  builtAt: "",
  book: { title: "", author: "", publisher: "", year: 0, isbn: "", note: "" },
  parts: [],
  method: "",
  claims: { reported: "", participant: "", document: "", public: "", contested: "" },
  cannotSay: [],
  figures: [],
  layers: [],
  cycle: {
    phases: [],
    removed: { what: "", chapter: "", page: null },
    remaining: { what: "", chapter: "", page: null },
    policy: { what: "", chapter: "", page: null },
  },
  beats: [],
  scenes: [],
  voices: [],
  where: [],
};

export function loadMaven(): MavenBook {
  try {
    const raw = JSON.parse(readFileSync(PATH, "utf8")) as Omit<MavenBook, "present">;
    return { ...raw, present: true };
  } catch {
    return EMPTY;
  }
}
