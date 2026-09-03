/**
 * Is this module the one node was asked to run?
 *
 * A connector that exports `run()` for the pipeline and also runs itself from
 * the command line needs to tell those two cases apart. The obvious test —
 * `process.argv[1]?.includes("elections")` — is also true when the entry point
 * is scripts/test-elections.ts, so importing the connector from its own test
 * fired a live ingest, three network calls and a file write, from inside
 * `npm test`. A substring of a path is not an identity.
 *
 * This compares resolved paths instead, so a module runs itself only when it
 * is genuinely the entry point.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function isEntryPoint(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return resolve(entry) === fileURLToPath(moduleUrl);
  } catch {
    return false;
  }
}
