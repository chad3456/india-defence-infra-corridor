import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Eyebrow, Standfirst } from "@/components/stories/Kit";
import { Awaiting, fmt } from "@/components/instagram/Charts";
import { LiveHeadlines } from "@/components/luxury/LiveHeadlines";
import { AREAS, SURVEYS, gap, type LbPublished, type LbSource, type NfhsIndicator, type NfhsRegister } from "@/lib/luxury-beliefs";

/**
 * Luxury beliefs and India's masses: Rob Henderson's idea, tested area by
 * area against Indian data, with live reporting on each area and the
 * National Family Health Survey's class breakdowns read from the DHS
 * Program. The idea is a hypothesis; the page reports what the data say for
 * and against it and scores nothing.
 */

export const metadata = {
  title: "Luxury beliefs and India: testing Rob Henderson's idea · Bharat Tracker",
  description: "Rob Henderson's \"luxury beliefs\" tested against Indian data: language of schooling, organic farming and GM crops, climate, prohibition, marriage, gender norms and policing — who believes what, who pays, and the strongest case against — with live headlines and the NFHS by wealth and schooling.",
};

const load = <T,>(f: string): T | null => { try { return JSON.parse(readFileSync(join(process.cwd(), "data", "luxury-beliefs", f), "utf8")) as T; } catch { return null; } };
const WHO_COLOUR = { "better-off": "var(--series-2)", poor: "var(--series-1)", all: "var(--story-ink-3)" } as const;

function Gradient({ ind }: { ind: NfhsIndicator }) {
  const s5 = ind.surveys[SURVEYS[0].id], s4 = ind.surveys[SURVEYS[1].id];
  if (!s5) return null;
  const unit = /fertility|ideal number/i.test(ind.title) ? "" : "%";
  // One scale for both breakdowns of an indicator, so wealth and schooling can be compared bar for bar.
  const max = Math.max(...s5.rows.map((r) => r.value));
  const block = (category: string, label: string) => {
    const rows = s5.rows.filter((r) => r.category.toLowerCase() === category);
    if (!rows.length) return null;
    const g = gap(s5.rows, category);
    return (
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--story-ink-3)" }}>{label}{g ? ` · ${g.high.label} vs ${g.low.label}: ${g.diff > 0 ? "+" : ""}${g.diff}${unit === "%" ? " points" : ""}` : ""}</p>
        <ul className="mt-1.5 space-y-1">
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2.8rem] items-center gap-2 text-[11.5px]" title={`${r.label}: ${r.value}${unit}`}>
              <span>{r.label}</span>
              <span className="block h-2.5 rounded-r-[3px]" style={{ width: `${(100 * r.value) / max}%`, background: category === "wealth quintile" ? "var(--series-1)" : "var(--series-3)" }} />
              <span className="mono text-right tabular-nums">{r.value}{unit}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };
  return (
    <div className="story-card min-w-0 p-4">
      <p className="text-[14px] font-bold leading-snug">{ind.title}</p>
      <p className="mt-0.5 text-[11px]" style={{ color: "var(--story-ink-3)" }}>
        India {fmt(s5.total, 1)}{unit} in NFHS-5{s4?.total !== null && s4?.total !== undefined ? `, ${fmt(s4.total, 1)}${unit} in NFHS-4` : ""} · DHS indicator {ind.id}: &ldquo;{ind.dhsLabel}&rdquo;
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{block("wealth quintile", "By household wealth")}{block("education", "By schooling")}</div>
    </div>
  );
}

export default function LuxuryBeliefsPage() {
  const pub = load<LbPublished>("published.json")!;
  const nfhs = load<NfhsRegister>("nfhs.json");
  const src = (id: string): LbSource => pub.sources.find((s) => s.id === id)!;
  const label = (id: string) => AREAS.find((a) => a.id === id)!.label;

  return (
    <article className="pt-6">
      <Eyebrow tone="hot">India · Live · Class and belief</Eyebrow>
      <h1 className="story-display mt-3 max-w-[22ch] text-[32px] sm:text-[44px]">Luxury beliefs and India&apos;s masses</h1>
      <Standfirst>
        Rob Henderson&apos;s phrase names beliefs that win the well-off status at little cost to them, while the costs fall on the poor. This page tests the idea in India, area by
        area. Two questions are asked of each: do India&apos;s better-off and its poor believe or choose differently, and who pays for the belief the better-off favour? Each area
        ends with the strongest case against calling the belief a luxury. The idea is a hypothesis, and some areas refute it. Reporting on every area arrives live; the survey
        evidence is the government&apos;s own National Family Health Survey, broken down by wealth and schooling.
      </Standfirst>

      <section className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="story-card p-4">
          <Eyebrow>The idea</Eyebrow>
          <blockquote className="mt-2 text-[16px] font-semibold leading-snug">&ldquo;{pub.concept.definition}&rdquo;</blockquote>
          <p className="mt-1 text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>Rob Henderson, 2019, as quoted by <a className="underline decoration-dotted" href={src(pub.concept.source).url} target="_blank" rel="noopener noreferrer">{src(pub.concept.source).publisher}</a>. Developed in his 2024 memoir <i>Troubled</i> (<a className="underline decoration-dotted" href={src("deseret-troubled").url} target="_blank" rel="noopener noreferrer">Deseret News</a>).</p>
        </div>
        <div className="story-card p-4">
          <Eyebrow>Its critics, and a defender</Eyebrow>
          <ul className="mt-2 space-y-1.5 text-[12.5px] leading-[1.5]">
            {pub.concept.critiques.map((c) => <li key={c.who}><b>{c.who}:</b> {c.point} <a className="text-[11px] underline decoration-dotted" style={{ color: "var(--story-ink-3)" }} href={src(c.source).url} target="_blank" rel="noopener noreferrer">{src(c.source).publisher}</a></li>)}
          </ul>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="story-display text-[24px]">Live: what is being reported now</h2>
        <p className="mt-1 max-w-[72ch] text-[12.5px]" style={{ color: "var(--story-ink-3)" }}>The past week&apos;s headlines on each area, in English and Hindi, refreshed every minute while the page is open. A headline is a pointer to a report, not evidence for or against the idea.</p>
        <div className="mt-3"><LiveHeadlines areas={AREAS.map((a) => ({ id: a.id, label: a.label }))} /></div>
      </section>

      <h2 className="story-display mt-12 text-[24px]">Seven areas, tested</h2>
      <nav className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">{pub.areas.map((a) => <a key={a.id} href={`#${a.id}`} className="underline decoration-dotted underline-offset-2">{label(a.id)}</a>)}<a href="#nfhs" className="underline decoration-dotted underline-offset-2">NFHS by class</a></nav>
      <div className="mt-4 space-y-5">
        {pub.areas.map((a, i) => (
          <section key={a.id} id={a.id} className="story-card scroll-mt-20 p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="mono text-[11px] font-bold" style={{ color: "var(--story-ink-3)" }}>{String(i + 1).padStart(2, "0")}</span>
              <h3 className="text-[18px] font-bold">{label(a.id)}</h3>
            </div>
            <p className="mt-1 text-[15px] italic leading-snug">&ldquo;{a.belief}&rdquo;</p>
            <div className="mt-3 grid gap-3 text-[12.5px] leading-[1.55] md:grid-cols-2">
              <p><b>Who holds it.</b> {a.whoHolds}</p>
              <p><b>Who pays.</b> {a.whoPays}</p>
            </div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {a.figures.map((f) => (
                <li key={f.label} className="rounded-md border p-3" style={{ borderColor: "var(--story-rule)", borderTop: `3px solid ${WHO_COLOUR[f.who ?? "all"]}` }} title={`"${f.quote}"`}>
                  <p className="mono text-[22px] font-bold leading-none tabular-nums">{f.display}</p>
                  <p className="mt-1.5 text-[11.5px] leading-snug">{f.label}</p>
                  <p className="mt-1 text-[10.5px] leading-snug" style={{ color: "var(--story-ink-3)" }}><a className="underline decoration-dotted" href={src(f.source).url} target="_blank" rel="noopener noreferrer">{src(f.source).publisher}</a>{f.notes ? ` · ${f.notes}` : ""}</p>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex flex-wrap gap-3 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>
              {(["poor", "better-off", "all"] as const).filter((w) => a.figures.some((f) => (f.who ?? "all") === w)).map((w) => <span key={w} className="flex items-center gap-1"><span className="inline-block h-1 w-3" style={{ background: WHO_COLOUR[w] }} />{w === "poor" ? "Borne by the poor" : w === "better-off" ? "The better-off" : "Everyone"}</span>)}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <p className="text-[12.5px] italic leading-[1.55]" style={{ color: "var(--story-ink-2)" }}><b className="not-italic">The case against.</b> {a.against}</p>
              <p className="rounded-md px-3 py-2 text-[12.5px] font-semibold leading-snug" style={{ background: "var(--story-bg)" }}>{a.verdict}</p>
            </div>
            {(nfhs?.indicators ?? []).filter((n) => n.area === a.id).length > 0 && (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">{nfhs!.indicators.filter((n) => n.area === a.id).map((n) => <Gradient key={n.key} ind={n} />)}</div>
            )}
          </section>
        ))}
      </div>

      <section id="nfhs" className="mt-12 scroll-mt-20">
        <h2 className="story-display text-[24px]">Where class divides belief and outcome: the NFHS</h2>
        <p className="mt-1 max-w-[74ch] text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-3)" }}>
          The National Family Health Survey asks the same questions of the poorest and richest households and of women and men with every level of schooling. Read from the DHS Program&apos;s API, which publishes its tables;
          {nfhs ? ` last read ${new Date(nfhs.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.` : ""} Wealth quintiles are fifths of households ranked by an index of assets, not by income.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {nfhs?.indicators.length ? nfhs.indicators.map((n) => <Gradient key={n.key} ind={n} />) : <Awaiting>The NFHS class breakdowns arrive with the scheduled job&apos;s first run, which reads them from the DHS Program&apos;s public API.</Awaiting>}
        </div>
        {nfhs?.status.some((s) => !s.ok) && <p className="mt-2 text-[11px]" style={{ color: "var(--story-ink-3)" }}>Not found in the DHS catalogue: {nfhs.status.filter((s) => !s.ok).map((s) => s.key).join(", ")}.</p>}
      </section>

      <section className="mt-12 border-t pt-8" style={{ borderColor: "var(--story-rule)" }}>
        <Eyebrow>How to read this page</Eyebrow>
        <ul className="mt-3 max-w-[78ch] list-disc space-y-1.5 pl-5 text-[13px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
          <li><b>A hypothesis, not a verdict on anyone.</b> Each area states a belief, who is on record holding it, who bears its cost, and the strongest case against calling it a luxury. On the evidence here, one area fits the idea cleanly (farming), two fit in part (schooling language, marriage), and four do not (climate, prohibition, gender norms, policing).</li>
          <li><b>Every number names its source</b> and the sentence it was read from (hover a figure). Published figures were read from search excerpts on 21 October 2026; where sources disagree, both are shown.</li>
          <li><b>Survey breakdowns are the NFHS&apos;s own</b>, as the DHS Program publishes them, unchanged. The gap between richest and poorest is the only number computed here.</li>
          <li><b>Headlines are live and are not evidence.</b> They show what is being reported about each area this week.</li>
        </ul>
      </section>
    </article>
  );
}
