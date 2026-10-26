import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { Eyebrow } from "@/components/stories/Kit";
import { TaxTicker } from "@/components/tax/TaxTicker";
import { TaxBuys, type Pot } from "@/components/tax/TaxBuys";
import { SlabCalculator } from "@/components/tax/SlabCalculator";
import { CRORE, LAKH, derive, inr, priceInr, type TaxPublished } from "@/lib/tax";

/**
 * A visual essay: what India's personal income tax adds up to, what it would
 * buy, who pays it, where it goes, and how it compares with the United States
 * — then the common claim "I pay taxes, so…" set against those numbers. Few
 * words, every figure sourced; every count, share and per-person figure is
 * derived on the page from the published inputs and says so.
 */

export const metadata = {
  title: "What India's income tax buys · Bharat Tracker",
  description: "India's personal income tax in pictures: ₹12.41 lakh crore in FY 2025-26, counted in iPhones, missiles, Rafales, aircraft carriers, moon missions and AIIMS; who pays it, where it goes, how it compares with the United States per person, and the claim 'I pay taxes, so…' set against the numbers.",
};

const load = (): TaxPublished => JSON.parse(readFileSync(join(process.cwd(), "data", "tax", "published.json"), "utf8")) as TaxPublished;
const pct = (v: number, dp = 0) => `${(v * 100).toFixed(dp)}%`;

function Big({ v, label, sub, tone }: { v: ReactNode; label: string; sub?: ReactNode; tone?: string }) {
  return (
    <div className="story-card p-4">
      <p className="story-display text-[34px] leading-none tabular-nums sm:text-[42px]" style={{ color: tone ?? "var(--story-ink)" }}>{v}</p>
      <p className="mt-2 text-[13px] font-semibold leading-snug">{label}</p>
      {sub && <p className="mt-1 text-[11px] leading-snug" style={{ color: "var(--story-ink-3)" }}>{sub}</p>}
    </div>
  );
}

/** Horizontal bars on one scale, labelled at the end. */
function Bars({ rows, unit, max }: { rows: Array<{ label: string; value: number; tone?: string; note?: ReactNode }>; unit: (v: number) => string; max?: number }) {
  const m = max ?? Math.max(...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(7.5rem,11rem)_minmax(0,1fr)] items-center gap-3 text-[12.5px]">
          <span className="leading-tight">{r.label}{r.note && <span className="block text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{r.note}</span>}</span>
          <span className="flex items-center gap-2">
            <span className="block h-4 rounded-r-[4px]" style={{ width: `${Math.max(1, (100 * r.value) / m)}%`, background: r.tone ?? "var(--series-1)" }} />
            <span className="mono shrink-0 font-semibold tabular-nums">{unit(r.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A hundred people, coloured by how many of them did a thing. */
function Hundred({ layers }: { layers: Array<{ n: number; colour: string; label: string }> }) {
  const cells = Array.from({ length: 100 }, (_, i) => layers.find((l) => i < l.n));
  return (
    <div>
      <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[3px]" role="img" aria-label={layers.map((l) => `${l.n.toFixed(1)} in 100: ${l.label}`).join("; ")}>
        {cells.map((l, i) => (
          <svg key={i} viewBox="0 0 10 14" className="h-auto w-full" aria-hidden>
            <circle cx="5" cy="3" r="2.6" fill={l?.colour ?? "var(--story-rule)"} />
            <path d="M1 14V8.5Q1 6 5 6t4 2.5V14z" fill={l?.colour ?? "var(--story-rule)"} />
          </svg>
        ))}
      </div>
      <ul className="mt-3 space-y-1 text-[12px]">
        {layers.slice().reverse().map((l) => <li key={l.label} className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full" style={{ background: l.colour }} /><b className="tabular-nums">{l.n.toFixed(1)}</b> {l.label}</li>)}
      </ul>
    </div>
  );
}

function Section({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-16 scroll-mt-20">
      <Eyebrow>{kicker}</Eyebrow>
      <h2 className="story-display mt-2 max-w-[24ch] text-[28px] sm:text-[36px]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function IncomeTaxPage() {
  const d = load();
  const x = derive(d);
  const src = (id: string) => d.sources.find((s) => s.id === id)!;
  const Cite = ({ ids, derived }: { ids: string[]; derived?: boolean }) => (
    <p className="mt-2 text-[10.5px] leading-[1.5]" style={{ color: "var(--story-ink-3)" }}>
      {derived && <b>Derived from </b>}{ids.map((id, i) => <span key={id}>{i ? " · " : ""}<a className="underline decoration-dotted" href={src(id).url} target="_blank" rel="noopener noreferrer">{src(id).publisher}</a></span>)}
    </p>
  );
  const b = Object.fromEntries(d.budget.rows.map((r) => [r.id, r])) as Record<string, (typeof d.budget.rows)[number]>;
  const iphone = d.items.find((i) => i.id === "iphone")!;
  const items = d.items.map((it) => ({ ...it, inr: priceInr(it, d.fx.value), cite: { publisher: src(it.source).publisher, url: src(it.source).url } }));
  const pots: Pot[] = [
    { id: "year", label: "One year", rupees: x.pitRs, note: `personal income tax, ${d.pit.year}` },
    { id: "day", label: "One day", rupees: x.perDay, note: "the year's tax ÷ 365 (derived)" },
    { id: "filer", label: "Per return filed", rupees: x.perFiler, note: `the year's tax ÷ ${d.filers.at(-1)!.value} crore returns (derived)` },
    { id: "indian", label: "Per Indian", rupees: x.perIndian, note: `the year's tax ÷ ${(d.population.india.value / 10).toFixed(2)} crore people (derived)` },
  ];

  return (
    <article className="pt-6">
      <Eyebrow tone="hot">India · Public money · A visual essay</Eyebrow>
      <h1 className="story-display mt-3 max-w-[16ch] text-[38px] sm:text-[60px]">What India&apos;s income tax buys</h1>

      <section className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="story-card p-5 sm:p-7">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--story-ink-3)" }}>Personal income tax, {d.pit.year}</p>
          <p className="story-display mt-2 text-[56px] leading-none sm:text-[84px]">₹12.41<span className="ml-2 text-[0.38em]">lakh crore</span></p>
          <p className="mt-3 text-[13px]" style={{ color: "var(--story-ink-2)" }}>{inr(x.perDay)} a day · {inr(x.perSecond)} a second</p>
          <p className="mt-4 text-[12px]" style={{ color: "var(--story-ink-3)" }}>Collected since you opened this page, at that rate</p>
          <p className="story-display text-[30px]" style={{ color: "var(--s-hot)" }}><TaxTicker perSecond={x.perSecond} /></p>
          <Cite ids={[d.pit.source]} />
          <p className="text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>Includes securities transaction tax. Provisional. The ticker is the year&apos;s average rate, derived — not a live feed.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Big v={inr(Math.round(x.perIndian))} label="per Indian, per year" sub={<>≈ ${x.perIndianUsd.toFixed(0)} · derived</>} />
          <Big v={inr(Math.round(x.perFiler))} label="per return filed" sub={`${d.filers.at(-1)!.value} crore returns · derived`} />
          <Big v={`${x.pitGdp.toFixed(1)}%`} label="of India's GDP" sub={`GDP ₹${d.gdp.value} lakh crore · derived`} />
        </div>
      </section>

      <Section id="buys" kicker="01 · Counted in things" title="One year of income tax would buy…">
        <TaxBuys pots={pots} items={items} />
        <p className="mt-3 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>Counts are the sum divided by each published price — derived, and ignoring that the money is already spent on other things. Dollar prices at {d.fx.label} (<a className="underline decoration-dotted" href={src(d.fx.source).url} target="_blank" rel="noopener noreferrer">{src(d.fx.source).publisher}</a>). Packages (Rafale-M) include weapons and support, not just aircraft.</p>
      </Section>

      <Section id="who" kicker="02 · Who pays" title="Out of every 100 Indians">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="story-card p-4 sm:p-5">
            <Hundred layers={[
              { n: x.payersPer100, colour: "var(--s-hot)", label: `owed any income tax (${d.zeroLiability.year} count)` },
              { n: x.filersPer100, colour: "var(--series-1)", label: `filed a return (${d.filers.at(-1)!.year})` },
            ]} />
            <Cite ids={[d.filers.at(-1)!.source, d.zeroLiability.source, d.population.india.source]} derived />
            <p className="text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>Per 100 people of the 2025 population. The payer count is the latest published ({d.zeroLiability.year}): {d.zeroLiability.filed} crore returns, {d.zeroLiability.zero} crore with zero liability.</p>
          </div>
          <div className="grid content-start gap-3 sm:grid-cols-2">
            <Big v={pct(x.zeroShareFy23)} label="of returns owed nothing" sub={`${d.zeroLiability.zero} of ${d.zeroLiability.filed} crore, ${d.zeroLiability.year}`} tone="var(--s-hot)" />
            <Big v={`${x.payersFy23.toFixed(2)} cr`} label="people paid income tax" sub={`${d.zeroLiability.year} · derived`} />
            <Big v={`${d.bands.rows.find((r) => /^above/i.test(r.band))!.share}%`} label="of returns above ₹50 lakh" sub={<>{d.bands.year} · secondary analysis, <span style={{ color: "var(--s-hot)" }}>low confidence</span></>} />
            <Big v={(d.croreFilers.value / LAKH).toFixed(2) + " lakh"} label="people declared over ₹1 crore" sub={`${d.croreFilers.year}`} />
          </div>
        </div>
        <div className="story-card mt-4 p-4">
          <p className="text-[12px] font-semibold" style={{ color: "var(--story-ink-2)" }}>Returns by declared income, {d.bands.year}</p>
          <div className="mt-2 flex h-9 overflow-hidden rounded-md text-[11px] font-semibold text-white">
            {d.bands.rows.map((r, i) => <div key={r.band} className="flex items-center justify-center overflow-hidden whitespace-nowrap px-1" style={{ width: `${r.share}%`, background: ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--s-hot)"][i] }} title={`${r.band}: ${r.share}%`}>{r.share >= 8 ? `${r.share}%` : ""}</div>)}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">{d.bands.rows.map((r, i) => <span key={r.band} className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--s-hot)"][i] }} />{r.band} · {r.share}%</span>)}</div>
          <Cite ids={[d.bands.source, d.croreFilers.source]} />
          <p className="text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{d.bands.notes} The Income Tax Department does not publish, in a form found for this page, how much tax each band pays.</p>
        </div>
      </Section>

      <Section id="slab" kicker="03 · Your slab" title="Your tax, in seconds of government">
        <SlabCalculator slabs={d.slabs} spendPerSecond={x.spendPerSecond} perIndian={x.perIndian} iphone={iphone.price!} />
        <Cite ids={[d.slabs.source, b.spend!.source]} derived />
      </Section>

      <Section id="where" kicker="04 · Where it goes" title="Income tax ≈ the interest bill">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="story-card p-4 sm:p-5">
            <p className="text-[12px] font-semibold" style={{ color: "var(--story-ink-2)" }}>{d.budget.year}, ₹ lakh crore</p>
            <div className="mt-3">
              <Bars unit={(v) => v.toFixed(2)} rows={d.budget.rows.map((r) => ({ label: r.label, value: r.value, tone: r.id === "income-tax" ? "var(--s-hot)" : r.id === "interest" ? "var(--series-2)" : "var(--series-1)" }))} />
            </div>
            <Cite ids={[...new Set(d.budget.rows.map((r) => r.source))]} />
          </div>
          <div className="grid content-start gap-3">
            <Big v={pct(x.incomeTaxShareOfSpending)} label="of the Union's spending is paid by income tax" sub="income tax ÷ total expenditure, 2026-27 BE · derived" tone="var(--s-hot)" />
            <Big v={`${x.incomeTaxVsInterest.toFixed(2)}×`} label="the interest bill" sub={`₹${b["income-tax"]!.value} vs ₹${b.interest!.value} lakh crore · derived`} />
            <Big v={`${x.incomeTaxVsDefence.toFixed(1)}×`} label="the defence budget" sub="excluding pensions · derived" />
          </div>
        </div>
        <div className="story-card mt-4 p-4 sm:p-5">
          <p className="text-[12px] font-semibold" style={{ color: "var(--story-ink-2)" }}>Everyone who buys anything pays GST — filer or not. {d.gst.year}, ₹ lakh crore</p>
          <div className="mt-3">
            <Bars unit={(v) => v.toFixed(2)} rows={[
              { label: "GST, gross", value: d.gst.gross, tone: "var(--series-3)", note: "paid by every shopper" },
              { label: "Personal income tax", value: d.pit.value / LAKH, tone: "var(--s-hot)", note: "paid by about 2 in 100" },
            ]} />
          </div>
          <Cite ids={[d.gst.source, d.pit.source]} />
        </div>
      </Section>

      <Section id="us" kicker="05 · Against the United States" title="An American pays ~80× more income tax">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Big v={`$${Math.round(x.perAmericanUsd).toLocaleString("en-US")}`} label="US federal income tax per American" sub={`$${(d.us.pit.value / 1000).toFixed(2)} trillion ÷ ${d.population.us.value}M people, ${d.us.pit.year} · derived`} />
          <Big v={`$${x.perIndianUsd.toFixed(0)}`} label="Indian income tax per Indian" sub={`${inr(Math.round(x.perIndian))} at ₹${d.fx.value}/$ · derived`} tone="var(--s-hot)" />
          <Big v={`${d.us.pitGdp.value}%`} label="US income tax, share of GDP" sub={d.us.pitGdp.year} />
          <Big v={`${x.pitGdp.toFixed(1)}%`} label="India's, share of GDP" sub={`${d.pit.year} · derived`} tone="var(--s-hot)" />
        </div>
        <Cite ids={[d.us.pit.source, d.us.pitGdp.source, d.population.us.source, d.fx.source, d.gdp.source]} derived />

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="story-card p-4 sm:p-5">
            <p className="text-[12px] font-semibold" style={{ color: "var(--story-ink-2)" }}>All taxes, share of GDP</p>
            <div className="mt-3"><Bars unit={(v) => `${v}%`} max={50} rows={d.taxToGdp.rows.map((r) => ({ label: r.label, value: r.value, note: r.year, tone: r.label.startsWith("India") ? "var(--s-hot)" : "var(--series-1)" }))} /></div>
            <Cite ids={[...new Set(d.taxToGdp.rows.map((r) => r.source))]} />
            <p className="text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{d.taxToGdp.rows[0]!.notes}</p>
          </div>
          <div className="story-card p-4 sm:p-5">
            <p className="text-[12px] font-semibold" style={{ color: "var(--story-ink-2)" }}>Who pays US federal income tax, {d.us.whoPays.year}</p>
            <div className="mt-3"><Bars unit={(v) => `${v}%`} max={100} rows={[
              { label: "Top 1% of filers", value: d.us.whoPays.top1, tone: "var(--s-hot)" },
              { label: "Top 10%", value: d.us.whoPays.top10, tone: "var(--series-2)" },
              { label: "Bottom 50%", value: d.us.whoPays.bottom50, tone: "var(--series-1)" },
            ]} /></div>
            <Cite ids={[d.us.whoPays.source]} />
            <p className="text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{d.us.whoPays.notes} A few paying most is how progressive income tax works everywhere.</p>
          </div>
        </div>
      </Section>

      <Section id="claim" kicker="06 · The claim, against the numbers" title="“I pay taxes, so…”">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { claim: "“Taxpayers fund the country.”", fact: `Income tax pays for ${pct(x.incomeTaxShareOfSpending)} of Union spending. GST, paid by every shopper, raised ${x.gstVsPit.toFixed(1)}× as much.`, verdict: "Partly true", tone: "var(--series-2)" },
            { claim: "“We are taxed like a rich country.”", fact: `As a country, no: income tax is ${x.pitGdp.toFixed(1)}% of India's GDP and ${d.us.pitGdp.value}% of America's; per person, $${x.perIndianUsd.toFixed(0)} against $${Math.round(x.perAmericanUsd).toLocaleString("en-US")}. Each payer above ₹24 lakh taxable does face a 30% top slab.`, verdict: "False for the country", tone: "var(--s-hot)" },
            { claim: "“My income tax pays for services.”", fact: `Money is pooled, but the scale is plain: income tax (₹${b["income-tax"]!.value} lakh crore) only just covers interest on the government's debt (₹${b.interest!.value}). The year's borrowing is larger than either.`, verdict: "Weaker than it sounds", tone: "var(--s-hot)" },
            { claim: "“A tiny few carry the whole load.”", fact: `About ${x.payersPer100.toFixed(1)} in 100 Indians pay income tax — and everyone pays GST. In the US, the top 1% pay ${d.us.whoPays.top1}% of income tax.`, verdict: "True of income tax, not of tax", tone: "var(--series-2)" },
          ].map((c) => (
            <div key={c.claim} className="story-card p-4 sm:p-5" style={{ borderTop: `4px solid ${c.tone}` }}>
              <p className="text-[18px] font-bold leading-snug">{c.claim}</p>
              <p className="mt-2 text-[13.5px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>{c.fact}</p>
              <p className="mt-3 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-white" style={{ background: c.tone }}>{c.verdict}</p>
            </div>
          ))}
        </div>
        <div className="story-card mt-3 p-4 sm:p-5" style={{ borderLeft: "4px solid var(--story-ink-3)" }}>
          <p className="text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--story-ink-3)" }}>The strongest case for the complaint</p>
          <p className="mt-1.5 text-[13.5px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>The base is narrow: income tax falls on a small group, who also pay GST on everything they buy. Salaries are taxed at source. These numbers show how little income tax funds — not whether the services it does fund are good. That is measured elsewhere on this site.</p>
        </div>
        <p className="mt-3 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>Verdicts are this page&apos;s reading of the figures above; every figure in them is sourced in its section.</p>
      </Section>

      <section className="mt-16 border-t pt-6 text-[11px] leading-[1.7]" style={{ borderColor: "var(--story-rule)", color: "var(--story-ink-3)" }}>
        <p className="font-bold uppercase tracking-[0.06em]">Sources, accessed {d.accessed}</p>
        <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
          {d.sources.map((s) => <li key={s.id}><a className="underline decoration-dotted" href={s.url} target="_blank" rel="noopener noreferrer">{s.publisher}</a> — {s.title}{s.published ? ` (${s.published})` : ""}</li>)}
        </ul>
        <p className="mt-3">Mixed years are named where they meet: the payer count is {d.zeroLiability.year}, the latest published; budget figures are 2026-27 estimates; collections are {d.pit.year} provisional. Counts of things, per-person figures, shares and slab tax are computed on this page.</p>
      </section>
    </article>
  );
}
