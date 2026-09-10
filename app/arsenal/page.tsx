import Link from "next/link";
import {
  loadArsenal, latestByCountry, seriesFor, systemsByCountry, type EventGroup,
} from "@/lib/arsenal";
import ChartCanvas from "@/components/charts/ChartCanvas";
import SystemCatalogue from "@/components/arsenal/SystemCatalogue";

/**
 * The arsenal tracker: what nations field, and what they have agreed to buy.
 *
 * Three layers, and the page keeps them visibly separate because they carry
 * very different weight. The spine is SIPRI through Our World in Data — annual,
 * audited, and the only figures here a reader should quote without checking.
 * The catalogue is open reference lists, which are good at *which* systems a
 * country fields and silent on how many. The ledger is this month's news, read
 * by an agent that grades each item by how well corroborated it is, and the
 * grade is printed on every row rather than being a filter applied behind the
 * reader's back.
 *
 * The one thing this page must never do is let those three blur into each
 * other, because a single-outlet headline set beside a SIPRI series looks like
 * it has the same standing and does not.
 */

export const metadata = {
  title: "The arsenal tracker",
  description:
    "Missiles by nation and military procurement across countries: SIPRI spending and warhead data, an open catalogue of fielded systems, and a standing agent that reads seven defence publishers and grades each deal by corroboration.",
};

const VERDICT_TONE: Record<EventGroup["verdict"], { colour: string; short: string }> = {
  "from a primary source": { colour: "var(--status-good)", short: "primary" },
  "corroborated by independent outlets": { colour: "var(--series-1)", short: "corroborated" },
  "a single report, uncorroborated": { colour: "var(--text-muted)", short: "single report" },
  "outlets disagree on the value": { colour: "var(--status-critical)", short: "disputed" },
};

function fmtMoney(v: { amount: number; currency: string; asWritten: string }): string {
  return v.asWritten;
}

function fmtBig(n: number, unit: string): string {
  if (/US\$/i.test(unit)) {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(0)}bn`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}mn`;
    return `$${n.toLocaleString("en")}`;
  }
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}mn`;
  if (n >= 1000) return n.toLocaleString("en", { maximumFractionDigits: 0 });
  return n.toLocaleString("en", { maximumFractionDigits: 1 });
}

export default function ArsenalPage() {
  const a = loadArsenal();
  const catalogue = systemsByCountry(a.gazetteer);

  const milexSpec = a.spineSpecs.find((s) => s.id === "milex");
  const milex = a.spine["milex"] ?? [];
  const topSpenders = latestByCountry(milex).slice(0, 12);
  const milexYear = topSpenders[0]?.year;

  const warheads = latestByCountry(a.spine["warheads"] ?? []);
  const warheadYear = warheads[0]?.year;

  const personnel = latestByCountry(a.spine["personnel"] ?? []).slice(0, 12);

  // India, China, the United States and Russia over time — the four this site's
  // readers compare, and the four the categorical order can carry without
  // generating a fifth hue.
  const trendCountries = ["IND", "CHN", "USA", "RUS"] as const;
  const milexTrend = trendCountries
    .map((iso) => {
      const rows = seriesFor(milex, iso).filter((r) => r.year >= 1995);
      return rows.length > 0
        ? {
          id: iso,
          label: rows[0]!.name,
          unitShort: "US$",
          data: rows.map((r) => ({ period: String(r.year), value: r.value })),
        }
        : null;
    })
    .filter((s) => s !== null);

  const feedsOk = a.feeds.filter((f) => f.ok);
  const kinds = a.events.reduce<Record<string, number>>((acc, e) => {
    acc[e.kind] = (acc[e.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <header className="pt-6 sm:pt-10">
        <p className="eyebrow">Arsenal · multi-nation · agent-tracked</p>
        <h1 className="display mt-4 max-w-[16ch] text-[40px] leading-[1.04] sm:text-[58px]">
          What nations field, and what they have agreed to buy
        </h1>
        <p className="mt-6 max-w-[58ch] text-[14px] leading-[1.7] text-[color:var(--text-secondary)]">
          Three layers, kept apart on purpose. SIPRI&rsquo;s spending and warhead figures are the
          only numbers here you should quote without checking. The catalogue of{" "}
          {a.gazetteer.length.toLocaleString("en")} systems is rebuilt from open reference lists
          every run, and it says which systems a country fields, never how many. The deal ledger
          is this month&rsquo;s news, read by an agent that grades every item by how well
          corroborated it is — and prints the grade on the row rather than filtering behind your
          back.
        </p>

        <dl className="mt-8 grid max-w-[52rem] grid-cols-2 gap-px overflow-hidden rounded-md border bg-[var(--hairline)] sm:grid-cols-4">
          {[
            { k: "Systems catalogued", v: a.gazetteer.length.toLocaleString("en") },
            { k: "Nations", v: String(catalogue.length) },
            { k: "Deals tracked", v: String(a.groups.length) },
            { k: "Publishers read", v: `${feedsOk.length} of ${a.feeds.length}` },
          ].map((c) => (
            <div key={c.k} className="bg-[var(--surface-1)] px-4 py-3.5">
              <dt className="eyebrow">{c.k}</dt>
              <dd className="mono mt-1.5 text-[18px] leading-none tracking-tight">{c.v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 max-w-[64ch] border-l-2 border-[color:var(--series-2)] pl-4">
          <p className="text-[13px] leading-[1.65] text-[color:var(--text-secondary)]">
            <strong className="font-semibold text-[color:var(--text-primary)]">
              What is missing, and why.
            </strong>{" "}
            {a.gap}
          </p>
          <p className="mt-2.5 text-[13px] leading-[1.65] text-[color:var(--text-secondary)]">
            <strong className="font-semibold text-[color:var(--text-primary)]">
              This is not an order of battle.
            </strong>{" "}
            {a.note}
          </p>
        </div>
      </header>

      {/* ── Layer one ─────────────────────────────────────────────────── */}
      <section className="mt-16 border-t pt-10">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="mono text-[12px] text-[color:var(--text-muted)]">01</span>
          <h2 className="display text-[27px] leading-tight sm:text-[32px]">What nations spend</h2>
        </div>
        <p className="mt-2 max-w-[56ch] text-[13.5px] leading-[1.65] text-[color:var(--text-secondary)]">
          SIPRI&rsquo;s military expenditure series, {milex.length.toLocaleString("en")} country-years
          across {new Set(milex.map((r) => r.iso3)).size} countries. The audited floor everything
          else on this page sits on.
        </p>

        <div className="mt-7 grid gap-6 lg:grid-cols-2">
          <figure className="m-0 min-w-0 rounded-lg border bg-[var(--surface-1)] p-4">
            <figcaption className="mb-1 text-[13px] font-medium">
              The twelve largest spenders
            </figcaption>
            <p className="mono mb-2 text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
              {milexSpec?.unit ?? "constant US$"} · {milexYear}
            </p>
            <ChartCanvas
              kind="bar"
              height={330}
              series={[{
                id: "milex", label: "Military spending", unitShort: "US$",
                data: topSpenders.map((r) => ({ period: r.name, value: r.value })),
              }]}
            />
          </figure>

          <figure className="m-0 min-w-0 rounded-lg border bg-[var(--surface-1)] p-4">
            <figcaption className="mb-1 text-[13px] font-medium">
              Four militaries since 1995
            </figcaption>
            <p className="mono mb-2 text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
              {milexSpec?.unit ?? "constant US$"} · annual
            </p>
            <ChartCanvas kind="line" height={330} series={milexTrend} />
          </figure>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <figure className="m-0 min-w-0 rounded-lg border bg-[var(--surface-1)] p-4">
            <figcaption className="mb-1 text-[13px] font-medium">
              Nuclear warheads, every state that holds them
            </figcaption>
            <p className="mono mb-2 text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
              warheads · {warheadYear} · federation of american scientists
            </p>
            <ChartCanvas
              kind="bar"
              height={Math.max(220, warheads.length * 26)}
              series={[{
                id: "warheads", label: "Warheads", unitShort: "",
                data: warheads.map((r) => ({ period: r.name, value: r.value })),
              }]}
            />
          </figure>

          <figure className="m-0 min-w-0 rounded-lg border bg-[var(--surface-1)] p-4">
            <figcaption className="mb-1 text-[13px] font-medium">
              The twelve largest militaries by headcount
            </figcaption>
            <p className="mono mb-2 text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
              personnel · latest reading per country
            </p>
            <ChartCanvas
              kind="bar"
              height={330}
              series={[{
                id: "personnel", label: "Armed forces personnel", unitShort: "",
                data: personnel.map((r) => ({ period: r.name, value: r.value })),
              }]}
            />
          </figure>
        </div>
      </section>

      {/* ── Layer two ─────────────────────────────────────────────────── */}
      <section className="mt-16 border-t pt-10">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="mono text-[12px] text-[color:var(--text-muted)]">02</span>
          <h2 className="display text-[27px] leading-tight sm:text-[32px]">
            What nations field
          </h2>
        </div>
        <p className="mt-2 max-w-[58ch] text-[13.5px] leading-[1.65] text-[color:var(--text-secondary)]">
          {a.gazetteer.length.toLocaleString("en")} systems across {catalogue.length} nations,
          rebuilt from open reference lists on every run — so a system enters this catalogue the
          week the public lists do, rather than when somebody remembers to type it. It carries
          which systems a country is reported to field. It carries no counts, because nobody
          publishes them, and a blank column invites a reader to fill it in.
        </p>
        <div className="mt-7">
          <SystemCatalogue groups={catalogue} />
        </div>
      </section>

      {/* ── Layer three ───────────────────────────────────────────────── */}
      <section className="mt-16 border-t pt-10">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="mono text-[12px] text-[color:var(--text-muted)]">03</span>
          <h2 className="display text-[27px] leading-tight sm:text-[32px]">
            What nations have agreed to buy
          </h2>
        </div>
        <p className="mt-2 max-w-[58ch] text-[13.5px] leading-[1.65] text-[color:var(--text-secondary)]">
          The agent reads {feedsOk.length} publishers twice a day, extracts the country, the system
          and the value where a headline carries one, links the reports that describe the same
          event, and grades the result. It refuses more than it keeps: an item naming neither a
          country nor a system is dropped, a headline carrying two different currency figures
          yields no value at all, and arms-control diplomacy is not procurement.
        </p>

        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
          {Object.entries(VERDICT_TONE).map(([verdict, tone]) => (
            <span key={verdict} className="flex items-center gap-1.5 text-[11.5px] text-[color:var(--text-secondary)]">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: tone.colour }} />
              {verdict}
            </span>
          ))}
        </div>

        {a.groups.length === 0 ? (
          <p className="mt-6 rounded-md border border-dashed p-5 text-[13px] text-[color:var(--text-secondary)]">
            The agent has not placed any events yet. It runs twice a day and the ledger fills as
            the feeds carry procurement stories.
          </p>
        ) : (
          <ol className="mt-6 divide-y overflow-hidden rounded-md border">
            {a.groups.map((g) => {
              const tone = VERDICT_TONE[g.verdict];
              const lead = g.events[0]!;
              return (
                <li key={g.key} className="bg-[var(--surface-1)] p-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span
                      className="mono rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em]"
                      style={{ background: "var(--surface-2)", color: tone.colour }}
                    >
                      {g.kind}
                    </span>
                    {g.countries.map((c) => (
                      <span key={c} className="text-[13.5px] font-medium">{c}</span>
                    ))}
                    {g.value && (
                      <span className="mono text-[13px] tabular-nums">{fmtMoney(g.value)}</span>
                    )}
                    <span className="mono ml-auto text-[11px] text-[color:var(--text-muted)]">
                      {lead.date}
                    </span>
                  </div>

                  <p className="mt-1.5 text-[13.5px] leading-snug">{lead.headline}</p>

                  {g.systems.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap gap-1.5">
                      {g.systems.map((s) => (
                        <span key={s} className="rounded border px-1.5 py-0.5 text-[11px]">{s}</span>
                      ))}
                    </p>
                  )}

                  <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[11.5px] text-[color:var(--text-muted)]">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: tone.colour }} />
                    <span>{g.verdict}</span>
                    <span>·</span>
                    {g.events.map((e, i) => (
                      <span key={e.id}>
                        {e.url ? (
                          <a href={e.url} target="_blank" rel="noopener noreferrer" className="link-underline">
                            {e.outlet}
                          </a>
                        ) : e.outlet}
                        {i < g.events.length - 1 ? "," : ""}
                      </span>
                    ))}
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        <div className="mt-6 grid gap-px overflow-hidden rounded-md border bg-[var(--hairline)] sm:grid-cols-2">
          <div className="bg-[var(--surface-1)] p-4">
            <p className="eyebrow mb-2">What the agent read this run</p>
            <ul className="flex flex-col gap-1 text-[12px]">
              {a.feeds.map((f) => (
                <li key={f.outlet} className="flex justify-between gap-3">
                  <span className={f.ok ? "" : "text-[color:var(--text-muted)] line-through"}>
                    {f.outlet}
                  </span>
                  <span className="mono text-[11px] text-[color:var(--text-muted)]">
                    {f.ok ? `${f.kept} of ${f.items} placed` : "no answer"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-[var(--surface-1)] p-4">
            <p className="eyebrow mb-2">What it kept</p>
            <ul className="flex flex-col gap-1 text-[12px]">
              {Object.entries(kinds).map(([k, n]) => (
                <li key={k} className="flex justify-between gap-3">
                  <span>{k}</span>
                  <span className="mono text-[11px] text-[color:var(--text-muted)]">{n}</span>
                </li>
              ))}
              <li className="mt-1 border-t pt-1.5 text-[11.5px] leading-relaxed text-[color:var(--text-muted)]">
                Events accumulate across runs over a two-year horizon, so the ledger deepens rather
                than rolling forward — and carried records are re-checked against the current
                refusals, so a tightened rule cleans the file behind it.
              </li>
              {a.egress && (
                <li className="text-[11.5px] leading-relaxed text-[color:var(--text-muted)]">
                  {a.egress}
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-16 border-t pt-10">
        <h2 className="display text-[27px] leading-tight sm:text-[32px]">Scope, and where it stops</h2>
        <p className="mt-3 max-w-[60ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
          This tracker is a record of publicly announced procurement and publicly catalogued
          inventories — the same material SIPRI, IISS and CSIS publish for general readers. It
          carries what a country is reported to field and what it has agreed to buy. It carries
          nothing about how any system works. The DSCA publishes the best-shaped record of US
          foreign military sales anywhere and declines automated access, so no scraper was written
          against it and US sales reach this page only through the outlets that report them.
        </p>
        <p className="mt-3 max-w-[60ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
          The spending and warhead figures come from SIPRI and the Federation of American
          Scientists via Our World in Data; the catalogue from open reference lists; the ledger
          from the publishers named above. Everything is listed on the{" "}
          <Link href="/sources" className="link-underline">sources page</Link>, and India&rsquo;s own
          defence numbers are on the{" "}
          <Link href="/defence-tracker" className="link-underline">defence tracker</Link>.
        </p>
        <p className="mono mt-5 text-[11px] text-[color:var(--text-muted)]">
          Built {new Date(a.builtAt).toISOString().slice(0, 16).replace("T", " ")} UTC
        </p>
      </section>
    </div>
  );
}
