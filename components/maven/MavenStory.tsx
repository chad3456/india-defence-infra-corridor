"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Stage, StageData, StepId } from "./stage";

/**
 * The scrolling half of the Project Maven piece.
 *
 * A three.js stage is pinned to the viewport while a column of steps scrolls
 * over it. As each step crosses the middle of the screen the stage rearranges
 * itself. The text in the steps is the argument; the stage illustrates it.
 * Everything a reader needs is in the text, so a reader without WebGL — or
 * with it switched off — loses the pictures and nothing else.
 *
 * three.js is imported on the client after mount, so it never reaches the
 * server bundle and a page that cannot run it never downloads it twice.
 */

export interface Step {
  id: StepId;
  /** The part of the book, shown as a running head. */
  part: string;
  content: ReactNode;
  control?: "accuracy" | "chain" | "tempo" | "globe";
}

export interface Theatre {
  id: string;
  label: string;
  rate: number;
  ground: "desert" | "jungle" | "snow";
  note: string;
}

export function MavenStory({
  steps, data, theatres, tempoLabels, globeKey,
}: {
  steps: Step[];
  data: StageData;
  theatres: Theatre[];
  tempoLabels: [string, string, string];
  globeKey: Array<{ kind: string; label: string; colour: string }>;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const [mode, setMode] = useState<"loading" | "3d" | "flat">("loading");
  const [current, setCurrent] = useState(0);
  const [theatre, setTheatre] = useState(0);
  const [withMaven, setWithMaven] = useState(false);
  const [tempo, setTempo] = useState<0 | 1 | 2>(0);

  /* Mount the stage once. */
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

  /* Pause rendering while the stage is off screen. */
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => stage.current?.setActive(Boolean(e?.isIntersecting)));
    io.observe(el);
    return () => io.disconnect();
  }, [mode]);

  /* Which step is in the middle of the screen. */
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
    if (!s || !stage.current) return;
    stage.current.setStep(s.id);
  }, [current, steps, mode]);

  useEffect(() => {
    const t = theatres[theatre];
    if (t) stage.current?.setAccuracy(t.rate, t.ground);
  }, [theatre, theatres, mode]);
  useEffect(() => { stage.current?.setChain(withMaven); }, [withMaven, mode]);
  useEffect(() => { stage.current?.setTempo(tempo); }, [tempo, mode]);

  /* Entering the accuracy and tempo steps starts them from the beginning. */
  useEffect(() => {
    const id = steps[current]?.id;
    if (id === "tempo") setTempo(0);
    if (id === "chain") setWithMaven(false);
    if (id === "accuracy") setTheatre(0);
  }, [current, steps]);

  const control = (c: Step["control"]) => {
    if (c === "accuracy") {
      const t = theatres[theatre];
      return (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Where the model was used">
            {theatres.map((x, i) => (
              <button key={x.id} type="button" className="mv-btn" aria-pressed={i === theatre} onClick={() => setTheatre(i)}>
                {x.label}
              </button>
            ))}
          </div>
          {t && <p className="mt-3 text-[13px] leading-snug text-[color:var(--mv-ink-2)]">{t.note}</p>}
        </div>
      );
    }
    if (c === "chain") {
      return (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="The cycle before and with Maven">
          <button type="button" className="mv-btn" aria-pressed={!withMaven} onClick={() => setWithMaven(false)}>Before</button>
          <button type="button" className="mv-btn" aria-pressed={withMaven} onClick={() => setWithMaven(true)}>With Maven, at the 18th</button>
        </div>
      );
    }
    if (c === "tempo") {
      return (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Targets a day">
          {tempoLabels.map((l, i) => (
            <button key={l} type="button" className="mv-btn" aria-pressed={tempo === i} onClick={() => setTempo(i as 0 | 1 | 2)}>{l}</button>
          ))}
        </div>
      );
    }
    if (c === "globe") {
      return (
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {globeKey.map((k) => (
            <li key={k.kind} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: k.colour }} />
              {k.label}
            </li>
          ))}
        </ul>
      );
    }
    return null;
  };

  return (
    <section ref={wrap} className="mv-scrolly relative" aria-label="Project Maven, illustrated">
      <div className="mv-stage sticky top-[56px] h-[calc(100svh-56px)]" aria-hidden={mode !== "3d"}>
        <canvas ref={canvas} className="absolute inset-0 h-full w-full touch-pan-y" />
        <div ref={overlay} className="pointer-events-none absolute inset-0 overflow-hidden" />
        {mode === "flat" && (
          <div className="absolute inset-0 flex items-end p-6">
            <p className="mv-card max-w-md text-[13px]">
              The illustrations need WebGL, which this browser has not made available. Every figure and
              quotation is in the text, with its page.
            </p>
          </div>
        )}
        <div className="mv-part absolute left-4 top-4 sm:left-6">{steps[current]?.part}</div>
      </div>
      <div className="relative z-10 -mt-[calc(100svh-56px)]">
        {steps.map((s, i) => (
          <div key={`${s.id}-${i}`} data-step={i} className="flex min-h-[100svh] items-end pb-[5svh] pt-[40svh] sm:items-center sm:py-[18svh]">
            <div className="mv-card mv-step w-full max-w-[420px]">
              {s.content}
              {control(s.control)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
