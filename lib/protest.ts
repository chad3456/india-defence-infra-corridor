/**
 * Server-side loader for /protests/delhi-2026-10-10: the attributed record and
 * the coverage wire. The wire is optional — until its first scheduled run the
 * page says it is awaiting headlines rather than showing an empty feed.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProtestRecord, ProtestWire } from "./protest-shared";

export type * from "./protest-shared";

export function loadProtest(): { record: ProtestRecord; wire: ProtestWire | null } {
  const dir = join(process.cwd(), "data", "protests");
  const record = JSON.parse(readFileSync(join(dir, "delhi-2026-10-10.json"), "utf8")) as ProtestRecord;
  const wf = join(dir, "delhi-2026-10-10-news.json");
  const wire = existsSync(wf) ? (JSON.parse(readFileSync(wf, "utf8")) as ProtestWire) : null;
  return { record, wire };
}
