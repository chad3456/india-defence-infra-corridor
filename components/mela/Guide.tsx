/**
 * The guide: a chibi caricature, drawn in manga convention.
 *
 * Recognisable by the things a caricature is allowed to use — white hair and
 * beard, round glasses, a long kurta under a sleeveless half-jacket — and
 * nothing else. Big head, closed happy eyes, a glint on the lenses, blush on
 * the cheeks: the register is a friendly tour guide at a fair.
 *
 * ── What the drawing is not allowed to do ────────────────────────────────
 *
 * Speak for the person it depicts. Every line the guide says is written by
 * this site, is a direction around the fair rather than a claim about policy,
 * and is labelled as the site's narration wherever it appears. A cartoon of a
 * head of government saying "I built this" would be a fabricated quotation
 * with a face on it.
 *
 * It also carries no party symbol. No lotus, no saffron-dominant palette: the
 * jacket is slate, the kurta is cream. The mela is about a government's
 * record, not a party's campaign.
 *
 * Drawn in a 200 × 300 box with the feet on the bottom edge, so the world can
 * place it by its feet.
 */

const INK = "#16101f";
const SKIN = "#c98b5c";
const SKIN_SHADE = "#a86c43";
const WHITE = "#fbfaf6";
const WHITE_SHADE = "#d9d7d0";
const KURTA = "#f4ecd9";
const KURTA_SHADE = "#dccfb0";
const JACKET = "#566b8c";
const JACKET_SHADE = "#435674";

export default function Guide({ talking = false, walking = false }: { talking?: boolean; walking?: boolean }) {
  return (
    <g className={walking ? "mela-walking" : undefined}>
      {/* Ground shadow */}
      <ellipse cx="100" cy="294" rx="48" ry="8" fill={INK} opacity=".18" />

      {/* Legs: churidar, and mojari with an upturned toe */}
      <rect x="78" y="236" width="18" height="50" rx="8" fill={WHITE} stroke={INK} strokeWidth="3" />
      <rect x="104" y="236" width="18" height="50" rx="8" fill={WHITE} stroke={INK} strokeWidth="3" />
      <path d="M72 284 q4 -9 22 -7 q6 2 4 9 q-14 4 -26 -2 z" fill="#7a4a2a" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M104 286 q-2 -9 16 -9 q16 0 20 7 q-18 7 -36 2 z" fill="#7a4a2a" stroke={INK} strokeWidth="3" strokeLinejoin="round" />

      {/* Left arm, at rest */}
      <path d="M58 158 q-16 30 -12 62" fill="none" stroke={INK} strokeWidth="21" strokeLinecap="round" />
      <path d="M58 158 q-16 30 -12 62" fill="none" stroke={KURTA} strokeWidth="15" strokeLinecap="round" />
      <circle cx="46" cy="224" r="9" fill={SKIN} stroke={INK} strokeWidth="3" />

      {/* Kurta: long, flared at the hem */}
      <path d="M60 150 q40 -12 80 0 l10 96 q-50 10 -100 0 z" fill={KURTA} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M128 152 l10 94 q-10 2 -22 3 l-4 -96 z" fill={KURTA_SHADE} opacity=".7" />

      {/* The half-jacket, with its mandarin collar and a button line */}
      <path d="M62 152 q38 -12 76 0 l6 78 q-44 9 -88 0 z" fill={JACKET} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M124 154 l8 74 q-8 2 -16 2 l-2 -76 z" fill={JACKET_SHADE} />
      <path d="M86 150 l14 30 l14 -30" fill={KURTA} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M84 146 q16 8 32 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <circle cx="100" cy="194" r="2.6" fill={INK} />
      <circle cx="100" cy="208" r="2.6" fill={INK} />
      <circle cx="100" cy="222" r="2.6" fill={INK} />
      <path d="M72 200 h14" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />

      {/* Right arm, waving */}
      {/* Kept outside the head's silhouette: the first version crossed the
          beard and read as a white stripe through it. */}
      <g className="mela-wave">
        <path d="M142 162 q30 -14 42 -52" fill="none" stroke={INK} strokeWidth="21" strokeLinecap="round" />
        <path d="M142 162 q30 -14 42 -52" fill="none" stroke={KURTA} strokeWidth="15" strokeLinecap="round" />
        <circle cx="185" cy="104" r="10" fill={SKIN} stroke={INK} strokeWidth="3" />
        <path d="M180 94 v-8 M185 93 v-10 M190 94 v-8" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Ears */}
      <circle cx="42" cy="92" r="10" fill={SKIN} stroke={INK} strokeWidth="3" />
      <circle cx="158" cy="92" r="10" fill={SKIN} stroke={INK} strokeWidth="3" />

      {/* Head */}
      <circle cx="100" cy="88" r="58" fill={SKIN} stroke={INK} strokeWidth="3" />
      <path d="M138 50 a58 58 0 0 1 -6 90 q14 -44 6 -90 z" fill={SKIN_SHADE} opacity=".55" />

      {/*
        White hair, swept back from a high forehead: a band along the crown
        and full at the temples. The first drawing covered the whole crown and
        read as a white cap; the forehead has to show for it to read as hair.
      */}
      <path d="M43 92 Q38 42 72 29 Q100 19 128 29 Q162 42 157 92 Q151 60 130 47 Q100 37 70 47 Q49 60 43 92 Z"
        fill={WHITE} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M62 40 q16 -9 30 -8 M110 32 q16 1 28 10" fill="none" stroke={WHITE_SHADE} strokeWidth="3" strokeLinecap="round" />
      <path d="M86 44 q14 -5 28 0" fill="none" stroke={SKIN_SHADE} strokeWidth="2" strokeLinecap="round" opacity=".6" />

      {/* Beard: full, rounded, with a cel-shaded side */}
      <path d="M46 96 q2 40 22 60 q32 26 64 0 q20 -20 22 -60 q-8 20 -22 26 q-20 -12 -32 -10 q-12 -2 -32 10 q-14 -6 -22 -26 z"
        fill={WHITE} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M140 108 q-4 32 -20 46 q12 -22 12 -46 z" fill={WHITE_SHADE} />
      <path d="M76 138 q6 6 8 14 M112 150 q4 -6 10 -10" fill="none" stroke={WHITE_SHADE} strokeWidth="2.5" strokeLinecap="round" />

      {/* Moustache, and the mouth under it */}
      <path d="M76 116 q12 -8 24 -2 q12 -6 24 2 q-10 8 -24 4 q-14 4 -24 -4 z" fill={WHITE} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
      {talking
        ? <ellipse cx="100" cy="128" rx="9" ry="6.5" fill="#8a2a36" stroke={INK} strokeWidth="2.5" />
        : <path d="M91 126 q9 7 18 0" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />}

      {/* Nose */}
      <path d="M100 92 q-5 12 2 16" fill="none" stroke={SKIN_SHADE} strokeWidth="3" strokeLinecap="round" />

      {/* Blush */}
      <ellipse cx="64" cy="104" rx="10" ry="5" fill="#ec7a8a" opacity=".45" />
      <ellipse cx="136" cy="104" rx="10" ry="5" fill="#ec7a8a" opacity=".45" />

      {/* Eyebrows */}
      <path d="M62 64 q12 -8 26 -2 M112 62 q14 -6 26 2" fill="none" stroke={WHITE} strokeWidth="7" strokeLinecap="round" />
      <path d="M62 64 q12 -8 26 -2 M112 62 q14 -6 26 2" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" opacity=".5" />

      {/* Happy closed eyes, the manga smile */}
      <path d="M66 84 q9 -9 18 0 M116 84 q9 -9 18 0" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />

      {/* Round glasses, with the lens glint */}
      <circle cx="75" cy="82" r="17" fill="#ffffff" fillOpacity=".12" stroke={INK} strokeWidth="2.6" />
      <circle cx="125" cy="82" r="17" fill="#ffffff" fillOpacity=".12" stroke={INK} strokeWidth="2.6" />
      <path d="M92 80 q8 -5 16 0" fill="none" stroke={INK} strokeWidth="2.6" />
      <path d="M58 80 l-14 -4 M142 80 l14 -4" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M64 76 l10 -8 M68 82 l4 -3" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity=".9" />
      <path d="M114 76 l10 -8 M118 82 l4 -3" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity=".9" />

      {/* Sparkles, because it is a fair */}
      <path d="M26 30 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3 l9 -3 z" fill="#ffd84a" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M178 40 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2 z" fill="#ffd84a" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    </g>
  );
}
