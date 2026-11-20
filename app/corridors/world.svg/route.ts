/**
 * The world basemap behind /corridors, as a static SVG built once at deploy.
 * Served as a file so the page does not carry a continent of path data twice.
 */
import { loadCorridors } from "@/lib/corridors-load";

export const dynamic = "force-static";

export function GET(): Response {
  const { worldView: v } = loadCorridors();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${v.width} ${v.height}"><path d="${v.land}" fill="#d9d8d1" stroke="#f9f9f7" stroke-width="0.6"/><path d="${v.india}" fill="#f2b98f" stroke="#f9f9f7" stroke-width="0.6"/></svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
}
