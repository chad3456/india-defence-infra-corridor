"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProgrammePublished, Rocket, StageKind } from "@/lib/space-programme";
import type { RocketExplorer as Ex } from "./explorer";

/**
 * The rocket explorer: India's seven rockets, one at a time, stage by stage.
 * Every statement in the panels is the register's, with its source; the
 * drawing's stage proportions are schematic and the panel says so.
 */

export function RocketExplorer({ rockets, kinds, sources, start, onClose }: {
  rockets: Rocket[];
  kinds: ProgrammePublished["kinds"];
  sources: Array<{ id: string; publisher: string; url: string }>;
  start?: string;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const ex = useRef<Ex | null>(null);
  const [ready, setReady] = useState<"loading" | "3d" | "flat">("loading");
  const [rid, setRid] = useState(start ?? "pslv");
  const [sel, setSel] = useState<string | null>(null);
  const [apart, setApart] = useState(false);
  const [spin, setSpin] = useState(false);
  const [full, setFull] = useState(false);
  const rocket = rockets.find((r) => r.id === rid) ?? rockets[0]!;
  const colours = useMemo(() => Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, v.colour])) as Record<StageKind, string>, [kinds]);
  const src = (id: string) => sources.find((s) => s.id === id);
  const Cite = ({ ids }: { ids: string[] }) => <>{[...new Set(ids)].map((s, i) => <span key={s}>{i ? " · " : ""}<a className="underline decoration-dotted" href={src(s)?.url} target="_blank" rel="noopener noreferrer">{src(s)?.publisher}</a></span>)}</>;

  useEffect(() => {
    let disposed = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") ?? probe.getContext("webgl")) || !canvas.current || !overlay.current) { setReady("flat"); return; }
    import("./explorer").then(({ createRocketExplorer }) => {
      if (disposed || !canvas.current || !overlay.current) return;
      const e = createRocketExplorer(canvas.current, overlay.current, colours, reduced);
      e.onPick((id) => setSel(id));
      ex.current = e;
      setReady("3d");
    }).catch(() => setReady("flat"));
    const ro = new ResizeObserver(() => ex.current?.resize());
    if (canvas.current) ro.observe(canvas.current);
    return () => { disposed = true; ro.disconnect(); ex.current?.dispose(); ex.current = null; };
  }, [colours]);

  useEffect(() => { ex.current?.setRocket(rocket); setSel(null); setApart(false); }, [rocket, ready]);
  useEffect(() => { ex.current?.select(sel); }, [sel, ready]);
  useEffect(() => { ex.current?.setApart(apart); }, [apart, ready]);
  useEffect(() => { ex.current?.setSpin(spin); }, [spin, ready]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) onClose();
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const ids = rocket.stages.map((s) => s.id), i = sel ? ids.indexOf(sel) : -1;
        setSel(ids[(i + (e.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length] ?? null);
      }
    };
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    box.current?.focus();
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); document.removeEventListener("fullscreenchange", onFs); };
  });

  const stage = sel ? rocket.stages.find((s) => s.id === sel) : null;
  const tool = (label: string, title: string, fn: () => void, pressed?: boolean) => <button type="button" className="sp-tool" title={title} aria-label={title} aria-pressed={pressed} onClick={fn}>{label}</button>;
  const pickStage = (id: string) => { setSel(id); if (window.innerWidth < 1024) body.current?.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Rocket explorer" className="sp-ex fixed inset-0 z-[80] flex flex-col outline-none">
      <div className="sp-ex-bar flex items-center gap-1.5 overflow-x-auto px-3 py-2">
        <span className="sp-ex-brand mono">ROCKETS</span>
        {rockets.map((r) => <button key={r.id} type="button" className="sp-chip" aria-pressed={r.id === rid} onClick={() => setRid(r.id)}>{r.name}</button>)}
        <span className="flex-1" />
        <button type="button" className="sp-chip" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void box.current?.requestFullscreen?.(); }}>{full ? "Exit full screen" : "Full screen"}</button>
        <button type="button" className="sp-chip sp-chip-close" onClick={onClose}>Close ✕</button>
      </div>
      <div ref={body} className="sp-ex-body grid min-h-0 flex-1 grid-cols-1 content-start overflow-y-auto lg:grid-cols-[260px_minmax(0,1fr)_330px] lg:content-stretch lg:overflow-hidden">
        <aside className="sp-ex-list order-3 p-3 lg:order-1 lg:min-h-0 lg:overflow-y-auto">
          <p className="sp-ex-h mono">{rocket.name.toUpperCase()} · STAGES, BOTTOM TO TOP</p>
          <ul className="mt-2">
            {rocket.stages.map((s, i) => (
              <li key={s.id}><button type="button" className="sp-ex-item" aria-current={sel === s.id} onClick={() => pickStage(s.id)}>
                <span className="sp-dot" style={{ background: kinds[s.kind].colour }} aria-hidden />
                <span className="mono sp-ex-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1">{s.name}</span>
              </button></li>
            ))}
          </ul>
          <p className="sp-ex-h mono mt-4">PROPELLANT</p>
          <ul className="mt-1 space-y-1 text-[12px]">
            {(Object.keys(kinds) as StageKind[]).map((k) => <li key={k} className="flex items-center gap-2"><span className="sp-dot" style={{ background: kinds[k].colour }} aria-hidden />{kinds[k].label}</li>)}
          </ul>
        </aside>
        <div className="sp-ex-view relative order-1 h-[52svh] min-h-[320px] lg:order-2 lg:h-auto">
          <canvas ref={canvas} className="absolute inset-0 h-full w-full touch-none" />
          <div ref={overlay} className="pointer-events-none absolute inset-0 overflow-hidden" />
          <div className="sp-scanlines pointer-events-none absolute inset-0" />
          {ready === "flat" && <p className="sp-card absolute left-4 top-4 max-w-xs text-[12.5px]">The 3D model needs WebGL. The stage list and details still work.</p>}
          <p className="sp-ex-status mono absolute left-3 top-3">{stage ? <>TARGET LOCKED · <b>{stage.name.toUpperCase()}</b></> : `${rocket.name.toUpperCase()} · ${rocket.heightApprox ? "~" : ""}${rocket.heightM} M`}</p>
          <div className="sp-ex-tools absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-wrap justify-center gap-1">
            {tool("−", "Zoom out", () => ex.current?.zoom(1.3))}
            {tool("+", "Zoom in", () => ex.current?.zoom(1 / 1.3))}
            {tool("⟲", "Turn left", () => ex.current?.rotate(-0.5, 0))}
            {tool("↑", "Tilt up", () => ex.current?.rotate(0, -0.35))}
            {tool("↓", "Tilt down", () => ex.current?.rotate(0, 0.35))}
            {tool("⟳", "Turn right", () => ex.current?.rotate(0.5, 0))}
            {tool("Front", "Front view", () => ex.current?.view("front"))}
            {tool("Side", "Side view", () => ex.current?.view("side"))}
            {tool("Top", "Top view", () => ex.current?.view("top"))}
            {tool("Reset view", "Reset view", () => { setSel(null); ex.current?.view("reset"); })}
            {tool("Spin", "Spin", () => setSpin((v) => !v), spin)}
            {tool("Separate stages", "Separate stages", () => setApart((v) => !v), apart)}
          </div>
          <p className="sp-ex-hint mono absolute bottom-2 left-0 right-0 text-center">DRAG TO ROTATE · PINCH OR SCROLL TO ZOOM · SHIFT-DRAG OR TWO FINGERS TO PAN · TAP A STAGE</p>
        </div>
        <aside className="sp-ex-detail order-2 p-4 lg:order-3 lg:min-h-0 lg:overflow-y-auto">
          {stage ? (
            <>
              <p className="sp-ex-h mono">{rocket.name.toUpperCase()}</p>
              <h3 className="mt-1 text-[21px] font-extrabold leading-tight text-white">{stage.name}</h3>
              {stage.propellantT !== null && <p className="mt-2"><span className="sp-ex-stat">{stage.propellantT} t</span> <span className="text-[12px]" style={{ color: "#8fb3cc" }}>propellant{stage.count > 1 ? " each" : ""}</span></p>}
              <div className="sp-ex-card" style={{ borderColor: kinds[stage.kind].colour }}>
                <p className="sp-ex-h mono">BURNS</p>
                <p className="font-bold" style={{ color: kinds[stage.kind].colour }}>{kinds[stage.kind].label}</p>
              </div>
              {stage.count > 1 && <div className="sp-ex-card"><p className="sp-ex-h mono">HOW MANY</p><p>{stage.count}, strapped round the core</p></div>}
              {stage.engine && <div className="sp-ex-card"><p className="sp-ex-h mono">ENGINE</p><p>{stage.engine}</p></div>}
              {stage.note && <div className="sp-ex-card"><p className="sp-ex-h mono">WHAT IT DOES</p><p>{stage.note}</p></div>}
              <div className="sp-ex-card"><p className="sp-ex-h mono">SOURCES</p><p><Cite ids={stage.sources} /></p></div>
            </>
          ) : (
            <>
              <p className="sp-ex-h mono">{rocket.era}</p>
              <h3 className="mt-1 text-[22px] font-extrabold leading-tight text-white">{rocket.name}</h3>
              <p className="mt-2"><span className="sp-ex-stat">{rocket.heightApprox ? "~" : ""}{rocket.heightM} m</span> <span className="text-[12px]" style={{ color: "#8fb3cc" }}>tall · <Cite ids={rocket.heightSources} /></span></p>
              <div className="sp-ex-card"><p className="sp-ex-h mono">CARRIES</p><p>{rocket.payload}</p><p className="text-[11px]" style={{ color: "#7f97aa" }}><Cite ids={rocket.payloadSources} /></p></div>
              {rocket.liftoffT !== null && <div className="sp-ex-card"><p className="sp-ex-h mono">WEIGHS AT LIFT-OFF</p><p>{rocket.liftoffT} tonnes</p><p className="text-[11px]" style={{ color: "#7f97aa" }}><Cite ids={rocket.liftoffSources} /></p></div>}
              <div className="sp-ex-card"><p className="sp-ex-h mono">STORY</p><p>{rocket.story}</p><p className="text-[11px]" style={{ color: "#7f97aa" }}><Cite ids={rocket.storySources} /></p></div>
              <p className="mt-3 text-[11px] leading-[1.5]" style={{ color: "#7f97aa" }}>Height is the published figure; how it divides between stages, and most diameters, are drawn to be legible. Tap a stage for what it burns and does.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
