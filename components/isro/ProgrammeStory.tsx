"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { ProgrammePublished, Rocket } from "@/lib/space-programme";
import type { ProgrammeStage, ProgrammeStageData, SceneId } from "./stage";
import { RocketExplorer } from "./RocketExplorer";

/**
 * The chaptered half of /space-programme: a holographic stage pinned to the
 * viewport, chapters scrolling over it, a counter, up and down, a contents
 * menu, and a rocket explorer that opens over everything. The text carries
 * every figure and its source; without WebGL the text is all still there.
 */

export interface ProgrammeStep {
  scene: SceneId;
  kicker: string;
  title: string;
  content: ReactNode;
  hud?: Array<[string, string]>;
  legend?: Array<{ colour: string; label: string }>;
  explore?: string;
}

export function ProgrammeStory({ steps, stage: stageData, rockets, kinds, sources }: {
  steps: ProgrammeStep[];
  stage: ProgrammeStageData;
  rockets: Rocket[];
  kinds: ProgrammePublished["kinds"];
  sources: Array<{ id: string; publisher: string; url: string }>;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const stage = useRef<ProgrammeStage | null>(null);
  const [mode, setMode] = useState<"loading" | "3d" | "flat">("loading");
  const [current, setCurrent] = useState(0);
  const [contents, setContents] = useState(false);
  const [explorer, setExplorer] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") ?? probe.getContext("webgl")) || !canvas.current || !overlay.current) { setMode("flat"); return; }
    import("./stage").then(({ createStage }) => {
      if (disposed || !canvas.current || !overlay.current) return;
      stage.current = createStage(canvas.current, overlay.current, stageData, reduced);
      setMode("3d");
    }).catch(() => setMode("flat"));
    const onResize = () => stage.current?.resize();
    window.addEventListener("resize", onResize);
    return () => { disposed = true; window.removeEventListener("resize", onResize); stage.current?.dispose(); stage.current = null; };
  }, [stageData]);

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
    const io = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) setCurrent(Number(e.target.getAttribute("data-step"))); }, { rootMargin: "-45% 0px -45% 0px" });
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  useEffect(() => { const s = steps[current]; if (s && stage.current) stage.current.setScene(s.scene); }, [current, steps, mode]);

  const go = useCallback((i: number) => {
    const el = wrap.current?.querySelector<HTMLElement>(`[data-step="${Math.max(0, Math.min(steps.length - 1, i))}"]`);
    el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    setContents(false);
  }, [steps.length]);

  const step = steps[current];
  const n = (i: number) => String(i + 1).padStart(2, "0");
  return (
    <section ref={wrap} className="sp-scrolly relative" aria-label="India's space programme, illustrated">
      <div className="sp-stage sticky top-[56px] h-[calc(100svh-56px)]" aria-hidden={mode !== "3d"}>
        <canvas ref={canvas} className="absolute inset-0 h-full w-full touch-pan-y" />
        <div ref={overlay} className="pointer-events-none absolute inset-0 overflow-hidden" />
        <div className="sp-scanlines pointer-events-none absolute inset-0" />
        {mode === "flat" && <div className="absolute inset-0 flex items-end p-6"><p className="sp-card max-w-md text-[13px]">The 3D pictures need WebGL, which this browser has not made available. Every figure and its source is in the text.</p></div>}
        <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2 sm:left-5 sm:right-5">
          <div className="sp-kicker">{step?.kicker}</div>
          <div className="flex items-center gap-1.5">
            <button type="button" className="sp-btn" onClick={() => setExplorer(step?.explore ?? "pslv")}>Rocket explorer</button>
            <div className="relative">
              <button type="button" className="sp-btn" aria-expanded={contents} onClick={() => setContents((v) => !v)}>Contents</button>
              {contents && (
                <ol className="sp-contents absolute right-0 top-[calc(100%+6px)]">
                  {steps.map((s, i) => <li key={`${s.scene}-${i}`}><button type="button" onClick={() => go(i)} aria-current={i === current}><span>{n(i)}</span>{s.title}</button></li>)}
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
        {step?.hud && <div className={`sp-hud absolute right-3 top-14 sm:right-5${step.hud.length > 4 ? " sp-hud-long" : ""}`}>{step.hud.map(([k, v]) => <div key={k} className="sp-hud-row"><span>{k}</span><b>{v}</b></div>)}</div>}
        {step?.legend && <ul className="sp-legend absolute bottom-4 left-3 sm:left-auto sm:right-20">{step.legend.map((l) => <li key={l.label}><span aria-hidden style={{ background: l.colour }} />{l.label}</li>)}</ul>}
      </div>
      <div className="pointer-events-none relative z-10 -mt-[calc(100svh-56px)]">
        {steps.map((s, i) => (
          <div key={`${s.scene}-${i}`} data-step={i} className="flex min-h-[100svh] items-end pb-[8svh] pt-[42svh] sm:items-center sm:py-[18svh]">
            <div className="sp-card sp-step w-full max-w-[440px]">
              <p className="sp-step-n mono">{n(i)} / {n(steps.length - 1)}</p>
              {s.content}
              {s.explore && <button type="button" className="sp-btn mt-3" onClick={() => setExplorer(s.explore!)}>Take it apart →</button>}
            </div>
          </div>
        ))}
      </div>
      {explorer && <RocketExplorer rockets={rockets} kinds={kinds} sources={sources} start={explorer} onClose={() => setExplorer(null)} />}
    </section>
  );
}
