"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator } from "d3-geo";
import {
  KIND_LABEL, X_LIVE_SEARCHES, xSearchUrl, mergeBy, headlineKey,
  type FranceLivePayload, type Headline, type Outline, type Statement, type StatementKind, type Video, type XPost,
} from "@/lib/france-riots-shared";

/**
 * The live France riots tracker. Asks /api/france-riots every minute while the
 * page is open; everything shown is a report, labelled with who published it
 * and when, and new arrivals since the page opened are marked.
 */

const POLL_MS = 60_000;
const C1 = "var(--series-1)", C2 = "var(--series-2)", HOT = "var(--s-hot)";

function ago(iso: string | null | undefined, now: number): string {
  if (!iso) return "undated";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
}
const paris = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " Paris" : "");

function Section({ id, title, note, children, right }: { id: string; title: string; note?: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-20">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="story-display text-[22px] sm:text-[26px]">{title}</h2>
        {right}
      </div>
      {note && <p className="mt-1.5 max-w-[72ch] text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-3)" }}>{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Tabs<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v} onClick={() => onChange(v)}
          className="rounded-full border px-2.5 py-1 text-[11.5px]"
          style={{ borderColor: value === v ? "var(--story-ink)" : "var(--story-rule)", fontWeight: value === v ? 700 : 500, background: value === v ? "var(--story-card)" : "transparent" }}>
          {label}
        </button>
      ))}
    </div>
  );
}

const NewTag = () => <span className="ml-1.5 rounded-[3px] px-1 text-[9px] font-bold uppercase tracking-[0.08em]" style={{ background: HOT, color: "#fff" }}>new</span>;

/** A quote with its counts picked out, so the figure is found at a glance but read in its sentence. */
function Quote({ s }: { s: Statement }) {
  const parts: Array<string | { n: string }> = [];
  let rest = s.quote;
  for (const n of s.numbers) {
    const i = rest.indexOf(n);
    if (i < 0) continue;
    parts.push(rest.slice(0, i), { n });
    rest = rest.slice(i + n.length);
  }
  parts.push(rest);
  return <>{parts.map((p, i) => (typeof p === "string" ? <span key={i}>{p}</span> : <mark key={i} className="rounded-[2px] px-0.5 font-semibold" style={{ background: "var(--s-hot-fill)", color: "var(--story-ink)" }}>{p.n}</mark>))}</>;
}

function Pulse({ points }: { points: Array<{ t: string; v: number }> }) {
  if (points.length < 2) return <p className="text-[12.5px]" style={{ color: "var(--story-ink-3)" }}>The coverage pulse appears after the scheduled job&apos;s first run.</p>;
  const W = 900, H = 180, pad = { l: 34, r: 8, t: 14, b: 22 };
  const max = Math.max(...points.map((p) => p.v), 1);
  const step = (W - pad.l - pad.r) / points.length;
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const peak = points.reduce((a, b) => (b.v > a.v ? b : a));
  const days = points.filter((p) => p.t.slice(11, 13) === "00");
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 520, height: "auto" }} role="img" aria-label={`Articles per hour, peak ${peak.v} at ${paris(peak.t)}`}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} stroke="var(--story-rule)" strokeDasharray={f ? "2 3" : undefined} />
            <text x={pad.l - 5} y={y(max * f) + 3} textAnchor="end" fontSize="10" fill="var(--story-ink-3)">{Math.round(max * f)}</text>
          </g>
        ))}
        {points.map((p, i) => {
          const x = pad.l + i * step, h = y(0) - y(p.v);
          return <rect key={p.t} x={x + 0.5} y={y(p.v)} width={Math.max(1, step - 1)} height={Math.max(0, h)} rx={Math.min(2, step / 3)} fill={p === peak ? HOT : C1}><title>{`${paris(p.t)}: ${p.v} articles`}</title></rect>;
        })}
        {days.map((p) => {
          const i = points.indexOf(p);
          return <text key={p.t} x={pad.l + i * step} y={H - 6} fontSize="10" fill="var(--story-ink-3)">{new Date(p.t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}</text>;
        })}
        <text x={Math.min(W - 120, pad.l + points.indexOf(peak) * step)} y={y(peak.v) - 4} fontSize="10.5" fontWeight={700} fill="var(--story-ink)">{`peak ${peak.v}/h`}</text>
      </svg>
    </div>
  );
}

function FranceMap({ outline, places }: { outline: Outline; places: Array<{ name: string; lat: number; lon: number; count: number }> }) {
  const proj = useMemo(() => geoMercator().scale(outline.scale).translate(outline.translate), [outline]);
  const max = Math.max(1, ...places.map((p) => p.count));
  const top = places.slice(0, 12);
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <svg viewBox={`0 0 ${outline.width} ${outline.height}`} style={{ width: "100%", height: "auto", maxHeight: 520 }} role="img" aria-label={`Places named in coverage: ${top.map((p) => `${p.name} ${p.count}`).join(", ")}`}>
        <path d={outline.d} fill="var(--story-card)" stroke="var(--story-ink-3)" strokeWidth={0.8} />
        {[...places].reverse().map((p) => {
          const xy = proj([p.lon, p.lat]);
          if (!xy) return null;
          return <circle key={`${p.name}${p.lat}`} cx={xy[0]} cy={xy[1]} r={3 + 20 * Math.sqrt(p.count / max)} fill={HOT} fillOpacity={0.35} stroke={HOT} strokeWidth={1}><title>{`${p.name}: named ${p.count} times`}</title></circle>;
        })}
        {top.slice(0, 7).map((p) => {
          const xy = proj([p.lon, p.lat]);
          return xy ? <text key={`l${p.name}`} x={xy[0] + 6} y={xy[1] - 6} fontSize="11" fontWeight={600} fill="var(--story-ink)" style={{ paintOrder: "stroke", stroke: "var(--story-card)", strokeWidth: 3 }}>{p.name.split(",")[0]}</text> : null;
        })}
      </svg>
      <ol className="space-y-1.5 text-[12.5px]">
        {top.map((p, i) => (
          <li key={p.name} className="flex items-center gap-2">
            <span className="mono w-5 text-right text-[11px]" style={{ color: "var(--story-ink-3)" }}>{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <span className="h-2 rounded-r-[3px]" style={{ width: `${Math.max(4, (p.count / max) * 120)}px`, background: HOT }} />
            <span className="mono w-10 text-right text-[11px] tabular-nums">{p.count}</span>
          </li>
        ))}
        {!top.length && <li style={{ color: "var(--story-ink-3)" }}>No places yet: the map fills after the scheduled job&apos;s first run.</li>}
      </ol>
    </div>
  );
}

function VideoCard({ v, now, isNew }: { v: Video; now: number; isNew: boolean }) {
  const [play, setPlay] = useState(false);
  return (
    <figure className="story-card min-w-0 overflow-hidden">
      <div className="relative aspect-video bg-black">
        {play ? (
          <iframe className="absolute inset-0 h-full w-full" src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`} title={v.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        ) : (
          <button type="button" onClick={() => setPlay(true)} className="group absolute inset-0" aria-label={`Play: ${v.title}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 group-hover:opacity-100" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-4 py-2 text-[13px] font-bold" style={{ background: "rgba(0,0,0,.7)", color: "#fff" }}>▶ Play</span>
          </button>
        )}
      </div>
      <figcaption className="p-3">
        <p className="text-[13px] font-semibold leading-snug">{v.title}{isNew && <NewTag />}</p>
        <p className="mono mt-1 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{v.channel} · {ago(v.published, now)} · <a className="underline decoration-dotted" href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer">YouTube</a></p>
      </figcaption>
    </figure>
  );
}

declare global { interface Window { twttr?: { widgets?: { load: (el?: Element | null) => void } } } }

function XPosts({ posts, active, reason, readsToday, budget }: { posts: XPost[]; active: boolean; reason?: string; readsToday: number; budget: number }) {
  const [show, setShow] = useState(false);
  const [videoOnly, setVideoOnly] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const list = posts.filter((p) => !videoOnly || p.video).slice(0, 12);
  useEffect(() => {
    if (!show) return;
    const run = () => window.twttr?.widgets?.load(box.current);
    if (window.twttr?.widgets) { run(); return; }
    const s = document.createElement("script");
    s.src = "https://platform.twitter.com/widgets.js"; s.async = true; s.onload = run;
    document.body.appendChild(s);
  }, [show, videoOnly, list.length]);
  return (
    <div>
      {posts.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {!show && <button type="button" onClick={() => setShow(true)} className="rounded-md border px-3 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: "var(--story-ink)" }}>Show {posts.length} posts from X</button>}
            <label className="flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={videoOnly} onChange={(e) => setVideoOnly(e.target.checked)} /> Videos only</label>
            <span className="text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>Loads content from x.com. Posts from French institutions, officials and newsrooms only.</span>
          </div>
          {show && (
            <div ref={box} className="mt-4 grid gap-3 md:grid-cols-2">
              {list.map((p) => (
                <blockquote key={p.id} className="twitter-tweet" data-dnt="true" data-theme="light">
                  <a href={`https://twitter.com/${p.handle || "x"}/status/${p.id}`}>Post by @{p.handle} on X</a>
                </blockquote>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-[13px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
          {active ? <>No matching posts from the listed accounts yet{reason ? ` — ${reason}` : ""}.</> : <>The site is not reading X right now: {reason ?? "no API access"}. X charges for every post read, so the tracker reads it only with a token and within a daily budget{budget ? ` (${readsToday} of ${budget} posts today)` : ""}.</>}
        </p>
      )}
      <div className="mt-4">
        <p className="text-[12px] font-semibold" style={{ color: "var(--story-ink-2)" }}>Open X&apos;s own live search (nothing is stored here):</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {X_LIVE_SEARCHES.map((s) => <a key={s.q} href={xSearchUrl(s.q)} target="_blank" rel="noopener noreferrer" className="rounded-full border px-3 py-1 text-[12px]" style={{ borderColor: "var(--story-rule)" }}>{s.label} ↗</a>)}
        </div>
      </div>
    </div>
  );
}

export default function FranceLive({ initial, outline }: { initial: FranceLivePayload; outline: Outline }) {
  const [data, setData] = useState<FranceLivePayload>(initial);
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [lastAsk, setLastAsk] = useState<number | null>(null);
  const firstSeen = useRef<Set<string> | null>(null);
  const [lang, setLang] = useState<"all" | "fr" | "en" | "official">("all");
  const [kind, setKind] = useState<"all" | StatementKind>("all");
  const [channel, setChannel] = useState("all");

  const load = async () => {
    try {
      const r = await fetch("/api/france-riots", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as FranceLivePayload;
      setData(j); setState("ok"); setLastAsk(Date.now());
    } catch { setState((s) => (s === "ok" ? "ok" : "failed")); setLastAsk(Date.now()); }
  };
  useEffect(() => { void load(); const t = setInterval(() => setNow(Date.now()), 10_000); return () => clearInterval(t); }, []);
  useEffect(() => { if (paused) return; const t = setInterval(() => { void load(); }, POLL_MS); return () => clearInterval(t); }, [paused]);

  const reg = data.register;
  const headlines = useMemo(() => mergeBy(data.headlines, reg?.headlines ?? [], headlineKey, 600), [data, reg]);
  const videos = useMemo(() => mergeBy(data.videos, reg?.videos ?? [], (v) => v.id, 300), [data, reg]);
  const statements = reg?.statements ?? [];
  const keyOf = (h: Headline) => headlineKey(h);
  // What was on the page at first load; anything else that arrives is new.
  if (firstSeen.current === null && state !== "loading") firstSeen.current = new Set([...headlines.map(keyOf), ...videos.map((v) => v.id), ...statements.map((s) => s.quote)]);
  const isNew = (k: string) => !!firstSeen.current && !firstSeen.current.has(k);
  const newCount = [...headlines.map(keyOf), ...videos.map((v) => v.id), ...statements.map((s) => s.quote)].filter(isNew).length;

  const shownHeadlines = headlines.filter((h) => lang === "all" ? h.kind === "press" : lang === "official" ? h.kind === "official" : h.kind === "press" && h.lang === lang).slice(0, 60);
  const kinds = (Object.keys(KIND_LABEL) as StatementKind[]).filter((k) => statements.some((s) => s.kind === k));
  const shownStatements = statements.filter((s) => kind === "all" || s.kind === kind).slice(0, 30);
  const channels = [...new Set(videos.map((v) => v.channel))];
  const shownVideos = videos.filter((v) => channel === "all" || v.channel === channel).slice(0, 24);
  const ok = data.status.filter((s) => s.ok).length;

  return (
    <div>
      {/* Status strip */}
      <div className="sticky top-[52px] z-30 -mx-4 mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-y px-4 py-2 text-[12px] backdrop-blur-md sm:mx-0 sm:rounded-lg sm:border"
        style={{ borderColor: "var(--story-rule)", background: "color-mix(in srgb, var(--story-card) 88%, transparent)" }}>
        <span className="flex items-center gap-1.5 font-bold" style={{ color: state === "failed" ? "var(--story-ink-3)" : HOT }}>
          <span aria-hidden className={paused || state === "failed" ? "" : "animate-pulse"} style={{ width: 8, height: 8, borderRadius: 9, background: state === "failed" ? "var(--story-ink-3)" : HOT }} />
          {state === "loading" ? "Connecting…" : state === "failed" ? "Live feed unavailable — showing the last saved run" : paused ? "Paused" : "Live"}
        </span>
        <span style={{ color: "var(--story-ink-2)" }}>Checked {lastAsk ? ago(new Date(lastAsk).toISOString(), now) : "—"} · sources answering {ok} of {data.status.length}</span>
        {reg && <span style={{ color: "var(--story-ink-3)" }}>Scheduled job last ran {ago(reg.updatedAt, now)}</span>}
        {newCount > 0 && <span className="font-semibold" style={{ color: HOT }}>{newCount} new since you opened the page</span>}
        <span className="ml-auto flex gap-2">
          <button type="button" onClick={() => void load()} className="rounded border px-2 py-0.5" style={{ borderColor: "var(--story-rule)" }}>Refresh</button>
          <button type="button" onClick={() => setPaused((p) => !p)} className="rounded border px-2 py-0.5" style={{ borderColor: "var(--story-rule)" }}>{paused ? "Resume" : "Pause"}</button>
        </span>
      </div>

      <nav aria-label="On this page" className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
        {[["figures", "Officials' figures"], ["pulse", "Coverage pulse"], ["map", "Where"], ["videos", "Videos"], ["x", "Posts on X"], ["headlines", "Headlines"], ["government", "Government & advisories"], ["world", "World coverage"], ["sources", "Sources"]].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="underline decoration-dotted underline-offset-2">{label}</a>
        ))}
      </nav>

      <Section id="figures" title="What officials have said, in their words"
        note={<>Sentences from news articles in which a minister, prefecture, the police, prosecutors or the organisers give a figure — quoted word for word, with who said it. Figures rise through a night and organisers and police count differently; nothing here is added up or confirmed by this site.</>}
        right={kinds.length > 0 ? <Tabs value={kind} onChange={setKind} options={[["all", `All · ${statements.length}`], ...kinds.map((k) => [k, `${KIND_LABEL[k]} · ${statements.filter((s) => s.kind === k).length}`] as [StatementKind, string])]} /> : null}>
        {shownStatements.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {shownStatements.map((s) => (
              <figure key={s.quote} className="story-card min-w-0 p-4">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: HOT }}>{KIND_LABEL[s.kind]} · according to {s.who}{isNew(s.quote) && <NewTag />}</p>
                <blockquote className="mt-2 text-[14px] leading-[1.55]">&ldquo;<Quote s={s} />&rdquo;</blockquote>
                <figcaption className="mono mt-2 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{s.outlet} · {ago(s.seen, now)} · <a className="underline decoration-dotted" href={s.url} target="_blank" rel="noopener noreferrer">read the article ↗</a></figcaption>
              </figure>
            ))}
          </div>
        ) : <p className="text-[13px]" style={{ color: "var(--story-ink-3)" }}>No quoted figures yet. The scheduled job reads new articles every twenty minutes and keeps the sentences in which a named official, the police or the organisers give a count.</p>}
      </Section>

      <Section id="pulse" title="How much is being written, hour by hour"
        note={<>Articles matching riot terms in France, per hour, in GDELT&apos;s index of world news over the past seven days. A measure of coverage, not of violence: a night of rioting and a night of commentary about it both raise it. Peak in pink.</>}>
        <Pulse points={reg?.pulse ?? []} />
      </Section>

      <Section id="map" title="Where it is being reported from"
        note={<>Places in metropolitan France named in matching coverage over the last 48 hours, sized by how often, as GDELT geocodes them. A place named in many articles is not necessarily where the most happened.</>}>
        <FranceMap outline={outline} places={reg?.places ?? []} />
      </Section>

      <Section id="videos" title="Videos from newsrooms"
        note={<>The latest videos on {channels.length || "the listed"} newsrooms&apos; YouTube channels whose titles name unrest in France. Footage is the newsroom&apos;s; it plays from YouTube when you press play.</>}
        right={channels.length > 1 ? <Tabs value={channel} onChange={setChannel} options={[["all", `All · ${videos.length}`], ...channels.slice(0, 8).map((c) => [c, c] as [string, string])]} /> : null}>
        {shownVideos.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shownVideos.map((v) => <VideoCard key={v.id} v={v} now={now} isNew={isNew(v.id)} />)}</div>
        ) : <p className="text-[13px]" style={{ color: "var(--story-ink-3)" }}>No matching videos yet from the listed channels.</p>}
      </Section>

      <Section id="x" title="Posts on X" note={<>From French institutions (the Interior Ministry, the Paris police prefecture, the national police and gendarmerie, the Élysée), public officials and newsrooms. Private individuals are not searched or shown.</>}>
        <XPosts posts={reg?.x.posts ?? []} active={!!reg?.x.active} reason={reg?.x.reason} readsToday={reg?.x.readsToday ?? 0} budget={reg?.x.budgetPerDay ?? 0} />
      </Section>

      <Section id="headlines" title="Headlines, as they are published"
        note={<>From Google News&apos;s search, asked in French and in English every minute while this page is open, and kept by the scheduled job so the record outlasts the search&apos;s one-day memory. A headline is a pointer to a report, not a fact.</>}
        right={<Tabs value={lang} onChange={setLang} options={[["all", "All"], ["fr", "Français"], ["en", "English"], ["official", "Government sites"]]} />}>
        <ul className="divide-y" style={{ borderColor: "var(--story-rule)" }}>
          {shownHeadlines.map((h) => (
            <li key={keyOf(h)} className="flex gap-3 py-2" style={{ borderColor: "var(--story-rule)" }}>
              <span className="mono w-16 shrink-0 pt-0.5 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{ago(h.published, now)}</span>
              <span className="min-w-0">
                <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-[13.5px] font-medium leading-snug hover:underline">{h.title}</a>{isNew(keyOf(h)) && <NewTag />}
                <span className="block text-[11px]" style={{ color: "var(--story-ink-3)" }}>{h.outlet || "—"} · {h.lang === "fr" ? "French" : "English"} · {paris(h.published)}</span>
              </span>
            </li>
          ))}
          {!shownHeadlines.length && <li className="py-2 text-[13px]" style={{ color: "var(--story-ink-3)" }}>No headlines in this view yet.</li>}
        </ul>
      </Section>

      <Section id="government" title="Government announcements and travel advice"
        note={<>What governments are telling people: the French Interior Ministry&apos;s press page, announcements on French government sites, and foreign governments&apos; travel advice for France.</>}>
        <div className="grid gap-3 lg:grid-cols-2">
          {(data.advisories.length ? data.advisories : reg?.advisories ?? []).map((a) => (
            <figure key={a.id} className="story-card min-w-0 p-4">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: C2 }}>Travel advice · {a.name}</p>
              <p className="mt-2 text-[14px] font-semibold leading-snug">{a.change ?? "Travel advice for France"}</p>
              {a.excerpt && <p className="mt-2 text-[13px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>&ldquo;{a.excerpt}&rdquo;</p>}
              <p className="mono mt-2 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>Updated {paris(a.updatedAt)} · <a className="underline decoration-dotted" href={a.page} target="_blank" rel="noopener noreferrer">full advice ↗</a></p>
            </figure>
          ))}
          <figure className="story-card min-w-0 p-4">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: C1 }}>Ministère de l&apos;Intérieur · press</p>
            <ul className="mt-2 space-y-1.5">
              {(reg?.official ?? []).slice(0, 10).map((o) => (
                <li key={o.url} className="text-[13px] leading-snug">
                  <a href={o.url} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ fontWeight: o.relevant ? 650 : 400 }}>{o.title}</a>
                  {o.date && <span className="mono ml-1.5 text-[10.5px]" style={{ color: "var(--story-ink-3)" }}>{o.date}</span>}
                </li>
              ))}
              {!(reg?.official ?? []).length && <li className="text-[12.5px]" style={{ color: "var(--story-ink-3)" }}>The ministry&apos;s press page has not been read yet.</li>}
            </ul>
            <p className="mt-2 text-[11px]" style={{ color: "var(--story-ink-3)" }}>Bold: titles about demonstrations or violence.</p>
          </figure>
        </div>
      </Section>

      <Section id="world" title="How the world is covering it"
        note={<>The newest matching articles in GDELT&apos;s index, from outlets in any country and many languages, as GDELT titles them.</>}>
        <ul className="grid gap-x-6 gap-y-2 md:grid-cols-2">
          {(reg?.articles ?? []).slice(0, 30).map((a) => (
            <li key={a.url} className="min-w-0 text-[13px] leading-snug">
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{a.title}</a>
              <span className="block text-[11px]" style={{ color: "var(--story-ink-3)" }}>{a.domain} · {a.country || "—"} · {a.language} · {ago(a.seen, now)}</span>
            </li>
          ))}
          {!(reg?.articles ?? []).length && <li className="text-[13px]" style={{ color: "var(--story-ink-3)" }}>GDELT&apos;s articles appear after the scheduled job&apos;s first run.</li>}
        </ul>
      </Section>

      <Section id="sources" title="Sources, and whether they are answering">
        <ul className="grid gap-1.5 text-[12.5px] sm:grid-cols-2">
          {[...data.status, ...(reg?.status ?? []).filter((s) => !data.status.some((d) => d.id === s.id))].map((s) => (
            <li key={s.id} className="flex items-start gap-2">
              <span aria-hidden style={{ color: s.ok ? "var(--series-3)" : HOT }}>{s.ok ? "●" : "○"}</span>
              <span><b>{s.label}</b> — {s.ok ? `${s.count} item${s.count === 1 ? "" : "s"}` : "not answering"}{s.error ? ` (${s.error})` : ""}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
