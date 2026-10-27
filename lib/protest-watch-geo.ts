/**
 * The geography Protest Watch places headlines with and draws on: every
 * country's names from the site's world map (data/geo/world-ind.json), India's
 * states added to India's names (Punjab left out — Pakistan has one too), and
 * the map's outlines and label points on an Equal Earth projection. Node only.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { geoArea, geoEqualEarth, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, MultiPolygon } from "geojson";
import type { PwCountry } from "./protest-watch";

export const PW_MAP_W = 960, PW_MAP_H = 440;
type Props = { iso2: string; iso3: string; name: string; names?: string[]; label: [number, number]; tiny: boolean };
export interface PwShape { iso2: string; name: string; d: string }

function world(): Array<Feature<MultiPolygon, Props>> {
  const f = join(process.cwd(), "data", "geo", "world-ind.json");
  if (!existsSync(f)) return [];
  const fc = JSON.parse(readFileSync(f, "utf8")) as FeatureCollection<MultiPolygon, Props>;
  // Reverse any ring that d3-geo would read as "the whole sphere except this country".
  return fc.features.map((ft) => ({ ...ft, geometry: { ...ft.geometry, coordinates: ft.geometry.coordinates.map((poly) => (geoArea({ type: "Polygon", coordinates: [poly[0]!] }) > 2 * Math.PI ? poly.map((r) => [...r].reverse()) : poly)) } }));
}

/** Names a headline uses for a country that the map does not carry: US states, UK nations, common short forms. */
const EXTRA: Record<string, string[]> = {
  US: ["U.S.", "US", "USA", "America", "American", "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Wisconsin", "Wyoming", "Portland", "Philadelphia", "Atlanta", "Minneapolis", "Houston", "Denver", "Phoenix", "Miami", "Detroit", "Baltimore", "Columbia University", "UCLA", "Harvard"],
  GB: ["UK", "Britain", "British", "England", "Scotland", "Wales", "Northern Ireland", "Birmingham", "Leeds", "Liverpool", "Bristol", "Edinburgh", "Cardiff", "Belfast"],
  KR: ["South Korea", "Korea"], CD: ["DR Congo", "DRC"], AE: ["UAE"], CZ: ["Czech"], NL: ["Dutch", "Netherlands", "Rotterdam", "The Hague"], DE: ["German", "Cologne", "Köln", "Frankfurt", "Leipzig", "Stuttgart", "Hannover", "Hanover", "Dresden", "Düsseldorf", "Bremen", "Nürnberg"],
  FR: ["French", "Toulouse", "Nantes", "Bordeaux", "Lille", "Nice", "Strasbourg", "Rennes"], ES: ["Spanish", "Valencia", "Seville", "Sevilla", "Bilbao", "Málaga", "Almería", "Zaragoza", "Murcia", "Granada", "Palma", "Galicia", "Cataluña", "Catalunya", "Andalucía", "País Vasco", "Canarias"], IT: ["Italian", "Turin", "Bologna", "Florence", "Genoa", "Palermo"],
  PK: ["Pakistani", "Peshawar", "Quetta", "Rawalpindi"], BD: ["Bangladeshi", "Chittagong", "Chattogram", "ঢাকা", "চট্টগ্রাম", "রাজশাহী", "খুলনা", "সিলেট", "বরিশাল", "রংপুর", "ময়মনসিংহ", "গাজীপুর", "নারায়ণগঞ্জ", "কুমিল্লা", "দুর্গাপুর"], NP: ["Nepali", "Nepalese"], LK: ["Sri Lankan"], KE: ["Kenyan", "Mombasa", "Kisumu"], NG: ["Nigerian", "Kano", "Port Harcourt"],
  ZA: ["South African", "Durban", "Pretoria"], PH: ["Filipino", "Philippine", "Quezon City", "Cebu"], ID: ["Indonesian", "Surabaya", "Bandung", "Makassar", "Medan"], TR: ["Turkish", "İstanbul", "Izmir", "İzmir", "Esenler", "Kadıköy", "Bursa", "Antalya", "Diyarbakır", "Adana", "Konya"],
  MX: ["Mexican", "Guadalajara", "Monterrey", "CDMX"], BR: ["Brazilian", "Brasília", "Brasilia", "Salvador", "Recife", "Porto Alegre", "Belo Horizonte"], AR: ["Argentine", "Argentinian", "Córdoba", "Rosario"],
  CA: ["Canadian", "Ottawa", "Calgary", "Edmonton", "Winnipeg"], AU: ["Australian", "Brisbane", "Perth", "Adelaide", "Canberra"], RS: ["Serbian", "Novi Sad"], GE: ["Georgian"], IR: ["Iranian"], EG: ["Egyptian", "القاهرة", "Alexandria"],
  IN: ["Indian", "Jamia", "JNU", "भारत", "दिल्ली", "मुंबई", "पटना", "लखनऊ", "जयपुर", "भोपाल", "कोलकाता", "हरियाणा", "पंजाब", "राजस्थान", "उत्तर प्रदेश", "बिहार", "मध्य प्रदेश", "महाराष्ट्र", "उत्तराखंड", "झारखंड", "दिल्लि", "দিল্লি", "কলকাতা", "জামিয়া"],
  HU: ["Hungarian", "Pécs", "Debrecen"], PT: ["Portuguese", "Porto"], PL: ["Polish", "Kraków", "Krakow", "Gdańsk", "Wrocław"],
};

export function protestGeo(): { countries: PwCountry[]; shapes: PwShape[] } {
  const features = world().filter((f) => f.properties.iso2);
  if (!features.length) return { countries: [], shapes: [] };
  const projection = geoEqualEarth().fitExtent([[4, 4], [PW_MAP_W - 4, PW_MAP_H - 4]], { type: "FeatureCollection", features } as FeatureCollection);
  // Whole-pixel paths: the map is a backdrop for circles, and decimals tripled its weight.
  const path = geoPath(projection).digits(0);
  // India's states and the site gazetteer's places, so "protest in Kochi" lands in India (Punjab left out: Pakistan has one too).
  let indian: string[] = [];
  try {
    const g = JSON.parse(readFileSync(join(process.cwd(), "data", "geo", "places.json"), "utf8")) as { states: Record<string, unknown>; places: Array<{ name: string }> };
    indian = [...Object.keys(g.states), ...g.places.map((p) => p.name)].filter((s) => s !== "Punjab" && s.length > 3);
  } catch { indian = []; }
  // Every country's name in each language the collector searches, from the runtime's own locale data.
  const LANGS = ["fr", "es", "de", "pt", "it", "tr", "id", "ar", "hi", "bn"];
  const local = (iso2: string) => LANGS.flatMap((l) => { try { const v = new Intl.DisplayNames([l], { type: "region" }).of(iso2); return v && v !== iso2 ? [v] : []; } catch { return []; } });
  const countries: PwCountry[] = features.map((f) => {
    const [x, y] = projection(f.properties.label) ?? [0, 0];
    const iso = f.properties.iso2;
    const names = [...new Set([f.properties.name, ...(f.properties.names ?? []), ...local(iso), ...(EXTRA[iso] ?? []), ...(iso === "IN" ? indian : [])])];
    return { iso2: f.properties.iso2, name: f.properties.name, names, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  });
  // Longer names first, so "South Sudan" is tried before "Sudan".
  countries.sort((a, b) => Math.max(...b.names.map((n) => n.length)) - Math.max(...a.names.map((n) => n.length)));
  const shapes = features.flatMap((f) => { const d = path(f); return d ? [{ iso2: f.properties.iso2, name: f.properties.name, d }] : []; });
  return { countries, shapes };
}
