import Link from "next/link";
import { loadPillars, loadSchemes, cumulativeByYear } from "@/lib/pillars";
import LiteracyMap from "@/components/map/LiteracyMap";
import ChartCanvas from "@/components/charts/ChartCanvas";
import StatRow, { type Stat } from "@/components/ui/StatRow";

/**
 * The growth story, in the four places it can actually be measured.
 *
 * Each section leads with what its number is *not*, because on this subject
 * the gap between a figure and the claim it is used for is usually the whole
 * argument. Literacy is a 2011 census figure and cannot speak to the decade
 * since. A list of defence firms is a list, not a registry. UPI volume is
 * transactions, not people. Satellite launches are launches.
 */

export const metadata = {
  title: "The growth story, measured",
  description:
    "Digital payments, literacy, the space programme and the defence industrial base — four things about Indian growth that can be counted, with what each number cannot say.",
};

const fmtBn = (mn: number): string =>
  mn >= 1000 ? `${(mn / 1000).toFixed(1)} bn` : `${Math.round(mn)} mn`;

export default function GrowthPage() {
  const p = loadPillars();
  const schemes = loadSchemes();

  // Plotted in billions rather than the millions the source uses. At this
  // scale a millions axis reads "208.8k", which is 208.8 thousand million and
  // is nobody's idea of a number — and it would disagree with the sentence
  // above the chart.
  const upiSeries = p.upiVolumeMn.length > 0 ? [{
    id: "upi-volume", label: "UPI transactions", unitShort: "bn",
    data: p.upiVolumeMn.map((r) => ({ period: String(r.year), value: r.value / 1000 })),
  }] : [];

  const satSeries = p.satellitesByYear.length > 0 ? [{
    id: "launches", label: "Indian satellites launched", unitShort: "",
    data: p.satellitesByYear.filter((r) => r.year >= 1975)
      .map((r) => ({ period: String(r.year), value: r.value })),
  }] : [];

  const cumulative = cumulativeByYear(p.defenceCompanies, 1950);
  const defSeries = cumulative.length > 0 ? [{
    id: "defence-firms", label: "Defence firms, cumulative", unitShort: "",
    data: cumulative.filter((r) => r.year >= 1990)
      .map((r) => ({ period: String(r.year), value: r.value })),
  }] : [];

  const since2014 = p.defenceCompanies.filter((c) => c.founded !== null && c.founded >= 2014);
  const upiLatest = p.upiVolumeMn[p.upiVolumeMn.length - 1];
  const upiFirst = p.upiVolumeMn[0];

  const latestCensus = p.censusYears[p.censusYears.length - 1] ?? "";
  const litValues = p.literacyByState
    .map((r) => r.byCensus[latestCensus])
    .filter((v): v is number => v !== undefined);
  const schemeAccounts = schemes.rows.reduce((s, r) => s + r.totalAccounts, 0);

  /**
   * Each tile carries the number and the thing it is most often used to claim
   * but cannot. A figure without its qualification is the format this site
   * exists to avoid.
   */
  const headline: Stat[] = [
    ...(upiLatest ? [{
      value: `${fmtBn(upiLatest.value)}`,
      label: "UPI transactions",
      meta: `in ${upiLatest.year}`,
      caveat: "Transactions, not people. One person paying twice is two.",
    }] : []),
    ...(litValues.length > 0 ? [{
      value: `${Math.min(...litValues).toFixed(0)}–${Math.max(...litValues).toFixed(0)}%`,
      label: "Literacy, state spread",
      meta: `census ${latestCensus}`,
      caveat: "The 2021 census did not happen, so this is fifteen years old.",
    }] : []),
    ...(p.satellitesByYear.length > 0 ? [{
      value: String(p.satellitesByYear.reduce((s, r) => s + r.value, 0)),
      label: "Satellites launched",
      meta: `since ${p.satellitesByYear[0]?.year}`,
      caveat: "A count of launches. It says nothing about what any of them do.",
    }] : []),
    ...(schemes.present ? [{
      value: `${(schemeAccounts / 1e7).toFixed(1)} cr`,
      label: "Jan Dhan accounts",
      meta: schemes.asOf ? `as on ${schemes.asOf}` : undefined,
      caveat: "Accounts opened, not people served. A dormant one counts the same.",
    }] : [{
      value: `${since2014.length}`,
      label: "Defence firms since 2014",
      caveat: "From a list of notable firms, not a registry. Treat it as a floor.",
    }]),
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-10 border-b border-gridline pb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">Growth</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-ink">
          The growth story, in the four places it can be counted
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          Digital payments, literacy, the space programme and the defence industrial base. Each
          section says what its number is, and then what it is not — on this subject the gap
          between a figure and the claim it gets used for is usually the whole argument.
        </p>
      </header>

      {p.present && (
        <section className="mb-12">
          <StatRow stats={headline} />
        </section>
      )}

      {!p.present ? (
        <p className="rounded-lg border border-gridline bg-surface-2 p-5 text-sm text-ink-2">
          The pillar data has not been ingested yet. The connector runs in CI and commits what it
          reads; this page fills in on the next run.
        </p>
      ) : (
        <>
          {/* ── Tech infrastructure ─────────────────────────────────── */}
          <section className="mb-14">
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-xl font-semibold tracking-tight text-ink">Digital infrastructure</h2>
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">UPI, 2016 onward</p>
            </div>
            {upiLatest && upiFirst && (
              <p className="mb-4 max-w-3xl text-sm leading-relaxed text-ink-2">
                UPI carried <strong className="text-ink">{fmtBn(upiFirst.value)}</strong> transactions
                in {upiFirst.year} and{" "}
                <strong className="text-ink">{fmtBn(upiLatest.value)}</strong> in {upiLatest.year}.
                That is the clearest single series anyone publishes about Indian digital
                infrastructure, and it is a count of <em>transactions</em> — not of people, not of
                rupees, and not of anyone who was brought into the banking system by it.
              </p>
            )}
            {upiSeries.length > 0 && (
              <div className="rounded-lg border border-gridline bg-surface-1 p-4">
                <ChartCanvas kind="line" series={upiSeries} height={260} />
              </div>
            )}
          </section>

          {/* ── Education ───────────────────────────────────────────── */}
          <section className="mb-14">
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-xl font-semibold tracking-tight text-ink">Literacy</h2>
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">
                Census, {p.censusYears[0]}–{p.censusYears[p.censusYears.length - 1]}
              </p>
            </div>
            <div className="mb-4 rounded-lg border border-gridline bg-surface-2 p-4">
              <p className="max-w-3xl text-sm leading-relaxed text-ink-2">
                <strong className="text-ink">This map is of 2011, and cannot be of 2014 onward.</strong>{" "}
                The last completed census was 2011 and the 2021 round did not happen, so the most
                recent literacy figure India has is fifteen years old. Putting it under a heading
                about the last decade would be a claim about the data, not about the country.
                What it can show is sixty years of change, which is a longer and more interesting
                story than a decade anyway.
              </p>
            </div>
            <div className="rounded-lg border border-gridline bg-surface-1 p-4">
              <LiteracyMap rows={p.literacyByState} censusYears={p.censusYears} />
            </div>
          </section>

          {/* ── Space ───────────────────────────────────────────────── */}
          <section className="mb-14">
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-xl font-semibold tracking-tight text-ink">The space programme</h2>
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">
                Satellites launched per year, 1975 onward
              </p>
            </div>
            <p className="mb-4 max-w-3xl text-sm leading-relaxed text-ink-2">
              <strong className="text-ink">
                {p.satellitesByYear.reduce((s, r) => s + r.value, 0)}
              </strong>{" "}
              Indian satellites across {p.satellitesByYear.length} years with a launch in them.
              Cadence is the one number about a space programme that cannot be spun — a launch
              either happened or it did not. It says nothing about what any of them do, and a year
              with one heavy mission can beat a year with four small ones on every measure except
              this one.
            </p>
            {satSeries.length > 0 && (
              <div className="rounded-lg border border-gridline bg-surface-1 p-4">
                <ChartCanvas kind="column" series={satSeries} height={240} />
              </div>
            )}
          </section>

          {/* ── Defence industry ────────────────────────────────────── */}
          <section className="mb-14">
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-xl font-semibold tracking-tight text-ink">
                The defence industrial base
              </h2>
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">
                Firms by founding year
              </p>
            </div>
            <p className="mb-4 max-w-3xl text-sm leading-relaxed text-ink-2">
              Of <strong className="text-ink">{p.defenceCompanies.length}</strong> firms on the
              record, <strong className="text-ink">{since2014.length}</strong> were founded in 2014
              or later — companies that did not exist before the policy did. This is a list of
              firms someone thought notable enough to write down, not a registry, so treat the
              count as a floor. The startup registry itself could not be read: Startup India
              publishes no statewise figures to a fetch and DPIIT&rsquo;s site returns a shell, so
              the number of recognised startups is not on this page rather than being estimated
              onto it.
            </p>
            {defSeries.length > 0 && (
              <div className="rounded-lg border border-gridline bg-surface-1 p-4">
                <ChartCanvas kind="line" series={defSeries} height={220} />
              </div>
            )}
            {since2014.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-muted">
                  Founded 2014 or later
                </p>
                <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {since2014.sort((a, b) => (b.founded ?? 0) - (a.founded ?? 0)).map((c) => (
                    <li key={c.name}
                      className="rounded border border-gridline bg-surface-1 px-3 py-2">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-sm text-ink">{c.name}</span>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-ink-muted">
                          {c.founded}
                        </span>
                      </span>
                      {c.specialisation && (
                        <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
                          {c.specialisation}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* ── Welfare reach ───────────────────────────────────────── */}
          <section className="mb-14">
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-xl font-semibold tracking-tight text-ink">Scheme reach</h2>
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">
                Jan Dhan{schemes.asOf ? `, as on ${schemes.asOf}` : ""}
              </p>
            </div>
            {schemes.present ? (
              <>
                <p className="mb-4 max-w-3xl text-sm leading-relaxed text-ink-2">
                  <strong className="text-ink">
                    {(schemes.rows.reduce((s, r) => s + r.totalAccounts, 0) / 1e7).toFixed(1)} crore
                  </strong>{" "}
                  accounts across {schemes.rows.length} states and union territories. An account
                  opened is not a person served: one household can hold several, and a dormant
                  account counts the same as a working one. The deposit figure is the corrective —
                  accounts with money moving through them are doing something that accounts merely
                  opened are not.
                </p>
                <div className="overflow-x-auto rounded-lg border border-gridline bg-surface-1">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gridline bg-surface-2">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-ink">State</th>
                        <th className="px-3 py-2 text-right font-medium text-ink">Accounts</th>
                        <th className="px-3 py-2 text-right font-medium text-ink">Deposits</th>
                        <th className="px-3 py-2 text-right font-medium text-ink">Per account</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schemes.rows.slice().sort((a, b) => b.totalAccounts - a.totalAccounts)
                        .slice(0, 15).map((r) => (
                        <tr key={r.state} className="border-b border-gridline last:border-0">
                          <td className="px-3 py-1.5 text-ink-2">{r.state}</td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums text-ink">
                            {(r.totalAccounts / 1e7).toFixed(2)} cr
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums text-ink-2">
                            {r.croreDeposits === null ? "—" : `₹${Math.round(r.croreDeposits).toLocaleString("en-IN")} cr`}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums text-ink-2">
                            {r.croreDeposits === null ? "—"
                              : `₹${Math.round((r.croreDeposits * 1e7) / r.totalAccounts).toLocaleString("en-IN")}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="rounded-lg border border-gridline bg-surface-2 p-4 text-sm text-ink-2">
                Jan Dhan is the one scheme portal of eleven that answers a fetch with a statewise
                table; its ingest has not landed yet. MGNREGA, PM-JAY and PMAY-Gramin refuse the
                connection outright, and Ujjwala, eShram and Jal Jeevan return pages that name
                states without putting them in a readable table.
              </p>
            )}
          </section>
        </>
      )}

      <footer className="mt-10 border-t border-gridline pt-4 text-xs text-ink-muted">
        Literacy from the decennial census; firms, satellites and UPI from the public record; Jan
        Dhan from the scheme portal. ·{" "}
        <Link href="/methodology" className="underline">Method</Link> ·{" "}
        <Link href="/sources" className="underline">Sources</Link>
      </footer>
    </main>
  );
}
