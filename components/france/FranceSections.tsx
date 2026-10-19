"use client";

import { useMemo, useState } from "react";
import { Translated } from "./Translated";
import {
  KIND_LABEL, THEME_LABEL, xSearchUrl,
  type Statement, type StatementKind, type Claim, type ClaimTheme, type BusinessReport,
  type MarketPoint, type EmbeddedPost,
} from "@/lib/france-riots-shared";

/**
 * The France riots dashboard's analytical sections. Every figure, claim and
 * business named here is a sentence quoted from an article, credited to the
 * person or body the sentence names; the components arrange them, they do
 * not add to them.
 */

const HOT = "var(--s-hot)";
const ago = (iso: string | null | undefined, now: number) => {
  if (!iso) return "undated";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  return s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86_400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86_400)} d ago`;
};
const Muted = ({ children }: { children: React.ReactNode }) => <p className="text-[13px]" style={{ color: "var(--story-ink-3)" }}>{children}</p>;
const Src = ({ outlet, url, seen, now }: { outlet: string; url: string; seen: string | null; now: number }) => (
  <span className="mono text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{outlet} · {ago(seen, now)} · <a className="underline decoration-dotted" href={url} target="_blank" rel="noopener noreferrer">article ↗</a></span>
);

function Chips<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v} className="rounded-full border px-2.5 py-1 text-[11.5px]"
          style={{ borderColor: value === v ? "var(--story-ink)" : "var(--story-rule)", fontWeight: value === v ? 700 : 500, background: value === v ? "var(--story-card)" : "transparent" }}>{l}</button>
      ))}
    </div>
  );
}

/* ── Key figures: the latest figure each kind of statement gives ──────── */

const NEAR: Partial<Record<StatementKind, RegExp>> = {
  arrests: /interpell|arrest|gardes? à vue|détenu|detain/i, injured: /bless|injur|hurt/i, deaths: /mort|dead|killed|tués?|died|décès/i,
  cost: /€|euros?/i, deployment: /policiers|gendarmes|forces|officers|mobilis|déploy|deploy/i, protesters: /manifestants|protesters|people|personnes/i,
};
/** The number in a sentence nearest the word for what is counted: "1,800 arrests and 500 injured" gives 500 for injuries. */
export function figureFor(s: Statement): string | null {
  const re = NEAR[s.kind];
  if (!s.numbers.length) return null;
  if (!re) return s.numbers[0]!;
  const keys = [...s.quote.matchAll(new RegExp(re.source, "gi"))].map((m) => m.index ?? 0);
  let best: string | null = null, dist = Infinity;
  for (const n of s.numbers) {
    const at = s.quote.indexOf(n);
    for (const k of keys) { const d = Math.abs(k - at); if (d < dist) { dist = d; best = n; } }
  }
  return best ?? s.numbers[0]!;
}

export function KeyFigures({ statements, now }: { statements: Statement[]; now: number }) {
  const kinds: StatementKind[] = ["arrests", "injured", "deaths", "cost", "deployment", "assaults"];
  const latest = kinds.map((k) => ({ k, s: statements.filter((x) => x.kind === k).sort((a, b) => (b.seen ?? "").localeCompare(a.seen ?? ""))[0] }));
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {latest.map(({ k, s }) => (
        <figure key={k} className="story-card min-w-0 p-4">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: HOT }}>{KIND_LABEL[k]}</p>
          {s ? (
            <>
              <p className="story-display mt-1 text-[30px] leading-none tabular-nums">{figureFor(s)}</p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--story-ink-2)" }}>latest stated, according to {s.who}</p>
              <blockquote className="mt-2 text-[12.5px] leading-[1.5]" style={{ color: "var(--story-ink-2)" }}><Translated text={s.quote.length > 220 ? `${s.quote.slice(0, 217)}…` : s.quote} en={s.en} lang={s.lang} quote /></blockquote>
              <div className="mt-1.5"><Src outlet={s.outlet} url={s.url} seen={s.seen} now={now} /></div>
            </>
          ) : <p className="mt-2 text-[12.5px]" style={{ color: "var(--story-ink-3)" }}>No figure stated by a named source in this view yet.</p>}
        </figure>
      ))}
    </div>
  );
}

/* ── Where: what the headlines report, by city and kind ───────────────── */

export function Businesses({ reports, now }: { reports: BusinessReport[]; now: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const brands = useMemo(() => {
    const by = new Map<string, BusinessReport[]>();
    for (const r of reports) by.set(r.brand, [...(by.get(r.brand) ?? []), r]);
    return [...by].map(([brand, rs]) => ({ brand, rs, cities: [...new Set(rs.map((r) => r.city).filter(Boolean))] as string[] })).sort((a, b) => b.rs.length - a.rs.length);
  }, [reports]);
  if (!brands.length) return <Muted>No business named as attacked in the articles read so far.</Muted>;
  return (
    <ul className="divide-y" style={{ borderColor: "var(--story-rule)" }}>
      {brands.map((b) => (
        <li key={b.brand} className="py-2" style={{ borderColor: "var(--story-rule)" }}>
          <button type="button" onClick={() => setOpen(open === b.brand ? null : b.brand)} className="flex w-full items-baseline gap-3 text-left">
            <span className="text-[14px] font-semibold">{b.brand}</span>
            <span className="text-[12px]" style={{ color: "var(--story-ink-3)" }}>{b.rs.length} report{b.rs.length === 1 ? "" : "s"}{b.cities.length ? ` · ${b.cities.join(", ")}` : ""}</span>
            <span className="ml-auto text-[11px]" style={{ color: "var(--story-ink-3)" }}>{open === b.brand ? "hide" : "show"} what was reported</span>
          </button>
          {open === b.brand && (
            <ul className="mt-2 space-y-2">
              {b.rs.slice(0, 8).map((r) => (
                <li key={r.quote} className="text-[12.5px] leading-[1.5]"><Translated text={r.quote} en={r.en} lang={r.lang ?? "en"} quote /> <Src outlet={r.outlet} url={r.url} seen={r.seen} now={now} /></li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ── Claims about the causes, and what officials say about who was arrested ── */

export function Claims({ claims, profile, now }: { claims: Claim[]; profile: Statement[]; now: number }) {
  const themes = (Object.keys(THEME_LABEL) as ClaimTheme[]).map((t) => ({ t, n: claims.filter((c) => c.themes.includes(t)).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const [theme, setTheme] = useState<"all" | ClaimTheme>("all");
  const shown = claims.filter((c) => theme === "all" || c.themes.includes(theme)).sort((a, b) => (b.seen ?? "").localeCompare(a.seen ?? "")).slice(0, 30);
  const max = Math.max(1, ...themes.map((x) => x.n));
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <ul className="space-y-1.5">
          {themes.map((x) => (
            <li key={x.t} className="grid grid-cols-[minmax(0,13rem)_1fr] items-center gap-2 text-[12px]">
              <button type="button" onClick={() => setTheme(theme === x.t ? "all" : x.t)} className="truncate text-left" style={{ fontWeight: theme === x.t ? 700 : 400 }}>{THEME_LABEL[x.t]}</button>
              <span className="flex items-center gap-2"><span style={{ width: `${(x.n / max) * 100}%`, minWidth: 3, height: 9, background: "var(--series-1)", borderRadius: "0 4px 4px 0" }} /><span className="mono text-[11px]">{x.n}</span></span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[11px]" style={{ color: "var(--story-ink-3)" }}>Claims by theme; click a theme to read them. A claim can carry several themes.</p>
        <ul className="mt-4 space-y-3">
          {shown.map((c) => (
            <li key={c.quote} className="story-card p-3">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: HOT }}>{c.speaker} · {c.themes.map((t) => THEME_LABEL[t]).join(" · ")}</p>
              <blockquote className="mt-1 text-[13px] leading-[1.55]"><Translated text={c.quote} en={c.en} lang={c.lang} quote /></blockquote>
              <div className="mt-1"><Src outlet={c.outlet} url={c.url} seen={c.seen} now={now} /></div>
            </li>
          ))}
          {!shown.length && <li><Muted>No claims about causes found in the articles read so far.</Muted></li>}
        </ul>
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold">What officials and courts say about who was arrested</p>
        <p className="mt-1 text-[11.5px] leading-[1.5]" style={{ color: "var(--story-ink-3)" }}>Ages, nationalities, records: the evidence a claim about causes can be checked against, as officials state it.</p>
        <ul className="mt-3 space-y-3">
          {profile.slice(0, 15).map((s) => (
            <li key={s.quote} className="text-[12.5px] leading-[1.5]"><Translated text={s.quote} en={s.en} lang={s.lang} quote /> <span className="text-[11px]" style={{ color: "var(--story-ink-2)" }}>— {s.who}</span> <Src outlet={s.outlet} url={s.url} seen={s.seen} now={now} /></li>
          ))}
          {!profile.length && <li><Muted>No official statement on the profile of those arrested in the articles read so far.</Muted></li>}
        </ul>
      </div>
    </div>
  );
}

/* ── Economy: markets around the riots, and what is said about the cost ── */

function Line({ pts, mark, label, fmt }: { pts: MarketPoint[]; mark: string; label: string; fmt: (v: number) => string }) {
  if (pts.length < 2) return <Muted>{label}: no closes read yet.</Muted>;
  const W = 440, H = 150, p = { l: 44, r: 10, t: 12, b: 20 };
  const lo = Math.min(...pts.map((x) => x.close)), hi = Math.max(...pts.map((x) => x.close));
  const x = (i: number) => p.l + (i / (pts.length - 1)) * (W - p.l - p.r);
  const y = (v: number) => p.t + (1 - (v - lo) / (hi - lo || 1)) * (H - p.t - p.b);
  const mi = pts.findIndex((q) => q.d >= mark);
  const last = pts.at(-1)!;
  return (
    <figure className="min-w-0">
      <p className="text-[12.5px] font-semibold">{label} · last {fmt(last.close)} ({last.d})</p>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={`${label}, daily closes`}>
        {[lo, hi].map((v) => <text key={v} x={p.l - 4} y={y(v) + 3} textAnchor="end" fontSize="9.5" fill="var(--story-ink-3)">{fmt(v)}</text>)}
        {mi >= 0 && <><line x1={x(mi)} x2={x(mi)} y1={p.t} y2={H - p.b} stroke={HOT} strokeDasharray="3 3" /><text x={x(mi) + 4} y={p.t + 9} fontSize="9.5" fill={HOT}>Mon 19 Oct</text></>}
        <path d={pts.map((q, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(q.close).toFixed(1)}`).join("")} fill="none" stroke="var(--series-1)" strokeWidth={2} />
        {pts.map((q, i) => <circle key={q.d} cx={x(i)} cy={y(q.close)} r={5} fill="transparent"><title>{`${q.d}: ${fmt(q.close)}`}</title></circle>)}
        <text x={p.l} y={H - 5} fontSize="9.5" fill="var(--story-ink-3)">{pts[0]!.d}</text>
        <text x={W - p.r} y={H - 5} textAnchor="end" fontSize="9.5" fill="var(--story-ink-3)">{last.d}</text>
      </svg>
    </figure>
  );
}

export function Economy({ markets, statements, now }: { markets: { cac40: MarketPoint[]; eurusd: MarketPoint[] } | undefined; statements: Statement[]; now: number }) {
  const since = (pts: MarketPoint[]) => pts.filter((p) => p.d >= "2026-09-15");
  return (
    <div>
      <div className="grid gap-6 md:grid-cols-2">
        <Line pts={since(markets?.cac40 ?? [])} mark="2026-10-19" label="CAC 40, Paris stock index" fmt={(v) => v.toFixed(0)} />
        <Line pts={since(markets?.eurusd ?? [])} mark="2026-10-19" label="Euro, in US dollars (ECB)" fmt={(v) => v.toFixed(3)} />
      </div>
      <p className="mt-1 text-[11px]" style={{ color: "var(--story-ink-3)" }}>Daily closes: the CAC 40 from Yahoo Finance (Stooq as a fallback), the euro at the European Central Bank's reference rate. The line marks the first trading day after the riots of Saturday 17 October. Markets move for many reasons at once — France&apos;s budget and debt among them — and a move here is not a measure of what the riots cost.</p>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {statements.slice(0, 16).map((s) => (
          <li key={s.quote} className="story-card p-3 text-[12.5px] leading-[1.5]">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: HOT }}>{KIND_LABEL[s.kind]} · according to {s.who}</p>
            <Translated text={s.quote} en={s.en} lang={s.lang} quote /> <div className="mt-1"><Src outlet={s.outlet} url={s.url} seen={s.seen} now={now} /></div>
          </li>
        ))}
        {!statements.length && <li><Muted>No figure on the economic cost stated by a named source yet.</Muted></li>}
      </ul>
    </div>
  );
}

/* ── Live: newsroom streams and public webcams ────────────────────────── */

export function LiveStreams({ streams, channels, webcams }: { streams: ReadonlyArray<readonly [string, string]>; channels: Record<string, { id: string | null } | undefined>; webcams: ReadonlyArray<{ name: string; url: string }> }) {
  const live = streams.filter(([h]) => channels[h]?.id);
  const [pick, setPick] = useState<string | null>(null);
  const id = pick ? channels[pick]?.id : null;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap gap-1.5">
          {live.map(([h, name]) => (
            <button key={h} type="button" onClick={() => setPick(h)} aria-pressed={pick === h} className="rounded-full border px-2.5 py-1 text-[11.5px]"
              style={{ borderColor: pick === h ? "var(--story-ink)" : "var(--story-rule)", fontWeight: pick === h ? 700 : 500 }}>{name}</button>
          ))}
        </div>
        <div className="relative mt-3 aspect-video overflow-hidden rounded-lg bg-black">
          {id ? (
            <iframe key={id} className="absolute inset-0 h-full w-full" src={`https://www.youtube-nocookie.com/embed/live_stream?channel=${id}&autoplay=1&mute=1`} title="Live stream" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          ) : (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-[13px]" style={{ color: "#ddd" }}>Choose a channel to watch its live stream. A channel that is not broadcasting at the moment shows YouTube&apos;s offline notice.</p>
          )}
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold">Public webcams and live searches</p>
        <p className="mt-1 text-[11.5px] leading-[1.5]" style={{ color: "var(--story-ink-3)" }}>Tourist and city cameras run by their owners, and YouTube&apos;s list of streams live now. Police CCTV is not public anywhere in France; these cameras point where their owners chose, not at the unrest.</p>
        <ul className="mt-3 space-y-2">
          {webcams.map((w) => <li key={w.url}><a className="text-[13px] underline decoration-dotted" href={w.url} target="_blank" rel="noopener noreferrer">{w.name} ↗</a></li>)}
        </ul>
      </div>
    </div>
  );
}

/* ── Accounts on X ────────────────────────────────────────────────────── */

export function Accounts({ groups, embedded }: { groups: ReadonlyArray<{ group: string; list: ReadonlyArray<readonly [string, string, string]> }>; embedded: EmbeddedPost[] }) {
  const inCoverage = new Map<string, number>();
  for (const p of embedded) if (p.handle) inCoverage.set(p.handle.toLowerCase(), (inCoverage.get(p.handle.toLowerCase()) ?? 0) + 1);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {groups.map((g) => (
        <div key={g.group} className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--story-ink-2)" }}>{g.group}</p>
          <ul className="mt-2 divide-y" style={{ borderColor: "var(--story-rule)" }}>
            {g.list.map(([handle, name, role]) => (
              <li key={handle} className="flex flex-wrap items-baseline gap-x-2 py-1.5 text-[12.5px]" style={{ borderColor: "var(--story-rule)" }}>
                <a className="font-semibold hover:underline" href={`https://x.com/${handle}`} target="_blank" rel="noopener noreferrer">{name}</a>
                <span className="mono text-[11px]" style={{ color: "var(--story-ink-3)" }}>@{handle}</span>
                <span className="text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>{role}</span>
                {inCoverage.get(handle.toLowerCase()) ? <span className="text-[11px] font-semibold" style={{ color: HOT }}>{inCoverage.get(handle.toLowerCase())} embedded in coverage</span> : null}
                <a className="ml-auto text-[11.5px] underline decoration-dotted" href={xSearchUrl(`from:${handle} (France OR Paris OR émeutes OR riots OR manifestation)`)} target="_blank" rel="noopener noreferrer">their posts on this ↗</a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
