"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { TleFeed } from "@/lib/tle-source";
import type { LiveState, SpacePart, SpacePublished } from "@/lib/space-story";
import type { SceneId, Stage, StageData } from "./stage";
import { SpaceExplorer } from "./SpaceExplorer";
import { LiveReadout } from "./LiveReadout";

/**
 * The chaptered half of /space: a holographic stage pinned to the viewport,
 * chapters scrolling over it, a counter, up and down, a contents menu, and an
 * X-ray explorer that opens over everything.
 *
 * The text carries every figure and its source; the stage illustrates it. The
 * one live element is NISAR's position and the positions of India's fleet,
 * propagated here from CelesTrak's public elements — the readout says so, and
 * says how old the elements are. Without WebGL, or with reduced motion, every
 * chapter's text is still there.
 */

export interface SpaceStep {
  scene: SceneId;
  kicker: string;
  title: string;
  content: ReactNode;
  hud?: Array<[string, string]>;
  live?: boolean;
  legend?: Array<{ colour: string; label: string }>;
}

export function SpaceStory({ steps, stage: stageData, parts, origins, sources }: {
  steps: SpaceStep[];
  stage: StageData;
  parts: SpacePart[];
  origins: SpacePublished["origins"];
  sources: Array<{ id: string; publisher: string; url: string }>;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const [mode, setMode] = useState<"loading" | "3d" | "flat">("loading");
  const [current, setCurrent] = useState(0);
  const [contents, setContents] = useState(false);
  const [explorer, setExplorer] = useState(false);
  const [live, setLive] = useState<LiveState | null>(null);
  const [contacts, setContacts] = useState<string[]>([]);
  const [fleetCounts, setFleetCounts] = useState<Record<string, number>>({});
  const [feed, setFeed] = useState<{ status: "loading" | "ok" | "none"; origin?: TleFeed["origin"]; fetchedAt?: string; nisar: boolean }>({ status: "loading", nisar: false });
  const [warp, setWarp] = useState(1);
  const feedRef = useRef<TleFeed | null>(null);

  useEffect(() => {
    let disposed = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
    if (!gl || !canvas.current || !overlay.current) { setMode("flat"); return; }
    import("./stage")
      .then(({ createStage }) => {
        if (disposed || !canvas.current || !overlay.current) return;
        const s = createStage(canvas.current, overlay.current, stageData, reduced);
        stage.current = s;
        s.onLive((st, extra) => { setLive(st); setContacts(extra.contacts); setFleetCounts(extra.fleet); });
        const f = feedRef.current;
        if (f) pushFeed(s, f);
        setMode("3d");
      })
      .catch(() => setMode("flat"));
    const onResize = () => stage.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      stage.current?.dispose();
      stage.current = null;
    };
  }, [stageData]);

  // The live feed: India's fleet and NISAR, from the site's CelesTrak route.
  useEffect(() => {
    let gone = false;
    fetch("/api/tle")
      .then((r) => (r.ok ? (r.json() as Promise<TleFeed>) : null))
      .then((f) => {
        if (gone) return;
        if (!f) { setFeed({ status: "none", nisar: false }); return; }
        feedRef.current = f;
        setFeed({ status: "ok", origin: f.origin, fetchedAt: f.fetchedAt, nisar: f.satellites.some((s) => /^NISAR/i.test(s.name)) });
        if (stage.current) pushFeed(stage.current, f);
      })
      .catch(() => { if (!gone) setFeed({ status: "none", nisar: false }); });
    return () => { gone = true; };
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => stage.current?.setActive(Boolean(e?.isIntersecting)));
    io.observe(el);
    return () => io.disconnect();
  }, [mode]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const nodes = [...el.querySelectorAll<HTMLElement>("[data-step]")];
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setCurrent(Number(e.target.getAttribute("data-step")));
    }, { rootMargin: "-45% 0px -45% 0px" });
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const s = steps[current];
    if (s && stage.current) stage.current.setScene(s.scene);
  }, [current, steps, mode]);

  useEffect(() => { stage.current?.setWarp(warp); }, [warp, mode]);

  const go = useCallback((i: number) => {
    const el = wrap.current?.querySelector<HTMLElement>(`[data-step="${Math.max(0, Math.min(steps.length - 1, i))}"]`);
    el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    setContents(false);
  }, [steps.length]);

  const step = steps[current];
  const n = (i: number) => String(i + 1).padStart(2, "0");
  return (
    <section ref={wrap} className="sp-scrolly relative" aria-label="How a satellite works, through NISAR, and India in space, illustrated">
      <div className="sp-stage sticky top-[56px] h-[calc(100svh-56px)]" aria-hidden={mode !== "3d"}>
        <canvas ref={canvas} className="absolute inset-0 h-full w-full touch-pan-y" />
        <div ref={overlay} className="pointer-events-none absolute inset-0 overflow-hidden" />
        <div className="sp-scanlines pointer-events-none absolute inset-0" />
        {mode === "flat" && (
          <div className="absolute inset-0 flex items-end p-6">
            <p className="sp-card max-w-md text-[13px]">The 3D pictures need WebGL, which this browser has not made available. Every figure and its source is in the text.</p>
          </div>
        )}
        <div className="sp-topbar absolute left-3 right-3 top-3 flex items-start justify-between gap-2 sm:left-5 sm:right-5">
          <div className="sp-kicker">{step?.kicker}</div>
          <div className="flex items-center gap-1.5">
            <button type="button" className="sp-btn" onClick={() => setExplorer(true)}>X-ray explorer</button>
            <div className="relative">
              <button type="button" className="sp-btn" aria-expanded={contents} onClick={() => setContents((v) => !v)}>Contents</button>
              {contents && (
                <ol className="sp-contents absolute right-0 top-[calc(100%+6px)]">
                  {steps.map((s, i) => (
                    <li key={`${s.scene}-${i}`}><button type="button" onClick={() => go(i)} aria-current={i === current}><span>{n(i)}</span>{s.title}</button></li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
        <div className="sp-counter absolute bottom-4 right-3 flex flex-col items-center gap-1 sm:right-5">
          <button type="button" className="sp-btn sp-btn-sq" aria-label="Previous chapter" onClick={() => go(current - 1)} disabled={current === 0}>↑</button>
          <span className="mono text-[11px]"><b>{n(current)}</b> / {n(steps.length - 1)}</span>
          <button type="button" className="sp-btn sp-btn-sq" aria-label="Next chapter" onClick={() => go(current + 1)} disabled={current === steps.length - 1}>↓</button>
        </div>
        {(step?.hud || step?.live) && (
          <div className="sp-hud absolute right-3 top-14 sm:right-5">
            {step.hud?.map(([k, v]) => <div key={k} className="sp-hud-row"><span>{k}</span><b>{v}</b></div>)}
            {step.live && <LiveReadout live={live} feed={feed} contacts={contacts} fleet={fleetCounts} warp={warp} setWarp={setWarp} />}
          </div>
        )}
        {step?.legend && (
          <ul className="sp-legend absolute bottom-4 left-3 sm:left-auto sm:right-20">
            {step.legend.map((l) => <li key={l.label}><span aria-hidden style={{ background: l.colour }} />{l.label}</li>)}
          </ul>
        )}
      </div>
      <div className="pointer-events-none relative z-10 -mt-[calc(100svh-56px)]">
        {steps.map((s, i) => (
          <div key={`${s.scene}-${i}`} data-step={i} className="flex min-h-[100svh] items-end pb-[8svh] pt-[42svh] sm:items-center sm:py-[18svh]">
            <div className="sp-card sp-step w-full max-w-[440px]">
              <p className="sp-step-n mono">{n(i)} / {n(steps.length - 1)}</p>
              {s.content}
            </div>
          </div>
        ))}
      </div>
      {explorer && <SpaceExplorer parts={parts} origins={origins} sources={sources} live={live} feedOk={feed.status === "ok" && feed.nisar} onClose={() => setExplorer(false)} />}
    </section>
  );
}

function pushFeed(s: Stage, f: TleFeed) {
  const nisar = f.satellites.find((x) => /^NISAR/i.test(x.name)) ?? null;
  s.setLive(nisar, f.satellites.filter((x) => x.indian));
}
