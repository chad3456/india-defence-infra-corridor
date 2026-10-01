/**
 * Server-side loader for /museum: the room register joined to what the
 * ingest found, with an empty collection when the ingest has not run.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOMS, type Museum, type MuseumView } from "./museum-shared";

export type { MuseumView };

export function loadMuseum(): MuseumView {
  const file = join(process.cwd(), "data", "art", "museum.json");
  const raw = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Museum) : null;
  const by = new Map((raw?.rooms ?? []).map((r) => [r.id, r]));
  // A room the record has nothing for is left out rather than hung empty.
  const rooms = ROOMS.map((r) => ({ ...r, works: by.get(r.id)?.works ?? [], found: by.get(r.id)?.found ?? 0, refused: by.get(r.id)?.refused ?? 0 }))
    .filter((r) => r.works.length > 0);
  return {
    present: !!raw && rooms.length > 0,
    generatedAt: raw?.generatedAt ?? null,
    rooms,
    notYet: raw?.notYet ?? [],
    total: rooms.reduce((s, r) => s + r.works.length, 0),
    refused: rooms.reduce((s, r) => s + r.refused, 0),
  };
}
