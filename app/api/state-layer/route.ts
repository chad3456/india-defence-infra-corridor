/**
 * What is in one state, for one layer, by name.
 *
 * The front-page map ships the grid and a count per state — a few kilobytes.
 * The names are close to a megabyte across all three layers, almost all of it
 * temple rows nobody will open, so they are fetched when a reader actually
 * clicks a state rather than shipped to everyone who loads the front page.
 *
 * Everything it serves is committed data read off disk, so it is cached hard
 * and immutably for the length of a deploy: the file cannot change under a
 * running server, and a request per click otherwise re-reads a megabyte of
 * JSON for an answer that was identical last time.
 */
import { NextResponse } from "next/server";
import { itemsFor, layerSummaries } from "@/lib/state-layers";

/** Committed data. It cannot change without a redeploy. */
export const revalidate = 3600;

export function GET(req: Request): NextResponse {
  const url = new URL(req.url);
  const layer = url.searchParams.get("layer") ?? "";
  const state = url.searchParams.get("state") ?? "";

  if (!layer || !state) {
    return NextResponse.json(
      { error: "both layer and state are required" },
      { status: 400 },
    );
  }
  // Named layers only. The parameter reaches a lookup on a fixed list rather
  // than a path or a key that could be steered somewhere else.
  const known = layerSummaries().map((l) => l.id);
  if (!known.includes(layer)) {
    return NextResponse.json({ error: `unknown layer`, known }, { status: 404 });
  }

  const found = itemsFor(layer, state);
  if (!found) return NextResponse.json({ error: "unknown layer" }, { status: 404 });

  return NextResponse.json(found, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
