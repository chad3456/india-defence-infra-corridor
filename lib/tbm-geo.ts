/**
 * The India outline the TBM stage draws its map from, sampled from the site's
 * state boundaries (data/geo/india-states.topo.json): points along the
 * country's edge and, more sparsely, along state borders. Node only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";

function sample(lines: number[][][], step: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const line of lines) {
    let carry = 0;
    for (let i = 1; i < line.length; i++) {
      const [x0, y0] = line[i - 1] as [number, number], [x1, y1] = line[i] as [number, number];
      const len = Math.hypot(x1 - x0, y1 - y0);
      let s = carry;
      while (s < len) { const f = s / len; out.push([Math.round((x0 + (x1 - x0) * f) * 100) / 100, Math.round((y0 + (y1 - y0) * f) * 100) / 100]); s += step; }
      carry = s - len;
    }
  }
  return out;
}

export function indiaOutline(): { outline: Array<[number, number]>; borders: Array<[number, number]> } {
  try {
    const topo = JSON.parse(readFileSync(join(process.cwd(), "data", "geo", "india-states.topo.json"), "utf8")) as Topology;
    const obj = topo.objects.india as GeometryCollection;
    const edge = mesh(topo, obj, (a, b) => a === b).coordinates as number[][][];
    const inner = mesh(topo, obj, (a, b) => a !== b).coordinates as number[][][];
    return { outline: sample(edge, 0.09), borders: sample(inner, 0.22) };
  } catch {
    return { outline: [], borders: [] };
  }
}
