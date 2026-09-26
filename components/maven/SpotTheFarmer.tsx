"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * "Forty seconds, or one": a reader tries the screener's job.
 *
 * The book reports that an analyst took forty seconds to spot a farmer with
 * his sheep before a strike, and that Maven's model, replayed over the same
 * footage, found him within a second. This is not that footage and no one has
 * published it. It is a generated field, drawn to be about as hard to read as
 * the book describes infrared drone video — so a reader can feel how long a
 * second is, and how long forty are. The reader's own time is the only number
 * this component produces, and it is theirs.
 */

interface Blob { x: number; y: number; r: number; person: boolean }

function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function SpotTheFarmer({ analyst, machine, cite }: { analyst: string; machine: string; cite: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [seed, setSeed] = useState(1);
  const [state, setState] = useState<"idle" | "looking" | "found" | "shown">("idle");
  const [started, setStarted] = useState(0);
  const [took, setTook] = useState<number | null>(null);
  const [misses, setMisses] = useState(0);
  const blobs = useRef<Blob[]>([]);

  const draw = useCallback((reveal: boolean) => {
    const c = ref.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const W = c.width; const H = c.height;
    const r = rand(seed * 97 + 3);
    g.fillStyle = "#0b120e"; g.fillRect(0, 0, W, H);
    /* Ground texture: warm and cool patches, furrows, bushes. */
    for (let i = 0; i < 900; i++) {
      const v = 18 + r() * 30;
      g.fillStyle = `rgb(${v},${v + 10},${v + 4})`;
      g.fillRect(r() * W, r() * H, 2 + r() * 10, 2 + r() * 10);
    }
    g.strokeStyle = "rgba(120,150,130,0.15)"; g.lineWidth = 2;
    for (let y = 20; y < H; y += 26) { g.beginPath(); g.moveTo(0, y + r() * 6); g.lineTo(W, y + r() * 6); g.stroke(); }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = "rgba(90,110,95,0.5)";
      g.beginPath(); g.arc(r() * W, r() * H, 3 + r() * 6, 0, 7); g.fill();
    }
    /* A herd, and one person among it. */
    const list: Blob[] = [];
    const hx = W * (0.2 + r() * 0.6); const hy = H * (0.25 + r() * 0.5);
    for (let i = 0; i < 16; i++) list.push({ x: hx + (r() - 0.5) * 150, y: hy + (r() - 0.5) * 90, r: 4 + r() * 2, person: false });
    list.push({ x: hx + (r() - 0.5) * 170, y: hy + (r() - 0.5) * 110, r: 3, person: true });
    for (const b of list) {
      if (b.person) {
        g.fillStyle = "rgba(205,225,212,0.75)";
        g.beginPath(); g.ellipse(b.x, b.y, 2.2, 3.6, 0.3, 0, 7); g.fill();
        g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.ellipse(b.x + 3, b.y + 3, 2, 4, 0.3, 0, 7); g.fill();
      } else {
        g.fillStyle = "rgba(190,210,198,0.6)";
        g.beginPath(); g.ellipse(b.x, b.y, b.r * 1.3, b.r * 0.8, r() * 3, 0, 7); g.fill();
      }
    }
    blobs.current = list;
    /* Sensor noise and a reticle. */
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(255,255,255,${(r() * 0.05).toFixed(3)})`; g.fillRect(r() * W, r() * H, 1, 1); }
    g.strokeStyle = "rgba(157,255,184,0.4)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(W / 2 - 14, H / 2); g.lineTo(W / 2 + 14, H / 2); g.moveTo(W / 2, H / 2 - 14); g.lineTo(W / 2, H / 2 + 14); g.stroke();
    if (reveal) {
      const p = list.find((b) => b.person);
      if (p) {
        g.strokeStyle = "#ffd400"; g.lineWidth = 2;
        g.strokeRect(p.x - 12, p.y - 14, 24, 28);
        g.fillStyle = "#ffd400"; g.font = "600 12px ui-sans-serif, system-ui";
        g.fillText("person", p.x + 15, p.y - 6);
      }
    }
  }, [seed]);

  useEffect(() => { draw(state === "found" || state === "shown"); }, [draw, state]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (state !== "looking" || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (ref.current.width / rect.width);
    const y = (e.clientY - rect.top) * (ref.current.height / rect.height);
    const p = blobs.current.find((b) => b.person);
    if (p && Math.hypot(p.x - x, p.y - y) < 18) {
      setTook((performance.now() - started) / 1000);
      setState("found");
    } else setMisses((m) => m + 1);
  };

  const start = () => { setSeed((s) => s + 1); setMisses(0); setTook(null); setState("looking"); setStarted(performance.now()); };

  return (
    <div className="mv-card">
      <div className="relative">
        <canvas
          ref={ref} width={720} height={405} onClick={onClick}
          className="block h-auto w-full rounded-md"
          style={{ cursor: state === "looking" ? "crosshair" : "default" }}
          aria-label="A generated overhead infrared view of a field with a herd of animals and one person among them"
        />
        {state === "idle" && (
          <div className="absolute inset-0 grid place-items-center rounded-md bg-black/55">
            <button type="button" className="mv-btn mv-btn-lg" onClick={start}>Find the person</button>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[14px]" aria-live="polite">
        {state === "looking" && (
          <>
            <span>Somewhere in the herd is one person. Click them.</span>
            {misses > 0 && <span className="text-[color:var(--mv-ink-2)]">{misses === 1 ? "That's an animal." : `${misses} misses.`}</span>}
            <button type="button" className="mv-btn" onClick={() => setState("shown")}>Show me</button>
          </>
        )}
        {state === "found" && took !== null && (
          <span>
            You took <strong>{took.toFixed(1)} seconds</strong>. The analyst in the book took {analyst}; replayed
            with Maven&apos;s model overlaid, the AI found him {machine} ({cite}).
          </span>
        )}
        {state === "shown" && (
          <span>There. The analyst in the book took {analyst}; the model, {machine} ({cite}).</span>
        )}
        {(state === "found" || state === "shown") && <button type="button" className="mv-btn" onClick={start}>Another field</button>}
      </div>
      <p className="mt-2 text-[12px] text-[color:var(--mv-ink-3)]">
        A generated field, not drone footage — none has been published. The only number here that is not the
        book&apos;s is your own time.
      </p>
    </div>
  );
}
