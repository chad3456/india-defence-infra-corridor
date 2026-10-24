"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { TbmStageData } from "@/lib/tbm";
import type { Stage, StepId } from "./stage";

/**
 * The scrolling half of /tbm: a particle stage pinned to the viewport while a
 * column of steps scrolls over it; as each step crosses the middle of the
 * screen the particles rearrange. The text is the account and carries every
 * figure and its source; the stage illustrates it. A reader without WebGL, or
 * who prefers reduced motion, keeps all of the text — with reduced motion the
 * pictures change without moving.
 */

export interface TbmStep { id: StepId; kicker: string; content: ReactNode; legend?: Array<{ colour: string; label: string; dashed?: boolean }> }

export function TbmStory({ steps, data }: { steps: TbmStep[]; data: TbmStageData }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const [mode, setMode] = useState<"loading" | "3d" | "flat">("loading");
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let disposed = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
    if (!gl || !canvas.current || !overlay.current) { setMode("flat"); return; }
    import("./stage")
      .then(({ createStage }) => {
        if (disposed || !canvas.current || !overlay.current) return;
        stage.current = createStage(canvas.current, overlay.current, data, reduced);
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
  }, [data]);

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
    if (s && stage.current) stage.current.setStep(s.id);
  }, [current, steps, mode]);

  const step = steps[current];
  return (
    <section ref={wrap} className="tbm-scrolly relative" aria-label="How a tunnel boring machine works, and India's machines, illustrated">
      <div className="tbm-stage sticky top-[56px] h-[calc(100svh-56px)]" aria-hidden={mode !== "3d"}>
        <canvas ref={canvas} className="absolute inset-0 h-full w-full touch-pan-y" />
        <div ref={overlay} className="pointer-events-none absolute inset-0 overflow-hidden" />
        {mode === "flat" && (
          <div className="absolute inset-0 flex items-end p-6">
            <p className="tbm-card max-w-md text-[13px]">The particle pictures need WebGL, which this browser has not made available. Every figure and its source is in the text.</p>
          </div>
        )}
        <div className="tbm-kicker absolute left-4 top-4 sm:left-6">{step?.kicker}</div>
        {step?.legend && (
          <ul className="tbm-legend absolute bottom-4 right-4 sm:right-6">
            {step.legend.map((l) => (
              <li key={l.label}><span aria-hidden style={{ background: l.dashed ? `repeating-linear-gradient(90deg, ${l.colour} 0 4px, transparent 4px 7px)` : l.colour }} />{l.label}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="relative z-10 -mt-[calc(100svh-56px)]">
        {steps.map((s, i) => (
          <div key={`${s.id}-${i}`} data-step={i} className="flex min-h-[100svh] items-end pb-[6svh] pt-[40svh] sm:items-center sm:py-[18svh]">
            <div className="tbm-card tbm-step w-full max-w-[430px]">{s.content}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
