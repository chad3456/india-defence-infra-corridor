import Link from "next/link";
import { getSeries, definedPoints } from "@/lib/data";
import { CLUSTERS, ALL_IDS, type Cluster } from "@/lib/global-economy";
import ChartCanvas, { type SeriesInput } from "@/components/charts/ChartCanvas";
import SparkGrid, { type Spark } from "@/components/charts/SparkGrid";
import SlopeChart, { type SlopeRow } from "@/components/charts/SlopeChart";
import PeerScatter, { type ScatterSeries } from "@/components/charts/PeerScatter";
import type { Series } from "@/lib/types";

/**
 * India in the world economy: a hundred indicators in ten clusters, ten forms.
 *
 * The page is organised the way the curation file argues for: each cluster
 * asks a different question, and the question picks the chart. Nothing here is
 * drawn a particular way for variety — if two clusters wanted the same form
 * they would be one cluster.
 *
 * ── The constraint, said once and near the top ──────────────────────────
 *
 * The ingest holds a full 2001-present run for India on all hundred of these
 * and only the latest reading for the five comparators. So every chart is
 * either India over time or all six at one moment, and none is five countries
 * over time. That is a property of the ingest, not a choice of framing, and
 * the header says so rather than letting a reader infer that peer history was
 * considered and dropped.
 */

export const metadata = {
  title: "India in the world economy",
  description:
    "A hundred economic indicators for India, clustered into ten questions and drawn in the ten chart forms those questions call for — scale, trade composition, the external account, prices, financial depth, and exposure.",
};

/** Every peer set uses the same six. Named once so the page can say so. */
const COMPARATORS = "China, Vietnam, Brazil, Indonesia and the United States";

/**
 * A category label short enough for the chart engine's gutter.
 *
 * Horizontal charts size their left margin to the longest label and clamp it
 * at 150px to keep the plot its room, so a 50-character WDI title is clipped
 * mid-word. The denominator in brackets is the part to drop: every one of
 * these panels states its own units above the chart, and the full title is in
 * the cluster's series list underneath.
 */
function shortLabel(title: string, n = 30): string {
  const bare = title.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return bare.length > n ? bare.slice(0, n - 1) + "\u2026" : bare;
}

type Loaded = { cluster: Cluster; series: Series[] };

function toInput(s: Series, from = 0): SeriesInput {
  return {
    id: s.id,
    label: s.title,
    unitShort: s.unitShort,
    data: definedPoints(s)
      .filter((p) => {
        const y = Number(p.period.match(/(19|20)\d{2}/)?.[0] ?? NaN);
        return !Number.isFinite(y) || y >= from;
      })
      .map((p) => ({ period: p.period, value: p.value as number })),
  };
}

/**
 * The chart for one cluster.
 *
 * Every branch is deliberate about how many series it draws at once. The
 * engine's categorical order carries four hues, so a form that would need a
 * fifth folds down to the four that answer the cluster's question and the rest
 * are reachable through the index at the foot of the page — a generated fifth
 * hue would be unreadable for a colour-blind reader and is never worth it.
 */
function ClusterChart({ cluster, series }: Loaded) {
  switch (cluster.form) {
    case "peer-bar": {
      // Six countries on one axis, per indicator. Drawn as one bar chart per
      // series because the eight indicators are in different units and a
      // shared axis across them would be meaningless.
      return (
        <div className="grid gap-6 lg:grid-cols-2">
          {series.map((s) => {
            const peers = [...(s.peers ?? [])].sort((a, b) => b.value - a.value);
            if (peers.length === 0) return null;
            return (
              <figure key={s.id} className="m-0 min-w-0 rounded-lg border bg-[var(--surface-1)] p-4">
                <figcaption className="mb-1 text-[13px] font-medium">{s.title}</figcaption>
                <p className="mono mb-2 text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                  {s.unitShort} · latest reading per country
                </p>
                <ChartCanvas
                  kind="bar"
                  height={190}
                  series={[{
                    id: s.id,
                    label: s.title,
                    unitShort: s.unitShort,
                    data: peers.map((p) => ({ period: p.country, value: p.value })),
                  }]}
                />
              </figure>
            );
          })}
        </div>
      );
    }

    case "line":
    case "stacked-area": {
      // Four at a time: the categorical order carries four hues and a fifth
      // would have to be generated.
      const groups: Series[][] = [];
      for (let i = 0; i < series.length; i += 4) groups.push(series.slice(i, i + 4));
      return (
        <div className="grid gap-6 lg:grid-cols-2">
          {groups.map((g, i) => (
            <figure key={i} className="m-0 min-w-0 rounded-lg border bg-[var(--surface-1)] p-4">
              <figcaption className="mb-3 text-[13px] font-medium">
                {g.map((s) => s.title).join(" · ")}
              </figcaption>
              <ChartCanvas
                kind={cluster.form === "line" ? "line" : "stacked-area"}
                height={230}
                series={g.map((s) => toInput(s, 2001))}
              />
            </figure>
          ))}
        </div>
      );
    }

    case "column-zero": {
      return (
        <div className="grid gap-6 lg:grid-cols-2">
          {series.map((s) => (
            <figure key={s.id} className="m-0 min-w-0 rounded-lg border bg-[var(--surface-1)] p-4">
              <figcaption className="mb-1 text-[13px] font-medium">{s.title}</figcaption>
              <p className="mono mb-2 text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                {s.unitShort} · above the line is an inflow
              </p>
              <ChartCanvas kind="column" height={180} zeroLine series={[toInput(s, 2001)]} />
            </figure>
          ))}
        </div>
      );
    }

    case "sparkgrid": {
      const items: Spark[] = series.map((s) => {
        const i = toInput(s, 2001);
        return { id: i.id, label: i.label, unitShort: i.unitShort, data: i.data };
      });
      return <SparkGrid items={items} />;
    }

    case "stacked-bar": {
      // Only the share-of-GDP members stack honestly; anything in dollars is
      // shown beside them rather than added into a total it does not belong to.
      const shares = series.filter((s) => s.unitShort === "%");
      const rest = series.filter((s) => s.unitShort !== "%");
      return (
        <div className="grid gap-6">
          <figure className="m-0 min-w-0 rounded-lg border bg-[var(--surface-1)] p-4">
            <figcaption className="mb-1 text-[13px] font-medium">
              Shares of GDP, stacked
            </figcaption>
            <p className="mb-3 text-[11.5px] leading-relaxed text-[color:var(--text-muted)]">
              These are separately published shares of the same denominator, not a decomposition
              that sums to 100 — consumption and gross national expenditure overlap. The stack
              shows each one&rsquo;s size against the others, not a partition of the economy.
            </p>
            <ChartCanvas
              kind="stacked-bar"
              height={260}
              series={shares.slice(0, 4).map((s) => toInput(s, 2010))}
            />
          </figure>
          {rest.length > 0 && (
            <figure className="m-0 min-w-0 rounded-lg border bg-[var(--surface-1)] p-4">
              <figcaption className="mb-3 text-[13px] font-medium">
                {rest.map((s) => s.title).join(" · ")}
              </figcaption>
              <ChartCanvas kind="line" height={200} series={rest.map((s) => toInput(s, 2001))} />
            </figure>
          )}
        </div>
      );
    }

    case "slope": {
      const rows: SlopeRow[] = series.flatMap((s) => {
        const pts = definedPoints(s);
        const a = pts[0], b = pts[pts.length - 1];
        if (!a || !b || a.period === b.period) return [];
        return [{
          id: s.id,
          label: s.title,
          unitShort: s.unitShort,
          from: { period: a.period, value: a.value as number },
          to: { period: b.period, value: b.value as number },
        }];
      });
      return (
        <figure className="m-0 rounded-lg border bg-[var(--surface-1)] p-4">
          <figcaption className="mb-3 text-[13px] font-medium">
            First reading against latest, all on one scale
          </figcaption>
          <SlopeChart rows={rows} />
          <p className="mt-2 text-[11.5px] leading-relaxed text-[color:var(--text-muted)]">
            Two dates only. The path between them is not drawn and was not straight — a sector
            that fell and recovered reads here as flat.
          </p>
        </figure>
      );
    }

    case "scatter": {
      const scatter: ScatterSeries[] = series
        .filter((s) => (s.peers?.length ?? 0) >= 4)
        .map((s) => ({
          id: s.id,
          label: s.title,
          unitShort: s.unitShort,
          peers: (s.peers ?? []).map((p) => ({
            country: p.country, iso3: p.iso3, value: p.value, period: p.period,
          })),
        }));
      return (
        <figure className="m-0 rounded-lg border bg-[var(--surface-1)] p-4">
          <PeerScatter series={scatter} />
        </figure>
      );
    }

    case "lollipop": {
      const latest = series.flatMap((s) => {
        const pts = definedPoints(s);
        const last = pts[pts.length - 1];
        return last ? [{ s, last }] : [];
      }).sort((a, b) => (b.last.value as number) - (a.last.value as number));
      return (
        <figure className="m-0 rounded-lg border bg-[var(--surface-1)] p-4">
          <figcaption className="mb-1 text-[13px] font-medium">
            Latest reading, ranked
          </figcaption>
          <p className="mono mb-3 text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
            mixed units · each row states its own
          </p>
          <ChartCanvas
            kind="lollipop"
            height={Math.max(220, latest.length * 30)}
            series={[{
              id: "state-revenue",
              label: "Latest reading",
              unitShort: "%",
              data: latest.map(({ s, last }) => ({
                period: shortLabel(s.title),
                value: last.value as number,
              })),
            }]}
          />
        </figure>
      );
    }

    case "dumbbell": {
      const pairs = series.flatMap((s) => {
        const pts = definedPoints(s);
        const a = pts[0], b = pts[pts.length - 1];
        return a && b && a.period !== b.period && (a.value as number) !== 0
          ? [{ s, a, b, index: ((b.value as number) / (a.value as number)) * 100 }]
          : [];
      });
      /*
       * Indexing every row to 100 at its first reading makes fourteen
       * different units comparable, and it is still not enough on its own:
       * reserves rose twelvefold while the rest moved between a fifth and
       * fivefold, so one row set the axis and squashed the other thirteen to a
       * dot. Rows past a 6x move come out of the chart and are stated in
       * words underneath with their real numbers, which carries a twelvefold
       * rise better than a bar running off the edge would.
       */
      const CAP = 600;
      const inChart = pairs.filter((p) => p.index <= CAP);
      const outliers = pairs.filter((p) => p.index > CAP);
      return (
        <figure className="m-0 rounded-lg border bg-[var(--surface-1)] p-4">
          <figcaption className="mb-1 text-[13px] font-medium">
            First reading and latest, on one row each
          </figcaption>
          <p className="mono mb-3 text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
            each row indexed to 100 at its own first reading · the connector is the change
          </p>
          <ChartCanvas
            kind="dumbbell"
            height={Math.max(260, inChart.length * 26)}
            unitOverride="= 100 at first reading"
            series={[
              {
                id: "first",
                label: "First reading",
                unitShort: "",
                data: inChart.map(({ s }) => ({ period: shortLabel(s.title), value: 100 })),
              },
              {
                id: "latest",
                label: "Latest",
                unitShort: "",
                data: inChart.map(({ s, index }) => ({
                  period: shortLabel(s.title), value: Math.round(index),
                })),
              },
            ]}
          />
          {outliers.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <p className="eyebrow mb-2">Off the scale, in words</p>
              <ul className="flex flex-col gap-1.5">
                {outliers.map(({ s, a, b, index }) => (
                  <li key={s.id} className="text-[12.5px] leading-relaxed text-[color:var(--text-secondary)]">
                    <span className="font-medium text-[color:var(--text-primary)]">{s.title}</span>{" "}
                    <span className="mono text-[11.5px]">
                      {fmtBig(a.value as number)} ({a.period}) → {fmtBig(b.value as number)} ({b.period})
                    </span>{" "}
                    · {(index / 100).toFixed(1)}×, too far to share the axis above.
                  </li>
                ))}
              </ul>
            </div>
          )}
        </figure>
      );
    }
  }
}

/** Compact enough for a sentence, exact enough to check. */
function fmtBig(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(2)} trillion`;
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)} billion`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)} million`;
  return v.toLocaleString("en-IN", { maximumFractionDigits: 1 });
}

export default function GlobalPage() {
  const loaded: Loaded[] = CLUSTERS.map((cluster) => ({
    cluster,
    series: cluster.ids.map((id) => getSeries(id)).filter((s): s is Series => s !== undefined),
  })).filter((l) => l.series.length > 0);

  const found = loaded.reduce((n, l) => n + l.series.length, 0);
  const years = loaded
    .flatMap((l) => l.series.flatMap((s) => definedPoints(s).map((p) =>
      Number(p.period.match(/(19|20)\d{2}/)?.[0] ?? NaN))))
    .filter(Number.isFinite);
  const observations = loaded.reduce(
    (n, l) => n + l.series.reduce((m, s) => m + definedPoints(s).length, 0), 0);

  return (
    <div>
      <header className="pt-6 sm:pt-10">
        <p className="eyebrow">Global economy · {found} indicators · {CLUSTERS.length} clusters</p>
        <h1 className="display mt-4 max-w-[18ch] text-[40px] leading-[1.04] sm:text-[58px]">
          India in the world economy
        </h1>
        <p className="mt-6 max-w-[56ch] text-[14px] leading-[1.7] text-[color:var(--text-secondary)]">
          A hundred indicators, grouped into ten questions, each drawn in the form its question
          calls for. Scale is a bar because it is a comparison across countries. The climb is a
          line because it is a shape over time. The export basket is a stacked area because it is
          parts of a whole. Nothing here is drawn a particular way for variety — where two
          clusters would honestly take the same form, they are one cluster.
        </p>

        <dl className="mt-8 grid max-w-[46rem] grid-cols-2 gap-px overflow-hidden rounded-md border bg-[var(--hairline)] sm:grid-cols-4">
          {[
            { k: "Indicators", v: String(found) },
            { k: "Observations", v: observations.toLocaleString("en-IN") },
            { k: "Chart forms", v: String(new Set(CLUSTERS.map((c) => c.form)).size) },
            { k: "Span", v: years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "—" },
          ].map((c) => (
            <div key={c.k} className="bg-[var(--surface-1)] px-4 py-3.5">
              <dt className="eyebrow">{c.k}</dt>
              <dd className="mono mt-1.5 text-[17px] leading-none tracking-tight">{c.v}</dd>
            </div>
          ))}
        </dl>

        {/* The constraint, stated once and near the top rather than per chart. */}
        <div className="mt-8 max-w-[62ch] border-l-2 border-[color:var(--series-2)] pl-4">
          <p className="text-[13px] leading-[1.65] text-[color:var(--text-secondary)]">
            <strong className="font-semibold text-[color:var(--text-primary)]">
              What this catalogue can and cannot do.
            </strong>{" "}
            It holds a full 2001-present run for India on every one of these, and for {COMPARATORS}{" "}
            only the latest reading. So each chart is either India over time or all six at one
            moment — never five countries over time. Peer readings are also not all from the same
            year, because countries report when they report, and every mark names its own year on
            hover.
          </p>
        </div>
      </header>

      {/* ── Contents. The clusters are a sequence, so they are numbered. ── */}
      <nav className="mt-12 border-t pt-8">
        <p className="eyebrow mb-4">The ten questions</p>
        <ol className="grid gap-px overflow-hidden rounded-md border bg-[var(--hairline)] sm:grid-cols-2">
          {loaded.map(({ cluster, series }, i) => (
            <li key={cluster.id}>
              <a
                href={`#${cluster.id}`}
                className="flex h-full gap-3 bg-[var(--surface-1)] p-4 transition-colors hover:bg-[var(--surface-2)]"
              >
                <span className="mono shrink-0 text-[11px] text-[color:var(--text-muted)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-medium">{cluster.title}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-[color:var(--text-secondary)]">
                    {cluster.question}
                  </span>
                  <span className="eyebrow mt-1.5 block">
                    {series.length} series · {cluster.form.replace("-", " ")}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {loaded.map(({ cluster, series }, i) => (
        <section key={cluster.id} id={cluster.id} className="mt-16 scroll-mt-16 border-t pt-10">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="mono text-[12px] text-[color:var(--text-muted)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h2 className="display text-[27px] leading-tight sm:text-[32px]">{cluster.title}</h2>
          </div>
          <p className="mt-2 max-w-[56ch] text-[14px] leading-[1.65]">{cluster.question}</p>
          <p className="mt-2 max-w-[62ch] text-[12.5px] leading-[1.6] text-[color:var(--text-muted)]">
            <span className="eyebrow">Why this form</span> — {cluster.why}
          </p>

          <div className="mt-7">
            <ClusterChart cluster={cluster} series={series} />
          </div>

          {/* Every series in the cluster, named, so nothing is only in a chart. */}
          <details className="mt-5 rounded-md border bg-[var(--surface-1)]">
            <summary className="cursor-pointer px-4 py-2.5 text-[12.5px] text-[color:var(--text-secondary)]">
              The {series.length} series in this cluster
            </summary>
            <ul className="border-t px-4 py-3 text-[12px] leading-relaxed">
              {series.map((s) => (
                <li key={s.id} className="flex flex-wrap justify-between gap-x-4 border-b py-1.5 last:border-b-0">
                  <span>{s.title}</span>
                  <span className="mono text-[11px] text-[color:var(--text-muted)]">
                    {s.unitShort} · {definedPoints(s).length} readings
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      ))}

      <section className="mt-16 border-t pt-10">
        <h2 className="display text-[27px] leading-tight sm:text-[32px]">Where these come from</h2>
        <p className="mt-3 max-w-[58ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
          All {found} are World Bank development indicators, ingested in full with their source
          notes and listed on the{" "}
          <Link href="/sources" className="link-underline">sources page</Link>. The same catalogue
          backs the{" "}
          <Link href="/everyday" className="link-underline">hundred legible indicators</Link>, which
          asks the opposite question — what can be explained to someone on a train — from the same
          690 series. Where a figure here disagrees with a headline, the{" "}
          <Link href="/methodology" className="link-underline">method page</Link> says how it was
          reconciled.
        </p>
      </section>
    </div>
  );
}
