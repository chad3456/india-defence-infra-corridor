import Link from "next/link";
import { loadPublicOrder, type Cited, type Episode, type PublicOrderView } from "@/lib/public-order";
import { CHARTS, PARTS, type ChartSpec } from "@/lib/public-order-charts";
import { EPISODE_KINDS } from "@/lib/public-order-shared";
import { Eyebrow, Standfirst, Stat, WhatThisCannotSay } from "@/components/stories/Kit";
import { ChartTitle, Caption, RankedRows } from "@/components/stories/Charts";
import { MultiLine, StackColumns, YearBars, type YearPoint } from "@/components/protests/PoCharts";

/**
 * Protest and public order since 2004: riots, damage to public property,
 * police firing and police casualties, communal violence, and the major
 * episodes one by one.
 *
 * Every figure is in data/protests/public-order.json with the document it
 * comes from and that document's own words for it, and is checked against the
 * text the probe read (data/protests/public-order-probe.json) before it is
 * drawn. A figure that fails the check is not drawn and is listed at the foot
 * of the page.
 */

export const metadata = {
  title: "Protest and public order · Bharat Tracker",
  description:
    "Riots, damage to public property, police firing and police casualties in India since 2004, with the major episodes one by one — "
    + "every figure checked against the text of the NCRB volume, parliamentary answer or official statement it comes from.",
};

const fmt = (v: number) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-IN") : Number.isInteger(v) ? String(v) : v.toFixed(1));

function seriesPoints(v: PublicOrderView, id: string): YearPoint[] {
  const s = v.file.series.find((x) => x.id === id);
  return (s?.points ?? []).filter((p) => v.ok.has(p)).map((p) => ({ x: p.x, v: p.v }));
}

function sourcesOf(v: PublicOrderView, cited: Cited[]): Array<{ id: string; publisher: string; url: string; title: string }> {
  const ids = [...new Set(cited.filter((c) => v.ok.has(c)).map((c) => c.src))];
  return ids.map((id) => ({ id, ...v.file.sources[id]! }));
}

function citedOf(v: PublicOrderView, c: ChartSpec): Cited[] {
  const s = (id: string) => v.file.series.find((x) => x.id === id)?.points ?? [];
  switch (c.kind) {
    case "bars": return s(c.series);
    case "lines": return c.lines.flatMap((l) => s(l.series));
    case "stack": return c.parts.flatMap((p) => p.series.flatMap((id) => s(id).filter((q) => c.years.includes(q.x))));
    case "rank": return v.file.breakdowns.find((b) => b.id === c.breakdown)?.rows ?? [];
    case "episodes": return v.file.episodes.map((e) => e[c.field as keyof Episode] as Cited | undefined).filter((x): x is Cited => !!x);
  }
}

function isWide(v: PublicOrderView, c: ChartSpec): boolean {
  return c.kind === "stack" || (c.kind === "bars" && (v.file.series.find((s) => s.id === c.series)?.points.length ?? 0) > 12);
}

function ChartBody({ v, c }: { v: PublicOrderView; c: ChartSpec }) {
  switch (c.kind) {
    case "bars":
      return <YearBars points={seriesPoints(v, c.series)} colour={c.colour} format={fmt} minWidth={isWide(v, c) ? 900 : 560} />;
    case "lines":
      return <MultiLine format={fmt} lines={c.lines.map((l) => ({ label: l.label, colour: l.colour, dashed: l.dashed, points: seriesPoints(v, l.series) }))} />;
    case "stack": {
      const years = c.years.filter((y) => c.parts.some((p) => p.series.some((id) => seriesPoints(v, id).some((q) => q.x === y))));
      return (
        <StackColumns years={years} groups={c.parts.map((p) => {
          const values: Record<number, number> = {};
          for (const y of years) values[y] = p.series.reduce((a, id) => a + (seriesPoints(v, id).find((q) => q.x === y)?.v ?? 0), 0);
          return { label: p.label, colour: p.colour, values };
        })} />
      );
    }
    case "rank": {
      const b = v.file.breakdowns.find((x) => x.id === c.breakdown);
      const rows = (b?.rows ?? []).filter((r) => v.ok.has(r)).sort((a, z) => z.v - a.v).slice(0, c.top ?? 50);
      return <RankedRows tone="mid" rows={rows.map((r) => ({ name: r.label, value: r.v, display: fmt(r.v) + (b?.unit === "per lakh" ? "" : "") }))} />;
    }
    case "episodes": {
      const rows = v.file.episodes
        .map((e) => ({ e, c: e[c.field as keyof Episode] as Cited | undefined }))
        .filter((x): x is { e: Episode; c: Cited } => !!x.c && v.ok.has(x.c))
        .sort((a, z) => z.c.v - a.c.v);
      return (
        <RankedRows tone="hot" rows={rows.map(({ e, c: x }) => ({
          name: `${e.name} (${e.start.slice(0, 4)})`,
          meta: x.who ? `${x.who}` : e.state,
          value: x.v,
          display: c.field === "loss" ? `₹${fmt(x.v)} cr` : fmt(x.v),
        }))} />
      );
    }
  }
}

function SourceLine({ v, cited }: { v: PublicOrderView; cited: Cited[] }) {
  const src = sourcesOf(v, cited);
  const n = cited.filter((c) => v.ok.has(c)).length;
  if (!src.length) return null;
  // One name per publisher, its documents numbered after it: seven NCRB volumes
  // read as "National Crime Records Bureau 1 2 3 4 5 6 7", not seven times over.
  const byPub = new Map<string, typeof src>();
  for (const s of src) byPub.set(s.publisher, [...(byPub.get(s.publisher) ?? []), s]);
  return (
    <p className="mono mt-3 text-[10.5px] leading-[1.7]" style={{ color: "var(--story-ink-3)" }}>
      {n} figure{n === 1 ? "" : "s"}, each checked against its source&apos;s text ·{" "}
      {[...byPub].map(([pub, docs], i) => (
        <span key={pub}>
          {i ? " · " : ""}{pub}
          {docs.map((s, j) => (
            <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="ml-1 underline decoration-dotted" title={s.title}>
              {docs.length > 1 ? `[${j + 1}]` : "[link]"}
            </a>
          ))}
        </span>
      ))}
    </p>
  );
}

function first(v: PublicOrderView, id: string, x?: number) {
  const pts = seriesPoints(v, id);
  return x == null ? pts[0] : pts.find((p) => p.x === x);
}
function last(v: PublicOrderView, id: string) { const pts = seriesPoints(v, id); return pts[pts.length - 1]; }

export default function PublicOrderPage() {
  const v = loadPublicOrder();
  const f = v.file;
  let n = 0;
  const riots04 = first(v, "riots-total", 2004), riotsNow = last(v, "riots-total");
  const peak = seriesPoints(v, "riots-total").reduce<YearPoint | null>((a, p) => (!a || (p.v ?? 0) > (a.v ?? 0) ? p : a), null);
  const pdppNow = last(v, "pdpp");
  const aandolanNow = last(v, "riots-aandolan");
  const mhaKilled = seriesPoints(v, "mha-communal-killed");
  const mhaKilledSum = mhaKilled.reduce((a, p) => a + (p.v ?? 0), 0);
  const episodes = [...f.episodes].sort((a, z) => a.start.localeCompare(z.start));

  return (
    <article className="pt-8">
      <Eyebrow tone="hot">Protest and public order · India since 2004</Eyebrow>
      <h1 className="story-display mt-3 max-w-[20ch] text-[34px] sm:text-[48px] lg:text-[56px]">Riots, damage and the police, counted</h1>
      <Standfirst>
        {CHARTS.length} charts on what India records about collective violence: rioting cases since 2004 and what police recorded them as being about,
        prosecutions for destroying public property, police and civilians killed and injured, the Home Ministry&apos;s count of communal incidents, and the
        major episodes one by one. Every one of the {v.checked} figures quotes the NCRB volume, parliamentary answer, court filing or official statement it
        comes from, and is checked against that document&apos;s text before it is drawn.
      </Standfirst>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {riots04 && riotsNow && (
          <Stat size="md" label="Rioting cases registered" value={fmt(riotsNow.v!)} unit={`in ${riotsNow.x}`}
            note={<>{fmt(riots04.v!)} in 2004{peak ? <>, peaking at {fmt(peak.v!)} in {peak.x}</> : null}. Registered cases, NCRB.</>} />
        )}
        {aandolanNow && (
          <Stat size="md" tone="hot" label="Rioting during agitations" value={fmt(aandolanNow.v!)} unit={`in ${aandolanNow.x}`}
            note={<>Cases police recorded as rioting during an andolan or morcha — the closest national count of violent protest.</>} />
        )}
        {pdppNow && (
          <Stat size="md" label="Public property cases" value={fmt(pdppNow.v!)} unit={`in ${pdppNow.x}`}
            note={<>Cases under the Prevention of Damage to Public Property Act, 1984. Prosecutions begun, not rupees lost.</>} />
        )}
        {mhaKilled.length > 1 && (
          <Stat size="md" tone="hot" label="Killed in communal incidents" value={fmt(mhaKilledSum)} unit={`${mhaKilled[0]!.x}–${mhaKilled[mhaKilled.length - 1]!.x}`}
            note={<>Sum of the Home Ministry&apos;s year-wise counts (derived here by adding them).</>} />
        )}
      </div>

      <nav className="mt-8 flex flex-wrap gap-2 text-[12px]" aria-label="Parts">
        {PARTS.map((p) => <a key={p.id} href={`#${p.id}`} className="story-card px-3 py-1.5" style={{ borderRadius: 999 }}><b>{p.n}</b> {p.title}</a>)}
        <a href="#episodes-list" className="story-card px-3 py-1.5" style={{ borderRadius: 999 }}>Every episode</a>
        <a href="#sources" className="story-card px-3 py-1.5" style={{ borderRadius: 999 }}>Sources</a>
        <Link href="/protests/delhi-2026-10-10" className="story-card px-3 py-1.5" style={{ borderRadius: 999 }}>Delhi, 10 October 2026 →</Link>
      </nav>

      {PARTS.map((p) => (
        <section key={p.id} id={p.id} className="mt-16 scroll-mt-20">
          <Eyebrow>{p.n} · {p.title}</Eyebrow>
          <p className="mt-3 max-w-[70ch] text-[14px] leading-[1.62]" style={{ color: "var(--story-ink-2)" }}>{p.lede}</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {CHARTS.filter((c) => c.part === p.id).map((c) => {
              n += 1;
              const cited = citedOf(v, c);
              const wide = isWide(v, c);
              return (
                <figure key={c.id} id={`chart-${c.id}`} className={`story-card min-w-0 p-4 sm:p-5 ${wide ? "lg:col-span-2" : ""}`}>
                  <div className="flex items-baseline gap-2">
                    <span className="mono text-[11px] font-bold tabular-nums" style={{ color: "var(--s-hot)" }}>{String(n).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1"><ChartTitle note={c.what}>{c.title}</ChartTitle></div>
                  </div>
                  <ChartBody v={v} c={c} />
                  {c.read && <figcaption><Caption>{c.read}</Caption></figcaption>}
                  <SourceLine v={v} cited={cited} />
                </figure>
              );
            })}
          </div>
        </section>
      ))}

      <section id="episodes-list" className="mt-16 scroll-mt-20">
        <Eyebrow>Every episode, with whose number each figure is</Eyebrow>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {episodes.map((e) => <EpisodeCard key={e.id} v={v} e={e} />)}
        </div>
      </section>

      <WhatThisCannotSay items={[
        { q: "How many protests there were", a: "No Indian authority publishes a national count of protests. NCRB counts cases registered; a peaceful protest produces no case, and a protest that turns violent can produce one case or fifty." },
        { q: "Whether rioting has really fallen", a: "Registered rioting fell by more than half between its 2012 peak and 2024. Some of that may be less rioting; some may be fewer cases registered, or cases filed under other sections, and the count cannot tell these apart. 2024 is also the first year counted partly under the new criminal code (BNS), from 1 July." },
        { q: "What the damage cost", a: "The Bureau counts prosecutions under the public property law, not rupees. The losses charted here are the few figures a government, a court or a commission stated for a single episode, and each counts something different." },
        { q: "Who was responsible", a: "Nothing on this page attributes blame for any episode. Tolls are given as the stated source gave them; where other counts differ, the difference is noted beside the figure." },
      ]} />

      {v.failed.length > 0 && (
        <section className="mt-12">
          <Eyebrow tone="hot">Not drawn: {v.failed.length} figure{v.failed.length === 1 ? "" : "s"} that did not pass the check</Eyebrow>
          <ul className="mono mt-3 text-[11px] leading-[1.7]" style={{ color: "var(--story-ink-3)" }}>
            {v.failed.map((x) => <li key={x.where}>{x.where} — {x.why}</li>)}
          </ul>
        </section>
      )}

      <section id="sources" className="mt-16 scroll-mt-20 border-t pt-10" style={{ borderColor: "var(--story-rule)" }}>
        <Eyebrow>Sources, and how each figure was checked</Eyebrow>
        <p className="mt-3 max-w-[72ch] text-[13px] leading-[1.65]" style={{ color: "var(--story-ink-2)" }}>
          Official documents were downloaded and converted to text by a scheduled job; each figure in the data file carries a verbatim quote from its document, and the
          page draws a figure only if that quote is found in the document&apos;s text and contains the figure. Tier 1 is the record itself (an NCRB table, an answer laid in
          Parliament); tier 2 reports the record (a news agency quoting a minister&apos;s written reply); tier 3 is a press account. Text last read {v.probedAt.slice(0, 10)}.
        </p>
        <ul className="mt-5 grid gap-x-6 gap-y-2 text-[12px] md:grid-cols-2">
          {Object.entries(f.sources).map(([id, s]) => (
            <li key={id} className="leading-[1.5]">
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline decoration-dotted">{s.publisher}</a>
              <span style={{ color: "var(--story-ink-2)" }}> — {s.title}</span>
              <span className="mono ml-1 text-[10px]" style={{ color: "var(--story-ink-3)" }}>tier {s.tier} · {s.kind}{v.readAt[id] ? ` · read ${v.readAt[id]!.slice(0, 10)}` : ""}</span>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function EpisodeCard({ v, e }: { v: PublicOrderView; e: Episode }) {
  const rows: Array<[string, Cited | undefined, string?]> = [
    ["Deaths", e.deaths], ["Injured", e.injured], ["Police injured", e.policeInjured], ["Arrested", e.arrests],
    ["Cases (FIRs)", e.firs], ["Displaced", e.displaced], ["Loss", e.loss, e.loss?.what],
  ];
  return (
    <div className="story-card min-w-0 p-4">
      <p className="mono text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{e.start} · {e.state} · {EPISODE_KINDS[e.kind]}</p>
      <h3 className="mt-1 text-[15px] font-bold leading-tight">{e.name}</h3>
      <p className="mt-1.5 text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>{e.summary}</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12px]">
        {rows.filter(([, c]) => c && v.ok.has(c)).map(([label, c, what]) => {
          const s = v.file.sources[c!.src]!;
          return (
            <div key={label} className="contents">
              <dt className="font-semibold">{label}</dt>
              <dd>
                <span className="font-semibold tabular-nums">{label === "Loss" ? `₹${fmt(c!.v)} crore` : fmt(c!.v)}</span>
                {what && <span style={{ color: "var(--story-ink-2)" }}> ({what})</span>}
                <span style={{ color: "var(--story-ink-3)" }}> — {c!.who ? `${c!.who}, per ` : ""}<a href={s.url} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted">{s.publisher}</a></span>
              </dd>
            </div>
          );
        })}
      </dl>
      {e.disputes && e.disputes.length > 0 && (
        <ul className="mt-2.5 list-disc pl-4 text-[11.5px] leading-[1.55]" style={{ color: "var(--story-ink-3)" }}>
          {e.disputes.map((d) => <li key={d}>{d}</li>)}
        </ul>
      )}
    </div>
  );
}
