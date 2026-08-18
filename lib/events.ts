import type { DevEvent, EventCategory } from "./types";
import eventsRaw from "@/data/events.json";

/**
 * Development events shown on the map.
 *
 * These are *reported activity*, deliberately kept apart from the chart series.
 * A headline saying a plant was announced is not a measurement, and the site's
 * whole credibility rests on not blurring the two. Every event links out to the
 * outlet that reported it and is labelled verified or reported.
 */

export const EVENT_CATEGORIES: Array<{
  id: EventCategory;
  label: string;
  /** Short gloss shown in the panel tooltip. */
  hint: string;
}> = [
  { id: "infrastructure", label: "Infrastructure", hint: "Metro, urban, water, large civil projects" },
  { id: "roads-airports", label: "Roads & airports", hint: "Highways, expressways, terminals, aviation" },
  { id: "defence", label: "Military", hint: "Trials, inductions, orders, corridor units" },
  { id: "manufacturing", label: "Manufacturing", hint: "Plants, fabs, assembly lines, PLI awards" },
  { id: "startups", label: "Startups", hint: "Funding rounds, unicorns, new ventures" },
  { id: "exports", label: "Exports", hint: "Shipments, export records, market access" },
  { id: "trade-deals", label: "Trade deals", hint: "FTAs, bilateral pacts, MoUs" },
  { id: "energy", label: "Energy", hint: "Renewables, nuclear, grid, transmission" },
  { id: "pipelines", label: "Pipelines", hint: "Gas and oil pipelines, LNG terminals" },
  { id: "ports", label: "Ports", hint: "Port capacity, terminals, shipping" },
  { id: "space", label: "Space", hint: "Launches, satellites, private space" },
  { id: "psu-msme", label: "PSU & MSME", hint: "Public undertakings and small enterprise" },
];

export const CATEGORY_LABEL: Record<EventCategory, string> = Object.fromEntries(
  EVENT_CATEGORIES.map((c) => [c.id, c.label]),
) as Record<EventCategory, string>;

const ALL: DevEvent[] = (eventsRaw as DevEvent[]).slice().sort((a, b) => b.date.localeCompare(a.date));

export function getEvents(): DevEvent[] {
  return ALL;
}

/**
 * "Recent" is defined against the newest event in the dataset, not against the
 * wall clock. Anchoring to `Date.now()` would silently empty the panel whenever
 * the pipeline had not run for a couple of days, which reads as "nothing
 * happened" rather than "nothing was ingested".
 */
export function recentWindow(events: DevEvent[], days: number): DevEvent[] {
  if (events.length === 0) return [];
  const newest = events[0]!.date;
  const cutoff = new Date(new Date(newest).getTime() - days * 86_400_000).toISOString().slice(0, 10);
  return events.filter((e) => e.date >= cutoff);
}

export function countByCategory(events: DevEvent[]): Record<string, number> {
  return events.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + 1;
    return acc;
  }, {});
}

export function latestEventDate(): string | null {
  return ALL[0]?.date ?? null;
}
