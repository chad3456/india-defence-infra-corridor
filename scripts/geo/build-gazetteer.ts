/**
 * Generate the place gazetteer.
 *
 *   npm run geo:build
 *
 * Cities come from Natural Earth's populated-places dataset (public domain),
 * fetched at build time rather than typed in. A hand-maintained list of ~85
 * cities was the previous approach and it was both incomplete and impossible
 * to keep current; this pulls every Indian place Natural Earth knows about,
 * with its real coordinates.
 *
 * A curated overlay adds what a global cities dataset cannot know: project
 * sites that are not towns (Sriharikota, Vizhinjam, Dholera), and the alternate
 * spellings Indian newsrooms actually use (Bengaluru/Bangalore,
 * Prayagraj/Allahabad). That overlay is deliberately small and is the only
 * hand-written geography in the project.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson } from "../etl/lib/http";

const NE_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson";

interface NeFeature {
  properties: {
    name?: string;
    nameascii?: string;
    adm0name?: string;
    adm1name?: string;
    pop_max?: number;
    latitude?: number;
    longitude?: number;
  };
}

export interface Place {
  id: string;
  name: string;
  state: string;
  coords: [number, number];
  aliases?: string[];
}

/** State and union-territory centroids, for stories that name no city. */
const STATES: Record<string, [number, number]> = {
  "Andhra Pradesh": [79.74, 15.91], "Arunachal Pradesh": [94.73, 28.22], Assam: [92.94, 26.2],
  Bihar: [85.31, 25.1], Chhattisgarh: [81.87, 21.28], Goa: [74.12, 15.3], Gujarat: [71.19, 22.26],
  Haryana: [76.09, 29.06], "Himachal Pradesh": [77.17, 31.1], Jharkhand: [85.28, 23.61],
  Karnataka: [75.71, 15.32], Kerala: [76.27, 10.85], "Madhya Pradesh": [78.66, 22.97],
  Maharashtra: [75.71, 19.75], Manipur: [93.91, 24.66], Meghalaya: [91.37, 25.47],
  Mizoram: [92.94, 23.16], Nagaland: [94.56, 26.16], Odisha: [85.1, 20.95], Punjab: [75.34, 31.15],
  Rajasthan: [74.22, 27.02], Sikkim: [88.51, 27.53], "Tamil Nadu": [78.66, 11.13],
  Telangana: [79.02, 17.12], Tripura: [91.99, 23.94], "Uttar Pradesh": [80.95, 26.85],
  Uttarakhand: [79.02, 30.07], "West Bengal": [87.86, 22.99], Delhi: [77.21, 28.61],
  "Jammu and Kashmir": [74.8, 33.78], Ladakh: [77.58, 34.15], Puducherry: [79.81, 11.94],
  Chandigarh: [76.78, 30.73], "Andaman and Nicobar Islands": [92.75, 11.74],
};

/**
 * Project sites and newsroom spellings a global cities dataset cannot supply.
 * Coordinates are approximate site centroids.
 */
const OVERLAY: Place[] = [
  { id: "sriharikota", name: "Sriharikota", state: "Andhra Pradesh", coords: [80.23, 13.72], aliases: ["Satish Dhawan Space Centre", "SDSC"] },
  { id: "chandipur", name: "Chandipur", state: "Odisha", coords: [86.98, 21.47], aliases: ["Integrated Test Range"] },
  { id: "vizhinjam", name: "Vizhinjam", state: "Kerala", coords: [76.98, 8.38] },
  { id: "dholera", name: "Dholera", state: "Gujarat", coords: [72.19, 22.25] },
  { id: "sanand", name: "Sanand", state: "Gujarat", coords: [72.38, 22.99] },
  { id: "mundra", name: "Mundra", state: "Gujarat", coords: [69.72, 22.84] },
  { id: "kandla", name: "Kandla", state: "Gujarat", coords: [70.22, 23.03], aliases: ["Deendayal Port", "Tuna Tekra"] },
  { id: "jewar", name: "Jewar", state: "Uttar Pradesh", coords: [77.56, 28.12], aliases: ["Noida International Airport"] },
  { id: "vadhavan", name: "Vadhavan", state: "Maharashtra", coords: [72.75, 19.75], aliases: ["Palghar"] },
  { id: "bhogapuram", name: "Bhogapuram", state: "Andhra Pradesh", coords: [83.42, 18.13] },
  { id: "balotra", name: "Balotra", state: "Rajasthan", coords: [72.24, 25.83], aliases: ["Pachpadra", "Barmer"] },
  { id: "chitrakoot", name: "Chitrakoot", state: "Uttar Pradesh", coords: [80.87, 25.2] },
  { id: "hosur", name: "Hosur", state: "Tamil Nadu", coords: [77.83, 12.74] },
  { id: "paradip", name: "Paradip", state: "Odisha", coords: [86.61, 20.32] },
  { id: "haldia", name: "Haldia", state: "West Bengal", coords: [88.06, 22.06] },
  { id: "gandhinagar", name: "Gandhinagar", state: "Gujarat", coords: [72.63, 23.22], aliases: ["GIFT City"] },
  { id: "greater-noida", name: "Greater Noida", state: "Uttar Pradesh", coords: [77.5, 28.47] },
  { id: "navi-mumbai", name: "Navi Mumbai", state: "Maharashtra", coords: [73.03, 19.03] },
  { id: "gurugram", name: "Gurugram", state: "Haryana", coords: [77.03, 28.46], aliases: ["Gurgaon"] },
  { id: "thoothukudi", name: "Thoothukudi", state: "Tamil Nadu", coords: [78.13, 8.76], aliases: ["Tuticorin"] },
];

/** Alternate spellings that appear in Indian copy, keyed by canonical name. */
const ALIASES: Record<string, string[]> = {
  Bengaluru: ["Bangalore"], Mumbai: ["Bombay"], Kolkata: ["Calcutta"], Chennai: ["Madras"],
  Prayagraj: ["Allahabad"], Varanasi: ["Benares", "Kashi"], Kochi: ["Cochin"],
  Thiruvananthapuram: ["Trivandrum"], Vadodara: ["Baroda"], Mysuru: ["Mysore"],
  Mangaluru: ["Mangalore"], Puducherry: ["Pondicherry"], Shimla: ["Simla"],
  Visakhapatnam: ["Vizag"], Tiruchirappalli: ["Trichy"], "New Delhi": ["Delhi", "NCR"],
  Panaji: ["Panjim"], "Port Blair": ["Sri Vijaya Puram"],
};

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function main() {
  process.stdout.write("Fetching Natural Earth populated places…\n");
  const res = await getJson<{ features: NeFeature[] }>(NE_URL, {
    timeoutMs: 120_000,
    cacheMs: 7 * 24 * 60 * 60 * 1000,
  });
  if (!res.ok || !res.data) {
    process.stderr.write(`Failed: ${res.error}\n`);
    process.exit(1);
  }

  const byId = new Map<string, Place>();

  for (const f of res.data.features) {
    const p = f.properties;
    if (p.adm0name !== "India") continue;
    const name = p.name ?? p.nameascii;
    const state = p.adm1name;
    if (!name || !state || p.longitude === undefined || p.latitude === undefined) continue;
    // Natural Earth's adm1 names must reconcile with our state list, otherwise
    // an event would carry a state the map cannot colour.
    if (!(state in STATES)) continue;
    const id = slug(name);
    byId.set(id, {
      id,
      name,
      state,
      coords: [Number(p.longitude.toFixed(4)), Number(p.latitude.toFixed(4))],
      aliases: ALIASES[name],
    });
  }

  const fromNe = byId.size;
  // Overlay wins: these are deliberate, and their coordinates are site-specific.
  for (const place of OVERLAY) byId.set(place.id, place);

  const places = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));

  await writeFile(
    join(process.cwd(), "data/geo/places.json"),
    JSON.stringify({ states: STATES, places }, null, 2) + "\n",
    "utf8",
  );

  const withAlias = places.filter((p) => p.aliases?.length).length;
  process.stdout.write(
    `Wrote data/geo/places.json — ${places.length} places ` +
      `(${fromNe} from Natural Earth, ${OVERLAY.length} curated overlay, ${withAlias} with aliases), ` +
      `${Object.keys(STATES).length} states\n`,
  );
}

main().catch((err: unknown) => {
  process.stderr.write((err instanceof Error ? err.stack : String(err)) + "\n");
  process.exit(1);
});
