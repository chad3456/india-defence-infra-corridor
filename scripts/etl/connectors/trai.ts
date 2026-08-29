/**
 * TRAI quarterly performance indicator report — state-level connectivity.
 *
 * The one state-level source that survived probing. PMAY's dashboards, NFHS on
 * three hosts, PNGRB's statistics page, the Central Electricity Authority and
 * MoSPI all failed or linked no data; this answered, and twenty-eight of its
 * pages carry tables indexed by service area.
 *
 * ── Reading a header that arrives in pieces ──────────────────────────────
 *
 * The tele-density table's header is set across two rows and pdf.js returns it
 * in fragments that do not reassemble in reading order:
 *
 *     Service Area/ States | Urban
 *     Rural Tele- | Total Tele- | Rural Tele- | Urban Tele- | Total Tele-
 *     Tele-
 *
 * Column order cannot be read off that with any confidence. What can be read
 * off it is the data: rural tele-density is below total, and total is below
 * urban, in every row of every such table ever published, because the total is
 * a population-weighted average of the two. So the layout is taken as rural,
 * urban, total per date and then *checked* against that inequality on every
 * row. A table that fails the check is refused rather than published, which
 * turns an inference about column order into a claim the data has to support.
 *
 * ── Two things this is not ───────────────────────────────────────────────
 *
 * Service areas are not states. Some cover two, some split one, and Delhi and
 * Mumbai are their own — so these series are labelled by service area and are
 * deliberately not drawn on the state map, which would silently assert a
 * correspondence that does not exist.
 *
 * And one report is one quarter. This produces a snapshot by service area, not
 * a yearly series, and the catalogue entries say so. The report's URL carries
 * its own publication date and TRAI's reports index answers 404, so the next
 * quarter's file cannot be discovered from here — when this connector stops
 * finding its document, that is why.
 */
import type { Series, DataPoint } from "../../../lib/types";
import { ALL_SECURITY_SPECS } from "../../../lib/security-catalogue";
import { extractTables } from "../lib/pdf-table";

const URL =
  "https://www.trai.gov.in/sites/default/files/2026-06/QPIR_22062026.pdf";
const SOURCE_ID = "trai-qpir";

/** Service areas as TRAI names them, so a row is recognised rather than guessed. */
const SERVICE_AREAS = [
  "Andhra Pradesh", "Assam", "Bihar", "Delhi", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu & Kashmir", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Mumbai", "North East", "Odisha",
  "Punjab", "Rajasthan", "Tamil Nadu", "Uttar Pradesh (East)",
  "Uttar Pradesh (West)", "West Bengal", "Kolkata",
];

const NAME = new Set(SERVICE_AREAS.map((s) => s.toLowerCase()));

function num(cell: string): number | null {
  const t = (cell ?? "").replace(/[,%\s]/g, "");
  if (!t || !/^-?\d/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Numbers on a row, in order, ignoring anything that is not one. */
function numbersOf(row: string[]): number[] {
  return row.map(num).filter((n): n is number => n !== null);
}

export interface TraiResult {
  series: Series[];
  errors: string[];
  fetched: number;
}

function build(specId: string, points: DataPoint[], extra: string[]): Series | null {
  const spec = ALL_SECURITY_SPECS.find((s) => s.id === specId);
  if (!spec || points.length === 0) return null;
  return {
    id: spec.id,
    title: spec.title,
    definition: spec.definition,
    category: spec.category,
    unit: spec.unit,
    unitShort: spec.unitShort,
    frequency: spec.frequency,
    provenance: spec.provenance,
    confidence: spec.confidence,
    higherIsBetter: spec.higherIsBetter,
    sourceIds: [...new Set([...spec.sourceIds, SOURCE_ID])],
    points,
    notes: [...(spec.note ? [spec.note] : []), ...extra],
    lastVerified: new Date().toISOString().slice(0, 10),
  };
}

export async function runTrai(
  opts: { dryRun?: boolean; onProgress?: (msg: string) => void } = {},
): Promise<TraiResult> {
  const log = opts.onProgress ?? (() => {});
  const errors: string[] = [];
  const series: Series[] = [];

  if (opts.dryRun) {
    log(`[dry-run] would read ${URL}`);
    return { series: [], errors: [], fetched: 0 };
  }

  let pages;
  try {
    const res = await fetch(URL, {
      headers: { "user-agent": "BharatTracker/0.1 data-pipeline", accept: "*/*" },
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      errors.push(`HTTP ${res.status} — the quarterly report URL carries its own date and TRAI's index 404s, so a new quarter needs the URL updated by hand`);
      return { series, errors, fetched: 0 };
    }
    pages = await extractTables(new Uint8Array(await res.arrayBuffer()), { lastPage: 40 });
  } catch (err) {
    errors.push(`fetch or parse failed: ${err instanceof Error ? err.message : String(err)}`);
    return { series, errors, fetched: 0 };
  }

  /* ---------------- Tele-density, rural / urban / total ---------------- */
  const density = pages.find((p) => p.rows.some((r) => /Table 1\.4/.test(r.join(" "))));
  if (!density) {
    errors.push("Table 1.4 (service-area tele-density) not found in the first 40 pages");
  } else {
    // The service-area name and its numbers sit on separate rows on this page,
    // so a name row is paired with the next row carrying six numbers.
    // Pair a label row with the next row carrying six numbers.
    //
    // The first version looked ahead two rows and found twelve of the twenty-two
    // service areas — the subscriber table matched twenty names on the same
    // list, so the names were never the problem; the gap between a label and
    // its numbers is wider than two rows for some areas. The look-ahead is now
    // generous, a label matches on prefix so TRAI's own longer names ("Madhya
    // Pradesh & Chhattisgarh") are recognised, and any label consumed is
    // reported so a short parse says which areas it missed rather than only how
    // many.
    const rows: Array<{ area: string; values: number[] }> = [];
    const used = new Set<number>();
    for (let i = 0; i < density.rows.length; i++) {
      if (used.has(i)) continue;
      const cells = density.rows[i] ?? [];
      const label = cells.join(" ").replace(/\s+/g, " ").trim();
      const known = SERVICE_AREAS.find(
        (a) => label.toLowerCase() === a.toLowerCase() || label.toLowerCase().startsWith(a.toLowerCase()),
      );
      if (!known) continue;
      // The numbers may sit on this row or on one of the next few.
      // Store the canonical name, not the text as it came off the page.
      //
      // The raw labels arrive truncated mid-parenthesis — "Maharashtra (incl.",
      // "West Bengal (incl.", and a loose "Kolkata) *" that is the tail of
      // another area's name rather than an area. Publishing those as period
      // labels put mangled text on the axis of a live chart. The matched name
      // is the honest label and it is the one TRAI itself uses.
      const inline = numbersOf(cells);
      if (inline.length >= 6) {
        rows.push({ area: known, values: inline.slice(0, 6) });
        continue;
      }
      for (let j = i + 1; j < Math.min(i + 5, density.rows.length); j++) {
        const values = numbersOf(density.rows[j] ?? []);
        if (values.length >= 6) {
          rows.push({ area: known, values: values.slice(0, 6) });
          used.add(j);
          break;
        }
        // A second label before any numbers means this one has none.
        const next = (density.rows[j] ?? []).join(" ").trim().toLowerCase();
        if (SERVICE_AREAS.some((a) => next.startsWith(a.toLowerCase()))) break;
      }
    }

    // A fragment of one area's name can match another area's prefix, so the
    // same canonical name can arrive twice. First occurrence wins and the
    // repeat is reported — a duplicate period would be rejected downstream
    // anyway, and losing the whole table to a stray footnote row would be a
    // poor trade.
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (let i = rows.length - 1; i >= 0; i--) {
      const area = rows[i]?.area ?? "";
      if (seen.has(area)) {
        duplicates.push(area);
        rows.splice(i, 1);
      } else {
        seen.add(area);
      }
    }
    if (duplicates.length > 0) {
      errors.push(`tele-density: ${duplicates.length} duplicate label(s) dropped (${[...new Set(duplicates)].join(", ")})`);
    }

    // The check that makes the column order a claim rather than a guess.
    const bad = rows.filter(({ values }) => {
      const [r1, u1, t1, r2, u2, t2] = values;
      return !(
        r1 !== undefined && u1 !== undefined && t1 !== undefined &&
        r2 !== undefined && u2 !== undefined && t2 !== undefined &&
        r1 < t1 && t1 < u1 && r2 < t2 && t2 < u2
      );
    });

    // Eighteen of twenty-two, not fifteen.
    //
    // Fifteen was an arbitrary floor and the table passed at exactly fifteen,
    // publishing a map of India missing Delhi, Kerala, Mumbai, Odisha and
    // Jammu & Kashmir. A partial map is the failure this gate exists to
    // prevent, and setting the bar at two-thirds of the country did not
    // prevent it. The subscriber table on the same document parses twenty, so
    // eighteen is achievable rather than aspirational.
    const MIN_AREAS = 18;
    if (rows.length < MIN_AREAS) {
      const missing = SERVICE_AREAS.filter((a) => !rows.some((r) => r.area === a));
      errors.push(
        `tele-density: only ${rows.length} service area(s) parsed; expected at least ${MIN_AREAS}. ` +
          `Not found: ${missing.join(", ")}`,
      );
    } else if (bad.length > 0) {
      errors.push(
        `tele-density: column order refused — ${bad.length} row(s) do not satisfy rural < total < urban ` +
          `(first: ${bad[0]?.area} ${bad[0]?.values.join(", ")}). The table layout has changed and reading it as before would mislabel the columns.`,
      );
    } else {
      // The later of the two dates is the current one.
      const mk = (idx: number, id: string, label: string) =>
        build(
          id,
          rows.map(({ area, values }) => ({
            period: area,
            value: values[idx] ?? null,
            sourceId: SOURCE_ID,
          })),
          [
            `${label} tele-density at the later of the two dates in TRAI's Table 1.4. One report is one quarter, so this is a snapshot by service area rather than a series over time.`,
          ],
        );
      for (const [idx, id, label] of [
        [3, "teledensity-rural-by-area", "Rural"],
        [4, "teledensity-urban-by-area", "Urban"],
        [5, "teledensity-by-area", "Total"],
      ] as const) {
        const s = mk(idx, id, label);
        if (s) {
          series.push(s);
          log(`  ${id.padEnd(30)} ${s.points.length} service area(s)`);
        }
      }
    }
  }

  /* ---------------- Subscriber base by service area ---------------- */
  const subs = pages.find((p) => p.rows.some((r) => /Table 1\.2/.test(r.join(" "))));
  if (!subs) {
    errors.push("Table 1.2 (service-area subscriber base) not found");
  } else {
    const points: DataPoint[] = [];
    for (const cells of subs.rows) {
      const label = (cells[0] ?? "").replace(/\s+/g, " ").trim();
      if (!NAME.has(label.toLowerCase())) continue;
      const values = numbersOf(cells.slice(1));
      // Columns are previous quarter, current quarter, net additions, growth.
      // The current quarter is the second, and it must exceed the net addition
      // it is paired with — a cheap check that the row parsed in order.
      const current = values[1];
      const adds = values[2];
      if (current === undefined || adds === undefined || Math.abs(adds) > current) continue;
      points.push({ period: label, value: current, sourceId: SOURCE_ID });
    }
    if (points.length < 15) {
      errors.push(`subscribers: only ${points.length} service area(s) parsed; expected at least 15`);
    } else {
      const s = build("subscribers-by-service-area", points, [
        "The later of the two quarters in TRAI's Table 1.2, in millions of subscribers. Wireless and wireline together, counting connections rather than people.",
      ]);
      if (s) {
        series.push(s);
        log(`  subscribers-by-service-area    ${points.length} service area(s)`);
      }
    }
  }

  return { series, errors, fetched: series.length };
}
