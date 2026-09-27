"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Arcade, Direction, Level, Reel } from "@/lib/bollywood-arcade-shared";
import { DIRECTION_WORD } from "@/lib/bollywood-arcade-shared";
import type { Mode, ReelRun, RunStats } from "./reel-run";

/**
 * Reel Run — the game at the top of /bollywood-villains.
 *
 * Each level asks a question first ("did revenge rise or fall?"), then drives
 * the reader down thirty years of film to find out. The towers are the answer
 * being built as they drive; the reels are the evidence, one real film each.
 * The results screen gives the same pooled figures as the charts further
 * down the page, so the game and the charts cannot disagree.
 *
 * Progress (levels finished, correct guesses, XP) is kept in localStorage
 * where the browser allows it. It is a convenience: nothing is lost that
 * matters if it is not.
 */

type Phase = "menu" | "predict" | "run" | "paused" | "results";

interface Progress { xp: number; done: string[]; correct: string[]; reels: number }
const EMPTY: Progress = { xp: 0, done: [], correct: [], reels: 0 };
const KEY = "reel-run-progress-v1";

function readProgress(): Progress {
  try { const v = localStorage.getItem(KEY); return v ? { ...EMPTY, ...(JSON.parse(v) as Progress) } : EMPTY; } catch { return EMPTY; }
}
function saveProgress(p: Progress): void { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private window */ } }

function fmt(v: number, unit: "pct" | "words"): string {
  return unit === "words" ? `${Math.round(v)} words` : `${v.toFixed(1)}%`;
}

function Spark({ level, lane, year, mode }: { level: Level; lane: number; year: number; mode: Mode }) {
  const pts = level.series.map((p) => (mode === "per1k" ? (p.per1k[lane] ?? p.raw[lane]) : p.raw[lane]) ?? 0);
  const max = Math.max(...pts, 0.0001);
  const W = 150; const H = 34;
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const y = (v: number) => H - 3 - (v / max) * (H - 6);
  const d = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const yi = year - (level.series[0]?.year ?? year);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="block">
      <path d={d} fill="none" stroke={level.lanes[lane]?.colour} strokeWidth={2} />
      {yi >= 0 && yi < pts.length && <circle cx={x(yi)} cy={y(pts[yi] ?? 0)} r={3.5} fill="#fff" stroke={level.lanes[lane]?.colour} strokeWidth={2} />}
    </svg>
  );
}

export function ReelRunGame({ arcade }: { arcade: Arcade }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const engine = useRef<ReelRun | null>(null);
  const [gl, setGl] = useState<"loading" | "ok" | "none">("loading");
  const [reduced, setReduced] = useState(false);
  const [phase, setPhase] = useState<Phase>("menu");
  const [li, setLi] = useState(0);
  const [guess, setGuess] = useState<Direction | null>(null);
  const [mode, setMode] = useState<Mode>("raw");
  const [year, setYear] = useState(arcade.years[0]);
  const [combo, setCombo] = useState(0);
  const [runXp, setRunXp] = useState(0);
  const [card, setCard] = useState<Reel | null>(null);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [progress, setProgress] = useState<Progress>(EMPTY);
  const [flash, setFlash] = useState(0);
  const level = arcade.levels[li]!;
  const levelRef = useRef(level); levelRef.current = level;
  const guessRef = useRef(guess); guessRef.current = guess;

  useEffect(() => { setProgress(readProgress()); }, []);

  const award = useCallback((fn: (p: Progress) => Progress) => {
    setProgress((p) => { const n = fn(p); saveProgress(n); return n; });
  }, []);

  /* Mount the engine. */
  useEffect(() => {
    let gone = false;
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(rm);
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") ?? probe.getContext("webgl")) || !canvas.current || !overlay.current) { setGl("none"); return; }
    import("./reel-run").then(({ createReelRun }) => {
      if (gone || !canvas.current || !overlay.current) return;
      engine.current = createReelRun(canvas.current, overlay.current, {
        onYear: (y) => setYear(y),
        onCollect: (reel, c) => {
          setCard(reel); setCombo(c); setFlash((f) => f + 1);
          const gain = 10 * Math.min(5, c);
          setRunXp((x) => x + gain);
          award((p) => ({ ...p, xp: p.xp + gain, reels: p.reels + 1 }));
        },
        onMiss: () => setCombo(0),
        onFinish: (s) => {
          setStats(s);
          const l = levelRef.current; const g = guessRef.current;
          const right = g === l.answer;
          award((p) => ({
            ...p,
            xp: p.xp + (right ? 100 : 0) + 50,
            done: p.done.includes(l.id) ? p.done : [...p.done, l.id],
            correct: right && !p.correct.includes(l.id) ? [...p.correct, l.id] : p.correct,
          }));
          setPhase("results");
        },
      }, rm);
      engine.current.load(arcade.levels[0]!, "raw");
      setGl("ok");
    }).catch(() => setGl("none"));
    const onResize = () => engine.current?.resize();
    window.addEventListener("resize", onResize);
    return () => { gone = true; window.removeEventListener("resize", onResize); engine.current?.dispose(); engine.current = null; };
  }, [arcade, award]);

  /* Pause rendering when the game is off screen. */
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      const on = Boolean(e?.isIntersecting);
      engine.current?.setActive(on);
      if (!on && phase === "run") { engine.current?.pause(); setPhase("paused"); }
    }, { threshold: 0.25 });
    io.observe(el); return () => io.disconnect();
  }, [phase]);

  /* Keyboard, only while driving. */
  useEffect(() => {
    if (phase !== "run" && phase !== "paused") return;
    const down = (e: KeyboardEvent) => {
      const k = e.key;
      if (["ArrowLeft", "ArrowRight", " ", "a", "d", "A", "D", "p", "P", "Escape", "ArrowUp", "w"].includes(k)) e.preventDefault(); else return;
      if (k === "ArrowLeft" || k === "a" || k === "A") engine.current?.steer(-1);
      else if (k === "ArrowRight" || k === "d" || k === "D") engine.current?.steer(1);
      else if (k === " " || k === "ArrowUp" || k === "w") { if (reduced) engine.current?.stepYear(); else engine.current?.boost(true); }
      else togglePause();
    };
    const up = (e: KeyboardEvent) => { if (e.key === " " || e.key === "ArrowUp" || e.key === "w") engine.current?.boost(false); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  });

  /* Swipe on the canvas. */
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; if (t) touch.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current; const t = e.changedTouches[0]; touch.current = null;
    if (!s || !t || phase !== "run") return;
    const dx = t.clientX - s.x;
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(t.clientY - s.y)) engine.current?.steer(dx < 0 ? -1 : 1);
  };

  function togglePause() {
    setPhase((p) => {
      if (p === "run") { engine.current?.pause(); return "paused"; }
      if (p === "paused") { engine.current?.start(); return "run"; }
      return p;
    });
  }

  function choose(i: number) {
    setLi(i); setGuess(null); setStats(null); setCard(null); setRunXp(0); setCombo(0);
    engine.current?.load(arcade.levels[i]!, mode);
    setYear(arcade.years[0]);
    setPhase("predict");
  }
  function go(g: Direction) {
    setGuess(g); setPhase("run");
    if (!reduced) engine.current?.start();
    wrap.current?.focus({ preventScroll: true });
  }
  function switchMode(m: Mode) { setMode(m); engine.current?.setMode(m); }

  const badges = useMemo(() => [
    { id: "first", label: "First reel", got: progress.reels >= 1 },
    { id: "hunter", label: "Evidence hunter · 50 reels", got: progress.reels >= 50 },
    { id: "reader", label: "Trend reader · 3 right calls", got: progress.correct.length >= 3 },
    { id: "full", label: "Full programme · every level", got: arcade.levels.every((l) => progress.done.includes(l.id)) },
  ], [progress, arcade.levels]);

  const yi = year - (level.series[0]?.year ?? year);
  const point = level.series[yi];
  const per1kAvailable = level.series.some((p) => p.per1k.some((v) => v !== null));

  return (
    <section className="rr-root mt-10" aria-label="Reel Run, a game over the film data">
      <div ref={wrap} tabIndex={-1} className="rr-stage relative outline-none" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden />
        <div ref={overlay} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden
          style={{ visibility: phase === "run" || phase === "paused" ? "visible" : "hidden" }} />

        {gl === "none" && (
          <div className="rr-panel absolute inset-4 grid place-items-center text-center">
            <p>Reel Run needs WebGL, which this browser has not made available. Every figure it uses is in the charts below.</p>
          </div>
        )}

        {/* HUD */}
        {(phase === "run" || phase === "paused") && (
          <>
            <div className="rr-hud absolute left-3 top-3 sm:left-4 sm:top-4">
              <p className="rr-kicker">{level.title}</p>
              <p className="rr-year" aria-live="polite">{year}</p>
              {point && <p className="text-[11.5px] opacity-80">{point.films} films measured this year</p>}
            </div>
            <div className="rr-hud absolute right-3 top-3 text-right sm:right-4 sm:top-4">
              <p className="rr-xp">{progress.xp.toLocaleString("en-GB")} XP</p>
              <p key={flash} className={`rr-combo ${combo > 1 ? "rr-pop" : ""}`}>{combo > 1 ? `combo ×${Math.min(5, combo)}` : `+${runXp} this run`}</p>
            </div>
            <div className="rr-hud rr-legend absolute bottom-3 left-3 sm:bottom-4 sm:left-4">
              {level.lanes.map((l, i) => {
                const v = point ? (mode === "per1k" ? point.per1k[i] : point.raw[i]) : null;
                return (
                  <div key={l.id} className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-sm" style={{ background: l.colour }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[12px]">{l.label}</span>
                    <span className="mono text-[12px] font-bold">
                      {v === null || v === undefined ? "—" : mode === "per1k" && point?.per1k[i] !== null ? `${v.toFixed(2)}/1k words` : fmt(v, l.unit)}
                    </span>
                    {i === 0 && <Spark level={level} lane={0} year={year} mode={mode} />}
                  </div>
                );
              })}
            </div>
            <div className="absolute bottom-3 right-3 flex gap-2 sm:bottom-4 sm:right-4">
              <button type="button" className="rr-btn" aria-label="Steer left" onClick={() => engine.current?.steer(-1)}>◀</button>
              {reduced
                ? <button type="button" className="rr-btn" onClick={() => engine.current?.stepYear()}>Next year</button>
                : <button type="button" className="rr-btn" aria-label="Boost" onPointerDown={() => engine.current?.boost(true)} onPointerUp={() => engine.current?.boost(false)} onPointerLeave={() => engine.current?.boost(false)}>⚡</button>}
              <button type="button" className="rr-btn" aria-label="Steer right" onClick={() => engine.current?.steer(1)}>▶</button>
              <button type="button" className="rr-btn" onClick={togglePause}>{phase === "paused" ? "Resume" : "Pause"}</button>
            </div>
            {card && (
              <div key={`${card.title}-${card.year}`} className="rr-card absolute left-1/2 top-[22%] w-[min(92%,440px)] -translate-x-1/2" role="status">
                <p className="rr-kicker" style={{ color: level.lanes[card.lane]?.colour }}>+ reel · {level.lanes[card.lane]?.label}</p>
                <p className="text-[16px] font-extrabold leading-tight">{card.title} <span className="font-medium opacity-70">({card.year})</span></p>
                {card.quote !== card.title && <p className="mt-1 text-[13px] leading-snug">“{card.quote}”</p>}
                <p className="mt-1 text-[10.5px] opacity-60">{card.quote !== card.title ? "The sentence of its Wikipedia plot summary that matched." : "Crime word in the title."}</p>
              </div>
            )}
            {phase === "paused" && (
              <div className="rr-panel absolute inset-x-4 top-1/2 mx-auto max-w-sm -translate-y-1/2 text-center">
                <p className="text-[20px] font-black">Paused</p>
                <div className="mt-3 flex justify-center gap-2">
                  <button type="button" className="rr-btn rr-btn-hot" onClick={togglePause}>Resume</button>
                  <button type="button" className="rr-btn" onClick={() => setPhase("menu")}>All levels</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Menu */}
        {phase === "menu" && gl !== "none" && (
          <div className="rr-panel absolute inset-3 overflow-y-auto sm:inset-6">
            <p className="rr-kicker">A game over {arcade.films.toLocaleString("en-GB")} Hindi film plots, {arcade.years[0]}–{arcade.years[1]}</p>
            <h2 className="rr-title">Reel Run</h2>
            <p className="max-w-[60ch] text-[14px] leading-snug">
              Call the trend, then drive thirty years of cinema to find out. The glowing towers are the answer
              building year by year; every reel you grab is a real film and the plot sentence that put it there.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {arcade.levels.map((l, i) => (
                <button key={l.id} type="button" className="rr-level" onClick={() => choose(i)}>
                  <span className="flex items-center gap-1.5">
                    {l.lanes.map((x) => <span key={x.id} className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: x.colour }} />)}
                    <span className="ml-auto text-[11px]">{progress.done.includes(l.id) ? (progress.correct.includes(l.id) ? "★ called it" : "✓ played") : `Level ${i + 1}`}</span>
                  </span>
                  <span className="mt-1 block text-[16px] font-extrabold">{l.title}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug opacity-80">{l.tagline}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px]">
              <span className="rr-xp">{progress.xp.toLocaleString("en-GB")} XP</span>
              {badges.map((b) => <span key={b.id} className={`rr-badge ${b.got ? "rr-badge-on" : ""}`}>{b.got ? "🏅" : "○"} {b.label}</span>)}
            </div>
            <p className="mt-3 text-[11.5px] opacity-70">
              {reduced ? "Reduced motion is on: the kart moves a year at a time. " : "Steer with ← → or A/D (swipe on a phone); hold Space or ⚡ to boost; P pauses. "}
              {arcade.refusal.split(".")[0]}.
            </p>
          </div>
        )}

        {/* Predict */}
        {phase === "predict" && (
          <div className="rr-panel absolute inset-x-3 top-1/2 mx-auto max-w-lg -translate-y-1/2 text-center">
            <p className="rr-kicker">Level {li + 1} · {level.title}</p>
            <p className="mt-1 text-[20px] font-black leading-tight">{level.question}</p>
            <p className="mt-1 text-[12.5px] opacity-80">Call it, then drive {arcade.years[0]}–{arcade.years[1]}. A right call is worth 100 XP.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {(["up", "down", "flat"] as Direction[]).map((d) => (
                <button key={d} type="button" className="rr-btn rr-btn-lg" onClick={() => go(d)}>
                  {d === "up" ? "▲ " : d === "down" ? "▼ " : "▬ "}{DIRECTION_WORD[d]}
                </button>
              ))}
            </div>
            <button type="button" className="mt-3 text-[12px] underline opacity-80" onClick={() => setPhase("menu")}>All levels</button>
          </div>
        )}

        {/* Results */}
        {phase === "results" && stats && (
          <div className="rr-panel absolute inset-3 overflow-y-auto sm:inset-6">
            <p className="rr-kicker">Level {li + 1} complete · {level.title}</p>
            <p className="rr-title !text-[clamp(26px,5vw,44px)]">
              {guess === level.answer ? "You called it." : `It ${DIRECTION_WORD[level.answer].toLowerCase()}.`}
            </p>
            <p className="text-[14px]">
              You said <strong>{guess ? DIRECTION_WORD[guess].toLowerCase() : "—"}</strong>
              {guess === level.answer ? " — +100 XP." : "."} {level.explain}
            </p>
            <div className="mt-4 space-y-3">
              {level.lanes.map((l) => {
                const max = Math.max(l.early, l.late, 0.0001);
                return (
                  <div key={l.id}>
                    <p className="text-[13px] font-bold">{l.label}</p>
                    {([["early", arcade.spans.early, l.early], ["late", arcade.spans.late, l.late]] as const).map(([k, span, v]) => (
                      <div key={k} className="mt-1 flex items-center gap-2 text-[12px]">
                        <span className="mono w-[76px] shrink-0 opacity-80">{span[0]}–{String(span[1]).slice(2)}</span>
                        <span className="h-3 flex-1 rounded-sm bg-white/10"><span className="block h-full rounded-sm" style={{ width: `${(v / max) * 100}%`, background: l.colour }} /></span>
                        <span className="mono w-[80px] shrink-0 text-right font-bold">{fmt(v, l.unit)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[12.5px] opacity-85">
              {level.reels.length > 0
                ? <>Reels: you took <strong>{stats.collected}</strong> of the {stats.onRoad} on the road (best combo ×{stats.bestCombo}). The road carries up to {arcade.reelsPerLaneYear} films per lane per year; the towers count all {level.totalFilms.reduce((a, x) => a + x, 0).toLocaleString("en-GB")}.</>
                : <>No reels on this road — the towers here are words, not films.</>}
              {" "}Shares are pooled over each five-year span, the same figures as the charts below.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {li + 1 < arcade.levels.length && <button type="button" className="rr-btn rr-btn-hot" onClick={() => choose(li + 1)}>Next: {arcade.levels[li + 1]!.title} →</button>}
              <button type="button" className="rr-btn" onClick={() => choose(li)}>Replay</button>
              <button type="button" className="rr-btn" onClick={() => setPhase("menu")}>All levels</button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[12.5px]">
        {per1kAvailable && (
          <div className="flex items-center gap-1.5" role="group" aria-label="Tower measure">
            <span className="opacity-70">Towers show:</span>
            <button type="button" className="rr-chip" aria-pressed={mode === "raw"} onClick={() => switchMode("raw")}>Share of films</button>
            <button type="button" className="rr-chip" aria-pressed={mode === "per1k"} onClick={() => switchMode("per1k")}>Per 1,000 words of plot</button>
          </div>
        )}
        <span className="opacity-70">
          Per 1,000 words corrects for plot summaries getting longer; the charts below publish both. Source: {arcade.source.split(":")[0]}.
        </span>
      </div>
    </section>
  );
}
