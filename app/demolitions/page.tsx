import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { Eyebrow, Standfirst, WhatThisCannotSay } from "@/components/stories/Kit";
import { DemolitionHeadlines } from "@/components/demolitions/DemolitionHeadlines";
import { FAITHS, UNSPECIFIED, floor, unspecified, type DemPublished, type DemRecord, type Faith } from "@/lib/demolitions";

/**
 * Religious structures demolished as encroachments, 2014–2026: what
 * governments, courts and reporters have counted, state by state. No national
 * count exists, so the page shows each published figure in its own window,
 * adds only records that do not overlap, and calls that sum a floor. Faith
 * breakdowns appear only where a source gives one. "Illegal" is the
 * authorities' designation, and the page says so.
 */

export const metadata = {
  title: "Temples, mazars, mosques demolished as encroachments, 2014–2026 · Bharat Tracker",
  description: "A sourced dashboard of religious structures — temples, mazars and dargahs, mosques, madrasas, gurdwaras, churches — demolished in India as encroachments since 2014: official and court figures state by state, what can and cannot be added up, the law behind the drives, both sides' positions, and live reporting.",
};

const load = (): DemPublished => JSON.parse(readFileSync(join(process.cwd(), "data", "demolitions", "published.json"), "utf8")) as DemPublished;
const n = (v: number) => v.toLocaleString("en-IN");
const monthOf = (s: string) => { const [y, m, dd] = s.split("-"); return new Date(Date.UTC(Number(y), Number(m ?? 1) - 1, Number(dd ?? 1))).toLocaleDateString("en-GB", { ...(dd ? { day: "numeric" } : {}), month: "short", year: "numeric", timeZone: "UTC" }); };
const faithOf = (id: Faith) => FAITHS.find((f) => f.id === id)!;

/** One record's total as a bar split by faith, with the unassigned part grey. */
function FaithBar({ counts, total, max }: { counts: Partial<Record<Faith, number>>; total: number; max: number }) {
  const rest = Math.max(0, total - Object.values(counts).reduce((a, v) => a + (v ?? 0), 0));
  return (
    <div className="flex h-4 overflow-hidden rounded-r-[4px]" style={{ width: `${Math.max(1.5, (100 * total) / max)}%` }}>
      {FAITHS.filter((f) => counts[f.id]).map((f) => <span key={f.id} title={`${f.label}: ${n(counts[f.id]!)}`} style={{ width: `${(100 * counts[f.id]!) / total}%`, background: f.colour }} />)}
      {rest > 0 && <span title={`${UNSPECIFIED.label}: ${n(rest)}`} style={{ width: `${(100 * rest) / total}%`, background: UNSPECIFIED.colour }} />}
    </div>
  );
}

function Section({ id, kicker, title, children, note }: { id: string; kicker: string; title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section id={id} className="mt-14 scroll-mt-20">
      <Eyebrow>{kicker}</Eyebrow>
      <h2 className="story-display mt-2 max-w-[28ch] text-[26px] sm:text-[32px]">{title}</h2>
      {note && <p className="mt-1.5 max-w-[76ch] text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-3)" }}>{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function DemolitionsPage() {
  const d = load();
  const f = floor(d.records);
  const src = (id: string) => d.sources.find((s) => s.id === id)!;
  const Cite = ({ ids }: { ids: string[] }) => (
    <span className="text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>
      {ids.map((id, i) => <span key={id}>{i ? " · " : ""}<a className="underline decoration-dotted" href={src(id).url} target="_blank" rel="noopener noreferrer">{src(id).publisher}</a>{src(id).kind === "partisan" || src(id).kind === "advocacy" ? <span className="ml-0.5 italic">({src(id).kind})</span> : null}</span>)}
    </span>
  );
  const maxState = Math.max(...f.byState.map((s) => s.total));
  const muslim = (["mazar", "madrasa", "mosque", "eidgah"] as Faith[]).reduce((a, k) => a + f.byFaith[k], 0);
  const legendFaiths = FAITHS.filter((x) => f.byFaith[x.id] > 0 || d.cases.some((c) => c.faith === x.id));

  // Timeline: every record and case, 2014 to 2026.
  const X0 = Date.UTC(2014, 0, 1), X1 = Date.UTC(2026, 11, 31), W = 1000, H = 190;
  const xOf = (s: string) => { const [y, m] = s.split("-"); return 40 + ((Date.UTC(Number(y), Number(m ?? 1) - 1, 15) - X0) / (X1 - X0)) * (W - 60); };
  const rOf = (v: number) => 4 + Math.sqrt(v) * 0.75;

  return (
    <article className="pt-6">
      <Eyebrow tone="hot">India · Religion and the state · 2014–2026</Eyebrow>
      <h1 className="story-display mt-3 max-w-[22ch] text-[32px] sm:text-[46px]">Temples, mazars, mosques: what has been demolished as encroachment</h1>
      <Standfirst>
        No government publishes a national count. What exists are state figures — told to assemblies and high courts, or announced in drives — each for its own window,
        and a handful of cases that made news. This page shows each one as published, adds up only those that do not overlap, and shows faith only where the source does.
        &ldquo;Illegal&rdquo; is the authorities&apos; word; many of these demolitions were contested.
      </Standfirst>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="story-card p-4 sm:col-span-2 lg:col-span-1">
          <p className="story-display text-[48px] leading-none tabular-nums" style={{ color: "var(--s-hot)" }}>{n(f.total)}</p>
          <p className="mt-2 text-[13px] font-semibold">religious structures, at least, documented as demolished or removed</p>
          <p className="mt-1 text-[11px]" style={{ color: "var(--story-ink-3)" }}>Sum of {f.records.length} non-overlapping official or reported figures in {f.byState.length} states · derived · a floor, not a total</p>
        </div>
        <div className="story-card p-4"><p className="story-display text-[40px] leading-none tabular-nums">{n(muslim)}</p><p className="mt-2 text-[13px] font-semibold">identified as mazars, madrasas, mosques or eidgahs</p><p className="mt-1 text-[11px]" style={{ color: "var(--story-ink-3)" }}>within that floor · derived</p></div>
        <div className="story-card p-4"><p className="story-display text-[40px] leading-none tabular-nums">{n(f.byFaith.temple)}</p><p className="mt-2 text-[13px] font-semibold">identified as temples</p><p className="mt-1 text-[11px]" style={{ color: "var(--story-ink-3)" }}>within that floor · derived</p></div>
        <div className="story-card p-4"><p className="story-display text-[40px] leading-none tabular-nums" style={{ color: "var(--story-ink-3)" }}>{n(f.unspecified)}</p><p className="mt-2 text-[13px] font-semibold">faith not stated by the source</p><p className="mt-1 text-[11px]" style={{ color: "var(--story-ink-3)" }}>Gujarat&apos;s and Delhi&apos;s court figures give no faith</p></div>
      </section>
      <p className="mt-2 max-w-[80ch] text-[11.5px] leading-[1.5]" style={{ color: "var(--story-ink-3)" }}>
        The faith split covers only records that give one, so it cannot be read as the share of all demolitions. Where faiths are counted, Uttarakhand&apos;s drives removed mostly mazars alongside some temples;
        Uttar Pradesh&apos;s border drive was all Muslim structures; Gujarat&apos;s assembly figure counts mazars only.
      </p>

      <Section id="states" kicker="01 · By state" title="The floor, state by state"
        note="Each bar is the non-overlapping figures for a state, split by faith where the source splits it; grey is a count with no faith given. States absent here are not states without demolitions — they are states without a published count found for this page.">
        <div className="story-card p-4 sm:p-5">
          <ul className="space-y-2.5">
            {f.byState.map((s) => (
              <li key={s.state} className="grid grid-cols-[minmax(6.5rem,9rem)_minmax(0,1fr)] items-center gap-3 text-[12.5px]">
                <span className="font-semibold">{s.state}</span>
                <span className="flex items-center gap-2"><FaithBar counts={s.counts} total={s.total} max={maxState} /><span className="mono shrink-0 font-semibold tabular-nums">{n(s.total)}</span></span>
              </li>
            ))}
          </ul>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            {legendFaiths.map((x) => <li key={x.id} className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: x.colour }} />{x.label}{f.byFaith[x.id] ? ` · ${n(f.byFaith[x.id])}` : ""}</li>)}
            <li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: UNSPECIFIED.colour }} />{UNSPECIFIED.label} · {n(f.unspecified)}</li>
          </ul>
        </div>
      </Section>

      <Section id="timeline" kicker="02 · Over time" title="Every published figure and case, 2014–2026"
        note="Circles are counts from governments, courts and reporting, sized by the number; diamonds are single demolitions that drew national attention. Hover for detail.">
        <div className="story-card overflow-x-auto p-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[640px]" role="img" aria-label="Published demolition figures and cases by date">
            {Array.from({ length: 13 }, (_, i) => 2014 + i).map((y) => (
              <g key={y}><line x1={xOf(`${y}-01`)} x2={xOf(`${y}-01`)} y1={20} y2={H - 26} stroke="var(--story-rule)" strokeWidth={0.6} /><text x={xOf(`${y}-01`)} y={H - 10} fontSize={10} textAnchor="middle" fill="var(--story-ink-3)">{y}</text></g>
            ))}
            <line x1={40} x2={W - 20} y1={H - 26} y2={H - 26} stroke="var(--story-ink-3)" strokeWidth={0.8} />
            {d.records.map((r, i) => {
              const lead = (Object.entries(r.counts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? null) as Faith | null;
              return (
                <g key={r.id}>
                  <circle cx={xOf(r.when)} cy={95 - (i % 3) * 22} r={rOf(r.total)} fill={lead ? faithOf(lead).colour : UNSPECIFIED.colour} fillOpacity={0.55} stroke={r.headline ? "var(--story-ink)" : "var(--story-ink-3)"} strokeWidth={r.headline ? 1.4 : 0.6} strokeDasharray={r.headline ? undefined : "2 2"}>
                    <title>{`${r.state}, ${r.window}: ${r.approx ? "about " : ""}${n(r.total)} ${r.action} (${r.basis})`}</title>
                  </circle>
                  <text x={xOf(r.when)} y={95 - (i % 3) * 22 + 3} fontSize={9} textAnchor="middle" fontWeight={700} fill="var(--story-ink)">{n(r.total)}</text>
                </g>
              );
            })}
            {d.cases.map((c) => (
              <g key={c.date + c.state}>
                <rect x={xOf(c.date) - 5} y={H - 44} width={10} height={10} transform={`rotate(45 ${xOf(c.date)} ${H - 39})`} fill={faithOf(c.faith).colour}><title>{`${monthOf(c.date)}, ${c.state}: ${c.what}`}</title></rect>
              </g>
            ))}
          </svg>
          <p className="mt-1 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>Solid outline: a figure counted in the floor above. Dashed: a figure contained in a later one, or a different measure, shown for the record. Nothing before 2019 — no state count from 2014–2018 was found.</p>
        </div>
      </Section>

      <Section id="records" kicker="03 · The figures" title="Every count, as published">
        <div className="grid gap-3 lg:grid-cols-2">
          {d.records.map((r: DemRecord) => (
            <div key={r.id} className="story-card p-4" style={{ borderLeft: `4px solid ${r.headline ? "var(--s-hot)" : "var(--story-rule)"}` }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[14.5px] font-bold">{r.state} <span className="font-normal" style={{ color: "var(--story-ink-3)" }}>· {r.window}</span></p>
                <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em]" style={{ borderColor: "var(--story-rule)", color: r.basis === "official" ? "var(--s-cool)" : "var(--story-ink-3)" }}>{r.basis}{r.headline ? " · in floor" : ""}</span>
              </div>
              <p className="mt-1 flex items-baseline gap-2"><span className="story-display text-[32px] leading-none tabular-nums">{r.approx ? "~" : ""}{n(r.total)}</span><span className="text-[12.5px]">{r.action}</span></p>
              <div className="mt-2"><FaithBar counts={r.counts} total={r.total} max={r.total} /></div>
              {Object.keys(r.counts).length > 0 && <p className="mt-1 text-[11.5px]" style={{ color: "var(--story-ink-2)" }}>{FAITHS.filter((x) => r.counts[x.id]).map((x) => `${n(r.counts[x.id]!)} ${x.label.toLowerCase()}`).join(" · ")}{unspecified(r) ? ` · ${n(unspecified(r))} not stated` : ""}</p>}
              <p className="mt-2 text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>{r.who}</p>
              <blockquote className="mt-1.5 border-l-2 pl-2.5 text-[12px] italic leading-[1.5]" style={{ borderColor: "var(--story-rule)", color: "var(--story-ink-2)" }}>&ldquo;{r.quote}&rdquo;</blockquote>
              {r.notes && <p className="mt-1.5 text-[11.5px] leading-[1.5]" style={{ color: "var(--story-ink-2)" }}>{r.notes}</p>}
              <p className="mt-1.5"><Cite ids={r.sources} /></p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="cases" kicker="04 · Cases" title="Demolitions that drew national attention" note="Single cases across faiths, chosen because they were widely reported, not as a sample. Each was contested.">
        <ol className="grid gap-2 md:grid-cols-2">
          {d.cases.map((c) => (
            <li key={c.date + c.state} className="story-card flex gap-3 p-3">
              <span aria-hidden className="mt-1 inline-block h-3 w-3 flex-none rotate-45" style={{ background: faithOf(c.faith).colour }} />
              <div>
                <p className="text-[11px] font-bold" style={{ color: "var(--story-ink-3)" }}>{monthOf(c.date)} · {c.state} · {faithOf(c.faith).one}</p>
                <p className="mt-0.5 text-[13px] leading-[1.5]">{c.what}</p>
                <Cite ids={c.sources} />
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="compilation" kicker="05 · A compilation" title="The figure in circulation: 2,166">
        {d.compilations.map((c) => (
          <div key={c.id} className="story-card grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <p className="story-display text-[48px] leading-none tabular-nums" style={{ color: "var(--story-ink-3)" }}>{n(c.value)}</p>
            <div>
              <p className="text-[13.5px] font-semibold">{c.name}, {c.window}: {c.what}</p>
              <p className="mt-1 text-[12px] leading-[1.5]" style={{ color: "var(--story-ink-2)" }}>Not added to the floor. {c.caveat}</p>
              <p className="mt-1"><Cite ids={c.sources} /></p>
            </div>
          </div>
        ))}
      </Section>

      <Section id="law" kicker="06 · The law" title="Why the drives happen, and what they must follow">
        <div className="grid gap-3 md:grid-cols-2">
          {d.law.map((l) => (
            <div key={l.date} className="story-card p-4">
              <p className="mono text-[11px] font-bold" style={{ color: "var(--story-ink-3)" }}>{monthOf(l.date)} · Supreme Court</p>
              <p className="mt-1 text-[13.5px] leading-[1.55]">{l.what}</p>
              <p className="mt-1.5"><Cite ids={l.sources} /></p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="views" kicker="07 · Two positions" title="What each side says">
        <div className="grid gap-3 md:grid-cols-2">
          {d.views.map((v) => (
            <div key={v.who} className="story-card p-4">
              <p className="text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--story-ink-3)" }}>{v.who}</p>
              <p className="mt-1.5 text-[14px] leading-[1.55]">{v.said}</p>
              <p className="mt-1.5"><Cite ids={v.sources} /></p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px]" style={{ color: "var(--story-ink-3)" }}>Summaries of each side&apos;s published position; the page takes neither. Whether a demolition was lawful is for the courts, several of which are still hearing these cases.</p>
      </Section>

      <Section id="live" kicker="08 · Reporting now" title="The past fortnight" note="Headlines in English and Hindi naming a religious structure and a demolition, refreshed while the page is open. A headline is a pointer; it enters the figures above only once checked against an official statement or court record.">
        <DemolitionHeadlines />
      </Section>

      <WhatThisCannotSay items={[
        { q: "How many religious structures were demolished in India since 2014?", a: `Nobody knows. No ministry collects it. ${n(f.total)} is the sum of published figures that can be added without double counting — a floor. Most states publish nothing.` },
        { q: "Were Muslim structures targeted more than temples?", a: "Where faiths are counted, mazars and other Muslim structures far outnumber temples. But most figures give no faith, the counts come from states that ran drives against mazars by name, and no count of the structures that were left standing exists to compare against." },
        { q: "Were these structures illegal?", a: "That is the authorities' finding. Courts upheld some demolitions, stayed others, and some owners say they held title or waqf registration. This page reports the designation, not a verdict." },
        { q: "Why does Karnataka's figure not count?", a: "It runs from 2009 and mixes demolitions with structures relocated or regularised, so it cannot be added to demolitions since 2014." },
      ]} />

      <section className="mt-12 border-t pt-6 text-[11px] leading-[1.7]" style={{ borderColor: "var(--story-rule)", color: "var(--story-ink-3)" }}>
        <p className="font-bold uppercase tracking-[0.06em]">Sources, accessed {d.accessed}</p>
        <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
          {d.sources.map((s) => <li key={s.id}><a className="underline decoration-dotted" href={s.url} target="_blank" rel="noopener noreferrer">{s.publisher}</a> — {s.title}{s.published ? ` (${s.published})` : ""}{s.kind === "partisan" || s.kind === "advocacy" ? ` · ${s.kind}` : ""}</li>)}
        </ul>
        <p className="mt-3">Outlets marked partisan or advocacy take a side; their figures are used only where they quote an official or court and are labelled. Totals, splits and the floor are computed on this page.</p>
      </section>
    </article>
  );
}
