import type { Series } from "../../lib/types";
import { CATEGORIES } from "../../lib/types";

const CONFIDENCE = new Set(["high", "medium", "low"]);
const PROVENANCE = new Set(["official", "multilateral", "think-tank", "press", "derived"]);
const FREQUENCY = new Set(["annual", "fiscal-year", "quarterly", "monthly", "point-in-time"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Structural and editorial validation for one series.
 *
 * This is the gate that enforces the site's central promise: nothing renders
 * unless it is traceable, typed and defined. Returns a list of problems —
 * empty means the series is fit to publish.
 */
export function validateSeries(s: Series, knownSourceIds?: Set<string>): string[] {
  const problems: string[] = [];

  if (!s.id?.trim()) problems.push("missing id");
  if (!s.title?.trim()) problems.push("missing title");
  if (!s.definition?.trim()) problems.push("missing definition — every series must say what it counts");
  if (!s.unit?.trim()) problems.push("missing unit");
  if (!s.unitShort?.trim()) problems.push("missing unitShort");

  if (!CATEGORIES.includes(s.category)) problems.push(`unknown category "${s.category}"`);
  if (!CONFIDENCE.has(s.confidence)) problems.push(`invalid confidence "${s.confidence}"`);
  if (!PROVENANCE.has(s.provenance)) problems.push(`invalid provenance "${s.provenance}"`);
  if (!FREQUENCY.has(s.frequency)) problems.push(`invalid frequency "${s.frequency}"`);

  if (!ISO_DATE.test(s.lastVerified ?? "")) {
    problems.push(`lastVerified must be YYYY-MM-DD, got "${s.lastVerified}"`);
  }

  if (!Array.isArray(s.sourceIds) || s.sourceIds.length === 0) {
    problems.push("no sourceIds — an unsourced series must not ship");
  } else if (knownSourceIds) {
    for (const id of s.sourceIds) {
      if (!knownSourceIds.has(id)) problems.push(`sourceId "${id}" not in the source register`);
    }
  }

  if (!Array.isArray(s.points)) {
    problems.push("points is not an array");
    return problems;
  }
  if (s.points.length === 0) problems.push("no data points");

  const seenPeriods = new Set<string>();
  for (const p of s.points) {
    if (!p.period?.trim()) {
      problems.push("a point has no period label");
      continue;
    }
    if (seenPeriods.has(p.period)) problems.push(`duplicate period "${p.period}"`);
    seenPeriods.add(p.period);

    if (p.value !== null) {
      if (typeof p.value !== "number" || !Number.isFinite(p.value)) {
        problems.push(`period "${p.period}" has a non-finite value`);
      }
    }
    if (p.sourceId && knownSourceIds && !knownSourceIds.has(p.sourceId)) {
      problems.push(`period "${p.period}" cites unknown source "${p.sourceId}"`);
    }
  }

  // Editorial rule: a low-confidence series must explain why.
  if (s.confidence === "low" && (!s.notes || s.notes.length === 0)) {
    problems.push("low-confidence series must carry at least one note explaining the uncertainty");
  }

  // Editorial rule: think-tank estimates are never presented as records.
  if (s.provenance === "think-tank" && s.confidence === "high") {
    problems.push("think-tank estimates cannot be graded high confidence");
  }

  for (const peer of s.peers ?? []) {
    if (!peer.iso3 || peer.iso3.length !== 3) problems.push(`peer "${peer.country}" has a bad iso3`);
    if (!Number.isFinite(peer.value)) problems.push(`peer "${peer.country}" has a non-finite value`);
    if (knownSourceIds && !knownSourceIds.has(peer.sourceId)) {
      problems.push(`peer "${peer.country}" cites unknown source "${peer.sourceId}"`);
    }
  }

  return problems;
}
