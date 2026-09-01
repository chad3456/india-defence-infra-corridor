import Link from "next/link";
import { getTradeData, getSectorViews, stageCounts, chapterName, type Product } from "@/lib/trade-data";
import { STAGES, CONFOUNDERS, RULES, HS_REVISIONS, nearRevision } from "@/lib/localisation";
import { INSTRUMENTS } from "@/lib/localisation-sectors";
import StageChip from "@/components/charts/StageChip";
import CoverageSpark from "@/components/charts/CoverageSpark";
import ProductExplorer, { type ExplorerRow } from "@/components/charts/ProductExplorer";
import { getSeries, definedPoints, getSource } from "@/lib/data";

/**
 * Made in India: import substitution, measured rather than announced.
 *
 * Deliberately a separate dashboard. The main gallery answers "what are the
 * numbers"; this one answers a single contested question — which things India
 * used to buy in and now makes — and everything on it is arranged to let that
 * question come out "no".
 *
 * The organising decision is that a product is a Harmonised System commodity
 * line, not a press release. That costs the page some famous stories, because
 * "we now make X" is often reported about things too specific for a six-digit
 * code to see. It buys the page the ability to be wrong in public, which is
 * the only thing that makes the right answers worth anything.
 */

export const metadata = {
  title: "Made in India",
  description:
    "Which products India used to import and now makes, measured from commodity-level trade data rather than announcements — including where the reversal is really assembly, and where dependence deepened.",
};

function usd(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}bn`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}m`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gridline bg-surface-2 p-4">
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs leading-snug text-ink-2">{sub}</p>}
    </div>
  );
}

/** A compact row used inside the sector panels. */
function LineRow({ p }: { p: Product }) {
  return (
    <tr className="border-b border-gridline">
      <td className="py-1.5 pr-3">
        <span className="block max-w-[15rem] truncate text-ink" title={p.name}>{p.name}</span>
        <span className="font-mono text-[10px] text-ink-muted">HS {p.code}</span>
      </td>
      <td className="py-1.5 pr-3"><StageChip stage={p.stage} small /></td>
      <td className="py-1.5 pr-2 text-right font-mono text-[11px] text-ink-2">{usd(p.closeM)}</td>
      <td className="py-1.5 pr-2 text-right font-mono text-[11px] text-ink-2">{usd(p.closeX)}</td>
      <td className="py-1.5"><CoverageSpark years={p.years} width={72} height={22} /></td>
    </tr>
  );
}

export default function MadeInIndiaPage() {
  const data = getTradeData();
  const counts = stageCounts(data.products);
  const sectors = getSectorViews(data);
  const graded = data.products.filter((p) => p.stage !== "thin");

  // GDP context. The annual series is in this project's own catalogue; the
  // quarterly print is not, and the difference is stated rather than blurred.
  const gdpGrowth = getSeries("wdi-gdp-growth");
  const gdpPoints = gdpGrowth ? definedPoints(gdpGrowth) : [];
  const lastGdpPoint = gdpPoints[gdpPoints.length - 1];
  // definedPoints only guarantees the point exists, not that its value is non-null.
  const latestGdp =
    lastGdpPoint && lastGdpPoint.value !== null
      ? { period: lastGdpPoint.period, value: lastGdpPoint.value }
      : null;

  // The quarterly figure is press-tier and cited as such: three independent
  // outlets, none of them the statistical office, because the statistical
  // office is not machine-readable here.
  const gdpQuarterSources = ["blin-gdp-q1-fy27", "mint-gdp-q1-fy27", "ndtvprofit-gdp-q1-fy27"]
    .map((id) => getSource(id))
    .filter((x): x is NonNullable<typeof x> => x !== undefined);

  const rows: ExplorerRow[] = data.products.map((p) => ({
    code: p.code,
    name: p.name,
    chapter: p.chapter,
    chapterName: chapterName(p.chapter),
    stage: p.stage,
    openM: p.openM, openX: p.openX, closeM: p.closeM, closeX: p.closeX,
    coverageShift: p.coverageShift,
    flags: p.flags,
    years: p.years,
  }));

  const firstYear = data.years[0];
  const lastYear = data.years[data.years.length - 1];
  const revisionsCrossed = HS_REVISIONS.filter(
    (r) => firstYear !== undefined && lastYear !== undefined && r > firstYear && r <= lastYear,
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-10">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">Made in India</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-ink">
          Which things did India stop importing?
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          Everyone has a story about this — safety pins we shamefully bought in, chips we now
          allegedly make. Stories are not evidence. This page asks the question the way it can
          actually be answered: for every commodity line in the tariff schedule, did India&rsquo;s
          exports gain on its imports, or not?
        </p>
      </header>

      {/* ── The growth framing, with its sourcing stated ─────────────────── */}
      <section className="mb-12">
        <h2 className="mb-3 text-lg font-semibold text-ink">The number behind the question</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Q1 FY2026-27 real GDP growth"
            value="7.8%"
            sub="Press-reported from the MoSPI quarterly release of 31 Aug 2026, against a 7.1% market expectation. Not in this site's series catalogue — see the note below."
          />
          {latestGdp && (
            <Stat
              label={`Annual GDP growth, ${latestGdp.period}`}
              value={`${latestGdp.value.toFixed(1)}%`}
              sub="World Bank national accounts. This one is a series here, with a source and a verification date."
            />
          )}
          <Stat
            label="Commodity lines graded"
            value={data.present ? graded.length.toLocaleString("en-IN") : "—"}
            sub={
              data.present
                ? `Of ${data.products.length.toLocaleString("en-IN")} with trade data. The rest are too thin to judge and are labelled as such rather than scored.`
                : "The commodity ingest has not landed yet. Showing a dash rather than a zero, because none-fetched and none-found are different facts."
            }
          />
        </div>
        {gdpQuarterSources.length > 0 && (
          <p className="mt-2 text-xs text-ink-muted">
            The 7.8% figure, reported by{" "}
            {gdpQuarterSources.map((src, i) => (
              <span key={src.id}>
                {i > 0 && (i === gdpQuarterSources.length - 1 ? " and " : ", ")}
                <a href={src.url} className="underline" rel="noopener noreferrer" target="_blank">
                  {src.publisher}
                </a>
              </span>
            ))}
            . Tier 3 — a press report of a primary claim, not the primary claim.
          </p>
        )}
        <div className="mt-4 rounded-lg border border-gridline bg-surface-2 p-4 text-sm leading-relaxed text-ink-2">
          <p>
            <strong className="text-ink">Why the headline figure carries a caveat.</strong>{" "}
            The 7.8% quarterly figure is real and widely reported, but this pipeline cannot read it
            from the primary source: MoSPI&rsquo;s site returns the same 2,621-byte JavaScript shell
            with zero data links on every path probed, so the quarterly national accounts are not
            machine-readable here. The figure above comes from the site&rsquo;s own news tracker
            rather than from a statistical release, which makes it press-tier evidence, and it is
            labelled that way rather than being promoted to a series.
          </p>
          <p className="mt-3">
            <strong className="text-ink">And a caution about the join.</strong>{" "}
            Nothing on this page demonstrates that import substitution caused that growth rate. A
            quarterly growth print and a twenty-year commodity trend are different objects on
            different clocks. What follows is about the composition of what India makes and buys —
            read it as that, not as an explanation of the quarter.
          </p>
        </div>
      </section>

      {data.present ? (
        <>
          {/* ── Distribution ───────────────────────────────────────────────── */}
          <section className="mb-12">
            <h2 className="mb-1 text-lg font-semibold text-ink">Where the lines landed</h2>
            <p className="mb-4 max-w-2xl text-sm text-ink-2">
              Each commodity line is graded by comparing three years at the start of the record
              against three at the end. Whether India is a net importer is settled first, and only
              then is the trend consulted — so a large net exporter whose ratio slipped is never
              filed under rising dependence. Within the net-importer group a line has to move a long
              way to change category: coverage must improve by {RULES.narrowingFactor}× to count as
              narrowing.
            </p>
            <div className="space-y-2">
              {STAGES.map((s) => {
                const n = counts[s.id];
                const pct = data.products.length > 0 ? (n / data.products.length) * 100 : 0;
                return (
                  <div key={s.id} className="grid grid-cols-[13rem_1fr_5rem] items-center gap-3">
                    <StageChip stage={s.id} />
                    <div className="h-4 w-full overflow-hidden rounded-sm bg-surface-2">
                      <div
                        className="h-full rounded-sm"
                        style={
                          s.id === "holding" || s.id === "thin"
                            ? { width: `${pct}%`, border: "1.5px solid var(--baseline)" }
                            : { width: `${pct}%`, background: `var(--stage-${s.id})` }
                        }
                      />
                    </div>
                    <span className="text-right font-mono text-xs tabular-nums text-ink-2">
                      {n.toLocaleString("en-IN")}
                    </span>
                  </div>
                );
              })}
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {STAGES.filter((s) => s.id !== "thin").map((s) => (
                <div key={s.id} className="rounded border border-gridline p-3">
                  <dt className="mb-1 text-sm font-medium text-ink">{s.label}</dt>
                  <dd className="text-xs leading-relaxed text-ink-2">{s.meaning}</dd>
                  <dd className="mt-1 text-xs leading-relaxed text-ink-muted">
                    <span className="uppercase tracking-wide">Would be wrong if:</span> {s.disproof}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* ── Sectors ────────────────────────────────────────────────────── */}
          <section className="mb-12">
            <h2 className="mb-1 text-lg font-semibold text-ink">The sectors people argue about</h2>
            <p className="mb-6 max-w-2xl text-sm text-ink-2">
              Finished goods on the left of each panel, the inputs they are made from on the right.
              Reading only the first column is how a country convinces itself it has localised
              something it has only assembled.
            </p>
            <div className="space-y-8">
              {sectors.map(({ sector, outputs, inputs, assembly }) => (
                <article key={sector.id} className="rounded-lg border border-gridline p-5">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold text-ink">{sector.name}</h3>
                    {assembly && (
                      <span className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-ink-2">
                        {assembly.verdict === "assembly-signature"
                          ? `Assembly signature — ${assembly.inputsDeepening} of ${assembly.inputsTotal} input lines going the other way`
                          : assembly.verdict === "integrated"
                            ? `Integrated — inputs moved with the finished good (${assembly.inputsTotal} checked)`
                            : `Mixed — ${assembly.inputsDeepening} of ${assembly.inputsTotal} input lines going the other way`}
                      </span>
                    )}
                  </div>
                  <p className="mb-1 text-sm italic text-ink-2">&ldquo;{sector.claim}&rdquo;</p>
                  <p className="mb-4 max-w-3xl text-sm leading-relaxed text-ink-2">{sector.reading}</p>

                  <div className="grid gap-6 lg:grid-cols-2">
                    {([["Finished goods", outputs, sector.outputs.length],
                       ["Inputs", inputs, sector.inputs.length]] as const).map(([title, list, declared]) => {
                      const items = list as Product[];
                      return (
                        // min-w-0 so the table's own scroller can engage: a grid
                        // item defaults to min-width:auto and would otherwise be
                        // stretched by the table instead of clipping it.
                        <div key={title as string} className="min-w-0">
                          <h4 className="mb-2 text-[11px] uppercase tracking-wide text-ink-muted">
                            {title as string}
                          </h4>
                          {items.length === 0 ? (
                            <p className="text-xs text-ink-muted">
                              {declared === 0
                                ? "None declared — this sector is listed for the other column."
                                : data.years.length === 0
                                  ? "Awaiting the ingest."
                                  : "No line in this group carries usable trade data."}
                            </p>
                          ) : (
                            // Its own scroller: a wide table must never make the page scroll.
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[27rem] border-collapse text-sm">
                                <thead>
                                  <tr className="border-b border-gridline text-left text-[10px] uppercase tracking-wide text-ink-muted">
                                    <th className="pb-1 pr-3 font-normal">Line</th>
                                    <th className="pb-1 pr-3 font-normal">Stage</th>
                                    <th className="pb-1 pr-2 text-right font-normal">Imports</th>
                                    <th className="pb-1 pr-2 text-right font-normal">Exports</th>
                                    <th className="pb-1 font-normal">X ÷ M</th>
                                  </tr>
                                </thead>
                                <tbody>{items.map((p) => <LineRow key={p.code} p={p} />)}</tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* ── The full table ─────────────────────────────────────────────── */}
          <section className="mb-12">
            <h2 className="mb-1 text-lg font-semibold text-ink">Every commodity line</h2>
            <p className="mb-4 max-w-2xl text-sm text-ink-2">
              {data.products.length.toLocaleString("en-IN")} six-digit lines with Indian trade data,
              searchable. Chapter 99 — the residual &ldquo;not specified according to kind&rdquo;
              bucket — is excluded: it is not a product, and it is big enough to sit near the top of
              the table pretending to be one. The sparkline is exports divided by imports on a log scale; the dashed rule
              is parity, where India sells as much as it buys.
            </p>
            <ProductExplorer rows={rows} />
          </section>
        </>
      ) : (
        <section className="mb-12 rounded-lg border border-gridline bg-surface-2 p-6">
          <h2 className="mb-2 text-lg font-semibold text-ink">The commodity data has not landed yet</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-ink-2">
            The ingest is resumable and runs in CI, fetching roughly 5,300 commodity lines across
            eleven years in paced batches against a public endpoint that caps every answer at 500
            rows. Until it completes, this page shows its method and its sectors and declines to
            show numbers it does not have. It will fill in as batches land.
          </p>
        </section>
      )}

      {/* ── How the chain actually gets moved ──────────────────────────── */}
      <section className="mb-12">
        <h2 className="mb-1 text-lg font-semibold text-ink">How a supply chain gets moved</h2>
        <p className="mb-4 max-w-2xl text-sm text-ink-2">
          Five instruments, working by different mechanisms. They matter here because each leaves a
          different fingerprint in the trade data — the shape of a line can tell you which lever was
          pulled, and whether it did what it was meant to.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-baseline text-left text-[11px] uppercase tracking-wide text-ink-muted">
                <th className="py-2 pr-4 font-medium">Instrument</th>
                <th className="py-2 pr-4 font-medium">How it works</th>
                <th className="py-2 pr-4 font-medium">Fingerprint in the data</th>
                <th className="py-2 font-medium">How it fails</th>
              </tr>
            </thead>
            <tbody>
              {INSTRUMENTS.map((i) => (
                <tr key={i.id} className="border-b border-gridline align-top">
                  <td className="py-3 pr-4 font-medium text-ink">{i.name}</td>
                  <td className="py-3 pr-4 text-xs leading-relaxed text-ink-2">{i.mechanism}</td>
                  <td className="py-3 pr-4 text-xs leading-relaxed text-ink-2">{i.fingerprint}</td>
                  <td className="py-3 text-xs leading-relaxed text-ink-muted">{i.failureMode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-ink-muted">
          These are instrument types, not claims about particular schemes. No scheme name, outlay or
          date appears here, because this pipeline has no machine-readable access to Indian scheme
          documentation and a figure that cannot be cited should not be printed. Nothing measured on
          this page depends on it: the commodity lines moved or they did not, whichever lever gets
          the credit — and attributing a movement to a lever is the step this page declines to take.
        </p>
      </section>

      {/* ── Method ─────────────────────────────────────────────────────────── */}
      <section className="mb-12">
        <h2 className="mb-1 text-lg font-semibold text-ink">What this cannot tell you</h2>
        <p className="mb-4 max-w-2xl text-sm text-ink-2">
          The honest ratio for this question is import dependence — imports over apparent domestic
          consumption. It is not computable, because nobody publishes domestic production at
          commodity-code level. Everything here is a trade-side proxy, and these are the four ways
          a proxy can improve while nothing real happens.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {CONFOUNDERS.map((c) => (
            <div key={c.id} className="rounded border border-gridline p-4">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-medium text-ink">{c.name}</h3>
                <span className="shrink-0 rounded-full border border-hairline px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
                  {c.detectable === "yes" ? "detected" : c.detectable === "partly" ? "partly detected" : "blind spot"}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-ink-2">{c.what}</p>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">{c.how}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-gridline bg-surface-2 p-4 text-sm leading-relaxed text-ink-2">
          <h3 className="mb-2 text-sm font-medium text-ink">The rules, in full</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              A line needs {RULES.minTradeUsd / 1e6}m dollars of trade at one end or the other to be
              graded at all. Below that a ratio is noise wearing a trend&rsquo;s clothes.
            </li>
            <li>
              Windows are {RULES.windowYears} years at each end, averaged, so a single good year
              cannot carry a line.
            </li>
            <li>
              Coverage must improve {RULES.narrowingFactor}× to be narrowing, or fall below{" "}
              {RULES.deepeningFactor}× to be deepening. Between those it is holding.
            </li>
            <li>
              A reversal built on imports collapsing while exports stood still is downgraded to
              holding, not reported as a win.
            </li>
            {data.years.length > 0 && (
              <li>
                Years sampled: {data.years.join(", ")}.
                {revisionsCrossed.length > 0 && (
                  <> This span crosses {revisionsCrossed.length} Harmonised System revision
                    {revisionsCrossed.length > 1 ? "s" : ""} ({revisionsCrossed.join(", ")}), in which
                    codes are split, merged and retired — so a line whose meaning changed can show a
                    break that looks like a structural shift.
                    {revisionsCrossed.some((r) => nearRevision(r)) && ""}
                  </>
                )}
              </li>
            )}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">
            Trade data: UN Comtrade, India as reporter, world as partner, annual, HS. Values are
            nominal US dollars and are not deflated — a line that merely kept pace with prices will
            look like growth in both directions at once, which is why every judgement here is a
            ratio between the two flows rather than a level.
          </p>
        </div>
      </section>

      <footer className="border-t border-gridline pt-6 text-sm text-ink-2">
        <p>
          Method shared with the rest of the site:{" "}
          <Link href="/methodology" className="underline">how things get graded</Link> ·{" "}
          <Link href="/evidence" className="underline">the evidence ladder</Link> ·{" "}
          <Link href="/data-sources" className="underline">every source</Link>
        </p>
      </footer>
    </main>
  );
}
