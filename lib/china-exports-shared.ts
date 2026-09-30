/**
 * Types and the product register for /china-exports, safe for the client.
 *
 * Every product is one Harmonized System code, named here because the
 * Comtrade preview endpoint returns no descriptions. The names follow the HS
 * heading texts, shortened; where a code is broader than its everyday name
 * (9207.90 is "other electrically amplified instruments", which is mostly
 * electric guitars and basses but is not only them) the `note` says so and
 * the page prints the note.
 */

export type Group = "sound" | "music" | "sky" | "energy" | "home" | "play" | "machines";

export interface Product {
  code: string;
  name: string;
  group: Group;
  /** What the code covers beyond, or short of, its everyday name. */
  note?: string;
  /** First year the code exists in the HS; earlier years are not comparable. */
  since?: number;
}

export const GROUP_LABEL: Record<Group, string> = {
  sound: "Sound systems",
  music: "Musical instruments",
  sky: "Drones",
  energy: "Energy",
  home: "Home",
  play: "Play & move",
  machines: "Heavy things",
};

export const PRODUCTS: Product[] = [
  { code: "851822", name: "Speaker systems", group: "sound", note: "HS 8518.22: multiple loudspeakers mounted in the same enclosure." },
  { code: "851821", name: "Single speakers", group: "sound", note: "HS 8518.21: a single loudspeaker mounted in its enclosure." },
  { code: "851830", name: "Headphones & earphones", group: "sound", note: "HS 8518.30: headphones and earphones, whether or not combined with a microphone." },
  { code: "851840", name: "Audio amplifiers", group: "sound" },
  { code: "851850", name: "Sound amplifier sets", group: "sound", note: "HS 8518.50: electric sound amplifier sets." },
  { code: "851810", name: "Microphones", group: "sound" },
  { code: "920290", name: "Acoustic guitars & other plucked strings", group: "music", note: "HS 9202.90: string instruments other than those played with a bow — the code acoustic guitars fall under, alongside other plucked strings." },
  { code: "920790", name: "Electric guitars & basses", group: "music", note: "HS 9207.90: instruments whose sound is produced or amplified electrically, other than keyboards — the code electric guitars and basses fall under, alongside other such instruments." },
  { code: "920710", name: "Electronic keyboards", group: "music" },
  { code: "920600", name: "Drums & percussion", group: "music" },
  { code: "920110", name: "Upright pianos", group: "music" },
  { code: "920510", name: "Brass instruments", group: "music" },
  { code: "880621", name: "Drones up to 250 g", group: "sky", since: 2022, note: "HS 8806.21: unmanned aircraft, maximum take-off weight up to 250 g. Drones got their own HS codes only in 2022." },
  { code: "880622", name: "Drones 250 g – 7 kg", group: "sky", since: 2022, note: "HS 8806.22: unmanned aircraft, maximum take-off weight above 250 g and up to 7 kg." },
  { code: "880623", name: "Drones 7 – 25 kg", group: "sky", since: 2022, note: "HS 8806.23: unmanned aircraft, maximum take-off weight above 7 kg and up to 25 kg." },
  { code: "880624", name: "Drones 25 – 150 kg", group: "sky", since: 2022, note: "HS 8806.24: unmanned aircraft, maximum take-off weight above 25 kg and up to 150 kg." },
  { code: "854143", name: "Solar panels", group: "energy", since: 2022, note: "HS 8541.43: photovoltaic cells assembled in modules or made up into panels. Before 2022 they shared a code with loose cells, so earlier years are not comparable." },
  { code: "850760", name: "Lithium-ion batteries", group: "energy" },
  { code: "870380", name: "Electric cars", group: "energy", since: 2017, note: "HS 8703.80: passenger vehicles with only an electric motor for propulsion." },
  { code: "841510", name: "Wall & window air conditioners", group: "home" },
  { code: "851650", name: "Microwave ovens", group: "home" },
  { code: "851713", name: "Smartphones", group: "home", since: 2022, note: "HS 8517.13: smartphones. Before 2022 they were counted with other mobile telephones, so earlier years are not comparable." },
  { code: "847130", name: "Laptops", group: "home", note: "HS 8471.30: portable computers weighing not more than 10 kg." },
  { code: "660199", name: "Umbrellas", group: "home", note: "HS 6601.99: umbrellas other than garden umbrellas and those with a telescopic shaft." },
  { code: "950510", name: "Christmas decorations", group: "home" },
  { code: "950300", name: "Toys", group: "play", since: 2017, note: "HS 9503.00: tricycles, scooters, dolls, models, puzzles and other toys." },
  { code: "950450", name: "Video game consoles", group: "play" },
  { code: "871200", name: "Bicycles", group: "play", note: "HS 8712.00: bicycles and other cycles, not motorised." },
  { code: "871160", name: "E-bikes & electric scooters", group: "play", since: 2022, note: "HS 8711.60: motorcycles and cycles with an electric motor for propulsion." },
  { code: "860900", name: "Shipping containers", group: "machines" },
  { code: "842952", name: "Excavators", group: "machines", note: "HS 8429.52: self-propelled machinery with a 360° revolving superstructure — excavators." },
];

export interface TrendPoint { year: number; value: number | null }

export interface PartnerValue {
  /** Comtrade's partner code (UN M49, with Comtrade's own variants). */
  m49: number;
  name: string;
  /** world-atlas feature id (ISO 3166-1 numeric), when the partner is a country on the map. */
  atlasId: string | null;
  value: number;
}

export interface ProductData {
  code: string;
  /** China's reported exports to the world, US$, per year. */
  trend: TrendPoint[];
  /** China's reported exports by destination, in `partnerYear`. */
  partners: PartnerValue[];
  partnerYear: number | null;
  /** Quantity exported to the world in `partnerYear`, with its unit, when Comtrade reports one. */
  quantity: { value: number; unit: string } | null;
  /** China's share of all reporters' exports to the world, in `share.year`. Derived. */
  share: { year: number; china: number; world: number; reporters: number } | null;
  /** What the rest of the world reports importing from China, in `mirror.year`. */
  mirror: { year: number; value: number; reporters: number } | null;
}

export interface ChinaExports {
  generatedAt: string;
  latestYear: number | null;
  products: ProductData[];
  calls: number;
  errors: string[];
}

export const SOURCE = {
  name: "UN Comtrade Database",
  publisher: "United Nations Statistics Division",
  url: "https://comtradeplus.un.org/",
  api: "https://comtradeapi.un.org/public/v1/preview/C/A/HS",
};

/* ─────────────────────────── What the page draws (built in lib/china-exports.ts) ─────────────────────────── */

export interface MapCountry { id: string; name: string; d: string; cx: number; cy: number }

export interface ProductView {
  code: string;
  name: string;
  group: Group;
  note: string | null;
  since: number | null;
  trend: Array<{ year: number; value: number | null }>;
  latest: { year: number; value: number } | null;
  /** Change from the first comparable year to the latest, as a multiple. Derived. */
  multiple: { from: number; to: number; x: number } | null;
  /** [atlasId, US$] for every destination on the map. */
  byCountry: Array<[string, number]>;
  top: Array<{ name: string; value: number; atlasId: string | null }>;
  partnerTotal: number;
  destinations: number;
  quantity: { value: number; unit: string } | null;
  share: { year: number; pct: number; reporters: number } | null;
  mirror: { year: number; china: number | null; world: number; reporters: number } | null;
}

export interface ChinaView {
  present: boolean;
  generatedAt: string | null;
  latestYear: number | null;
  calls: number;
  errorCount: number;
  map: { countries: MapCountry[]; origin: [number, number] };
  products: ProductView[];
  /** Destinations summed across all products, latest year. Derived. */
  buyers: Array<{ name: string; atlasId: string | null; value: number; products: number }>;
}

