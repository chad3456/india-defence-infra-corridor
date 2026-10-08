"use client";

/**
 * One floating readout for every chart on /internet. Any element with a
 * data-tip attribute inside the essay shows it on hover or tap. The charts are
 * server-rendered; this is the only script they need, and without it each
 * map shape still carries a native <title>.
 */
import { useEffect, useRef } from "react";

export function TipLayer() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.querySelector(".ie-root");
    const tip = ref.current;
    if (!root || !tip) return;
    let current: Element | null = null;
    const show = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-tip]") ?? null;
      if (!el || !root.contains(el)) { hide(); return; }
      if (el !== current) {
        current?.classList.remove("ie-hot");
        current = el;
        el.classList.add("ie-hot");
        tip.textContent = el.getAttribute("data-tip");
      }
      const pad = 14;
      const w = tip.offsetWidth, h = tip.offsetHeight;
      const x = Math.min(window.innerWidth - w - 8, Math.max(8, e.clientX + pad));
      const y = e.clientY - h - pad < 8 ? e.clientY + pad : e.clientY - h - pad;
      tip.style.transform = `translate(${x}px, ${y}px)`;
      tip.style.opacity = "1";
    };
    const hide = () => {
      current?.classList.remove("ie-hot");
      current = null;
      tip.style.opacity = "0";
    };
    root.addEventListener("pointermove", show as EventListener);
    root.addEventListener("pointerdown", show as EventListener);
    root.addEventListener("pointerleave", hide);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      root.removeEventListener("pointermove", show as EventListener);
      root.removeEventListener("pointerdown", show as EventListener);
      root.removeEventListener("pointerleave", hide);
      window.removeEventListener("scroll", hide);
    };
  }, []);
  return <div ref={ref} className="ie-tip" role="status" aria-live="polite" />;
}
