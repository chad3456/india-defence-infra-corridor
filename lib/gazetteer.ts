import placesData from "@/data/geo/places.json";

/**
 * Place lookup for geo-locating development events.
 *
 * The place list is GENERATED, not hand-written — `npm run geo:build` pulls
 * every Indian populated place from Natural Earth (public domain) and merges a
 * small curated overlay of project sites a global cities dataset cannot know
 * about (Sriharikota, Vizhinjam, Dholera) plus the alternate spellings Indian
 * newsrooms use. Editing `data/geo/places.json` by hand is pointless; edit the
 * generator.
 *
 * Coordinates are city or site centroids, not precise project locations — a pin
 * says "this happened in Kanpur", not "this is the factory gate". The map
 * legend states that so a reader does not over-read the placement.
 */

export interface Place {
  id: string;
  name: string;
  /** [longitude, latitude] */
  coords: [number, number];
  state: string;
  aliases?: string[];
}

interface PlacesFile {
  states: Record<string, [number, number]>;
  places: Place[];
}

const data = placesData as unknown as PlacesFile;

export const STATES: Record<string, [number, number]> = data.states;
export const PLACES: Place[] = data.places;

const BY_KEY = new Map<string, Place>();
for (const p of PLACES) {
  BY_KEY.set(p.name.toLowerCase(), p);
  for (const a of p.aliases ?? []) BY_KEY.set(a.toLowerCase(), p);
}

/**
 * Keys sorted longest-first, computed once.
 *
 * Longest wins so "New Delhi" beats "Delhi" and "Greater Noida" beats "Noida".
 * This used to be re-sorted on every call — 200+ keys sorted per headline, on
 * every item of every feed.
 */
const KEYS_BY_LENGTH = [...BY_KEY.keys()].sort((a, b) => b.length - a.length);
const STATE_KEYS = Object.keys(STATES);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findPlace(id: string): Place | undefined {
  return PLACES.find((p) => p.id === id);
}

/**
 * Best-effort geo-tag for a piece of text.
 *
 * Returns null rather than guessing when no place is mentioned — an
 * unplaceable event is listed but never pinned, because a pin in the wrong
 * state is worse than no pin. Falls back to a state centroid only when no city
 * matched, so "a plant in Gujarat" still lands somewhere defensible.
 */
export function detectPlace(text: string): Place | null {
  const haystack = ` ${text.toLowerCase()} `;

  for (const k of KEYS_BY_LENGTH) {
    // Word-boundary match so "Goa" does not fire inside "Goalpara".
    if (new RegExp(`[^a-z]${escapeRe(k)}[^a-z]`).test(haystack)) {
      return BY_KEY.get(k) ?? null;
    }
  }

  for (const state of STATE_KEYS) {
    if (new RegExp(`[^a-z]${escapeRe(state.toLowerCase())}[^a-z]`).test(haystack)) {
      return {
        id: state.toLowerCase().replace(/\s+/g, "-"),
        name: state,
        state,
        coords: STATES[state]!,
      };
    }
  }
  return null;
}
