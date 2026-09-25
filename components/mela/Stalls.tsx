/**
 * The attractions, one drawing each.
 *
 * Every drawing sits on its own base line at y = 0, centred on x = 0, and
 * grows upward, so the world can place any of them by its feet and scale the
 * back row down without re-measuring anything.
 *
 * ── The drawing rules ────────────────────────────────────────────────────
 *
 * Ink outlines of one weight, flat fills, one cel-shade step on the side away
 * from the light. No gradients on the attractions themselves: gradients are
 * how a vector illustration signals "rendered", and this is meant to read as
 * drawn.
 *
 * No party symbol appears on any stall — no lotus, no raised palm, no
 * saffron-dominant scheme — and no national emblem is used as decoration.
 * The health tent carries a heart, not a red cross, because the red cross is
 * a protected emblem and not a medical logo.
 *
 * `night` lights the windows, bulbs and lanterns for the Term III sky.
 */

export const INK = "#16101f";
const SW = 3;
const GLOW = "#ffe27a";

type Art = { night: boolean };

/** A scalloped, striped awning — the one shape that says "fair" at any size. */
function Awning({ w, y, h = 30, a, b, n = 6 }: { w: number; y: number; h?: number; a: string; b: string; n?: number }) {
  const sw = w / n;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const x = -w / 2 + i * sw;
        return (
          <path key={i}
            d={`M${x} ${y} h${sw} v${h} a${sw / 2} ${sw / 2.4} 0 0 1 ${-sw} 0 z`}
            fill={i % 2 === 0 ? a : b} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
        );
      })}
    </g>
  );
}

function Post({ x, top }: { x: number; top: number }) {
  return <rect x={x - 5} y={top} width="10" height={-top} fill="#9b6b43" stroke={INK} strokeWidth={SW} />;
}

function Bulb({ x, y, night }: { x: number; y: number; night: boolean }) {
  return (
    <g>
      {night && <circle cx={x} cy={y} r="14" fill={GLOW} opacity=".35" />}
      <circle cx={x} cy={y} r="6" fill={night ? GLOW : "#fff3c4"} stroke={INK} strokeWidth="2" />
    </g>
  );
}

/** Teeth on a circle, for the factory gears. */
function gearPath(r: number, teeth: number): string {
  const pts: string[] = [];
  const inner = r * 0.8;
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2;
    const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : inner;
    pts.push(`${(Math.cos(a0) * rr).toFixed(1)} ${(Math.sin(a0) * rr).toFixed(1)}`);
    pts.push(`${(Math.cos(a1) * rr).toFixed(1)} ${(Math.sin(a1) * rr).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}

/* ── Defence: the fort, which is also a shooting gallery ──────────────── */
export function Fort({ night }: Art) {
  const wall = "#dccdae";
  const tower = "#c9b58e";
  const merlons = (x0: number, x1: number, y: number) =>
    Array.from({ length: Math.floor((x1 - x0) / 20) }, (_, i) => (
      <rect key={`${x0}-${i}`} x={x0 + i * 20} y={y - 16} width="12" height="16" fill={wall} stroke={INK} strokeWidth={SW} />
    ));
  return (
    <g>
      <rect x="-110" y="-120" width="220" height="120" fill={wall} stroke={INK} strokeWidth={SW} />
      {merlons(-98, 98, -120)}
      <path d="M-110 -120 h220 v14 h-220 z" fill="#c4b38f" opacity=".5" />
      {[-125, 85].map((x) => (
        <g key={x}>
          <rect x={x} y="-172" width="40" height="172" fill={tower} stroke={INK} strokeWidth={SW} />
          {merlons(x + 2, x + 40, -172)}
          <path d={`M${x + 20} -188 v-44`} stroke={INK} strokeWidth={SW} />
          <path d={`M${x + 20} -232 l28 9 l-28 9 z`} fill={x < 0 ? "#18a3a3" : "#e5557d"} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <rect x={x + 13} y="-140" width="14" height="22" rx="7" fill={night ? GLOW : "#5a4632"} stroke={INK} strokeWidth="2.5" />
        </g>
      ))}
      <path d="M-30 0 v-50 a30 30 0 0 1 60 0 v50 z" fill="#5a3a26" stroke={INK} strokeWidth={SW} />
      <path d="M-30 -20 h60 M-30 -38 h60 M0 -80 v80" stroke="#3a2416" strokeWidth="2" />
      {[-66, 66].map((x) => (
        <g key={x}>
          <circle cx={x} cy="-66" r="20" fill="#fdfbf4" stroke={INK} strokeWidth={SW} />
          <circle cx={x} cy="-66" r="13" fill="#e04a5f" stroke={INK} strokeWidth="2" />
          <circle cx={x} cy="-66" r="6" fill="#fdfbf4" stroke={INK} strokeWidth="2" />
        </g>
      ))}
      <path d="M-100 -30 h18 M-96 -94 h14 M82 -30 h16 M84 -98 h12" stroke="#a8966f" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

/* ── Education: the striped book tent ─────────────────────────────────── */
export function BookTent({ night }: Art) {
  const xs = [-100, -60, -20, 20, 60, 100];
  return (
    <g>
      {xs.slice(0, -1).map((x, i) => (
        <path key={x} d={`M0 -190 L${x} 0 L${xs[i + 1]} 0 Z`}
          fill={i % 2 === 0 ? "#8a5cd6" : "#f6f0ff"} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      ))}
      <path d="M-30 0 L0 -78 L30 0 Z" fill={night ? "#3b2a1a" : "#2a1f3d"} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      {night && <path d="M-18 0 L0 -48 L18 0 Z" fill={GLOW} opacity=".55" />}
      <path d="M0 -190 v-34" stroke={INK} strokeWidth={SW} />
      <path d="M0 -224 l30 8 l-30 8 z" fill="#ffc83d" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      {/* the giant open book */}
      <path d="M-70 -6 q30 -14 64 0 v-38 q-34 -14 -64 0 z" fill="#fffaf0" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M70 -6 q-30 -14 -64 0 v-38 q34 -14 64 0 z" fill="#fffaf0" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M-58 -30 q22 -8 44 0 M-58 -20 q22 -8 44 0 M58 -30 q-22 -8 -44 0 M58 -20 q-22 -8 -44 0" fill="none" stroke="#b8a7d8" strokeWidth="2" />
      {/* a pencil leaning on it */}
      <g transform="translate(78,-6) rotate(-62)">
        <rect x="0" y="-6" width="58" height="12" fill="#ffc83d" stroke={INK} strokeWidth="2.5" />
        <path d="M58 -6 l14 6 l-14 6 z" fill="#f4d9b0" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="-10" y="-6" width="10" height="12" fill="#ec7a9a" stroke={INK} strokeWidth="2.5" />
      </g>
    </g>
  );
}

/* ── Finance: the coin stall, at the centre of the fair ───────────────── */
export function CoinStall({ night }: Art) {
  return (
    <g>
      <Post x={-95} top={-150} />
      <Post x={95} top={-150} />
      <rect x="-108" y="-62" width="216" height="62" fill="#23a38a" stroke={INK} strokeWidth={SW} />
      <path d="M-108 -62 h216 v10 h-216 z" fill="#ffd24a" stroke={INK} strokeWidth="2.5" />
      <path d="M-100 -34 h200" stroke="#1a7f6b" strokeWidth="2.5" />
      <Awning w={224} y={-158} a="#ffd24a" b="#fffaf0" n={7} />
      {Array.from({ length: 7 }, (_, i) => <Bulb key={i} x={-96 + i * 32} y={-112} night={night} />)}
      {/* the big coin sign */}
      <circle cx="0" cy="-202" r="40" fill="#ffd24a" stroke={INK} strokeWidth={SW} />
      <circle cx="0" cy="-202" r="31" fill="none" stroke="#c99a12" strokeWidth="3" />
      <text x="0" y="-188" textAnchor="middle" fontSize="42" fontWeight="800" fill="#a8790a" fontFamily="system-ui, sans-serif">₹</text>
      <path d="M-24 -222 l8 -6" stroke="#fff6cf" strokeWidth="4" strokeLinecap="round" />
      {/* piggy bank */}
      <ellipse cx="-50" cy="-82" rx="30" ry="22" fill="#f59ab5" stroke={INK} strokeWidth={SW} />
      <circle cx="-24" cy="-86" r="9" fill="#f7b2c6" stroke={INK} strokeWidth="2.5" />
      <path d="M-58 -104 l6 -10 l6 10" fill="#f59ab5" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M-60 -98 h14" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <circle cx="-38" cy="-90" r="2.6" fill={INK} />
      {/* coin stacks */}
      {[30, 58].map((x, j) => Array.from({ length: 4 - j }, (_, i) => (
        <ellipse key={`${x}-${i}`} cx={x} cy={-66 - i * 8} rx="14" ry="5" fill="#ffd24a" stroke={INK} strokeWidth="2.2" />
      )))}
    </g>
  );
}

/* ── Manufacturing: the toy factory ───────────────────────────────────── */
export function Factory({ night }: Art) {
  return (
    <g>
      <rect x="54" y="-196" width="28" height="90" fill="#b54a3c" stroke={INK} strokeWidth={SW} />
      <path d="M50 -196 h36 v10 h-36 z" fill="#8e3a2f" stroke={INK} strokeWidth="2.5" />
      <g className="mela-cloud">
        <circle cx="70" cy="-214" r="12" fill="#f3f1ec" stroke={INK} strokeWidth="2.5" />
        <circle cx="86" cy="-230" r="16" fill="#f3f1ec" stroke={INK} strokeWidth="2.5" />
        <circle cx="106" cy="-248" r="12" fill="#f3f1ec" stroke={INK} strokeWidth="2.5" />
      </g>
      <path d="M-104 -106 L-104 -134 L-64 -106 L-64 -134 L-24 -106 L-24 -134 L16 -106 L16 -134 L56 -106 L104 -106 Z"
        fill="#f0b45a" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <rect x="-104" y="-106" width="208" height="106" fill="#e46a55" stroke={INK} strokeWidth={SW} />
      <path d="M-104 -80 h208 M-104 -54 h208 M-104 -28 h208" stroke="#c9533f" strokeWidth="2" />
      {[-80, 40, 76].map((x) => (
        <rect key={x} x={x} y="-94" width="22" height="22" fill={night ? GLOW : "#bfe3ff"} stroke={INK} strokeWidth="2.5" />
      ))}
      <g className="mela-wheel" style={{ animationDuration: "9s" }}>
        <path d={gearPath(26, 10)} transform="translate(-50,-44)" fill="#9aa6b8" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <circle cx="-50" cy="-44" r="8" fill="#e46a55" stroke={INK} strokeWidth="2.5" />
      <g className="mela-wheel" style={{ animationDuration: "6s", animationDirection: "reverse" }}>
        <path d={gearPath(17, 8)} transform="translate(-13,-24)" fill="#c2cad6" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <rect x="18" y="-58" width="34" height="58" fill="#6a3b2c" stroke={INK} strokeWidth={SW} />
      {/* a toy robot */}
      <g transform="translate(84,0)">
        <rect x="-14" y="-40" width="28" height="26" rx="4" fill="#9fc7e8" stroke={INK} strokeWidth="2.5" />
        <rect x="-11" y="-60" width="22" height="18" rx="4" fill="#9fc7e8" stroke={INK} strokeWidth="2.5" />
        <circle cx="-4" cy="-51" r="2.4" fill={INK} /><circle cx="4" cy="-51" r="2.4" fill={INK} />
        <path d="M0 -60 v-8" stroke={INK} strokeWidth="2.5" /><circle cx="0" cy="-70" r="3" fill="#e5557d" stroke={INK} strokeWidth="2" />
        <rect x="-10" y="-14" width="7" height="14" fill="#7aa9cf" stroke={INK} strokeWidth="2.5" />
        <rect x="3" y="-14" width="7" height="14" fill="#7aa9cf" stroke={INK} strokeWidth="2.5" />
      </g>
    </g>
  );
}

/* ── Innovation: the rocket ride ──────────────────────────────────────── */
export function Rocket({ night }: Art) {
  return (
    <g>
      <rect x="-96" y="-22" width="192" height="22" fill="#b8bec9" stroke={INK} strokeWidth={SW} />
      {/* launch tower */}
      <path d="M-86 -22 V-250 M-58 -22 V-250" stroke={INK} strokeWidth={SW} />
      {Array.from({ length: 7 }, (_, i) => (
        <path key={i} d={`M-86 ${-22 - i * 32} L-58 ${-54 - i * 32} M-58 ${-22 - i * 32} L-86 ${-54 - i * 32}`} stroke="#6f7787" strokeWidth="2" />
      ))}
      <path d="M-58 -150 h34" stroke={INK} strokeWidth={SW} />
      {/* flame */}
      <path d="M-6 -40 q16 44 32 0 q-6 20 -16 22 q-10 -2 -16 -22 z" fill="#ffb13d" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M2 -40 q8 22 16 0" fill="#fff08a" />
      {/* body */}
      <path d="M10 -268 q30 34 30 104 v112 h-60 v-112 q0 -70 30 -104 z" fill="#f7f7fb" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M10 -268 q18 22 24 54 h-48 q6 -32 24 -54 z" fill="#e5557d" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M40 -120 l24 36 v30 l-24 -12 z M-20 -120 l-24 36 v30 l24 -12 z" fill="#18a3a3" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M26 -212 q6 60 0 150" fill="none" stroke="#d7d9e3" strokeWidth="6" strokeLinecap="round" />
      <circle cx="10" cy="-170" r="16" fill={night ? GLOW : "#8fd3ff"} stroke={INK} strokeWidth={SW} />
      <path d="M2 -176 l6 -5" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <rect x="-20" y="-58" width="60" height="10" fill="#6f7787" stroke={INK} strokeWidth="2.5" />
      {/* dish */}
      <path d="M78 -22 v-50" stroke={INK} strokeWidth={SW} />
      <path d="M58 -96 q20 30 44 6 z" fill="#e8ecf4" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M80 -88 l10 -12" stroke={INK} strokeWidth="2.5" />
    </g>
  );
}

/* ── Rural: a village with its well, its tap and its lit bulb ─────────── */
export function Village({ night }: Art) {
  return (
    <g>
      <rect x="-116" y="-82" width="104" height="82" fill="#d99f66" stroke={INK} strokeWidth={SW} />
      <path d="M-116 -56 h104 M-116 -30 h104" stroke="#bf8551" strokeWidth="2" />
      <path d="M-132 -80 L-64 -146 L4 -80 Z" fill="#e8c35a" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M-110 -96 l18 -16 M-86 -90 l22 -22 M-60 -92 l20 -20 M-36 -94 l14 -14" stroke="#c9a23d" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="-76" y="-50" width="26" height="50" fill="#5a3a26" stroke={INK} strokeWidth={SW} />
      <path d="M-63 -76 v8" stroke={INK} strokeWidth="2" />
      <Bulb x={-63} y={-62} night={night} />
      {/* the tap on a standpipe, dripping */}
      <path d="M22 0 v-58 h20" fill="none" stroke="#7d8aa0" strokeWidth="8" strokeLinecap="round" />
      <path d="M22 0 v-58 h20" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" opacity=".5" />
      <path d="M42 -58 v10" stroke="#7d8aa0" strokeWidth="6" strokeLinecap="round" />
      <path d="M42 -40 q-5 8 0 10 q5 -2 0 -10 z M42 -22 q-4 6 0 8 q4 -2 0 -8 z" fill="#5fc2f0" stroke={INK} strokeWidth="1.8" />
      <ellipse cx="42" cy="-2" rx="16" ry="5" fill="#5fc2f0" stroke={INK} strokeWidth="2" />
      {/* the well */}
      <path d="M72 0 v-44 h60 v44 z" fill="#b9b1a2" stroke={INK} strokeWidth={SW} />
      <ellipse cx="102" cy="-44" rx="30" ry="9" fill="#5a6d7f" stroke={INK} strokeWidth={SW} />
      <path d="M76 -44 v-58 M128 -44 v-58" stroke="#8a5c36" strokeWidth="6" />
      <path d="M66 -100 L102 -124 L138 -100 Z" fill="#c75b4a" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M102 -100 v30" stroke={INK} strokeWidth="2" />
      <path d="M94 -70 h16 l-3 14 h-10 z" fill="#8a5c36" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M78 -22 h14 M104 -30 h18" stroke="#9a9283" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

/* ── Women: the kitchen stall, with its clean flame ───────────────────── */
export function Kitchen({ night }: Art) {
  return (
    <g>
      <Post x={-92} top={-150} />
      <Post x={92} top={-150} />
      <rect x="-104" y="-58" width="208" height="58" fill="#f6d365" stroke={INK} strokeWidth={SW} />
      <path d="M-104 -58 h208 v8 h-208 z" fill="#e0a82f" stroke={INK} strokeWidth="2.2" />
      <Awning w={216} y={-156} a="#ec6f9b" b="#fff4f8" n={6} />
      {night && [-60, 0, 60].map((x) => <circle key={x} cx={x} cy="-112" r="16" fill={GLOW} opacity=".3" />)}
      {/* stove, clean blue flame, pot and steam */}
      <rect x="-30" y="-74" width="56" height="16" rx="3" fill="#3b4254" stroke={INK} strokeWidth="2.5" />
      <path d="M-14 -74 q4 -10 8 0 q4 -12 8 0 q4 -10 8 0" fill="#4aa8ff" stroke={INK} strokeWidth="1.8" />
      <path d="M-24 -104 h44 v18 q-22 10 -44 0 z" fill="#b6c0cc" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M-26 -104 h48" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M-10 -114 q-6 -10 0 -20 M4 -114 q-6 -10 0 -20" fill="none" stroke="#c9ced8" strokeWidth="3" strokeLinecap="round" />
      {/* the cylinder */}
      <rect x="54" y="-54" width="30" height="54" rx="12" fill="#e2493f" stroke={INK} strokeWidth={SW} />
      <rect x="62" y="-66" width="14" height="12" rx="3" fill="#8b8f99" stroke={INK} strokeWidth="2.5" />
      <path d="M58 -30 h22" stroke="#b5352d" strokeWidth="3" />
      {/* bangle stand */}
      <path d="M-74 -58 v-40" stroke="#8a5c36" strokeWidth="5" />
      {["#e5557d", "#18a3a3", "#ffc83d", "#8a5cd6"].map((c, i) => (
        <ellipse key={c} cx="-74" cy={-94 + i * 9} rx="14" ry="4" fill="none" stroke={c} strokeWidth="4" />
      ))}
    </g>
  );
}

/* ── Health: the tent with a heart on it ──────────────────────────────── */
export function HealthTent({ night }: Art) {
  return (
    <g>
      <path d="M-96 0 q0 -120 96 -150 q96 30 96 150 z" fill="#f4fbf8" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M-60 0 q2 -104 60 -146 q-30 60 -24 146 z" fill="#6cc6a8" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M60 0 q-2 -104 -60 -146 q30 60 24 146 z" fill="#6cc6a8" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M0 -150 v-24" stroke={INK} strokeWidth={SW} />
      <circle cx="0" cy="-178" r="6" fill="#ffc83d" stroke={INK} strokeWidth="2.2" />
      <path d="M0 -58 q-34 -24 -20 -44 q12 -12 20 2 q8 -14 20 -2 q14 20 -20 44 z" fill="#2fbf71" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M-18 -78 h10 l5 -10 l6 20 l5 -10 h10" fill="none" stroke="#f4fbf8" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <rect x="-24" y="-40" width="48" height="40" fill={night ? GLOW : "#2a3b36"} stroke={INK} strokeWidth="2.5" opacity={night ? 0.8 : 1} />
      <rect x="66" y="-36" width="18" height="30" rx="4" fill="#ffb13d" stroke={INK} strokeWidth="2.5" />
      <rect x="68" y="-44" width="14" height="8" fill="#f4fbf8" stroke={INK} strokeWidth="2" />
    </g>
  );
}

/* ── Digital: the tower, and a phone with a payment code on it ────────── */
export function Tower({ night }: Art) {
  const qr = [[0, 0], [1, 0], [0, 1], [3, 0], [4, 1], [2, 2], [0, 3], [1, 4], [3, 3], [4, 4], [2, 4], [4, 2]];
  return (
    <g>
      <path d="M-42 0 L-10 -236 M42 0 L10 -236" stroke={INK} strokeWidth={SW} />
      {Array.from({ length: 6 }, (_, i) => {
        const y0 = -i * 38;
        const y1 = -(i + 1) * 38;
        const w0 = 42 - (32 * i) / 6;
        const w1 = 42 - (32 * (i + 1)) / 6;
        return <path key={i} d={`M${-w0} ${y0} L${w1} ${y1} M${w0} ${y0} L${-w1} ${y1} M${-w1} ${y1} H${w1}`} stroke="#6f7787" strokeWidth="2" />;
      })}
      <circle cx="0" cy="-240" r="7" fill={night ? "#ff5a6a" : "#e04a5f"} stroke={INK} strokeWidth="2.2" />
      {night && <circle cx="0" cy="-240" r="16" fill="#ff5a6a" opacity=".35" className="mela-twinkle" />}
      <g className="mela-twinkle">
        {[18, 32, 46].map((r) => (
          <g key={r}>
            <path d={`M${r * 0.7} ${-240 - r * 0.7} A${r} ${r} 0 0 1 ${r * 0.7} ${-240 + r * 0.7}`} fill="none" stroke="#18a3a3" strokeWidth="4" strokeLinecap="round" />
            <path d={`M${-r * 0.7} ${-240 - r * 0.7} A${r} ${r} 0 0 0 ${-r * 0.7} ${-240 + r * 0.7}`} fill="none" stroke="#18a3a3" strokeWidth="4" strokeLinecap="round" />
          </g>
        ))}
      </g>
      {/* the phone kiosk */}
      <g transform="translate(64,0)">
        <rect x="-30" y="-120" width="60" height="112" rx="10" fill="#2b2f3d" stroke={INK} strokeWidth={SW} />
        <rect x="-24" y="-110" width="48" height="88" rx="4" fill={night ? "#dff3ff" : "#eef8ff"} stroke={INK} strokeWidth="2" />
        {qr.map(([cx, cy]) => <rect key={`${cx}${cy}`} x={-17 + (cx ?? 0) * 7} y={-98 + (cy ?? 0) * 7} width="6" height="6" fill="#2b2f3d" />)}
        <path d="M-12 -46 l8 8 l16 -16" fill="none" stroke="#2fbf71" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="-14" y="-14" width="28" height="3" rx="1.5" fill="#6f7787" />
      </g>
    </g>
  );
}

/* ── Trade: the harbour, a container ship and its crane ───────────────── */
export function Harbour({ night }: Art) {
  const boxes = ["#e5557d", "#18a3a3", "#ffc83d", "#4f7fd6", "#e46a55", "#8a5cd6", "#2fbf71", "#f08a3a"];
  return (
    <g>
      <rect x="-128" y="-16" width="120" height="16" fill="#9b6b43" stroke={INK} strokeWidth={SW} />
      <path d="M-120 0 v18 M-90 0 v18 M-60 0 v18 M-30 0 v18" stroke={INK} strokeWidth="4" />
      {/* crane */}
      <path d="M-100 -16 V-176 M-70 -16 V-176" stroke="#f0b45a" strokeWidth="8" />
      <path d="M-100 -16 V-176 M-70 -16 V-176" stroke={INK} strokeWidth="2" opacity=".6" />
      <path d="M-116 -176 H80" stroke="#f0b45a" strokeWidth="10" />
      <path d="M-116 -176 H80" stroke={INK} strokeWidth="2" opacity=".6" />
      <path d="M40 -176 v44" stroke={INK} strokeWidth="2" />
      <rect x="28" y="-132" width="24" height="14" fill={boxes[3]} stroke={INK} strokeWidth="2.2" />
      {/* ship */}
      <path d="M-20 -4 L130 -4 L112 26 L-4 26 Z" fill="#2c3e57" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M-14 14 L124 14" stroke="#c9453d" strokeWidth="8" />
      {boxes.map((c, i) => (
        <rect key={i} x={-8 + (i % 4) * 26} y={-28 - Math.floor(i / 4) * 22} width="24" height="22" fill={c} stroke={INK} strokeWidth="2.2" />
      ))}
      <rect x="98" y="-54" width="26" height="50" fill="#f4f1ea" stroke={INK} strokeWidth={SW} />
      {[0, 1].map((r) => <rect key={r} x="103" y={-48 + r * 16} width="16" height="8" fill={night ? GLOW : "#8fd3ff"} stroke={INK} strokeWidth="1.8" />)}
      <path d="M-24 34 q14 -8 28 0 t28 0 t28 0 t28 0 t28 0 t28 0" fill="none" stroke="#e8f6ff" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}
