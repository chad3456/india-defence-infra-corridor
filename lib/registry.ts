import type { ChartSpec, ChartKind, Transform, Series, Category } from "./types";
import { getAllSeries, getSeries, definedPoints, isTemporal } from "./data";
import { transformIsValid, TRANSFORM_LABELS } from "./transforms";
import { WDI_INDICATORS } from "./wdi-catalogue";
import { ALL_SECURITY_SPECS } from "./security-catalogue";

/**
 * The chart registry.
 *
 * Charts are generated from specs rather than hand-written components. Each
 * spec pairs a stored series with a transform and a mark type; a handful of
 * generic SVG chart components render every one of them.
 *
 * Two rules keep the gallery honest:
 *   1. A spec is only emitted when the transform is *meaningful* for that
 *      series (see `transformIsValid`) — no year-on-year charts drawn across a
 *      three-point series, no index charts off a zero base.
 *   2. Specs for series the ETL has not yet populated are still emitted, but
 *      flagged `pending` so the gallery shows an explicit "awaiting data"
 *      state rather than an empty axis pretending to be a finding.
 */

export interface RegistryEntry extends ChartSpec {
  /** True when no data has loaded for this spec's series yet. */
  pending: boolean;
}

function kindForLevel(series: Series): ChartKind {
  const n = definedPoints(series).length;
  if (!isTemporal(series)) return n <= 8 ? "lollipop" : "bar";
  if (n <= 3) return "column";
  if (n <= 8) return "column";
  return "line";
}

function kindForTransform(series: Series, t: Transform): ChartKind {
  switch (t) {
    case "level":
      return kindForLevel(series);
    case "yoy":
    case "delta":
      return "column";
    case "index-2001":
      return "line";
    case "cagr":
      return "step";
    case "share":
      return isTemporal(series) ? "stacked-bar" : "bar";
    default:
      return "line";
  }
}

function subtitleFor(series: Series, t: Transform): string {
  if (t === "level") return series.definition;
  return `${TRANSFORM_LABELS[t]} — derived from "${series.title}".`;
}

const TRANSFORM_ORDER: Transform[] = ["level", "yoy", "index-2001", "cagr", "share", "delta"];

/** Specs generated from series that are actually loaded. */
function specsFromLoadedSeries(): RegistryEntry[] {
  const out: RegistryEntry[] = [];
  for (const series of getAllSeries()) {
    for (const t of TRANSFORM_ORDER) {
      if (!transformIsValid(series, t)) continue;
      // "share" only reads well on categorical breakdowns or small series.
      if (t === "share" && isTemporal(series) && definedPoints(series).length > 8) continue;
      out.push({
        id: `${series.id}--${t}`,
        title: series.title,
        subtitle: subtitleFor(series, t),
        kind: kindForTransform(series, t),
        category: series.category,
        seriesIds: [series.id],
        transform: t,
        tags: [series.category, t, series.provenance, `confidence:${series.confidence}`],
        annotation: series.notes?.[0],
        pending: false,
      });
    }

    if (series.peers && series.peers.length > 1) {
      out.push({
        id: `${series.id}--peers`,
        title: `${series.title} — international comparison`,
        subtitle: `India against comparator countries. ${series.definition}`,
        kind: "lollipop",
        category: series.category,
        seriesIds: [series.id],
        transform: "level",
        peerView: true,
        tags: [series.category, "comparison", "peers"],
        annotation: series.notes?.[0],
        pending: false,
      });
    }
  }
  return out;
}

/**
 * Specs for World Bank indicators the ETL has not yet fetched. Emitted so the
 * gallery reflects the full intended surface on first deploy, each marked
 * pending until `npm run etl` populates `data/series/wdi.json`.
 */
function specsFromPendingWdi(): RegistryEntry[] {
  const out: RegistryEntry[] = [];
  for (const ind of WDI_INDICATORS) {
    if (getSeries(ind.id)) continue; // already loaded — handled above
    const base = {
      category: ind.category,
      seriesIds: [ind.id],
      pending: true,
      annotation: ind.note,
    };
    out.push({
      ...base,
      id: `${ind.id}--level`,
      title: ind.title,
      subtitle: ind.definition,
      kind: "line" as ChartKind,
      transform: "level" as Transform,
      tags: [ind.category, "level", "multilateral", "world-bank"],
    });
    out.push({
      ...base,
      id: `${ind.id}--index-2001`,
      title: ind.title,
      subtitle: `Indexed to 2001 = 100 — derived from "${ind.title}".`,
      kind: "line" as ChartKind,
      transform: "index-2001" as Transform,
      tags: [ind.category, "index-2001", "world-bank"],
    });
    out.push({
      ...base,
      id: `${ind.id}--yoy`,
      title: ind.title,
      subtitle: `Year-on-year change — derived from "${ind.title}".`,
      kind: "column" as ChartKind,
      transform: "yoy" as Transform,
      tags: [ind.category, "yoy", "world-bank"],
    });
    out.push({
      ...base,
      id: `${ind.id}--peers`,
      title: `${ind.title} — India vs peers`,
      subtitle: `${ind.definition} India against China, Vietnam, Brazil, Indonesia and the United States.`,
      kind: "lollipop" as ChartKind,
      transform: "level" as Transform,
      peerView: true,
      tags: [ind.category, "comparison", "peers", "world-bank"],
    });
  }
  return out;
}

/**
 * Specs for security series the SATP connector has not yet filled, and for the
 * defence series that need a document read by a person.
 *
 * Emitted pending rather than omitted: a chart that says what it is waiting for
 * is a commitment, and a reader can see the gap. Silently leaving them out
 * would make the gallery look complete when it is not.
 */
function specsFromPendingSecurity(): RegistryEntry[] {
  const out: RegistryEntry[] = [];
  for (const spec of ALL_SECURITY_SPECS) {
    if (getSeries(spec.id)) continue; // filled — handled by specsFromLoadedSeries
    const base = {
      category: spec.category,
      seriesIds: [spec.id],
      pending: true,
      annotation:
        spec.note ??
        (spec.filledBy === "satp"
          ? "Fills on the next pipeline run from the SATP datasheet."
          : "Awaiting a sourced figure for each year."),
    };
    out.push({
      ...base,
      id: `${spec.id}--level`,
      title: spec.title,
      subtitle: spec.definition,
      kind: "line" as ChartKind,
      transform: "level" as Transform,
      tags: [spec.category, "level", spec.provenance, `confidence:${spec.confidence}`],
    });
    out.push({
      ...base,
      id: `${spec.id}--yoy`,
      title: spec.title,
      subtitle: `Year-on-year change — derived from "${spec.title}".`,
      kind: "column" as ChartKind,
      transform: "yoy" as Transform,
      tags: [spec.category, "yoy", spec.provenance],
    });
  }
  return out;
}

/** Hand-authored charts that compare distinct series against each other. */
function curatedSpecs(): RegistryEntry[] {
  const curated: Array<Omit<RegistryEntry, "pending">> = [
    {
      id: "curated--exports-vs-production",
      title: "Defence exports against defence production",
      subtitle:
        "Exports as a share of what India builds. The gap is the domestic absorption of Indian defence output.",
      kind: "grouped-bar",
      category: "defence",
      seriesIds: ["defence-exports", "defence-production"],
      transform: "level",
      tags: ["defence", "comparison", "flagship"],
      annotation:
        "Exports are around 15% of production value. India builds mainly for itself; the export story is real but small against the domestic order book.",
    },
    {
      id: "curated--budget-vs-capital",
      title: "Defence budget against capital outlay",
      subtitle:
        "How much of the defence budget actually buys equipment rather than paying salaries and pensions.",
      kind: "grouped-bar",
      category: "defence",
      seriesIds: ["defence-budget", "defence-capital-outlay"],
      transform: "level",
      tags: ["defence", "comparison", "flagship"],
      annotation:
        "Capital outlay sits near 26-27% of the budget. Revenue expenditure — pay and pensions — crowds out modernisation, and this ratio has barely moved in a decade.",
    },
    {
      id: "curated--corridor-committed-vs-grounded",
      title: "Defence corridors: committed against grounded investment",
      subtitle:
        "Investment announced via MoU versus investment actually on the ground.",
      kind: "dumbbell",
      category: "defence",
      seriesIds: ["defence-corridor-committed", "defence-corridor-grounded"],
      transform: "level",
      tags: ["defence", "corridors", "flagship", "reality-check"],
      annotation:
        "Roughly 15% of committed corridor investment has been grounded. This single chart is the best corrective to announcement-driven infrastructure reporting.",
    },
    {
      id: "curated--network-vs-construction",
      title: "Highway network length against annual construction",
      subtitle:
        "Network growth includes re-designating existing state roads. Annual construction is what was actually built.",
      kind: "grouped-bar",
      category: "infrastructure",
      seriesIds: ["nh-network-length", "nh-constructed-annual"],
      transform: "level",
      tags: ["infrastructure", "comparison", "flagship", "reality-check"],
      annotation:
        "Construction has plateaued around 10,000-12,000 km a year since the FY2020-21 peak, even as headline network length keeps rising.",
    },
    {
      id: "curated--metro-length-vs-ridership",
      title: "Metro network length against ridership",
      subtitle: "Track built versus passengers carried, indexed to 2014.",
      kind: "line",
      category: "infrastructure",
      seriesIds: ["metro-network-length", "metro-ridership"],
      transform: "index-2001",
      tags: ["infrastructure", "comparison", "flagship", "reality-check"],
      annotation:
        "The two lines track almost exactly — meaning passengers per kilometre have been flat. New metro lines are not, on average, better used than the ones they followed.",
    },
    {
      id: "curated--port-capacity-vs-throughput",
      title: "Port capacity against cargo actually handled",
      subtitle: "Installed capacity versus throughput across all Indian ports.",
      kind: "grouped-bar",
      category: "infrastructure",
      seriesIds: ["port-capacity", "all-ports-cargo"],
      transform: "level",
      tags: ["infrastructure", "comparison", "flagship"],
      annotation:
        "Utilisation is around 59%. There is real headroom for trade growth, and weak near-term returns on further capacity spending.",
    },
    {
      id: "curated--merch-vs-services-exports",
      title: "Merchandise against services exports",
      subtitle: "Where India's export growth actually comes from.",
      kind: "grouped-bar",
      category: "trade",
      seriesIds: ["merchandise-exports", "services-exports"],
      transform: "level",
      tags: ["trade", "comparison", "flagship"],
      annotation:
        "Services grew 8.71% in FY2025-26 while goods grew 0.93%. India's export engine is offices, not factories — the opposite of the manufacturing-led story usually told.",
    },
    {
      id: "curated--airports-vs-udan-routes",
      title: "Airports built against UDAN routes started",
      subtitle: "Physical airports versus the routes meant to make them viable.",
      kind: "grouped-bar",
      category: "infrastructure",
      seriesIds: ["airports-operational", "udan-routes"],
      transform: "level",
      tags: ["infrastructure", "comparison", "reality-check"],
      annotation:
        "Route counts are cumulative inaugurations. A material share lapsed once the three-year viability-gap subsidy expired, so the operating network is smaller than the cumulative figure suggests.",
    },
    {
      id: "curated--arms-import-dependence",
      title: "Arms import dependence and supplier concentration",
      subtitle: "India's share of global arms imports against Russia's share of Indian imports.",
      kind: "grouped-bar",
      category: "defence",
      seriesIds: ["arms-imports-global-share", "arms-imports-russia-share"],
      transform: "level",
      tags: ["defence", "comparison", "flagship"],
      annotation:
        "Supplier diversification is the clearest structural win: Russia fell from 72% to 36% of Indian arms imports in a decade. India is nonetheless still the world's second-largest importer.",
    },
  ];

  return curated.map((c) => ({
    ...c,
    pending: c.seriesIds.some((id) => !getSeries(id)),
  }));
}

let cached: RegistryEntry[] | null = null;

export function getRegistry(): RegistryEntry[] {
  if (cached) return cached;
  const all = [
    ...curatedSpecs(),
    ...specsFromLoadedSeries(),
    ...specsFromPendingWdi(),
    ...specsFromPendingSecurity(),
  ];
  const seen = new Set<string>();
  cached = all.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  return cached;
}

export function getChart(id: string): RegistryEntry | undefined {
  return getRegistry().find((c) => c.id === id);
}

export function registryByCategory(category: Category): RegistryEntry[] {
  return getRegistry().filter((c) => c.category === category);
}

export function registryStats() {
  const all = getRegistry();
  return {
    total: all.length,
    live: all.filter((c) => !c.pending).length,
    pending: all.filter((c) => c.pending).length,
    byCategory: all.reduce<Record<string, number>>((acc, c) => {
      acc[c.category] = (acc[c.category] ?? 0) + 1;
      return acc;
    }, {}),
  };
}
