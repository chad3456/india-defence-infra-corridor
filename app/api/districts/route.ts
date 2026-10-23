/**
 * One district indicator's values for the map: /api/districts?id=<indicator>.
 * Values Spatial India flags as estimated are left out and counted, never sent
 * as data. Read from the committed file; cached for an hour.
 */
import { NextResponse, type NextRequest } from "next/server";
import { indicatorValues } from "@/lib/spatial-india-map";

export const revalidate = 3600;

export function GET(req: NextRequest): NextResponse {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const res = /^[a-z0-9_]{1,80}$/i.test(id) ? indicatorValues(id) : null;
  if (!res) return NextResponse.json({ error: "unknown indicator" }, { status: 404 });
  return NextResponse.json(res, { headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
