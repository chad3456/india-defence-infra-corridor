/**
 * Turning orbits into positions.
 *
 * A satellite's position is not something anyone publishes, because it is not
 * something anyone stores. What is published is the orbit — a two-line element
 * set — and SGP4 turns that into a position for any instant you ask for. So
 * this file holds no positions at all. It holds the elements and the arithmetic
 * that produces a position from them, and the page runs that arithmetic in the
 * browser against the current clock.
 *
 * ── Three questions, only two of which are answerable ────────────────────
 *
 * "Which satellite is over India" is exact: propagate, take the sub-satellite
 * point, test it against the same boundary polygons every other map here uses.
 *
 * "Which satellite can see India" is also exact, but means something wider
 * than it sounds. A satellite at 550 km is above the horizon from everywhere
 * within about 2,500 km of the point beneath it, so at any moment a great many
 * things can see India without being anywhere near it.
 *
 * "Which satellite is imaging India" is not answerable and this file does not
 * pretend otherwise. That depends on where the sensor is pointed and when it
 * was switched on, which is tasking data — nobody publishes it, and for most
 * of the interesting satellites nobody is going to.
 */
import type { FeatureCollection, Geometry } from "geojson";
import { geoContains, geoDistance } from "d3-geo";

/** Mean Earth radius, km. */
export const EARTH_RADIUS_KM = 6371;

export interface Tle {
  /** Catalogue name as the source gives it. */
  name: string;
  /** NORAD catalogue number, the stable identity. */
  noradId: number;
  line1: string;
  line2: string;
}

export interface SatPosition {
  noradId: number;
  name: string;
  /** Degrees, -180..180. */
  lon: number;
  /** Degrees, -90..90. */
  lat: number;
  /** Kilometres above the ellipsoid. */
  altKm: number;
  /** Ground speed, km/s. */
  speedKmS: number;
}

/**
 * The epoch a TLE was generated at, from columns 19-32 of line 1.
 *
 * Encoded as YYDDD.DDDDDDDD — two-digit year, then the fractional day. The
 * year pivots at 57 by convention, which is the launch of Sputnik and
 * therefore the earliest an element set can describe.
 */
export function tleEpoch(line1: string): Date | null {
  const raw = line1.slice(18, 32).trim();
  const m = /^(\d{2})(\d{1,3}\.\d+)$/.exec(raw);
  if (!m) return null;
  const yy = Number(m[1]);
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  const dayOfYear = Number(m[2]);
  if (!Number.isFinite(dayOfYear) || dayOfYear < 1) return null;
  return new Date(Date.UTC(year, 0, 1) + (dayOfYear - 1) * 86_400_000);
}

/**
 * How stale an element set is, in days.
 *
 * This matters more than it looks. SGP4 does not fail on an old element set,
 * it just drifts — quietly, and further every day, especially in low orbit
 * where drag dominates. A week-old element set will still produce a confident
 * position that is simply in the wrong place, so the age is carried through to
 * the page rather than left in the pipeline.
 */
export function epochAgeDays(line1: string, now: Date = new Date()): number | null {
  const e = tleEpoch(line1);
  return e === null ? null : (now.getTime() - e.getTime()) / 86_400_000;
}

/**
 * Parse the three-line format CelesTrak serves: name, then the two lines.
 *
 * Rows that do not form a complete triple are dropped rather than
 * half-accepted — a TLE missing a line is not a partially usable orbit.
 */
export function parseTle(text: string): Tle[] {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim().length > 0);
  const out: Tle[] = [];
  for (let i = 0; i + 2 < lines.length + 1; i++) {
    const l1 = lines[i + 1];
    const l2 = lines[i + 2];
    if (l1 === undefined || l2 === undefined) break;
    if (!l1.startsWith("1 ") || !l2.startsWith("2 ")) continue;
    const noradId = Number(l1.slice(2, 7).trim());
    if (!Number.isFinite(noradId)) continue;
    out.push({ name: (lines[i] ?? "").trim(), noradId, line1: l1, line2: l2 });
    i += 2;
  }
  return out;
}

/**
 * Great-circle radius of the region from which a satellite is above the
 * horizon, in kilometres.
 *
 * The horizon is where the line of sight grazes the Earth, so the half-angle
 * at the centre is arccos(R / (R + h)). At 550 km that is about 23 degrees, or
 * 2,560 km along the ground — which is why "can see India" is a far weaker
 * claim than "is over India".
 */
export function footprintRadiusKm(altKm: number): number {
  if (altKm <= 0) return 0;
  const halfAngle = Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altKm));
  return EARTH_RADIUS_KM * halfAngle;
}

/** Great-circle distance in km between two [lon, lat] points. */
export function distanceKm(a: [number, number], b: [number, number]): number {
  return geoDistance(a, b) * EARTH_RADIUS_KM;
}

/**
 * Is the point beneath the satellite inside India?
 *
 * Tested against the same boundary polygons the rest of the site draws, so
 * "over India" means the same thing here as everywhere else. Antimeridian and
 * projection are not involved: geoContains works on the sphere.
 */
export function isOverIndia(
  lon: number,
  lat: number,
  states: FeatureCollection<Geometry, { name: string | null }>,
): string | null {
  for (const f of states.features) {
    if (geoContains(f, [lon, lat])) return f.properties?.name ?? "";
  }
  return null;
}

/**
 * Elevation of a satellite above the horizon at an observer, in degrees.
 *
 * Negative means below the horizon and therefore not visible at all. This is
 * the honest version of "overhead": a reader in Delhi cares whether a thing is
 * 80 degrees up or 3 degrees up, and the sub-satellite point alone does not
 * say.
 */
export function elevationDegrees(
  observer: [number, number],
  sat: { lon: number; lat: number; altKm: number },
): number {
  const central = geoDistance(observer, [sat.lon, sat.lat]);          // radians
  const r = EARTH_RADIUS_KM + sat.altKm;
  // Plane triangle through the centre: the elevation is the angle between the
  // observer's local horizontal and the line to the satellite.
  const el = Math.atan2(
    Math.cos(central) - EARTH_RADIUS_KM / r,
    Math.sin(central),
  );
  return (el * 180) / Math.PI;
}
