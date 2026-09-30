/**
 * Hand-drawn icons and card illustrations for /namesakes.
 *
 * Ink-on-card, like the board they sit beside: white fills, one heavy black
 * stroke, a single colour accent. The gods are drawn by what they carry — a
 * bow, a flute, a mace, a lotus — never as figures: an attribute identifies a
 * god in Indian iconography without anyone having to draw a face for one.
 */
import type { ReactNode } from "react";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Svg({ children, size = 30, label }: { children: ReactNode; size?: number; label?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {children}
    </svg>
  );
}

/** Ram: a bow and an arrow. */
export function BowIcon(p: { size?: number }) {
  return (
    <Svg {...p}>
      <path {...S} d="M12 6c12 6 12 22 0 28" />
      <path {...S} d="M12 6v28" strokeWidth={1.4} />
      <path {...S} d="M8 20h26M30 16l4 4-4 4" />
      <path {...S} d="M8 20l-2-2M8 20l-2 2" strokeWidth={1.6} />
    </Svg>
  );
}

/** Krishna: a flute with a peacock feather. */
export function FluteIcon(p: { size?: number }) {
  return (
    <Svg {...p}>
      <path {...S} d="M6 30L32 12" strokeWidth={4} />
      <path {...S} d="M6 30L32 12" stroke="#fff" strokeWidth={1.4} />
      <circle cx="15" cy="24" r="1" fill="currentColor" />
      <circle cx="20" cy="20.5" r="1" fill="currentColor" />
      <circle cx="25" cy="17" r="1" fill="currentColor" />
      <path {...S} d="M30 10c2-6 8-6 7 0-1 4-6 4-7 0z" strokeWidth={1.8} />
      <circle cx="33.5" cy="9" r="1.5" fill="currentColor" />
    </Svg>
  );
}

/** Hanuman: the gada, his mace. */
export function MaceIcon(p: { size?: number }) {
  return (
    <Svg {...p}>
      <path {...S} d="M9 33l12-12" strokeWidth={3} />
      <circle {...S} cx="26" cy="15" r="7.5" />
      <path {...S} d="M20 14c3 2 9 2 12-1M21 19c3 1 7 1 10-2" strokeWidth={1.5} />
      <path {...S} d="M30 8l3-3" />
    </Svg>
  );
}

/** The other gods: a lotus. */
export function LotusIcon(p: { size?: number }) {
  return (
    <Svg {...p}>
      <path {...S} d="M20 30c-4-4-4-12 0-18 4 6 4 14 0 18z" />
      <path {...S} d="M20 30c-6-1-11-7-11-13 6 1 10 6 11 13zM20 30c6-1 11-7 11-13-6 1-10 6-11 13z" />
      <path {...S} d="M8 32h24" />
    </Svg>
  );
}

/** Mahatma Gandhi: the round spectacles. */
export function SpectaclesIcon(p: { size?: number }) {
  return (
    <Svg {...p}>
      <circle {...S} cx="12" cy="22" r="6.5" />
      <circle {...S} cx="28" cy="22" r="6.5" />
      <path {...S} d="M18.5 21c1-1.5 2-1.5 3 0M5.5 21L3 17M34.5 21L37 17" />
    </Svg>
  );
}

/** Indira and Rajiv: initials in a seal. The page does not borrow a party symbol. */
export function InitialsIcon({ text, size }: { text: string; size?: number }) {
  return (
    <Svg size={size}>
      <circle {...S} cx="20" cy="20" r="14" />
      <text x="20" y="24.5" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="currentColor" fontFamily="var(--ns-display)">{text}</text>
    </Svg>
  );
}

export function AllIcon(p: { size?: number }) {
  return (
    <Svg {...p}>
      <ellipse {...S} cx="20" cy="27" rx="10" ry="4" />
      <path {...S} d="M10 27v-4M30 27v-4" />
      <ellipse {...S} cx="20" cy="23" rx="10" ry="4" />
      <path {...S} d="M10 23v-4M30 23v-4" />
      <ellipse {...S} cx="20" cy="19" rx="10" ry="4" />
    </Svg>
  );
}

export function figureIcon(id: string, size = 30): ReactNode {
  switch (id) {
    case "rama": return <BowIcon size={size} />;
    case "krishna": return <FluteIcon size={size} />;
    case "hanuman": return <MaceIcon size={size} />;
    case "others": return <LotusIcon size={size} />;
    case "mahatma": return <SpectaclesIcon size={size} />;
    case "indira": return <InitialsIcon text="IG" size={size} />;
    case "rajiv": return <InitialsIcon text="RG" size={size} />;
    default: return <AllIcon size={size} />;
  }
}

/* ─────────────────────────── Card illustrations ─────────────────────────── */

const L = { fill: "#fff", stroke: "#1c1b19", strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const T = { fontFamily: "var(--ns-display)", fontSize: 15, fill: "#1c1b19" };

function Walker({ x, y, s = 1, hat = false }: { x: number; y: number; s?: number; hat?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="44" rx="13" ry="3.5" fill="#1c1b19" opacity="0.12" />
      <rect {...L} x="-9" y="12" width="18" height="26" rx="9" />
      <path {...L} d="M-4 36v7M4 36v7" />
      <circle {...L} cx="0" cy="4" r="10" />
      {hat && <path d="M-9 -3c2-6 16-6 18 0z" fill="#1c1b19" />}
      <circle cx="-3" cy="4" r="1.3" fill="#1c1b19" />
      <circle cx="3" cy="4" r="1.3" fill="#1c1b19" />
    </g>
  );
}

function Bubble({ x, y, text, w }: { x: number; y: number; text: string; w: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path {...L} strokeWidth={2.4} d={`M0 0h${w}a8 8 0 0 1 8 8v12a8 8 0 0 1 -8 8h-${w / 2 - 6}l-6 7-6-7h-${w / 2 - 6}a8 8 0 0 1 -8 -8v-12a8 8 0 0 1 8 -8z`} />
      <text {...T} fontSize={13} x={w / 2} y={19} textAnchor="middle">{text}</text>
    </g>
  );
}

/** Card 1: a signpost that points two ways. */
export function SignpostArt() {
  return (
    <svg viewBox="0 0 320 180" className="ns-art" aria-hidden>
      <path {...L} d="M158 40v122" strokeWidth={5} />
      <path {...L} d="M160 44h92l14 14-14 14h-92z" />
      <text {...T} x="210" y="63" textAnchor="middle">RAM…? →</text>
      <path {...L} d="M156 82h-96l-14 14 14 14h96z" />
      <text {...T} x="104" y="101" textAnchor="middle">← GANDHI…?</text>
      <path {...L} d="M130 162h56" />
      <Walker x={70} y={118} hat />
      <Walker x={250} y={118} />
      <Bubble x={36} y={76 - 50} text="who's that?" w={78} />
    </svg>
  );
}

/** Card 2: a magnifier over a name, showing it is not what it spells. */
export function MagnifierArt() {
  return (
    <svg viewBox="0 0 320 180" className="ns-art" aria-hidden>
      <rect {...L} x="40" y="58" width="180" height="46" rx="8" />
      <text {...T} fontSize={22} x="130" y="89" textAnchor="middle">KRISHNA·NAGAR</text>
      <circle {...L} cx="222" cy="84" r="36" fill="none" strokeWidth={5} />
      <path {...L} d="M248 110l34 34" strokeWidth={9} />
      <path d="M206 72l6-10 6 8 6-8 6 10z" fill="#e0b52c" stroke="#1c1b19" strokeWidth="2.4" strokeLinejoin="round" />
      <text {...T} fontSize={12} x="222" y="100" textAnchor="middle">a Maharaja</text>
      <Walker x={70} y={126} />
      <Bubble x={20} y={22} text="hm…" w={46} />
    </svg>
  );
}

/** Card 3: three stamped proofs. */
export function StampsArt() {
  const cards: Array<[number, string, string]> = [[40, "WIKIDATA", "#1a9e6a"], [128, "WIKIPEDIA", "#3b62d6"], [216, "FULL NAME", "#b8760a"]];
  return (
    <svg viewBox="0 0 320 180" className="ns-art" aria-hidden>
      {cards.map(([x, label, c], k) => (
        <g key={label} transform={`rotate(${(k - 1) * 4} ${x + 32} 90)`}>
          <rect {...L} x={x} y={40} width={66} height={92} rx={6} />
          <path d={`M${x + 10} 58h46M${x + 10} 68h36M${x + 10} 78h42`} stroke="#b9b3a6" strokeWidth="3" strokeLinecap="round" />
          <circle cx={x + 33} cy={108} r={16} fill="none" stroke={c} strokeWidth="3" />
          <path d={`M${x + 25} 108l6 6 11-12`} fill="none" stroke={c} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          <text {...T} fontSize={10} x={x + 33} y={150} textAnchor="middle">{label}</text>
        </g>
      ))}
    </svg>
  );
}

/** Card 4: a stack of tokens and a tapping finger. */
export function TokensArt() {
  const stack = (x: number, n: number, c: string) =>
    Array.from({ length: n }, (_, k) => (
      <g key={k} transform={`translate(${x} ${130 - k * 12})`}>
        <path {...L} strokeWidth={2.6} d="M-22 0v6a22 7 0 0 0 44 0v-6" fill={c} />
        <ellipse {...L} strokeWidth={2.6} cx="0" cy="0" rx="22" ry="7" fill={c} />
      </g>
    ));
  return (
    <svg viewBox="0 0 320 180" className="ns-art" aria-hidden>
      <path d="M20 150h280" stroke="#1c1b19" strokeWidth="3" strokeLinecap="round" />
      {stack(80, 1, "#1a9e6a")}
      {stack(150, 5, "#b8760a")}
      {stack(220, 2, "#3b62d6")}
      <path {...L} d="M252 60c-4-10 6-14 10-4l6 16 4-2c6-2 9 4 7 9l-8 22c-3 8-14 10-20 4l-12-12c-4-4 0-10 5-7l8 5z" />
      <Bubble x={112} y={20} text="stack = many" w={84} />
    </svg>
  );
}

/** Card 5: the board, two ways. */
export function SwitchArt() {
  return (
    <svg viewBox="0 0 320 180" className="ns-art" aria-hidden>
      <rect {...L} x="60" y="52" width="200" height="60" rx="30" />
      <rect x="66" y="58" width="94" height="48" rx="24" fill="#1c1b19" />
      <text {...T} x="113" y="88" textAnchor="middle" fill="#fff">GODS</text>
      <text {...T} x="210" y="88" textAnchor="middle">GANDHIS</text>
      <Walker x={40} y={120} hat />
      <Walker x={280} y={120} />
      <Walker x={160} y={128} s={0.8} />
      <Bubble x={236} y={70 - 48} text="sure" w={44} />
    </svg>
  );
}
