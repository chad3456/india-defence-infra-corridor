/** India's states behind the national corridors on /corridors, as a static SVG built once at deploy. */
import { loadCorridors } from "@/lib/corridors-load";

export const dynamic = "force-static";

export function GET(): Response {
  const { indiaView: v } = loadCorridors();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${v.width} ${v.height}"><path d="${v.land}" fill="#e7e6df" stroke="#f9f9f7" stroke-width="0.8"/></svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
}
