/**
 * Server-side loader for /internet: the state of the internet, country by
 * country, and the case that Starlink is a sovereignty question.
 *
 * Reads three committed files and computes every chart the page draws:
 *
 *   data/internet/internet.json  the connector's output (World Bank, ITU,
 *                                PeeringDB, TeleGeography, CelesTrak)
 *   data/internet/speeds.json    Ookla's open tiles, aggregated by country
 *   data/internet/curated.json   hand-entered counts and case studies, each
 *                                with the page that states it
 *
 * Nothing here invents a number. Where a chart is built from arithmetic on
 * published figures — people offline, price per GB — the chart carries a
 * `derived` line saying exactly what was done. A chart whose source has not
 * arrived renders an "awaiting data" state rather than an empty axis.
 *
 * The world map is projected once here and shipped once: country outlines go
 * into a single <defs> block and every map on the page references them.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { geoArea, geoEqualEarth, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, MultiPolygon } from "geojson";
import type {
  BarDatum, CaseStudy, ChartBody, ChartView, CuratedInternet, InternetData, InternetView, MapLayer,
  MapShape, ScatterDatum, Speeds, YearSeries,
} from "./internet-shared";

export type { InternetView };

export const MAP_W = 960;
export const MAP_H = 440;

const G20 = ["ARG", "AUS", "BRA", "CAN", "CHN", "FRA", "DEU", "IND", "IDN", "ITA", "JPN", "KOR", "MEX", "RUS", "SAU", "ZAF", "TUR", "GBR", "USA"];
const SOUTH_ASIA = ["IND", "PAK", "BGD", "LKA", "NPL", "BTN", "MDV", "AFG"];
const PEERS = ["IND", "CHN", "IDN", "BRA", "BGD", "PAK", "VNM"];

const WB = "World Bank WDI (ITU data)";
const WB_URL = "https://data.worldbank.org/indicator/IT.NET.USER.ZS";
const OOKLA = "Ookla Open Data, Speedtest performance tiles (CC BY-NC-SA 4.0)";
const OOKLA_URL = "https://github.com/teamookla/ookla-open-data";
const ITU = "ITU ICT Price Baskets 2025";
const ITU_URL = "https://www.itu.int/en/ITU-D/Statistics/Pages/ICTprices/default.aspx";

/** Where the case-study pins are drawn: a drawing position, not a data point. */
const CASE_AT: Record<string, [number, number, number?, number?]> = {
  "ukraine-sevastopol": [33.5, 44.6],
  "iran-2022": [53.7, 32.4],
  "brazil-2024": [-47.9, -15.8],
  "andaman-2024": [93.0, 12.3],
  "manipur-2024": [93.9, 24.8],
  "myanmar-scam-2025": [98.5, 16.7],
  "ukraine-whitelist-2026": [37.8, 48.0, 16, -12],
};

function read<T>(...parts: string[]): T | null {
  const f = join(process.cwd(), ...parts);
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as T) : null;
}

type WorldProps = { iso3: string; name: string; tiny: boolean; label: [number, number] };

function projectWorld(): { shapes: MapShape[]; project: (p: [number, number]) => [number, number] | null } {
  const world = read<FeatureCollection<MultiPolygon, WorldProps>>("data", "geo", "world-ind.json");
  // GeoJSON winds exterior rings anticlockwise; d3-geo reads that as "the
  // whole sphere except this country". Reverse any polygon whose spherical
  // area exceeds a hemisphere, so either winding draws correctly.
  const features = ((world?.features ?? []) as Array<Feature<MultiPolygon, WorldProps>>).map((f) => ({
    ...f,
    geometry: {
      ...f.geometry,
      coordinates: f.geometry.coordinates.map((poly) =>
        geoArea({ type: "Polygon", coordinates: [poly[0]!] }) > 2 * Math.PI ? poly.map((r) => [...r].reverse()) : poly),
    },
  }));
  const projection = geoEqualEarth().fitExtent([[4, 4], [MAP_W - 4, MAP_H - 4]], { type: "FeatureCollection", features } as FeatureCollection);
  const path = geoPath(projection).digits(1);
  const shapes: MapShape[] = [];
  for (const f of features) {
    const d = path(f);
    if (!d) continue;
    const [cx, cy] = projection(f.properties.label) ?? [0, 0];
    shapes.push({ iso3: f.properties.iso3, name: f.properties.name, d, cx: Math.round(cx * 10) / 10, cy: Math.round(cy * 10) / 10, tiny: f.properties.tiny });
  }
  return { shapes, project: (p) => projection(p) };
}

/** The most recent value no older than `maxAge` years. */
function latest(s: YearSeries | undefined, maxAge = 6): [number, number] | null {
  if (!s?.length) return null;
  const last = s[s.length - 1]!;
  return last[0] >= new Date().getUTCFullYear() - maxAge ? last : null;
}

function at(s: YearSeries | undefined, year: number): number | null {
  return s?.find(([y]) => y === year)?.[1] ?? null;
}

function yearSpan(years: number[]): string {
  if (!years.length) return "";
  const lo = Math.min(...years), hi = Math.max(...years);
  return lo === hi ? String(hi) : `${lo}–${hi}`;
}

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;
const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

function awaiting(reason: string): ChartBody {
  return { kind: "awaiting", reason };
}

export function loadInternet(): InternetView {
  const d = read<InternetData>("data", "internet", "internet.json");
  const sp = read<Speeds>("data", "internet", "speeds.json");
  const curated = read<CuratedInternet>("data", "internet", "curated.json")!;
  const { shapes, project } = projectWorld();
  const nameOf = new Map(shapes.map((s) => [s.iso3, s.name]));
  const wb = d?.worldBank ?? null;
  const ind = (code: string) => wb?.indicators[code]?.values ?? {};
  const isCountry = (iso: string) => !!wb?.countries[iso];
  const name = (iso: string) => wb?.countries[iso]?.name ?? nameOf.get(iso) ?? iso;
  const charts: ChartView[] = [];
  let n = 0;
  const push = (c: Omit<ChartView, "n">) => charts.push({ n: ++n, ...c });

  /* ── I. Access ───────────────────────────────────────────────────────── */

  const users = ind("IT.NET.USER.ZS");
  const pop = ind("SP.POP.TOTL");
  const latestLayer = (code: string, id: string, title: string, unit: string, breaks: number[], extra: Partial<MapLayer> = {}): MapLayer | null => {
    const vals = ind(code);
    const values: Record<string, number> = {};
    const years: number[] = [];
    for (const [iso, s] of Object.entries(vals)) {
      if (!isCountry(iso)) continue;
      const l = latest(s);
      if (!l) continue;
      values[iso] = round(l[1]);
      years.push(l[0]);
    }
    if (!Object.keys(values).length) return null;
    return { id, title, unit, breaks, values, year: yearSpan(years), source: WB, ...extra };
  };

  const usersLayer = latestLayer("IT.NET.USER.ZS", "users", "Internet users", "% of population", [20, 40, 60, 80, 90]);
  push({
    id: "users-map", part: "access",
    title: "Who is online",
    dek: usersLayer
      ? `Share of people who used the internet in the past three months, latest year for each country (${usersLayer.year}). India: ${usersLayer.values.IND ?? "no recent figure"}%.`
      : "Share of people who used the internet in the past three months.",
    body: usersLayer ? { kind: "map", layer: { ...usersLayer, note: "Most recent year available per country; some countries' latest figure is several years old." } } : awaiting("World Bank data not yet ingested"),
    source: WB, sourceUrl: WB_URL,
  });

  const lineIds = ["WLD", "HIC", "UMC", "LMC", "LIC", "IND"];
  const lines = lineIds.filter((i) => users[i]?.length).map((i) => ({ id: i, name: i === "IND" ? "India" : wb?.aggregates[i] ?? i, points: users[i]!, highlight: i === "IND" }));
  push({
    id: "users-income", part: "access",
    title: "The gap closes slowly at the bottom",
    dek: "Internet users as a share of population: the world, the four World Bank income groups, and India.",
    body: lines.length ? { kind: "lines", series: lines, unit: "% of population" } : awaiting("World Bank data not yet ingested"),
    source: WB, sourceUrl: WB_URL,
  });

  const offline: BarDatum[] = [];
  for (const [iso, s] of Object.entries(users)) {
    if (!isCountry(iso)) continue;
    const l = latest(s);
    const p = l ? at(pop[iso], l[0]) : null;
    if (!l || p === null) continue;
    offline.push({ iso3: iso, name: name(iso), value: round((p * (1 - l[1] / 100)) / 1e6), label: `${l[0]}` });
  }
  offline.sort((a, b) => b.value - a.value);
  push({
    id: "offline", part: "access",
    title: "Where the offline people are",
    dek: `People not using the internet, millions. A low share in a populous country is a very large number of people${offline[0] ? `: ${offline[0].name} has ${Math.round(offline[0].value)} million offline, the most of any country` : ""}.`,
    body: offline.length ? { kind: "bars", data: offline.slice(0, 15), unit: "million people offline", highlight: ["IND"] } : awaiting("World Bank data not yet ingested"),
    source: WB, sourceUrl: WB_URL,
    derived: "Population × (100 − internet users %) ÷ 100, both for the country's latest year with an internet-users figure.",
  });

  const bbLayer = latestLayer("IT.NET.BBND.P2", "broadband", "Fixed broadband", "subscriptions per 100 people", [2, 10, 20, 30, 40]);
  push({
    id: "broadband-map", part: "access",
    title: "The wired internet is a rich-country thing",
    dek: bbLayer ? `Fixed broadband subscriptions per 100 people (${bbLayer.year}). India: ${bbLayer.values.IND ?? "—"}. Most Indians are online through a phone, not a line.` : "Fixed broadband subscriptions per 100 people.",
    body: bbLayer ? { kind: "map", layer: bbLayer } : awaiting("World Bank data not yet ingested"),
    source: WB, sourceUrl: "https://data.worldbank.org/indicator/IT.NET.BBND.P2",
  });

  const cel = ind("IT.CEL.SETS.P2");
  const phones: ScatterDatum[] = [];
  for (const [iso, s] of Object.entries(users)) {
    if (!isCountry(iso)) continue;
    // The latest year with both figures, so the two are always the same year.
    const both = [...s].reverse().find(([y]) => at(cel[iso], y) !== null && y >= new Date().getUTCFullYear() - 6);
    if (!both) continue;
    phones.push({ iso3: iso, name: name(iso), x: round(at(cel[iso], both[0])!), y: round(both[1]), r: at(pop[iso], both[0]) ?? undefined, group: wb?.countries[iso]?.income });
  }
  const simsNotOnline = phones.filter((p) => p.x > 100 && p.y < 60).length;
  push({
    id: "phones-vs-users", part: "access",
    title: "A SIM card is not an internet connection",
    dek: `Mobile subscriptions per 100 people (log scale) against the share actually online, same year; circles sized by population. In ${simsNotOnline} countries there are more SIM cards than people and yet fewer than 60% are online.`,
    body: phones.length ? { kind: "scatter", data: phones, x: "mobile subscriptions per 100 people (log)", y: "internet users, % of population", logX: true, reference: { x: 100, label: "one SIM per person" } } : awaiting("World Bank data not yet ingested"),
    source: WB, sourceUrl: "https://data.worldbank.org/indicator/IT.CEL.SETS.P2",
  });

  const peers = PEERS.filter((i) => users[i]?.length).map((i) => ({ id: i, name: name(i), points: users[i]!, highlight: i === "IND" }));
  push({
    id: "india-peers", part: "access",
    title: "India against its peers",
    dek: `Internet users as a share of population, 2000 onwards. The year each crossed half its population: ${peers.map((p) => `${p.name} ${p.points.find(([, v]) => v >= 50)?.[0] ?? "not yet"}`).join(", ")}.`,
    body: peers.length ? { kind: "lines", series: peers, unit: "% of population" } : awaiting("World Bank data not yet ingested"),
    source: WB, sourceUrl: WB_URL,
  });

  /* ── II. Speed ───────────────────────────────────────────────────────── */

  const quarter = sp ? `${sp.year} Q${sp.quarter}` : null;
  const speedLayer = (k: "mobile" | "fixed", breaks: number[]): MapLayer | null => {
    if (!sp) return null;
    const values: Record<string, number> = {};
    for (const [iso, v] of Object.entries(sp[k].countries)) values[iso] = v.downMbps;
    return {
      id: k, title: `${k === "mobile" ? "Mobile" : "Fixed"} download speed`, unit: "Mbps", breaks, values, year: quarter!, source: OOKLA,
      derived: `Test-weighted mean of Ookla's tile averages within each country; countries with fewer than ${sp.minTests[k]} tests in the quarter left out.`,
    };
  };
  const mob = speedLayer("mobile", [25, 50, 100, 150, 250]);
  const fix = speedLayer("fixed", [25, 50, 100, 200, 300]);
  const speedDerived = "Ookla publishes speeds per map tile, not per country. Tiles were placed in countries by their centre and averaged weighted by test count. This is a mean of tests, not Ookla's Speedtest Global Index (a median), and will differ from it.";
  push({
    id: "mobile-speed-map", part: "speed",
    title: "Mobile speed: India's phones are fast",
    dek: mob ? `Average mobile download speed, ${quarter}. India: ${mob.values.IND ?? "—"} Mbps, against ${mob.values.GBR ?? "—"} in the United Kingdom and ${mob.values.USA ?? "—"} in the United States; ${Object.values(mob.values).filter((x) => x > (mob.values.IND ?? Infinity)).length} of ${Object.keys(mob.values).length} countries measured faster.` : "Average mobile download speed.",
    body: mob ? { kind: "map", layer: mob } : awaiting("Ookla aggregation not yet run"),
    source: OOKLA, sourceUrl: OOKLA_URL, derived: speedDerived,
  });
  push({
    id: "fixed-speed-map", part: "speed",
    title: "Fixed speed: the wire is where India lags",
    dek: fix ? `Average fixed-broadband download speed, ${quarter}. India: ${fix.values.IND ?? "—"} Mbps; China ${fix.values.CHN ?? "—"}; the United States ${fix.values.USA ?? "—"}.` : "Average fixed-broadband download speed.",
    body: fix ? { kind: "map", layer: fix } : awaiting("Ookla aggregation not yet run"),
    source: OOKLA, sourceUrl: OOKLA_URL, derived: speedDerived,
  });

  const g20Speed: BarDatum[] = sp ? G20.filter((i) => sp.fixed.countries[i] && sp.mobile.countries[i])
    .map((i) => ({ iso3: i, name: name(i), value: sp.fixed.countries[i]!.downMbps, value2: sp.mobile.countries[i]!.downMbps }))
    .sort((a, b) => b.value - a.value) : [];
  push({
    id: "fixed-vs-mobile", part: "speed",
    title: "Where mobile beats the wire",
    dek: `Fixed against mobile download speed in the G20. In ${g20Speed.filter((g) => g.value > (g.value2 ?? 0)).length} of ${g20Speed.length} the wire is faster${sp?.mobile.countries.IND && sp.fixed.countries.IND ? (sp.mobile.countries.IND.downMbps > sp.fixed.countries.IND.downMbps ? "; in India the phone is" : "; India too") : ""}.`,
    body: g20Speed.length ? { kind: "dumbbell", data: g20Speed, unit: "Mbps", labels: ["fixed", "mobile"] } : awaiting("Ookla aggregation not yet run"),
    source: OOKLA, sourceUrl: OOKLA_URL, derived: speedDerived,
  });

  const lat: BarDatum[] = sp ? G20.filter((i) => sp.mobile.countries[i]).map((i) => ({ iso3: i, name: name(i), value: sp.mobile.countries[i]!.latencyMs })).sort((a, b) => a.value - b.value) : [];
  push({
    id: "latency", part: "speed",
    title: "Latency: how long a signal waits",
    dek: "Average mobile latency in the G20, milliseconds; lower is better. The delay before data starts to move matters more than raw speed for calls, games and anything interactive.",
    body: lat.length ? { kind: "bars", data: lat, unit: "ms (lower is better)", highlight: ["IND"] } : awaiting("Ookla aggregation not yet run"),
    source: OOKLA, sourceUrl: OOKLA_URL, derived: speedDerived,
  });

  /* ── III. Price ──────────────────────────────────────────────────────── */

  const plans = d?.itu?.mobile ?? [];
  const perGb: Record<string, number> = {};
  for (const p of plans) {
    if (!p.iso3 || p.usd === null || p.gb === null || p.gb <= 0 || p.unlimited) continue;
    perGb[p.iso3] = round(p.usd / p.gb, 2);
  }
  const cheapOrder = Object.entries(perGb).sort((a, b) => a[1] - b[1]).map(([iso]) => iso);
  const rankCheap = (iso: string) => cheapOrder.indexOf(iso) + 1;
  const ituYear = (d?.itu?.mobileTitle.match(/(20\d{2})/) ?? [])[1] ?? "2025";
  push({
    id: "price-per-gb", part: "price",
    title: "What a gigabyte costs",
    dek: Object.keys(perGb).length ? `US dollars per GB in the mobile data plan ITU priced in each country, ${ituYear}. India: $${perGb.IND?.toFixed(2) ?? "—"}, the ${ordinal(rankCheap("IND"))} cheapest of ${Object.keys(perGb).length}.` : "US dollars per GB of mobile data.",
    body: Object.keys(perGb).length ? { kind: "map", layer: { id: "pergb", title: "Price per GB", unit: "US$ per GB", breaks: [0.1, 0.25, 0.5, 1, 2.5], invert: true, values: perGb, year: ituYear, source: ITU } } : awaiting("ITU workbook not yet ingested"),
    source: ITU, sourceUrl: ITU_URL,
    derived: "The monthly price of the plan ITU chose for its data-only mobile basket (at least 5 GB), divided by that plan's data allowance. It is the per-GB price of an entry plan, not a market average; plans sold as unlimited are left out.",
  });

  const aff: BarDatum[] = plans.filter((p) => p.iso3 && p.gniPct !== null && (G20.includes(p.iso3) || SOUTH_ASIA.includes(p.iso3)))
    .map((p) => ({ iso3: p.iso3!, name: name(p.iso3!), value: p.gniPct! }))
    .sort((a, b) => b.value - a.value);
  const over = plans.filter((p) => p.gniPct !== null && p.gniPct > 2).length;
  const priced = plans.filter((p) => p.gniPct !== null).length;
  push({
    id: "affordability", part: "price",
    title: "Affordable is relative to income",
    dek: priced ? `The same mobile data basket as a share of monthly income per person, G20 and South Asia. ${over} of ${priced} economies ITU priced miss the 2% target.` : "Mobile data basket as a share of monthly income per person.",
    body: aff.length ? { kind: "bars", data: aff, unit: "% of monthly GNI per capita", reference: { value: 2, label: "2% target" }, highlight: ["IND"] } : awaiting("ITU workbook not yet ingested"),
    source: ITU, sourceUrl: ITU_URL,
    note: "The 2% line is the UN Broadband Commission's affordability target for entry-level broadband.",
  });

  const priceUsers: ScatterDatum[] = [];
  for (const p of plans) {
    if (!p.iso3 || p.gniPct === null || p.gniPct <= 0) continue;
    const u = latest(users[p.iso3]);
    if (!u) continue;
    priceUsers.push({ iso3: p.iso3, name: name(p.iso3), x: p.gniPct, y: round(u[1]), r: at(pop[p.iso3], u[0]) ?? undefined, group: wb?.countries[p.iso3]?.income });
  }
  push({
    id: "price-vs-users", part: "price",
    title: "Price keeps people off",
    dek: "Mobile data basket as a share of income (log scale) against the share of people online. Where data costs more than a few per cent of income, most people are not online.",
    body: priceUsers.length ? { kind: "scatter", data: priceUsers, x: "mobile data basket, % of monthly GNI per capita (log)", y: "internet users, % of population", logX: true, reference: { x: 2, label: "2% target" } } : awaiting("ITU workbook not yet ingested"),
    source: `${ITU}; ${WB}`, sourceUrl: ITU_URL,
  });

  /* ── IV. Plumbing ────────────────────────────────────────────────────── */

  const servers = latestLayer("IT.NET.SECR.P6", "servers", "Secure internet servers", "per million people", [10, 100, 1000, 10000, 50000]);
  push({
    id: "servers-map", part: "plumbing",
    title: "Where the internet is hosted",
    dek: servers ? `Secure (TLS) internet servers per million people (${servers.year}). India: ${servers.values.IND ?? "—"}. Users are everywhere; servers cluster in a few places.` : "Secure internet servers per million people.",
    body: servers ? { kind: "map", layer: { ...servers, note: "Log-spaced classes: each step is ten times the last." } } : awaiting("World Bank data not yet ingested"),
    source: WB, sourceUrl: "https://data.worldbank.org/indicator/IT.NET.SECR.P6",
  });

  const ixp = d?.peeringdb;
  const ixBars = ixp ? Object.entries(ixp.byCountry).map(([iso, v]) => ({ iso3: iso, name: name(iso), value: v })).sort((a, b) => b.value - a.value) : [];
  const topIx = ixBars.slice(0, 15);
  if (ixBars.length && !topIx.some((b) => b.iso3 === "IND")) { const i = ixBars.find((b) => b.iso3 === "IND"); if (i) topIx.push(i); }
  push({
    id: "ixps", part: "plumbing",
    title: "Where networks meet",
    dek: ixp ? `Internet exchange points by country, from ${ixp.total.toLocaleString("en-IN")} in PeeringDB. Local exchanges keep local traffic local — and inside the country's jurisdiction.` : "Internet exchange points by country.",
    body: topIx.length ? { kind: "bars", data: topIx, unit: "exchange points", highlight: ["IND"] } : awaiting("PeeringDB not yet ingested"),
    source: "PeeringDB", sourceUrl: "https://www.peeringdb.com/",
    note: "PeeringDB is self-reported by network operators; an exchange that has not registered is not counted.",
  });

  const cab = d?.cables;
  const cabBars = cab ? Object.entries(cab.byCountry).map(([iso, v]) => ({ iso3: iso, name: name(iso), value: cab.perCable ? v.cables : v.landings })).filter((b) => b.value > 0).sort((a, b) => b.value - a.value) : [];
  const topCab = cabBars.slice(0, 15);
  if (cabBars.length && !topCab.some((b) => b.iso3 === "IND")) { const i = cabBars.find((b) => b.iso3 === "IND"); if (i) topCab.push(i); }
  push({
    id: "cables", part: "plumbing",
    title: "The internet arrives by sea",
    dek: cab ? `${cab.perCable ? "Submarine cables landing in each country" : "Submarine cable landing points in each country"}, of ${cab.total} cables on TeleGeography's map. TeleGeography's own check finds cables carry over 99% of intercontinental data traffic.` : "Submarine cables landing in each country.",
    body: topCab.length ? { kind: "bars", data: topCab, unit: cab?.perCable ? "cables landing" : "landing points", highlight: ["IND"] } : awaiting("Cable map not yet ingested"),
    source: "TeleGeography Submarine Cable Map", sourceUrl: "https://www.submarinecablemap.com/",
    note: "Includes cables TeleGeography lists as planned. Country is read from each landing point's name.",
    also: [{ label: "TeleGeography, 2023: do submarine cables account for over 99% of intercontinental data traffic?", url: "https://resources.telegeography.com/2023-mythbusting-part-3" }],
  });

  /* ── V. Control ──────────────────────────────────────────────────────── */

  const sy = curated.shutdowns.years;
  push({
    id: "shutdowns", part: "control",
    title: "The state's own off switch",
    dek: `Internet shutdowns recorded worldwide and in India. In ${curated.shutdowns.latest.year}: ${curated.shutdowns.latest.byCountry.map((c) => `${c.name} ${c.count}`).join(", ")}.`,
    body: { kind: "columns", data: sy.filter((y) => y.global !== null).map((y) => ({ label: String(y.year), value: y.global!, value2: y.india ?? undefined })), unit: "shutdowns", labels: ["world", "India"] },
    source: "Access Now, #KeepItOn reports", sourceUrl: "https://www.accessnow.org/campaign/keepiton/",
    note: "Counts as published in each year's report; Access Now sometimes revises a past year in a later report (2020: 155 at first, 159 later). A shutdown is counted per order, whatever its length or area.",
  });

  /* ── VI. Sky ─────────────────────────────────────────────────────────── */

  const sat = d?.satcat;
  const st = sat?.constellations.Starlink;
  if (sat && st) {
    const rivals = Object.entries(sat.constellations).filter(([k]) => k !== "Starlink").reduce((s, [, c]) => s + c.active, 0);
    push({
      id: "sky-share", part: "sky",
      title: "One company's share of the sky",
      dek: `Of ${sat.activePayloads.toLocaleString("en-IN")} working satellites in orbit, ${st.active.toLocaleString("en-IN")} are Starlink — ${Math.round((st.active / sat.activePayloads) * 100)}%. Working satellites owned by India: ${(sat.activeByOwner.IND ?? 0).toLocaleString("en-IN")}.`,
      body: {
        kind: "waffle", unit: "working satellites", per: 25,
        cells: [
          { label: "Starlink", value: st.active, tone: "red" },
          { label: "Other broadband constellations (OneWeb, Kuiper, Qianfan, Guowang and older)", value: rivals, tone: "blue" },
          { label: "Every other working satellite, all countries", value: sat.activePayloads - st.active - rivals, tone: "grey" },
        ],
      },
      source: "CelesTrak SATCAT", sourceUrl: "https://celestrak.org/satcat/",
      derived: "Counted from the catalogue: payloads with no decay date whose status is operational, partially operational, backup, spare or extended mission. Constellations are identified by the names CelesTrak gives their satellites.",
    });
    const years = Object.keys(st.launchedByYear).concat(Object.keys(st.decayedByYear)).map(Number).filter((y) => y >= 2018);
    const ys = years.length ? Array.from({ length: Math.max(...years) - Math.min(...years) + 1 }, (_, i) => Math.min(...years) + i) : [];
    push({
      id: "starlink-launches", part: "sky",
      title: "Launched faster than anyone can regulate",
      dek: `Starlink satellites launched and re-entered each year. ${st.launched.toLocaleString("en-IN")} launched in all; ${st.decayed.toLocaleString("en-IN")} have already re-entered the atmosphere.`,
      body: { kind: "columns", data: ys.map((y) => ({ label: String(y), value: st.launchedByYear[String(y)] ?? 0, value2: st.decayedByYear[String(y)] ?? 0 })), unit: "satellites", labels: ["launched", "re-entered"] },
      source: "CelesTrak SATCAT", sourceUrl: "https://celestrak.org/satcat/",
      note: "The current year is partial.",
    });
  } else {
    push({ id: "sky-share", part: "sky", title: "One company's share of the sky", dek: "Working satellites in orbit, Starlink against everyone else.", body: awaiting("Satellite catalogue not yet ingested"), source: "CelesTrak SATCAT", sourceUrl: "https://celestrak.org/satcat/" });
    push({ id: "starlink-launches", part: "sky", title: "Launched faster than anyone can regulate", dek: "Starlink satellites launched and re-entered each year.", body: awaiting("Satellite catalogue not yet ingested"), source: "CelesTrak SATCAT", sourceUrl: "https://celestrak.org/satcat/" });
  }

  const subs = curated.starlinkSubscribers;
  const lastSub = subs[subs.length - 1];
  push({
    id: "starlink-subscribers", part: "sky",
    title: "Customers, by the company's own count",
    dek: lastSub ? `Starlink subscribers as SpaceX has announced them: ${(lastSub.subscribers / 1e6).toFixed(0)} million by ${lastSub.date}${lastSub.countries ? `, in ${lastSub.countries}+ countries and territories` : ""}. No regulator publishes a global count.` : "Starlink subscribers as SpaceX has announced them.",
    body: { kind: "columns", data: subs.map((s) => ({ label: s.date, value: s.subscribers / 1e6 })), unit: "million subscribers (company claims)", claim: true },
    source: "SpaceX announcements, as reported", sourceUrl: subs[0]?.cite[0]?.url ?? "https://www.starlink.com/",
    note: "Company claims, not audited figures. Each point's report is listed in the sources.",
  });

  /* ── headline and the rest ───────────────────────────────────────────── */

  const indUsers = latest(users.IND);
  const indOffline = offline.find((o) => o.iso3 === "IND");
  const headline = [
    indUsers ? { label: "Indians online", value: `${round(indUsers[1], 0)}%`, sub: `${indUsers[0]}, ITU via World Bank` } : null,
    indOffline ? { label: "Indians offline", value: `${Math.round(indOffline.value)}m`, sub: "derived from the same figures" } : null,
    sp?.mobile.countries.IND ? { label: "Mobile download, India", value: `${sp.mobile.countries.IND.downMbps} Mbps`, sub: `${quarter}, Ookla open data` } : null,
    perGb.IND !== undefined ? { label: "A GB of mobile data, India", value: `$${perGb.IND.toFixed(2)}`, sub: `${ituYear}, derived from ITU` } : null,
    sat && st ? { label: "Working satellites that are Starlink", value: `${Math.round((st.active / sat.activePayloads) * 100)}%`, sub: "CelesTrak SATCAT" } : null,
    { label: "Internet shutdowns in India", value: String(sy[sy.length - 1]?.india ?? "—"), sub: `${sy[sy.length - 1]?.year}, Access Now` },
  ].filter((x): x is { label: string; value: string; sub: string } => x !== null);

  const cases = curated.cases.map((c: CaseStudy) => {
    const at = CASE_AT[c.id];
    const p = at ? project([at[0], at[1]]) : null;
    return { ...c, x: p ? Math.round(p[0] + (at?.[2] ?? 0)) : null, y: p ? Math.round(p[1] + (at?.[3] ?? 0)) : null };
  });

  const sources = [
    { name: "World Bank World Development Indicators", url: "https://data.worldbank.org/", what: "Internet users, fixed broadband and mobile subscriptions (the ITU's figures), secure servers, population.", licence: "CC BY 4.0" },
    { name: "ITU ICT Price Baskets", url: ITU_URL, what: "Mobile and fixed broadband prices as a share of income and in US dollars; the plan priced in each country and its allowance." },
    { name: "Ookla Open Data", url: OOKLA_URL, what: `Speed-test tiles${quarter ? ` for ${quarter}` : ""}, aggregated by country here.`, licence: "CC BY-NC-SA 4.0" },
    { name: "PeeringDB", url: "https://www.peeringdb.com/", what: "Internet exchange points and their countries." },
    { name: "TeleGeography Submarine Cable Map", url: "https://www.submarinecablemap.com/", what: "Cables and their landing points.", licence: "CC BY-SA 4.0" },
    { name: "CelesTrak SATCAT", url: "https://celestrak.org/satcat/", what: "Every catalogued object: owner, launch, decay and status." },
    { name: "Access Now #KeepItOn", url: "https://www.accessnow.org/campaign/keepiton/", what: "Internet shutdown counts, cited year by year below." },
    { name: "Natural Earth", url: "https://www.naturalearthdata.com/", what: "Country borders as India draws them (1:10m India view), simplified.", licence: "Public domain" },
  ];

  return {
    present: !!d || !!sp,
    generatedAt: d?.generatedAt ?? sp?.generatedAt ?? null,
    speedsQuarter: quarter,
    map: { w: MAP_W, h: MAP_H, shapes },
    charts,
    headline,
    curated,
    cases,
    sources,
  };
}
