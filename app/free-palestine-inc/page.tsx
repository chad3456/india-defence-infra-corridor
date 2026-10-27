import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { Eyebrow, Standfirst, WhatThisCannotSay } from "@/components/stories/Kit";
import { FpScrolly, type FpStep } from "@/components/fp/FpScrolly";
import { ClaimChecker } from "@/components/fp/ClaimChecker";
import { TestCards } from "@/components/fp/TestCards";
import { big, derive, type FpPublished } from "@/lib/free-palestine";

/**
 * Free Palestine, Inc.? A visual essay in the explainer register: a thesis in
 * circulation — that pro-Palestine activism abroad has become a career and a
 * product line that does not need the war to end — tested against the record.
 * Gaza's numbers, the hashtags, the merchandise, the money, the protests and
 * twenty-one specific claims, each checked and sourced. The page reports
 * where the thesis holds and where it does not, and judges no one by name.
 */

export const metadata = {
  title: "Free Palestine, Inc.? Cause, career, or both · Bharat Tracker",
  description: "A visual essay testing the claim that pro-Palestine activism has become a career and a product line: Gaza's toll and economy, #FreePalestine on Instagram and TikTok, the keffiyeh boom, the fundraising, the campus protests, the incidents abroad and in India — and 21 claims in circulation, each checked against the record.",
};

const load = (): FpPublished => JSON.parse(readFileSync(join(process.cwd(), "data", "free-palestine", "published.json"), "utf8")) as FpPublished;
const pct = (v: number, dp = 1) => `${(v * 100).toFixed(dp)}%`;
const day = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function Bars({ rows, max, fmt }: { rows: Array<{ label: ReactNode; value: number; tone: string; sub?: string }>; max?: number; fmt: (v: number) => string }) {
  const m = max ?? Math.max(...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={i} className="text-[12px]">
          <div className="flex items-baseline justify-between gap-2"><span className="font-semibold leading-tight">{r.label}</span><span className="mono shrink-0 font-bold tabular-nums">{fmt(r.value)}</span></div>
          <div className="mt-1 h-3.5 w-full overflow-hidden rounded-r" style={{ background: "var(--story-rule)" }}><div className="h-full rounded-r" style={{ width: `${Math.max(0.6, (100 * r.value) / m)}%`, background: r.tone }} /></div>
          {r.sub && <p className="mt-0.5 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{r.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

/** A field of dots, one per `per` units, coloured in runs. */
function Dots({ runs, per, cols = 40 }: { runs: Array<{ n: number; colour: string }>; per: number; cols?: number }) {
  const cells = runs.flatMap((r) => Array.from({ length: Math.round(r.n / per) }, () => r.colour));
  const rows = Math.ceil(cells.length / cols), s = 10;
  return (
    <svg viewBox={`0 0 ${cols * s} ${rows * s}`} className="h-auto w-full" aria-hidden>
      {cells.map((c, i) => <circle key={i} cx={(i % cols) * s + s / 2} cy={Math.floor(i / cols) * s + s / 2} r={s * 0.36} fill={c} />)}
    </svg>
  );
}

export default function FreePalestineIncPage() {
  const d = load();
  const x = derive(d);
  const src = (id: string) => d.sources.find((s) => s.id === id)!;
  const Cite = ({ ids }: { ids: string[] }) => (
    <p className="mt-2 text-[10.5px] leading-[1.5]" style={{ color: "var(--story-ink-3)" }}>
      {ids.map((id, i) => <span key={id}>{i ? " · " : ""}<a className="underline decoration-dotted" href={src(id).url} target="_blank" rel="noopener noreferrer">{src(id).publisher}</a></span>)}
    </p>
  );
  const L = (id: string) => d.ledger.find((r) => r.id === id)!;
  const M = (id: string) => d.money.find((r) => r.id === id)!;
  const protests = d.protest.us[0]!.value;

  const visuals: Record<string, ReactNode> = {
    ledger: (
      <div>
        <p className="text-[12px]" style={{ color: "var(--story-ink-2)" }}>One dot = 100 people killed</p>
        <div className="mt-2"><Dots per={100} runs={[{ n: L("oct7").value, colour: "var(--story-ink)" }, { n: L("dead").value, colour: "var(--s-hot)" }]} /></div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px]">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--story-ink)" }} />Israel, 7 Oct 2023 · ~{big(L("oct7").value)}</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--s-hot)" }} />Gaza, to {day(L("dead").asOf)} · {big(L("dead").value)}</span>
        </div>
        <Cite ids={[L("dead").source, L("oct7").source]} />
      </div>
    ),
    economy: (
      <div className="grid gap-4">
        <Bars fmt={(v) => `${v}`} max={100} rows={[
          { label: "Gaza GDP, 2023 = 100", value: 100 - L("gdp").value, tone: "var(--s-hot)", sub: `2024: down ${L("gdp").value}%` },
          { label: "Unemployment, %", value: L("jobless").value, tone: "var(--series-2)", sub: L("jobless").asOf },
        ]} />
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="story-display text-[26px] tabular-nums">${L("gdppc").value}</p><p className="text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>GDP per person, a year (2024)</p></div>
          <div><p className="story-display text-[26px] tabular-nums">{L("pop").value}M</p><p className="text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>people left, −10.6%</p></div>
          <div><p className="story-display text-[26px] tabular-nums">${L("rebuild").value}bn</p><p className="text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>to rebuild</p></div>
        </div>
        <Cite ids={[L("gdp").source, L("jobless").source, L("pop").source, L("rebuild").source]} />
      </div>
    ),
    attention: (
      <div>
        <Bars fmt={big} rows={[
          ...d.attention.platforms.flatMap((p) => [
            { label: <>{p.platform} · {p.proTag}</>, value: p.pro, tone: "var(--s-hot)" },
            { label: <>{p.platform} · {p.conTag}</>, value: p.con, tone: "var(--series-1)" },
          ]),
          { label: <>US TikTok views · {d.attention.usTiktok.proTag}</>, value: d.attention.usTiktok.pro, tone: "var(--s-hot)", sub: d.attention.usTiktok.window },
          { label: <>US TikTok views · {d.attention.usTiktok.conTag}</>, value: d.attention.usTiktok.con, tone: "var(--series-1)" },
          { label: "'All Eyes on Rafah' shares", value: d.attention.rafah.shares, tone: "var(--series-2)", sub: d.attention.rafah.range },
        ]} />
        <Cite ids={[d.attention.platformsSource, ...d.attention.rafah.sources]} />
      </div>
    ),
    merch: (
      <div>
        <Bars fmt={(v) => `${v}`} max={180} rows={[
          { label: "Amazon keffiyeh unit sales, 56 days before 7 Oct (index)", value: 100, tone: "var(--story-ink-3)" },
          { label: "…the 56 days after", value: 100 + d.merch.keffiyeh.value, tone: "var(--s-hot)", sub: d.merch.keffiyeh.via },
          { label: "Hirbawi factory, Hebron: sales up 50–70%", value: 160, tone: "var(--s-cool)", sub: "midpoint shown" },
        ]} />
        <div className="mt-3 flex flex-wrap gap-1.5">{d.merch.catalogue.map((c) => <span key={c} className="rounded-full border px-2 py-0.5 text-[11px]" style={{ borderColor: "var(--story-rule)" }}>{c}</span>)}</div>
        <Cite ids={[d.merch.keffiyeh.source, d.merch.hirbawi.source]} />
      </div>
    ),
    money: (
      <div>
        <Bars fmt={(v) => `$${v}M`} rows={d.money.map((m) => ({ label: m.label, value: m.value, tone: m.basis === "government claim" ? "var(--series-4)" : m.basis === "projection" ? "var(--series-2)" : "var(--series-1)", sub: m.basis === "reported" ? undefined : m.basis }))} />
        <p className="mt-4 text-[12px] font-semibold">At scale: squares by area, $ million</p>
        <div className="mt-2 flex items-end gap-3">
          <div style={{ width: 180, height: 180, background: "var(--story-rule)" }} className="relative rounded-sm"><span className="absolute left-2 top-2 text-[11px] font-semibold">Rebuilding Gaza · ${L("rebuild").value}bn</span>
            <span className="absolute bottom-2 left-2 block" style={{ width: Math.max(2, 180 * Math.sqrt((M("us20").value) / (L("rebuild").value * 1000))), height: Math.max(2, 180 * Math.sqrt((M("us20").value) / (L("rebuild").value * 1000))), background: "var(--series-4)" }} title="$250M" />
            <span className="absolute bottom-2 left-8 block" style={{ width: Math.max(2, 180 * Math.sqrt((M("unrwausa-2024").value) / (L("rebuild").value * 1000))), height: Math.max(2, 180 * Math.sqrt((M("unrwausa-2024").value) / (L("rebuild").value * 1000))), background: "var(--series-2)" }} title="$51M" />
          </div>
          <p className="text-[11px] leading-snug" style={{ color: "var(--story-ink-3)" }}>Five years of the ~20 US groups&apos; reported income: {pct(x.us20ShareOfRebuild, 2)} of the bill. UNRWA USA&apos;s expected 2024: {pct(x.unrwaShareOfRebuild, 2)}. Derived.</p>
        </div>
        <Cite ids={[...new Set(d.money.map((m) => m.source)), L("rebuild").source]} />
      </div>
    ),
    protest: (
      <div>
        <p className="text-[12px]" style={{ color: "var(--story-ink-2)" }}>{big(protests)} US pro-Palestine protests in 8 months · one dot = 10</p>
        <div className="mt-2"><Dots per={10} cols={50} runs={[
          { n: d.protest.us[1]!.value, colour: "var(--s-hot)" },
          { n: d.protest.us[2]!.value, colour: "var(--story-ink)" },
          { n: protests - d.protest.us[1]!.value - d.protest.us[2]!.value, colour: "var(--s-cool)" },
        ]} /></div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px]">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--s-hot)" }} />Property damage reported · {d.protest.us[1]!.value}</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--story-ink)" }} />Police injured · {d.protest.us[2]!.value}</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--s-cool)" }} />Neither reported</span>
        </div>
        <Cite ids={[d.protest.us[0]!.source]} />
      </div>
    ),
    abroad: (
      <ol className="relative border-l-2 pl-5" style={{ borderColor: "var(--story-rule)" }}>
        {d.protest.abroad.map((a) => (
          <li key={a.date} className="relative pb-3">
            <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2" style={{ borderColor: a.where === "Mumbai" ? "var(--s-hot)" : "var(--story-ink-2)", background: "var(--story-card)" }} />
            <p className="mono text-[11px] font-bold" style={{ color: "var(--story-ink-3)" }}>{day(a.date)} · {a.where}</p>
            <p className="text-[12.5px] leading-[1.5]">{a.what}</p>
          </li>
        ))}
      </ol>
    ),
    aid: (
      <div className="grid gap-3">
        {d.aid.map((a) => (
          <div key={a.label} className="rounded-md border p-3" style={{ borderColor: "var(--story-rule)" }}>
            <p className="story-display text-[30px] leading-none">{a.value}</p>
            <p className="mt-1 text-[12px] font-semibold">{a.label}</p>
            <p className="text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{a.basis}</p>
          </div>
        ))}
        <div>
          <p className="text-[12px] font-semibold">Palestinian legislative election, January 2006 · 132 seats</p>
          <div className="mt-1 flex h-5 overflow-hidden rounded text-[10px] font-bold text-white">
            <span className="flex items-center pl-1.5" style={{ width: `${(74 / 132) * 100}%`, background: "var(--series-3)" }}>Hamas 74</span>
            <span className="flex items-center pl-1.5" style={{ width: `${(45 / 132) * 100}%`, background: "var(--series-1)" }}>Fatah 45</span>
            <span style={{ width: `${(13 / 132) * 100}%`, background: "var(--story-ink-3)" }} />
          </div>
        </div>
        <Cite ids={[...d.aid.map((a) => a.source), d.election.source]} />
      </div>
    ),
  };

  const steps: FpStep[] = [
    { id: "ledger", kicker: "The ledger", content: <><p className="text-[22px] font-black leading-tight" style={{ color: "var(--story-ink)" }}>{big(L("dead").value)} dead in Gaza.</p><p className="mt-2">That is the Gaza health ministry&apos;s count to {day(L("dead").asOf)} — {Math.round(x.deadPerIsraeliKilled)} for every Israeli killed on 7 October. Any argument about the people protesting abroad starts here, with a war whose toll is not in dispute as a scale, only in its details.</p></> },
    { id: "economy", kicker: "What is left", content: <><p className="text-[22px] font-black leading-tight" style={{ color: "var(--story-ink)" }}>${L("gdppc").value} a year.</p><p className="mt-2">Gaza&apos;s output per person after an {L("gdp").value}% collapse in 2024. {L("jobless").value}% unemployed. About 254,000 fewer people than before the war. Rebuilding: ${L("rebuild").value} billion. None of these numbers moves when a scarf sells out.</p></> },
    { id: "attention", kicker: "The hashtag", content: <><p className="text-[22px] font-black leading-tight" style={{ color: "var(--story-ink)" }}>{Math.round(x.proConRatio[0]!.ratio)}× more posts.</p><p className="mt-2">#FreePalestine against #StandWithIsrael on Instagram, by the counts TikTok published in November 2023 — {Math.round(x.proConRatio[1]!.ratio)}× on Facebook. In the US, TikTok views ran the other way. &ldquo;All Eyes on Rafah&rdquo;, an AI image, was shared some {big(d.attention.rafah.shares)} times; Indian actors were among the sharers.</p><p className="mt-2 text-[12px]" style={{ color: "var(--story-ink-3)" }}>{d.attention.gap}</p></> },
    { id: "merch", kicker: "The merchandise", content: <><p className="text-[22px] font-black leading-tight" style={{ color: "var(--story-ink)" }}>+{d.merch.keffiyeh.value}% in 56 days.</p><p className="mt-2">Keffiyeh sales on Amazon after 7 October. The essay calls it a lifestyle line, and the catalogue grew. But the boom also reached the West Bank&apos;s last keffiyeh factory: &ldquo;{d.merch.hirbawi.quote}&rdquo; Its sales rose {d.merch.hirbawi.value}. {d.merch.donations}</p></> },
    { id: "money", kicker: "The money", content: <><p className="text-[22px] font-black leading-tight" style={{ color: "var(--story-ink)" }}>$4M → $32M → $51M.</p><p className="mt-2">UNRWA USA&apos;s income before the war, in 2023, and expected for 2024. Israel&apos;s diaspora ministry puts about 20 US pro-Palestinian groups at $250 million over five years. Fundraising grew with the war. Set against what Gaza needs, it is a rounding error: {pct(x.us20ShareOfRebuild, 2)} of the reconstruction bill.</p></> },
    { id: "protest", kicker: "The campus", content: <><p className="text-[22px] font-black leading-tight" style={{ color: "var(--story-ink)" }}>{pct(x.peacefulShare)} with no damage.</p><p className="mt-2">Of {big(protests)} US pro-Palestine protests counted in eight months, property damage was reported at {d.protest.us[1]!.value} and police injuries at {d.protest.us[2]!.value}. Arrests at campus protests passed 3,600, at more than 130 encampments. {d.protest.offCampus.text}</p></> },
    { id: "abroad", kicker: "The street", content: <><p className="text-[22px] font-black leading-tight" style={{ color: "var(--story-ink)" }}>Real incidents, mis-told.</p><p className="mt-2">Milan&apos;s station clashes injured some 60 police. London&apos;s memorial climb changed the law. A Madrid arson targeted a kosher restaurant. In Mumbai, a court told would-be marchers to &ldquo;look at your own country&rdquo;. Each is in the record — but not always as the essay tells it.</p></> },
    { id: "aid", kicker: "The other ledger", content: <><p className="text-[22px] font-black leading-tight" style={{ color: "var(--story-ink)" }}>Up to 25% diverted.</p><p className="mt-2">That is what documents Israel seized say Hamas took of aid under its control until April 2024 — one side&apos;s evidence, not an audit. The UN found nine UNRWA staff may have joined 7 October. And Hamas won the last election Palestinians held, in 2006. A cause can be just and its proxies compromised; both are in the record.</p></> },
  ];

  const checked = d.claims.map((c) => ({ claim: c.claim, verdict: c.verdict, finding: c.finding, cites: c.sources.map((id) => ({ publisher: src(id).publisher, url: src(id).url })) }));

  return (
    <article className="pt-6">
      <Eyebrow tone="hot">World · India · A visual essay, tested</Eyebrow>
      <h1 className="story-display mt-3 max-w-[18ch] text-[36px] sm:text-[56px]">Free Palestine, Inc.?</h1>
      <Standfirst>
        A claim is circulating: that for its loudest supporters abroad — from American campuses to Mumbai&apos;s protest sites — Palestine has stopped being a cause and become
        a career, a feed and a product line, one that needs the war more than it needs it to end. This essay puts that claim against the record: Gaza&apos;s numbers, the
        hashtags, the merchandise, the money, the protests — and twenty-one specific claims, each checked. Some hold. Some do not.
      </Standfirst>

      <FpScrolly steps={steps} visuals={visuals} />

      <section id="claims" className="mt-14 scroll-mt-20">
        <Eyebrow>The claims, checked</Eyebrow>
        <h2 className="story-display mt-2 text-[28px] sm:text-[36px]">21 claims, one by one</h2>
        <p className="mt-1 max-w-[76ch] text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-3)" }}>Taken from an essay making the &ldquo;career, not cause&rdquo; argument. Filter by verdict. Verdicts are this page&apos;s reading of the sources cited under each.</p>
        <div className="mt-4"><ClaimChecker claims={checked} /></div>
      </section>

      <section id="tests" className="mt-14 scroll-mt-20">
        <Eyebrow>Cause or career?</Eyebrow>
        <h2 className="story-display mt-2 text-[28px] sm:text-[36px]">Four tests the thesis would have to pass</h2>
        <p className="mt-1 max-w-[76ch] text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-3)" }}>Flip each between the case that this is a career and the case that it is a cause. The line under each says how much the published record can actually settle.</p>
        <div className="mt-4"><TestCards tests={d.tests} /></div>
        <div className="story-card mt-4 p-4 sm:p-5" style={{ borderLeft: "4px solid var(--story-ink)" }}>
          <p className="text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--story-ink-3)" }}>Where the record leaves it</p>
          <p className="mt-1.5 text-[14px] leading-[1.6]">Attention, sales and donations all rose with the war — that part of the thesis is measured. That the people behind them do not care, or need the war to go on, is not: no published data measures motive, and the protest data shows a movement that is overwhelmingly peaceful and mostly off campus. Gaza&apos;s collapse is on a scale no merchandise line, charity or protest touches, in either direction.</p>
        </div>
      </section>

      <WhatThisCannotSay items={[
        { q: "Is this cause a career for activists?", a: "For some, it may be; the record cannot say for whom. Salaries, speaker fees and sellers' margins are not published in a form this page could read, so the claim is neither proved nor disproved here." },
        { q: "How did #FreePalestine rise in India, country by country?", a: d.attention.gap },
        { q: "How many Free Palestine T-shirts sold in India or the US?", a: "No sales figures were found beyond Amazon US keffiyeh data and one West Bank factory's own estimate." },
        { q: "Why are no activists named or pictured?", a: "Private individuals at protests are not public figures. This page tests a claim about a movement, not about particular people in it." },
      ]} />

      <section className="mt-12 border-t pt-6 text-[11px] leading-[1.7]" style={{ borderColor: "var(--story-rule)", color: "var(--story-ink-3)" }}>
        <p className="font-bold uppercase tracking-[0.06em]">Sources, accessed {d.accessed}</p>
        <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
          {d.sources.map((s) => <li key={s.id}><a className="underline decoration-dotted" href={s.url} target="_blank" rel="noopener noreferrer">{s.publisher}</a> — {s.title}{s.published ? ` (${s.published})` : ""}{s.kind === "government-claim" ? " · a party to the conflict" : ""}</li>)}
        </ul>
        <p className="mt-3">Gaza casualty figures are the Gaza health ministry&apos;s, which does not separate combatants from civilians. Figures from Israel&apos;s government or military are labelled as one side&apos;s claim. Ratios and shares are computed on this page.</p>
      </section>
    </article>
  );
}
