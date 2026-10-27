"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The documentary half of /free-palestine-inc: a column of steps scrolls past
 * a pinned panel, and the panel's picture changes as each step reaches the
 * middle of the screen. The pictures are drawn on the server and passed in;
 * this component only chooses which one to show. Every figure is in the step
 * text as well, so nothing depends on seeing the picture.
 */
export interface FpStep { id: string; kicker: string; content: ReactNode }

export function FpScrolly({ steps, visuals }: { steps: FpStep[]; visuals: Record<string, ReactNode> }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const nodes = [...el.querySelectorAll<HTMLElement>("[data-fp-step]")];
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setCurrent(Number(e.target.getAttribute("data-fp-step")));
    }, { rootMargin: "-45% 0px -45% 0px" });
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
  const step = steps[current]!;
  return (
    <section ref={wrap} className="relative mt-10 flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" aria-label="The essay, in pictures">
      <div className="order-2 lg:order-1">
        {steps.map((s, i) => (
          <div key={s.id} data-fp-step={i} className="flex min-h-[78svh] items-end pb-[5svh] lg:items-center lg:py-[10svh]">
            <div className="story-card w-full p-5 transition-opacity duration-300" style={{ opacity: i === current ? 1 : 0.35 }}>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--s-hot)" }}>{s.kicker}</p>
              <div className="mt-2 text-[14.5px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>{s.content}</div>
            </div>
          </div>
        ))}
      </div>
      {/* On narrow screens the wrapper itself sticks, above the steps; on wide ones the panel sticks inside its column. */}
      <div className="sticky top-[56px] z-10 order-1 lg:static lg:order-2">
        <div className="rounded-xl border p-3 shadow-sm sm:p-5 lg:sticky lg:top-[64px]" style={{ borderColor: "var(--story-rule)", background: "var(--story-card)" }}>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--story-ink-3)" }}>{String(current + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")} · {step.kicker}</p>
          <div key={step.id} className="fp-fade mt-2 min-h-[200px] sm:min-h-[340px]">{visuals[step.id]}</div>
        </div>
      </div>
    </section>
  );
}
