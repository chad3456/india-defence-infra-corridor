"use client";

import type { ComponentType, KeyboardEvent } from "react";
import Guide from "./Guide";
import { INK, Fort, BookTent, CoinStall, Factory, Rocket, Village, Kitchen, HealthTent, Tower, Harbour } from "./Stalls";

/**
 * The fairground: one SVG, 1600 × 900, drawn back to front.
 *
 * ── Why time of day follows the term ─────────────────────────────────────
 *
 * The three terms need to be told apart at a glance, and colour alone is not
 * allowed to carry that on this site. So the sky changes — morning for the
 * first term, golden hour for the second, lantern-lit night for the third —
 * and the ticket that was pressed says which term it is in words. The sky is
 * the mood; the ticket is the label.
 *
 * ── Why the guide walks along the front ──────────────────────────────────
 *
 * He moves on one path at the bottom of the scene and only ever changes x.
 * A guide that walked up into the back row would pass behind some stalls and
 * in front of others, and the walk would read as clipping rather than as a
 * walk.
 *
 * Every attraction is a focusable button with a label, so the whole fair can
 * be toured from the keyboard. On a phone the frame scrolls sideways inside
 * itself and follows the guide; the page does not scroll sideways.
 */

export type TermKey = "all" | "I" | "II" | "III";

export interface WorldStall { id: string; name: string; sfx: string; count: number }

type Place = {
  x: number; y: number; s: number;
  Art: ComponentType<{ night: boolean }> | null;
  w: number; h: number;
  /** Where the sign hangs, in the attraction's own coordinates. */
  sx: number; sy: number;
};

export const PLACE: Record<string, Place> = {
  rural:          { x: 150,  y: 612, s: 0.8, Art: Village,    w: 270, h: 150, sx: -64, sy: -176 },
  women:          { x: 362,  y: 612, s: 0.8, Art: Kitchen,    w: 216, h: 160, sx: 0,   sy: -186 },
  digital:        { x: 1130, y: 612, s: 0.8, Art: Tower,      w: 190, h: 290, sx: 0,   sy: -150 },
  health:         { x: 1298, y: 612, s: 0.8, Art: HealthTent, w: 200, h: 184, sx: 0,   sy: -118 },
  trade:          { x: 1482, y: 612, s: 0.8, Art: Harbour,    w: 260, h: 180, sx: -18, sy: -206 },
  defence:        { x: 212,  y: 808, s: 1,   Art: Fort,       w: 260, h: 236, sx: 0,   sy: -152 },
  education:      { x: 482,  y: 808, s: 1,   Art: BookTent,   w: 230, h: 226, sx: 0,   sy: -116 },
  finance:        { x: 800,  y: 808, s: 1,   Art: CoinStall,  w: 226, h: 244, sx: 0,   sy: -128 },
  manufacturing:  { x: 1086, y: 808, s: 1,   Art: Factory,    w: 220, h: 252, sx: -18, sy: -150 },
  innovation:     { x: 1360, y: 808, s: 1,   Art: Rocket,     w: 210, h: 272, sx: 10,  sy: -12 },
  infrastructure: { x: 800,  y: 612, s: 1,   Art: null,       w: 460, h: 540, sx: -150, sy: -66 },
};

/**
 * Where the guide stands for each attraction: in the gap beside it, never in
 * front of it. The first version walked him to each stall's centre, where he
 * stood squarely over the Finance sign and his "!" covered the rest of it.
 */
export const STAND: Record<string, number> = {
  defence: 356, women: 356, rural: 356,
  education: 644, infrastructure: 644,
  finance: 948,
  manufacturing: 1226, digital: 1226, health: 1226,
  innovation: 1520, trade: 1520,
};
export const START_X = 644;

const SKY: Record<TermKey, [string, string, string]> = {
  all: ["#7ccfff", "#c4ebff", "#fff0d4"],
  I: ["#7ccfff", "#c4ebff", "#fff0d4"],
  II: ["#ff8a64", "#ffc38a", "#ffe8b8"],
  III: ["#110e37", "#2c226e", "#7b4091"],
};
const HILL: Record<TermKey, [string, string]> = {
  all: ["#b9e39a", "#93cf78"], I: ["#b9e39a", "#93cf78"],
  II: ["#d8bf85", "#bda36b"], III: ["#2f3c5f", "#253053"],
};
const GROUND: Record<TermKey, [string, string]> = {
  all: ["#f4dba6", "#e7c381"], I: ["#f4dba6", "#e7c381"],
  II: ["#f1c88f", "#e0ab6c"], III: ["#3d3754", "#2c2842"],
};

/** Points along a quadratic curve, for bunting and string lights. */
function along(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1;
    const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1;
    return { x, y };
  });
}

function Cloud({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) {
  const puffs: Array<[number, number, number]> = [[0, 0, 34], [36, -14, 40], [80, -2, 32], [44, 12, 30], [-30, 10, 24], [110, 12, 22]];
  return (
    <g transform={`translate(${x},${y}) scale(${s})`} className="mela-cloud">
      {/* The clean-outline trick: ink discs first, a little larger, then the
          fill discs on top, so only the outer silhouette keeps its line. */}
      {puffs.map(([cx, cy, r], i) => <circle key={`o${i}`} cx={cx} cy={cy} r={r + 3} fill={INK} />)}
      {puffs.map(([cx, cy, r], i) => <circle key={`f${i}`} cx={cx} cy={cy} r={r} fill={fill} />)}
      <path d="M-20 22 q50 14 120 2" fill="none" stroke="#9fd0ee" strokeWidth="6" strokeLinecap="round" opacity=".55" />
    </g>
  );
}

function Starburst({ r, points = 18 }: { r: number; points?: number }) {
  const d = Array.from({ length: points * 2 }, (_, i) => {
    const a = (i / (points * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.72;
    return `${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr).toFixed(1)}`;
  }).join(" L");
  return <path d={`M${d} Z`} fill="#ffe27a" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" className="mela-pop" />;
}

function Sign({ name, sfx, count, term }: { name: string; sfx: string; count: number; term: TermKey }) {
  const w = Math.max(120, name.length * 14.5 + 30);
  return (
    <g>
      <rect x={-w / 2} y="-18" width={w} height="36" rx="6" fill="#fffdf7" stroke={INK} strokeWidth="3" />
      <text x="0" y="8" textAnchor="middle" fontSize="23" className="manga-title" fill={INK}>{name}</text>
      <g transform={`translate(${w / 2 - 6},-22) rotate(-10)`}>
        <text textAnchor="middle" fontSize="19" className="manga-sfx">{sfx}</text>
      </g>
      {term !== "all" && (
        <g transform={`translate(${-w / 2},-18)`}>
          <circle r="15" fill={count > 0 ? "#ffe27a" : "#e7e3dc"} stroke={INK} strokeWidth="2.5" />
          <text y="6" textAnchor="middle" fontSize="16" fontWeight="800" fill={INK} fontFamily="system-ui, sans-serif">{count}</text>
        </g>
      )}
    </g>
  );
}

function Wheel({ night }: { night: boolean }) {
  const cars = ["#e5557d", "#18a3a3", "#ffc83d", "#8a5cd6", "#4f7fd6", "#e46a55", "#2fbf71", "#f08a3a", "#ec6f9b", "#5fc2f0", "#c9a23d", "#6cc6a8"];
  const R = 214;
  return (
    <g>
      {/* legs: an A-frame each side */}
      <path d="M-110 0 L0 -312 L110 0" fill="none" stroke={INK} strokeWidth="18" strokeLinejoin="round" />
      <path d="M-110 0 L0 -312 L110 0" fill="none" stroke="#e5557d" strokeWidth="11" strokeLinejoin="round" />
      <path d="M-70 -110 H70" stroke={INK} strokeWidth="12" /><path d="M-70 -110 H70" stroke="#e5557d" strokeWidth="6" />
      <g transform="translate(0,-312)">
        <g className="mela-wheel">
          <circle r={R} fill="none" stroke={INK} strokeWidth="14" />
          <circle r={R} fill="none" stroke="#ffc83d" strokeWidth="7" />
          <circle r={R - 26} fill="none" stroke={INK} strokeWidth="3" />
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2;
            return <path key={i} d={`M0 0 L${Math.cos(a) * R} ${Math.sin(a) * R}`} stroke={INK} strokeWidth="3" />;
          })}
          {cars.map((c, i) => {
            const a = (i / cars.length) * Math.PI * 2;
            const x = Math.cos(a) * R;
            const y = Math.sin(a) * R;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="22" fill={c} stroke={INK} strokeWidth="3" />
                <circle cx={x} cy={y} r="11" fill={night ? "#ffe27a" : "#fffdf7"} stroke={INK} strokeWidth="2.2" />
              </g>
            );
          })}
          {night && Array.from({ length: 32 }, (_, i) => {
            const a = (i / 32) * Math.PI * 2;
            return <circle key={`l${i}`} cx={Math.cos(a) * (R - 13)} cy={Math.sin(a) * (R - 13)} r="3.5" fill="#fff4b0" className="mela-twinkle" style={{ animationDelay: `${(i % 6) * 0.3}s` }} />;
          })}
        </g>
        <circle r="30" fill="#ffc83d" stroke={INK} strokeWidth="4" />
        <circle r="12" fill="#e5557d" stroke={INK} strokeWidth="3" />
      </g>
    </g>
  );
}

export default function World({
  stalls, selected, term, guideX, walking, talking, facing, onSelect,
}: {
  stalls: WorldStall[];
  selected: string | null;
  term: TermKey;
  guideX: number;
  walking: boolean;
  talking: boolean;
  facing: 1 | -1;
  onSelect: (id: string) => void;
}) {
  const night = term === "III";
  const [s0, s1, s2] = SKY[term];
  const [h0, h1] = HILL[term];
  const [g0, g1] = GROUND[term];
  const byId = new Map(stalls.map((s) => [s.id, s]));

  const key = (id: string) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(id); }
  };

  const bunting = [
    ...along(0, 70, 280, 150, 560, 96, 13),
    ...along(1040, 96, 1320, 150, 1600, 70, 13),
  ];
  const flagColours = ["#e5557d", "#ffc83d", "#18a3a3", "#8a5cd6", "#f08a3a", "#4f7fd6"];
  const stars = [[80, 60], [210, 40], [330, 120], [470, 55], [610, 140], [980, 40], [1100, 110], [1210, 60], [1380, 40], [1520, 130], [150, 220], [1450, 230], [700, 70], [900, 30]];

  const order = ["infrastructure", "rural", "women", "digital", "health", "trade", "defence", "education", "finance", "manufacturing", "innovation"];

  return (
    <svg viewBox="0 0 1600 900" role="group" aria-label="The Vikas Mela: a fairground of eleven attractions. Choose one to hear about it."
      className="block h-auto w-full min-w-[920px]">
      <defs>
        <linearGradient id="mela-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s0} /><stop offset=".55" stopColor={s1} /><stop offset="1" stopColor={s2} />
        </linearGradient>
        <linearGradient id="mela-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={g0} /><stop offset="1" stopColor={g1} />
        </linearGradient>
        <mask id="mela-moon">
          <circle r="54" fill="#fff" />
          <circle cx="24" cy="-12" r="46" fill="#000" />
        </mask>
        <pattern id="mela-tone" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.3" fill={INK} opacity=".12" />
        </pattern>
      </defs>

      {/* ── Sky ─────────────────────────────────────────────────── */}
      <rect width="1600" height="620" fill="url(#mela-sky)" />
      {night && stars.map(([x, y], i) => (
        <path key={i} className="mela-twinkle" style={{ animationDelay: `${(i % 5) * 0.45}s` }}
          d={`M${x} ${(y ?? 0) - 7} l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z`} fill="#fff6c8" />
      ))}
      {term === "III" ? (
        <g transform="translate(1300,140)">
          {/* A crescent cut with a mask. The first moon was a full disc with a
              sky-coloured disc over it, and the sky is a gradient, so the
              "bite" showed as a darker circle — an eclipse, not a moon. */}
          <circle r="72" fill="#fff6d6" opacity=".12" />
          <g mask="url(#mela-moon)">
            <circle r="54" fill="#fff6d6" />
            <circle cx="-18" cy="10" r="8" fill="#efe3b8" />
            <circle cx="-30" cy="-16" r="5" fill="#efe3b8" />
          </g>
        </g>
      ) : term === "II" ? (
        <g transform="translate(1250,420)">
          <circle r="120" fill="#ffd27a" opacity=".45" />
          <circle r="78" fill="#ffb347" stroke={INK} strokeWidth="3" />
        </g>
      ) : (
        <g transform="translate(1330,150)">
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <path key={i} d={`M${Math.cos(a) * 66} ${Math.sin(a) * 66} L${Math.cos(a) * 92} ${Math.sin(a) * 92}`} stroke="#ffc83d" strokeWidth="7" strokeLinecap="round" />;
          })}
          <circle r="54" fill="#ffd84a" stroke={INK} strokeWidth="3" />
          <path d="M-22 -18 q10 -12 26 -12" fill="none" stroke="#fff3b0" strokeWidth="6" strokeLinecap="round" />
        </g>
      )}
      {!night && (
        <>
          <Cloud x={150} y={210} s={1} fill={term === "II" ? "#ffe3d2" : "#ffffff"} />
          <Cloud x={1040} y={250} s={0.8} fill={term === "II" ? "#ffe3d2" : "#ffffff"} />
          <Cloud x={500} y={70} s={0.55} fill={term === "II" ? "#ffe3d2" : "#ffffff"} />
        </>
      )}

      {/* ── Hills, city, the metro line and the sea ────────────────── */}
      <path d="M0 520 Q180 430 360 500 T720 490 T1080 480 T1440 500 T1600 470 V620 H0 Z" fill={h0} stroke={INK} strokeWidth="3" />
      <g>
        {[[430, 60], [470, 92], [512, 70], [556, 110], [600, 80], [1000, 96], [1044, 70], [1090, 120], [1140, 84], [1186, 64]].map(([x, h], i) => (
          <g key={i}>
            <rect x={x} y={580 - (h ?? 0)} width="38" height={h} fill={night ? "#3a4570" : "#cfd8e6"} stroke={INK} strokeWidth="2.5" />
            {Array.from({ length: Math.floor((h ?? 0) / 22) }, (_, r) => (
              <rect key={r} x={(x ?? 0) + 9} y={580 - (h ?? 0) + 8 + r * 22} width="8" height="8" fill={night ? "#ffe27a" : "#9fb3cf"} />
            ))}
          </g>
        ))}
      </g>
      <path d="M0 568 Q400 540 800 556 T1600 548 V620 H0 Z" fill={h1} stroke={INK} strokeWidth="3" />
      <path d="M1340 590 H1600 V650 H1340 Z" fill={night ? "#23365c" : "#63b8e8"} />
      <path d="M1350 600 q14 -6 28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0" fill="none" stroke={night ? "#5a78a8" : "#dff3ff"} strokeWidth="3" strokeLinecap="round" />

      {/* ── Ground ──────────────────────────────────────────────── */}
      <rect y="600" width="1600" height="300" fill="url(#mela-ground)" />
      <rect y="600" width="1600" height="300" fill="url(#mela-tone)" />
      <path d="M0 600 H1600" stroke={INK} strokeWidth="3" />
      <path d="M0 842 Q800 822 1600 842 V900 H0 Z" fill={night ? "#4a4463" : "#fbe8c2"} stroke={INK} strokeWidth="2.5" />

      {/* ── Bunting, and string lights after dark ───────────────── */}
      <path d="M0 70 Q280 150 560 96 M1040 96 Q1320 150 1600 70" fill="none" stroke={INK} strokeWidth="2.5" />
      {bunting.map((p, i) => (
        <path key={i} d={`M${p.x - 13} ${p.y} L${p.x + 13} ${p.y} L${p.x} ${p.y + 26} Z`}
          fill={flagColours[i % flagColours.length]} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      ))}
      {night && bunting.map((p, i) => (
        <circle key={`sl${i}`} cx={p.x} cy={p.y - 4} r="4" fill="#fff4b0" className="mela-twinkle" style={{ animationDelay: `${(i % 4) * 0.4}s` }} />
      ))}

      {/* ── Balloons, filling the gaps in the back row ──────────── */}
      {[590, 1010].map((bx, j) => (
        <g key={bx} transform={`translate(${bx},612)`}>
          <path d="M0 0 V-96" stroke="#9b6b43" strokeWidth="5" />
          {[[-24, -128, "#e5557d"], [0, -146, "#ffc83d"], [24, -126, "#18a3a3"], [-6, -112, "#8a5cd6"]].map(([x, y, c], i) => (
            <g key={i}>
              <path d={`M0 -96 L${x} ${(y as number) + 20}`} stroke={INK} strokeWidth="1.5" />
              <ellipse cx={x as number} cy={y as number} rx="16" ry="20" fill={c as string} stroke={INK} strokeWidth="2.5" />
              <path d={`M${(x as number) - 6} ${(y as number) - 8} q3 -5 8 -6`} stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".8" />
            </g>
          ))}
          {j === 0 && night && <circle cy="-128" r="40" fill="#ffe27a" opacity=".12" />}
        </g>
      ))}

      {/* ── The attractions ─────────────────────────────────────── */}
      {order.map((id) => {
        const p = PLACE[id];
        const st = byId.get(id);
        if (!p || !st) return null;
        const isSel = selected === id;
        const dim = term !== "all" && st.count === 0;
        return (
          <g key={id} transform={`translate(${p.x},${p.y}) scale(${p.s})`}>
            <g
              className="mela-stall"
              role="button"
              tabIndex={0}
              aria-label={`${st.name}${term !== "all" ? `, ${st.count} programme${st.count === 1 ? "" : "s"} in this term` : ""}`}
              aria-pressed={isSel}
              data-dim={dim ? "true" : "false"}
              onClick={() => onSelect(id)}
              onKeyDown={key(id)}
            >
              <rect x={-p.w / 2} y={-p.h - 30} width={p.w} height={p.h + 40} fill="transparent" />
              {isSel && (
                <g transform={`translate(0,${-p.h / 2})`}>
                  <Starburst r={Math.max(p.w, p.h) * (id === "infrastructure" ? 0.5 : 0.62)} />
                </g>
              )}
              <rect className="mela-focus" x={-p.w / 2 - 6} y={-p.h - 36} width={p.w + 12} height={p.h + 52} rx="14"
                fill="none" stroke={INK} strokeWidth="3" strokeDasharray="10 7" />
              {id === "infrastructure" ? <Wheel night={night} /> : p.Art ? <p.Art night={night} /> : null}
              <g transform={`translate(${p.sx},${p.sy})`}>
                <Sign name={st.name} sfx={st.sfx} count={st.count} term={term} />
              </g>
            </g>
          </g>
        );
      })}

      {/* ── The guide ───────────────────────────────────────────── */}
      <g style={{ transform: `translate(${guideX - 60}px, 706px)`, transition: "transform 1.15s cubic-bezier(.45,.05,.35,1)" }}>
        <g transform={facing < 0 ? "translate(120,0) scale(-0.6,0.6)" : "scale(0.6)"}>
          <Guide talking={talking} walking={walking} />
        </g>
        {!walking && talking && (
          <g transform={facing < 0 ? "translate(-26,-10)" : "translate(104,-10)"} className="mela-pop">
            <path d="M0 0 h34 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 h-18 l-10 10 l2 -10 h-8 a8 8 0 0 1 -8 -8 v-22 a8 8 0 0 1 8 -8 z" fill="#fffdf7" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
            <text x="13" y="29" textAnchor="middle" fontSize="26" className="manga-title" fill="#e5557d">!</text>
          </g>
        )}
      </g>
    </svg>
  );
}
