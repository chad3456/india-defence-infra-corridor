"use client";

import { memo, useMemo, useState } from "react";
import { geoMercator } from "d3-geo";
import {
  CITIES, DAMAGE_LABEL, INCIDENT_LABEL, damageCategories, firstCity, incidentTypes, isParis,
  type DamageCategory, type DamageItem, type Headline, type IncidentType, type LandGrid, type Outline, type Statement,
} from "@/lib/france-riots-shared";

/**
 * The riots as a pixel map: France on 8-pixel cells, and a schematic Paris.
 *
 * Every sprite stands for reporting, not for an event. A fire over Lyon means
 * headlines or quoted sentences about Lyon report fires; three rioters mean
 * more headlines name the city than one rioter does. Sprites are placed at the
 * city, or in Paris at the street, square or district the reporting names —
 * never at a guessed address.
 */

/* ── Sprites: 8 × 8 pixel art, one character per pixel ────────────────── */

const PAL: Record<string, string> = {
  k: "#17171c", w: "#f4f1ea", r: "#e23b3b", o: "#ff8c1a", y: "#ffd23f", b: "#1f3f99", B: "#5b86ff", g: "#a3a8ae", G: "#5d6269",
  n: "#8a5a2b", m: "#5c3a1c", p: "#8e44ad", P: "#d2a8e6", t: "#d9f0e0", e: "#1f8a5b", s: "#f2c7a5", c: "#7fd3f0",
};
const ART = {
  rioter: ["......y.", "..kkk.k.", ".kGGGkk.", ".kckcGk.", "..kGGk..", ".kGGGGk.", "..k..k..", ".kk..kk."],
  fire: ["...r....", "..rr..r.", ".rory.r.", ".ryyyrr.", "ryyoyyor", "royyyyor", "roooooor", ".rrrrrr."],
  police: ["..bbbb..", ".bBccBb.", ".bsssb..", "bbbbbbgg", "bBbbbbgg", ".bbbbbgg", ".bb.bbgg", ".kk.kk.."],
  van: ["..rB....", "bbbbbbb.", "bccbbbbb", "bccbbwbb", "bbbbbbbb", "bwwwwwwb", ".kk..kk.", ".kk..kk."],
  looted: ["rwrwrwrw", "nnnnnnnn", "nckcnkcn", "nkckncnn", "ncknckmn", "nnnnnnmn", "y.k.y.k.", "kkkkkkkk"],
  shop: ["rwrwrwrw", "rwrwrwrw", "nnnnnnnn", "nccnccnn", "nccnccmn", "nnnnnnmn", "nccnnnmn", "kkkkkkkk"],
  mall: ["pppppppp", "pPwPPwPp", "gggggggg", "gccgccgg", "gggggggg", "gccgccgg", "ggcccggg", "kkkkkkkk"],
  bank: ["...ee...", "..eeee..", ".eeeeee.", "wwwwwwww", ".w.w.w.w", ".w.w.w.w", ".w.w.w.w", "wwwwwwww"],
  townhall: ["...kBwr.", "...k....", "..gggg..", ".gggggg.", "gwgwgwgg", "gwgwgwgg", "gggkkggg", "kkkkkkkk"],
  station: ["..bbbb..", ".bwwwwb.", "bbbbbbbb", "bcbcbcbb", "bbbbbbbb", "bcbkkbcb", "bbbkkbbb", "kkkkkkkk"],
  car: ["..ro.r..", ".ryoyr..", "..GGGG..", ".GccccG.", "GGGGGGGG", "GrGGGGrG", ".kk..kk.", "........"],
  bus: ["eeeeeee.", "ecceccee", "eccecce.", "eeeeeeee", "eyeeeeey", "eeeeeeee", ".kk..kk.", "........"],
  cafe: ["..w.w...", "...w.w..", "kkkkkk..", "kwwwwkkk", "kwwwwk.k", "kwwwwkkk", ".kkkk...", "kkkkkkk."],
  bin: ["..r..r..", ".ryrryr.", "GGGGGGGG", ".GgGgGg.", ".GgGgGg.", ".GgGgGg.", ".GGGGGG.", "..k..k.."],
  monument: ["gggggggg", "gGggggGg", "gg....gg", "gg....gg", "gg....gg", "gg....gg", "gg....gg", "kk....kk"],
  home: ["...rr...", "..rrrr..", ".rrrrrr.", "rrrrrrrr", ".wcwwcw.", ".wcwwcw.", ".wwkkww.", ".wwkkww."],
  teargas: ["..tt....", ".tttt.t.", "tttttttt", ".tttttt.", "..tttt..", "...gk...", "...kk...", "........"],
  casualty: ["wwwwwwww", "wwwrrwww", "wwwrrwww", "wrrrrrrw", "wrrrrrrw", "wwwrrwww", "wwwrrwww", "wwwwwwww"],
} satisfies Record<string, string[]>;
export type SpriteName = keyof typeof ART;
export const SPRITE_LABEL: Record<SpriteName, string> = {
  rioter: "Rioters (more figures, more reporting)", fire: "Fires and arson", police: "Riot police and clashes", van: "Police vans and forces deployed",
  looted: "Shops looted or smashed", shop: "Shops (not reported attacked)", mall: "Shopping centres", bank: "Banks and cash machines", townhall: "Town halls and public buildings",
  station: "Police stations", car: "Cars burned", bus: "Buses, trams and stations", cafe: "Restaurants, cafés and bars", bin: "Bins, street furniture, barricades",
  monument: "Monuments and places of worship", home: "Homes and residential buildings", teargas: "Tear gas", casualty: "Injuries or deaths",
};
const FROM_DAMAGE: Record<DamageCategory, SpriteName> = {
  "public-building": "townhall", police: "station", mall: "mall", shop: "looted", bank: "bank", restaurant: "cafe", vehicle: "car", transport: "bus", street: "bin", monument: "monument", home: "home",
};
const FROM_INCIDENT: Record<IncidentType, SpriteName[]> = {
  arson: ["fire"], looting: ["looted"], "public-buildings": ["townhall"], clashes: ["teargas", "police"], casualties: ["casualty"],
};

/**
 * The sprites as SVG symbols, rendered once per page in a hidden <svg>: runs
 * of same-coloured pixels merged into one rect each. Every map and legend
 * icon refers to these by id.
 */
export function PixelDefs() {
  return (
    <svg width="0" height="0" aria-hidden style={{ position: "absolute" }}>
      <style>{"@keyframes pxf{0%{opacity:1}50%{opacity:.55}}.px-flicker{animation:pxf .8s steps(1) infinite}@media (prefers-reduced-motion:reduce){.px-flicker{animation:none}}"}</style>
    <defs>
      {(Object.keys(ART) as SpriteName[]).map((name) => (
        <g id={`px-${name}`} key={name}>
          {ART[name].flatMap((row, y) => {
            const runs: Array<{ x: number; w: number; c: string }> = [];
            [...row.padEnd(8, ".").slice(0, 8)].forEach((ch, x) => {
              const last = runs.at(-1);
              if (ch === ".") return;
              if (last && last.c === ch && last.x + last.w === x) last.w++;
              else runs.push({ x, w: 1, c: ch });
            });
            return runs.map((r) => <rect key={`${y}-${r.x}`} x={r.x} y={y} width={r.w} height={1} fill={PAL[r.c]} />);
          })}
        </g>
      ))}
    </defs>
    </svg>
  );
}
const Sprite = ({ name, x, y, size, dim, title, onClick }: { name: SpriteName; x: number; y: number; size: number; dim?: boolean; title?: string; onClick?: () => void }) => (
  <use href={`#px-${name}`} transform={`translate(${x} ${y}) scale(${size / 8})`} opacity={dim ? 0.45 : 1} className={name === "fire" ? "px-flicker" : undefined}
    onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>{title && <title>{title}</title>}</use>
);
const SpriteIcon = ({ name, size = 16 }: { name: SpriteName; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden className="inline-block shrink-0 align-[-3px]"><use href={`#px-${name}`} /></svg>
);

/* ── Placement: spiral out from a point onto free slots ───────────────── */

const SPIRAL: Array<[number, number]> = (() => {
  const out: Array<[number, number]> = [];
  for (let dx = -5; dx <= 5; dx++) for (let dy = -5; dy <= 5; dy++) out.push([dx, dy]);
  return out.sort((a, b) => Math.hypot(...a) - Math.hypot(...b) || Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
})();
function place(slots: Set<string>, sx: number, sy: number, n: number, ok: (x: number, y: number) => boolean): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const [dx, dy] of SPIRAL) {
    if (out.length >= n) break;
    const k = `${sx + dx},${sy + dy}`;
    if (slots.has(k) || !ok(sx + dx, sy + dy)) continue;
    slots.add(k);
    out.push([sx + dx, sy + dy]);
  }
  return out;
}

/** What one place's reporting adds up to, and the sprites that show it. */
interface Spot {
  name: string; x: number; y: number; mentions: number;
  types: Partial<Record<IncidentType, number>>; damage: Partial<Record<DamageCategory, number>>; deployed: number;
  quotes: Array<{ text: string; en?: string; url: string; outlet: string }>;
}
function spritesFor(s: Spot, cap: number): SpriteName[] {
  const scored = new Map<SpriteName, number>();
  const bump = (n: SpriteName, v: number) => scored.set(n, (scored.get(n) ?? 0) + v);
  for (const [t, v] of Object.entries(s.types) as Array<[IncidentType, number]>) for (const n of FROM_INCIDENT[t]) bump(n, v);
  for (const [c, v] of Object.entries(s.damage) as Array<[DamageCategory, number]>) bump(FROM_DAMAGE[c], v);
  if (s.deployed) bump("van", s.deployed);
  if ((s.types.clashes ?? 0) > 0) bump("van", 1);
  const rioters = Math.max(1, Math.min(4, Math.round(Math.log2(s.mentions + 1))));
  return [...Array<SpriteName>(rioters).fill("rioter"), ...[...scored].sort((a, b) => b[1] - a[1]).map(([n]) => n)].slice(0, cap);
}
function Legend({ used }: { used: SpriteName[] }) {
  return (
    <ul className="grid gap-x-4 gap-y-1 text-[11.5px] sm:grid-cols-2" style={{ color: "var(--story-ink-2)" }}>
      {used.map((n) => <li key={n} className="flex items-center gap-2"><SpriteIcon name={n} />{SPRITE_LABEL[n]}</li>)}
    </ul>
  );
}
const tr = (text: string, en?: string) => (en ? `${text} ${en}` : text);
function SpotPanel({ spot, items }: { spot: Spot | null; items: Array<{ text: string; en?: string; url: string; outlet: string }> }) {
  if (!spot) return <p className="text-[12.5px]" style={{ color: "var(--story-ink-3)" }}>Press a place on the map to see what the reporting says about it.</p>;
  const sprites = spritesFor(spot, 20).filter((n, i, a) => a.indexOf(n) === i);
  return (
    <div>
      <p className="text-[16px] font-bold">{spot.name}</p>
      <p className="mt-0.5 text-[12px]" style={{ color: "var(--story-ink-3)" }}>Named in {spot.mentions} report{spot.mentions === 1 ? "" : "s"} in this view</p>
      <ul className="mt-2 space-y-1 text-[12.5px]">
        {(Object.entries(spot.types) as Array<[IncidentType, number]>).sort((a, b) => b[1] - a[1]).map(([t, v]) => <li key={t} className="flex items-center gap-2"><SpriteIcon name={FROM_INCIDENT[t][0]!} />{INCIDENT_LABEL[t]}: <b>{v}</b> headline{v === 1 ? "" : "s"}</li>)}
        {(Object.entries(spot.damage) as Array<[DamageCategory, number]>).sort((a, b) => b[1] - a[1]).map(([c, v]) => <li key={c} className="flex items-center gap-2"><SpriteIcon name={FROM_DAMAGE[c]} />{DAMAGE_LABEL[c]}: <b>{v}</b> sentence{v === 1 ? "" : "s"}</li>)}
        {spot.deployed > 0 && <li className="flex items-center gap-2"><SpriteIcon name="van" />Forces deployed: <b>{spot.deployed}</b> quoted figure{spot.deployed === 1 ? "" : "s"}</li>}
      </ul>
      {!sprites.length && null}
      {items.length > 0 && (
        <ul className="mt-3 space-y-2 border-t pt-2" style={{ borderColor: "var(--story-rule)" }}>
          {items.slice(0, 6).map((q) => (
            <li key={q.url + q.text} className="text-[12px] leading-[1.5]">
              &ldquo;{q.en ?? q.text}&rdquo;{q.en && <span className="block text-[11px] italic" style={{ color: "var(--story-ink-3)" }}>Original: {q.text}</span>}
              <a className="mono ml-1 text-[10.5px] underline decoration-dotted" style={{ color: "var(--story-ink-3)" }} href={q.url} target="_blank" rel="noopener noreferrer">{q.outlet} ↗</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Where each place's label goes: above and right of it, moved down or left until it overlaps no earlier label. */
function labelled(spots: Spot[], charW: number, h: number, W: number) {
  const boxes: Array<{ x: number; y: number; w: number }> = [];
  return spots.flatMap((s) => {
    const w = s.name.length * charW + 6;
    const tries: Array<[number, number]> = [[s.x + 10, s.y - h - 10], [s.x + 10, s.y + 18], [s.x - w - 4, s.y - h - 10], [s.x - w - 4, s.y + 18], [s.x + 10, s.y + 32], [s.x - w - 4, s.y + 32]];
    for (const [tx, ty] of tries) {
      const x = Math.max(2, Math.min(W - w - 2, tx)), y = Math.max(2, ty);
      if (boxes.every((b) => x + w < b.x || b.x + b.w < x || y + h < b.y || b.y + h < y)) { boxes.push({ x, y, w }); return [{ s, x, y, w }]; }
    }
    return [];
  });
}

/* ── France ───────────────────────────────────────────────────────────── */

const LAND = ["#7fb069", "#73a35f"], NEIGHBOUR = "#4b5a4c", SEA = "#24557f", WAVE = "#3a74a6", COAST = "#e6d6a2";
const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

/** Cells as one path per colour, consecutive same-coloured cells in a row merged: a few kilobytes, not thousands of rects. */
function Paths({ cols, rows, cell, colour }: { cols: number; rows: number; cell: number; colour: (c: number, r: number) => string | null }) {
  const d = new Map<string, string[]>();
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const fill = colour(c, r);
      let w = 1;
      while (c + w < cols && colour(c + w, r) === fill) w++;
      if (fill) { const list = d.get(fill) ?? []; list.push(`M${c * cell} ${r * cell}h${w * cell}v${cell}h${-w * cell}z`); d.set(fill, list); }
      c += w;
    }
  }
  return <>{[...d].map(([fill, parts]) => <path key={fill} d={parts.join("")} fill={fill} />)}</>;
}

const Board = memo(function Board({ grid }: { grid: LandGrid }) {
  const { cell, cols, rows, land } = grid;
  const at = (c: number, r: number) => (c < 0 || r < 0 || c >= cols || r >= rows ? "0" : land[r * cols + c]!);
  const colour = (c: number, r: number) => {
    const k = at(c, r);
    if (k === "0") return hash(c, r) % 17 === 0 ? WAVE : null;
    if (k === "2") return NEIGHBOUR;
    if ([at(c + 1, r), at(c - 1, r), at(c, r + 1), at(c, r - 1)].includes("0")) return COAST;
    return LAND[hash(c, r) % 5 === 0 ? 1 : 0]!;
  };
  return <Paths cols={cols} rows={rows} cell={cell} colour={colour} />;
});

export function PixelFrance({ outline, headlines, damage, statements }: { outline: Outline; headlines: Headline[]; damage: DamageItem[]; statements: Statement[] }) {
  const grid = outline.grid;
  const proj = useMemo(() => geoMercator().scale(outline.scale).translate(outline.translate), [outline]);
  const spots = useMemo(() => {
    const by = new Map<string, Spot>();
    const get = (name: string) => {
      const c = CITIES.find((x) => x.name === name)!;
      const xy = proj([c.lon, c.lat]) ?? [0, 0];
      if (!by.has(name)) by.set(name, { name, x: xy[0], y: xy[1], mentions: 0, types: {}, damage: {}, deployed: 0, quotes: [] });
      return by.get(name)!;
    };
    for (const h of headlines) {
      const text = tr(h.title, h.en), city = firstCity(text);
      if (!city) continue;
      const s = get(city);
      s.mentions++;
      for (const t of incidentTypes(text)) s.types[t] = (s.types[t] ?? 0) + 1;
    }
    for (const d of damage) {
      if (!d.city) continue;
      const s = get(d.city);
      s.mentions++;
      for (const c of d.categories) s.damage[c] = (s.damage[c] ?? 0) + 1;
      s.quotes.push({ text: d.quote, en: d.en, url: d.url, outlet: d.outlet });
    }
    for (const st of statements) {
      if (st.kind !== "deployment") continue;
      const city = firstCity(tr(st.quote, st.en));
      if (city) get(city).deployed++;
    }
    return [...by.values()].sort((a, b) => b.mentions - a.mentions);
  }, [headlines, damage, statements, proj]);
  const [pick, setPick] = useState<string | null>(null);
  const picked = spots.find((s) => s.name === pick) ?? spots[0] ?? null;

  if (!grid) return null;
  const SLOT = 16;
  const slots = new Set<string>();
  const onLand = (x: number, y: number) => { const c = Math.floor((x * SLOT + 8) / grid.cell), r = Math.floor((y * SLOT + 8) / grid.cell); return grid.land[r * grid.cols + c] === "1"; };
  const drawn = spots.slice(0, 40).map((s, i) => {
    const want = spritesFor(s, i === 0 ? 14 : i < 4 ? 8 : i < 12 ? 5 : 3);
    const at = place(slots, Math.round(s.x / SLOT - 0.5), Math.round(s.y / SLOT - 0.5), want.length, onLand);
    return { s, sprites: want.slice(0, at.length).map((n, j) => ({ n, x: at[j]![0] * SLOT, y: at[j]![1] * SLOT })) };
  });
  const used = [...new Set(drawn.flatMap((d) => d.sprites.map((x) => x.n)))];
  const W = grid.cols * grid.cell, H = grid.rows * grid.cell;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div>
        <div className="overflow-hidden rounded-md border" style={{ borderColor: "var(--story-rule)", background: SEA }}>
          <svg viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges" style={{ width: "100%", height: "auto", display: "block", imageRendering: "pixelated" }} role="img"
            aria-label={`Pixel map of France: ${spots.slice(0, 6).map((s) => `${s.name}, ${s.mentions} reports`).join("; ")}`}>
            <Board grid={grid} />
            {drawn.map(({ s, sprites }) => sprites.map((p, j) => <Sprite key={`${s.name}-${j}`} name={p.n} x={p.x} y={p.y} size={SLOT} title={`${s.name}: ${SPRITE_LABEL[p.n]}`} onClick={() => setPick(s.name)} />))}
            {labelled(drawn.slice(0, 9).map((d) => d.s), 6, 11, W).map(({ s, x, y, w }) => {
              const label = s.name.toUpperCase();
              return (
                <g key={`l-${s.name}`} onClick={() => setPick(s.name)} style={{ cursor: "pointer" }}>
                  <rect x={x} y={y} width={w} height={11} fill="#17171c" opacity={0.85} />
                  <text x={x + 3} y={y + 8.5} fontSize={8.5} fontFamily="ui-monospace, Menlo, monospace" fontWeight={700} fill={s.name === picked?.name ? "#ffd23f" : "#f4f1ea"}>{label}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <p className="mt-2 text-[11px] leading-[1.5]" style={{ color: "var(--story-ink-3)" }}>
          Cells are 8 pixels of Natural Earth&apos;s outline of France; sprites are 8 × 8 pixel art. Each place shows up to fourteen sprites, chosen by what its headlines and quoted sentences report most. Places are where reporting names them, not exact locations.
        </p>
      </div>
      <div className="min-w-0 space-y-4">
        <div className="story-card p-4"><SpotPanel spot={picked} items={picked?.quotes ?? []} /></div>
        <div className="flex flex-wrap gap-1.5">
          {spots.slice(0, 16).map((s) => (
            <button key={s.name} type="button" onClick={() => setPick(s.name)} className="rounded-full border px-2.5 py-0.5 text-[11.5px]"
              style={{ borderColor: s.name === picked?.name ? "var(--story-ink)" : "var(--story-rule)", fontWeight: s.name === picked?.name ? 700 : 500 }}>{s.name} · {s.mentions}</button>
          ))}
        </div>
        <Legend used={used} />
      </div>
    </div>
  );
}

/* ── Paris, schematic ─────────────────────────────────────────────────── */

/** Two views of the same schematic: central Paris at 125 m a cell, and Greater Paris with its suburbs at 250 m. */
interface View { id: "central" | "greater"; label: string; west: number; east: number; south: number; north: number; km: number }
const VIEWS: View[] = [
  { id: "central", label: "Central Paris", west: 2.245, east: 2.425, south: 48.812, north: 48.905, km: 0.125 },
  { id: "greater", label: "Greater Paris and suburbs", west: 2.19, east: 2.47, south: 48.785, north: 48.945, km: 0.25 },
];
const PCELL = 8;
const KX = Math.cos((48.865 * Math.PI) / 180) * 111.32, KY = 111.32;
const dims = (v: View) => ({ cols: Math.round(((v.east - v.west) * KX) / v.km), rows: Math.round(((v.north - v.south) * KY) / v.km) });
const project = (v: View) => (lat: number, lon: number): [number, number] => [(((lon - v.west) * KX) / v.km) * PCELL, (((v.north - lat) * KY) / v.km) * PCELL];

/** The Boulevard périphérique, by its gates (approximate). */
const PERIPH: Array<[number, number]> = [
  [48.878, 2.283], [48.8945, 2.313], [48.8975, 2.33], [48.899, 2.3446], [48.8985, 2.359], [48.8985, 2.37], [48.8975, 2.386], [48.8885, 2.3925], [48.877, 2.4065],
  [48.864, 2.4085], [48.8535, 2.4105], [48.847, 2.4105], [48.8355, 2.406], [48.829, 2.3935], [48.8215, 2.37], [48.819, 2.3595], [48.8235, 2.3255], [48.827, 2.305],
  [48.832, 2.2875], [48.838, 2.257], [48.848, 2.258], [48.86, 2.269], [48.8715, 2.2775],
];
/** The Seine, from Saint-Denis round the western loop and through Paris (approximate). */
const SEINE: Array<[number, number]> = [
  [48.94, 2.36], [48.925, 2.34], [48.915, 2.305], [48.905, 2.27], [48.89, 2.242], [48.87, 2.218], [48.85, 2.226], [48.835, 2.236], [48.83, 2.249], [48.842, 2.262],
  [48.851, 2.278], [48.858, 2.29], [48.8635, 2.301], [48.864, 2.313], [48.8615, 2.329], [48.8575, 2.341], [48.855, 2.35], [48.8505, 2.359], [48.844, 2.368], [48.837, 2.377],
  [48.827, 2.39], [48.818, 2.41], [48.808, 2.43], [48.795, 2.45],
];
const PARKS: Array<[number, number, number, number]> = [[48.862, 2.249, 1.3, 2.0], [48.834, 2.437, 1.4, 1.6], [48.88, 2.3955, 0.35, 0.45], [48.8265, 2.338, 0.3, 0.35]];

interface Landmark { name: string; lat: number; lon: number; re: RegExp; base?: SpriteName }
/** Squares, streets, stations and suburbs that reporting names, with approximate positions. `base` draws a fixture whether or not it is reported. */
export const LANDMARKS: Landmark[] = [
  { name: "Champs-Élysées", lat: 48.8698, lon: 2.3075, re: /champs[- ]?[ée]lys[ée]es/i },
  { name: "Arc de Triomphe", lat: 48.8738, lon: 2.295, re: /arc de triomphe|place de l.[ée]toile|charles[- ]de[- ]gaulle[- ][ée]toile/i, base: "monument" },
  { name: "Concorde", lat: 48.8656, lon: 2.3212, re: /concorde/i },
  { name: "Opéra & grands magasins", lat: 48.8725, lon: 2.3316, re: /op[ée]ra\b|galeries lafayette|printemps haussmann|boulevard haussmann|grands magasins/i, base: "mall" },
  { name: "Châtelet–Les Halles", lat: 48.862, lon: 2.347, re: /ch[âa]telet|les halles|forum des halles/i, base: "mall" },
  { name: "Rivoli & Louvre", lat: 48.8606, lon: 2.3376, re: /rivoli|louvre/i },
  { name: "République", lat: 48.8675, lon: 2.3637, re: /place de la r[ée]publique|\b(?:à|a|at|in) r[ée]publique\b|r[ée]publique square/i },
  { name: "Bastille", lat: 48.8532, lon: 2.3692, re: /bastille/i },
  { name: "Nation", lat: 48.8483, lon: 2.3958, re: /place de la nation|\b(?:à|at|in) nation\b|nation square/i },
  { name: "Gare du Nord", lat: 48.8809, lon: 2.3553, re: /gare du nord/i },
  { name: "Gare de l'Est", lat: 48.8768, lon: 2.3592, re: /gare de l.est/i },
  { name: "Gare de Lyon", lat: 48.8443, lon: 2.374, re: /gare de lyon/i },
  { name: "Saint-Lazare", lat: 48.8766, lon: 2.325, re: /saint-lazare/i },
  { name: "Montparnasse", lat: 48.8421, lon: 2.3219, re: /montparnasse/i },
  { name: "Barbès", lat: 48.8838, lon: 2.3497, re: /barb[èe]s/i },
  { name: "Pigalle", lat: 48.8822, lon: 2.3378, re: /pigalle/i },
  { name: "Belleville", lat: 48.8722, lon: 2.3767, re: /belleville/i },
  { name: "Oberkampf", lat: 48.865, lon: 2.38, re: /oberkampf|m[ée]nilmontant/i },
  { name: "Marais", lat: 48.859, lon: 2.362, re: /\bmarais\b/i },
  { name: "Latin Quarter", lat: 48.8505, lon: 2.3435, re: /saint-michel|quartier latin|latin quarter|sorbonne/i },
  { name: "Hôtel de Ville", lat: 48.8566, lon: 2.3522, re: /h[ôo]tel de ville de paris|paris city hall|parvis de l.h[ôo]tel de ville/i, base: "townhall" },
  { name: "Police prefecture", lat: 48.854, lon: 2.347, re: /si[èe]ge de la pr[ée]fecture de police|[îi]le de la cit[ée]/i, base: "station" },
  { name: "Place d'Italie", lat: 48.831, lon: 2.3555, re: /place d.italie|italie deux/i, base: "mall" },
  { name: "Eiffel Tower", lat: 48.8584, lon: 2.2945, re: /tour eiffel|eiffel tower|trocad[ée]ro/i, base: "monument" },
  { name: "National Assembly", lat: 48.8619, lon: 2.3186, re: /assembl[ée]e nationale|national assembly|palais bourbon/i },
  { name: "Élysée", lat: 48.8704, lon: 2.3167, re: /(?<!champs[- ])[ée]lys[ée]e\b(?!s)/i },
  { name: "Beaugrenelle", lat: 48.8487, lon: 2.2826, re: /beaugrenelle/i, base: "mall" },
  { name: "Bercy", lat: 48.833, lon: 2.386, re: /\bbercy\b(?! a| said| says)/i, base: "mall" },
  { name: "La Défense", lat: 48.892, lon: 2.238, re: /la d[ée]fense|quatre temps|4 temps/i, base: "mall" },
  { name: "Saint-Denis", lat: 48.9362, lon: 2.3574, re: /saint-denis(?! de la)/i },
  { name: "Saint-Ouen", lat: 48.9118, lon: 2.3339, re: /saint-ouen/i },
  { name: "Aubervilliers", lat: 48.9146, lon: 2.3821, re: /aubervilliers/i, base: "mall" },
  { name: "Pantin", lat: 48.8944, lon: 2.4093, re: /\bpantin\b/i },
  { name: "Bobigny", lat: 48.9077, lon: 2.4396, re: /bobigny/i },
  { name: "Montreuil", lat: 48.8638, lon: 2.4485, re: /montreuil/i },
  { name: "Bagnolet", lat: 48.8692, lon: 2.4183, re: /bagnolet/i },
  { name: "Vincennes", lat: 48.8474, lon: 2.4392, re: /vincennes/i },
  { name: "Ivry", lat: 48.8156, lon: 2.3849, re: /ivry/i },
  { name: "Vitry", lat: 48.7875, lon: 2.3928, re: /vitry/i },
  { name: "Créteil", lat: 48.7904, lon: 2.4556, re: /cr[ée]teil/i },
  { name: "Boulogne-Billancourt", lat: 48.8397, lon: 2.2399, re: /boulogne-billancourt/i },
  { name: "Nanterre", lat: 48.8924, lon: 2.2071, re: /nanterre/i },
  { name: "Clichy", lat: 48.9045, lon: 2.3062, re: /(?<!place de )clichy(?!-sous)/i },
  { name: "Levallois", lat: 48.893, lon: 2.287, re: /levallois/i, base: "mall" },
];
const ARR: Array<[number, number]> = [
  [48.8625, 2.3363], [48.8683, 2.3428], [48.863, 2.36], [48.8543, 2.3576], [48.8445, 2.3507], [48.8491, 2.3328], [48.8562, 2.3121], [48.8727, 2.3125], [48.8771, 2.3375], [48.8761, 2.3607],
  [48.8591, 2.38], [48.84, 2.388], [48.8283, 2.3623], [48.8292, 2.3266], [48.8401, 2.293], [48.862, 2.276], [48.8873, 2.3067], [48.8925, 2.3482], [48.8871, 2.3848], [48.8634, 2.4012],
];
const ARR_RE = /(?<!\d)(1?\d|20)(?:e|ème|eme|er|st|nd|rd|th)\s+arrondissement|paris\s+(1?\d|20)e\b|(?:dans|in) le (1?\d|20)e\b/gi;
function arrondissements(t: string): number[] {
  return [...t.matchAll(ARR_RE)].map((m) => Number(m[1] ?? m[2] ?? m[3])).filter((n) => n >= 1 && n <= 20);
}

const inPoly = (lat: number, lon: number, poly: Array<[number, number]>) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i]!, [yj, xj] = poly[j]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const segDist = (p: [number, number], a: [number, number], b: [number, number]) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};

/** The schematic base: buildings inside the périphérique, sparser suburbs, parks, the river and the ring road. */
const ParisBoard = memo(function ParisBoard({ view }: { view: View }) {
  const px = project(view), { cols, rows } = dims(view);
  const seine = SEINE.map(([la, lo]) => px(la, lo)), ring = PERIPH.map(([la, lo]) => px(la, lo));
  // The river is about 150 m wide and the ring road a cell wide, whatever the scale.
  const riverW = Math.max(0.75, 0.09 / view.km) * PCELL;
  const colour = (c: number, r: number) => {
    const cx = c * PCELL + PCELL / 2, cy = r * PCELL + PCELL / 2;
    const lon = view.west + ((cx / PCELL) * view.km) / KX, lat = view.north - ((cy / PCELL) * view.km) / KY;
    if (seine.some((a, i) => i > 0 && segDist([cx, cy], seine[i - 1]!, a) < riverW)) return "#3a74a6";
    if (ring.some((a, i) => segDist([cx, cy], ring[(i + ring.length - 1) % ring.length]!, a) < PCELL * 0.55)) return "#5d6269";
    if (PARKS.some(([pla, plo, rx, ry]) => (((lon - plo) * KX) / rx) ** 2 + (((lat - pla) * KY) / ry) ** 2 < 1)) return hash(c >> 1, r >> 1) % 4 === 0 ? "#4f8a3c" : "#6aa34f";
    // Inside the ring, Haussmann blocks three cells by two between streets; outside, looser suburbs.
    if (inPoly(lat, lon, PERIPH)) return c % 6 === 0 || r % 5 === 0 ? "#cfc6b4" : ["#b9a688", "#c2ae8e", "#a8957a", "#b3a083"][hash(Math.floor(c / 3), Math.floor(r / 2)) % 4]!;
    return c % 7 === 0 || r % 7 === 0 ? "#d4ceb8" : ["#c9c1a8", "#8fbf73", "#bdb59b"][hash(Math.floor(c / 3), Math.floor(r / 3)) % 3]!;
  };
  return <Paths cols={cols} rows={rows} cell={PCELL} colour={colour} />;
});

export function PixelParis({ items }: { items: Array<{ text: string; en?: string; url: string; outlet: string; source: "headline" | "damage" | "statement"; categories?: DamageCategory[] }> }) {
  const [viewId, setViewId] = useState<View["id"]>("central");
  const view = VIEWS.find((v) => v.id === viewId)!;
  const px = useMemo(() => project(view), [view]);
  const spots = useMemo(() => {
    const by = new Map<string, Spot>();
    const add = (name: string, lat: number, lon: number, it: (typeof items)[number], text: string) => {
      const [x, y] = px(lat, lon);
      const s = by.get(name) ?? { name, x, y, mentions: 0, types: {}, damage: {}, deployed: 0, quotes: [] };
      by.set(name, s);
      s.mentions++;
      for (const t of incidentTypes(text)) s.types[t] = (s.types[t] ?? 0) + 1;
      for (const c of it.categories ?? (it.source === "damage" ? damageCategories(text) : [])) s.damage[c] = (s.damage[c] ?? 0) + 1;
      if (it.source !== "headline" && s.quotes.length < 12) s.quotes.push({ text: it.text, en: it.en, url: it.url, outlet: it.outlet });
    };
    for (const it of items) {
      const text = tr(it.text, it.en);
      if (!isParis(text) && !LANDMARKS.some((l) => l.re.test(text))) continue;
      for (const l of LANDMARKS) if (l.re.test(text)) add(l.name, l.lat, l.lon, it, text);
      for (const n of new Set(arrondissements(text))) add(`${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"} arrondissement`, ARR[n - 1]![0], ARR[n - 1]![1], it, text);
    }
    return [...by.values()].sort((a, b) => b.mentions - a.mentions);
  }, [items, px]);
  const [pick, setPick] = useState<string | null>(null);
  const picked = spots.find((s) => s.name === pick) ?? spots[0] ?? null;

  const { cols, rows } = dims(view);
  const SLOT = 16, W = cols * PCELL, H = rows * PCELL;
  const slots = new Set<string>();
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x * SLOT < W - SLOT && y * SLOT < H - SLOT;
  const visible = (s: Spot) => s.x >= 0 && s.y >= 0 && s.x < W && s.y < H;
  const drawn = spots.filter(visible).slice(0, 30).map((s, i) => {
    const want = spritesFor(s, i < 3 ? 9 : i < 10 ? 5 : 3);
    const at = place(slots, Math.round(s.x / SLOT - 0.5), Math.round(s.y / SLOT - 0.5), want.length, inside);
    return { s, sprites: want.slice(0, at.length).map((n, j) => ({ n, x: at[j]![0] * SLOT, y: at[j]![1] * SLOT })) };
  });
  // Fixtures — shopping centres, the prefecture, town hall, monuments — drawn faintly where reporting has not reached them.
  const reported = new Set(spots.map((s) => s.name));
  const fixtures = LANDMARKS.filter((l) => l.base && !reported.has(l.name)).map((l) => { const [x, y] = px(l.lat, l.lon); return { l, x: x - 6, y: y - 6 }; }).filter((f) => f.x > 0 && f.y > 0 && f.x < W - 12 && f.y < H - 12);
  const used = [...new Set([...drawn.flatMap((d) => d.sprites.map((x) => x.n)), ...fixtures.map((f) => f.l.base!)])];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" onClick={() => setViewId(v.id)} className="rounded-full border px-2.5 py-0.5 text-[11.5px]"
              style={{ borderColor: v.id === viewId ? "var(--story-ink)" : "var(--story-rule)", fontWeight: v.id === viewId ? 700 : 500 }}>{v.label} · {v.km * 1000} m a cell</button>
          ))}
        </div>
        <div className="overflow-hidden rounded-md border" style={{ borderColor: "var(--story-rule)" }}>
          <svg viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges" style={{ width: "100%", height: "auto", display: "block" }} role="img"
            aria-label={`Pixel map of Paris: ${spots.slice(0, 6).map((s) => `${s.name}, ${s.mentions} reports`).join("; ")}`}>
            <ParisBoard view={view} />
            {fixtures.map(({ l, x, y }) => <Sprite key={`f-${l.name}`} name={l.base!} x={x} y={y} size={12} dim title={`${l.name} (not named in reporting in this view)`} />)}
            {drawn.map(({ s, sprites }) => sprites.map((p, j) => <Sprite key={`${s.name}-${j}`} name={p.n} x={p.x} y={p.y} size={SLOT} title={`${s.name}: ${SPRITE_LABEL[p.n]}`} onClick={() => setPick(s.name)} />))}
            {labelled(drawn.slice(0, 12).map((d) => d.s), 5.4, 10, W).map(({ s, x, y, w }) => {
              const label = s.name.toUpperCase();
              return (
                <g key={`l-${s.name}`} onClick={() => setPick(s.name)} style={{ cursor: "pointer" }}>
                  <rect x={x} y={y} width={w} height={10} fill="#17171c" opacity={0.85} />
                  <text x={x + 3} y={y + 7.8} fontSize={7.6} fontFamily="ui-monospace, Menlo, monospace" fontWeight={700} fill={s.name === picked?.name ? "#ffd23f" : "#f4f1ea"}>{label}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <p className="mt-2 text-[11px] leading-[1.5]" style={{ color: "var(--story-ink-3)" }}>
          Schematic, one cell ≈ {view.km * 1000} m: the périphérique (grey ring), the Seine, the Bois de Boulogne and de Vincennes, denser blocks inside the ring and the suburbs outside. Sprites stand where headlines and quoted sentences name a square, station, street, district or suburb; faint fixtures are shopping centres and public buildings not named in this view.
        </p>
      </div>
      <div className="min-w-0 space-y-4">
        <div className="story-card p-4"><SpotPanel spot={picked} items={picked?.quotes ?? []} /></div>
        <div className="flex flex-wrap gap-1.5">
          {spots.slice(0, 20).map((s) => (
            <button key={s.name} type="button" onClick={() => setPick(s.name)} className="rounded-full border px-2.5 py-0.5 text-[11.5px]"
              style={{ borderColor: s.name === picked?.name ? "var(--story-ink)" : "var(--story-rule)", fontWeight: s.name === picked?.name ? 700 : 500 }}>{s.name} · {s.mentions}</button>
          ))}
          {!spots.length && <p className="text-[12.5px]" style={{ color: "var(--story-ink-3)" }}>No Paris street, square or district named in the reporting in this view.</p>}
        </div>
        <Legend used={used} />
      </div>
    </div>
  );
}
