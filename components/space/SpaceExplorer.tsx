"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ORIGINS, PART_ORDER, searchParts, type LiveState, type Origin, type PartId, type SpacePart, type SpacePublished } from "@/lib/space-story";
import type { Explorer, View } from "./explorer";
import { LiveReadout } from "./LiveReadout";

/**
 * The X-ray explorer: NISAR's sixteen parts to turn, zoom, pull apart, filter
 * and pick. Every statement in the panels is the register's, with its source;
 * colours are who built each part.
 */

type Chip = Origin | `group:${string}`;

export function SpaceExplorer({ parts, origins, sources, live, feedOk, onClose }: {
  parts: SpacePart[];
  origins: SpacePublished["origins"];
  sources: Array<{ id: string; publisher: string; url: string }>;
  live: LiveState | null;
  feedOk: boolean;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const ex = useRef<Explorer | null>(null);
  const [ready, setReady] = useState<"loading" | "3d" | "flat">("loading");
  const [selected, setSelected] = useState<PartId | null>(null);
  const [chips, setChips] = useState<Set<Chip>>(new Set());
  const [q, setQ] = useState("");
  const [apart, setApart] = useState(false);
  const [spin, setSpin] = useState(false);
  const [full, setFull] = useState(false);
  const byId = useMemo(() => Object.fromEntries(parts.map((p) => [p.id, p])) as Record<PartId, SpacePart>, [parts]);
  const src = (id: string) => sources.find((s) => s.id === id);
  const groups = useMemo(() => [...new Set(parts.map((p) => p.group))], [parts]);
  const colours = useMemo(() => Object.fromEntries(ORIGINS.map((o) => [o, origins[o].colour])) as Record<Origin, string>, [origins]);

  const shown = useMemo(() => {
    const found = searchParts(parts, q);
    const og = [...chips].filter((c): c is Origin => !c.startsWith("group:"));
    const gr = [...chips].filter((c) => c.startsWith("group:")).map((c) => c.slice(6));
    return new Set(parts.filter((p) => found.has(p.id) && (!og.length || og.includes(p.origin)) && (!gr.length || gr.includes(p.group))).map((p) => p.id));
  }, [parts, q, chips]);

  useEffect(() => {
    let disposed = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") ?? probe.getContext("webgl")) || !canvas.current || !overlay.current) { setReady("flat"); return; }
    import("./explorer").then(({ createExplorer }) => {
      if (disposed || !canvas.current || !overlay.current) return;
      const e = createExplorer(canvas.current, overlay.current, parts.map((p) => ({ id: p.id, name: p.name, origin: p.origin })), colours, reduced);
      e.onPick((id) => setSelected(id));
      ex.current = e;
      setReady("3d");
    }).catch(() => setReady("flat"));
    const ro = new ResizeObserver(() => ex.current?.resize());
    if (canvas.current) ro.observe(canvas.current);
    return () => { disposed = true; ro.disconnect(); ex.current?.dispose(); ex.current = null; };
  }, [parts, colours]);

  useEffect(() => { ex.current?.select(selected); }, [selected, ready]);
  useEffect(() => { ex.current?.setShown(shown); }, [shown, ready]);
  useEffect(() => { ex.current?.setApart(apart); }, [apart, ready]);
  useEffect(() => { ex.current?.setSpin(spin); }, [spin, ready]);

  // Esc closes; arrows step through the parts. The page behind does not scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (document.fullscreenElement) return; onClose(); }
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") step(e.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    box.current?.focus();
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); document.removeEventListener("fullscreenchange", onFs); };
  });

  const order = PART_ORDER.filter((id) => shown.has(id));
  function step(d: number) {
    const list = order.length ? order : PART_ORDER;
    const i = selected ? list.indexOf(selected) : -1;
    setSelected(list[(i + d + list.length) % list.length] ?? null);
  }
  const toggle = (c: Chip) => setChips((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  const resetAll = () => { setChips(new Set()); setQ(""); setSelected(null); setApart(false); setSpin(false); ex.current?.view("reset"); };
  const fullscreen = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void box.current?.requestFullscreen?.(); };
  const p = selected ? byId[selected] : null;
  const idx = selected ? PART_ORDER.indexOf(selected) : -1;
  const tool = (label: string, title: string, fn: () => void, pressed?: boolean) => (
    <button type="button" className="sp-tool" title={title} aria-label={title} aria-pressed={pressed} onClick={fn}>{label}</button>
  );

  return (
    <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label="X-ray explorer: NISAR, part by part" className="sp-ex fixed inset-0 z-[80] flex flex-col outline-none">
      <div className="sp-ex-bar flex items-center gap-1.5 overflow-x-auto px-3 py-2">
        <span className="sp-ex-brand mono">X-RAY · NISAR</span>
        {ORIGINS.map((o) => (
          <button key={o} type="button" className="sp-chip" aria-pressed={chips.has(o)} onClick={() => toggle(o)}><span className="sp-dot" style={{ background: origins[o].colour }} aria-hidden />{origins[o].label}</button>
        ))}
        {groups.map((g) => <button key={g} type="button" className="sp-chip" aria-pressed={chips.has(`group:${g}`)} onClick={() => toggle(`group:${g}`)}>{g}</button>)}
        <span className="flex-1" />
        <button type="button" className="sp-chip" onClick={resetAll}>Reset all</button>
        <button type="button" className="sp-chip" onClick={fullscreen}>{full ? "Exit full screen" : "Full screen"}</button>
        <button type="button" className="sp-chip sp-chip-close" onClick={onClose}>Close ✕</button>
      </div>

      <div ref={body} className="sp-ex-body grid min-h-0 flex-1 grid-cols-1 content-start overflow-y-auto lg:grid-cols-[250px_minmax(0,1fr)_320px] lg:content-stretch lg:overflow-hidden">
        <aside className="sp-ex-list order-3 p-3 lg:order-1 lg:min-h-0 lg:overflow-y-auto">
          <input className="sp-search" placeholder="Find a part…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a part" />
          {groups.map((g) => {
            const list = parts.filter((x) => x.group === g);
            return (
              <div key={g} className="mt-3">
                <p className="sp-ex-h mono">{g.toUpperCase()}</p>
                <ul>
                  {list.map((x) => (
                    <li key={x.id}>
                      <button type="button" className="sp-ex-item" aria-current={selected === x.id} disabled={!shown.has(x.id)} onClick={() => { setSelected(x.id); if (window.innerWidth < 1024) body.current?.scrollTo({ top: 0, behavior: "smooth" }); }}>
                        <span className="sp-dot" style={{ background: origins[x.origin].colour }} aria-hidden />
                        <span className="mono sp-ex-n">{String(PART_ORDER.indexOf(x.id) + 1).padStart(2, "0")}</span>
                        <span className="flex-1">{x.name}</span>
                        {x.origin === "us" && <span className="sp-tag">US</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </aside>

        <div className="sp-ex-view relative order-1 h-[52svh] min-h-[320px] lg:order-2 lg:h-auto">
          <canvas ref={canvas} className="absolute inset-0 h-full w-full touch-none" />
          <div ref={overlay} className="pointer-events-none absolute inset-0 overflow-hidden" />
          <div className="sp-scanlines pointer-events-none absolute inset-0" />
          {ready === "flat" && <p className="sp-card absolute left-4 top-4 max-w-xs text-[12.5px]">The 3D model needs WebGL. The part list and details still work.</p>}
          <p className="sp-ex-status mono absolute left-3 top-3">{p ? <>TARGET LOCKED · <b>{p.name.toUpperCase()}</b></> : `${shown.size} OF ${parts.length} PARTS SHOWN`}</p>
          <div className="sp-ex-tools absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-wrap justify-center gap-1">
            {tool("−", "Zoom out", () => ex.current?.zoom(1.3))}
            {tool("+", "Zoom in", () => ex.current?.zoom(1 / 1.3))}
            {tool("⟲", "Turn left", () => ex.current?.rotate(-0.5, 0))}
            {tool("↑", "Tilt up", () => ex.current?.rotate(0, -0.35))}
            {tool("↓", "Tilt down", () => ex.current?.rotate(0, 0.35))}
            {tool("⟳", "Turn right", () => ex.current?.rotate(0.5, 0))}
            {tool("Front", "Front view", () => ex.current?.view("front" as View))}
            {tool("Side", "Side view", () => ex.current?.view("side"))}
            {tool("Top", "Top view", () => ex.current?.view("top"))}
            {tool("Reset view", "Reset view", () => { setSelected(null); ex.current?.view("reset"); })}
            {tool("Spin", "Spin", () => setSpin((v) => !v), spin)}
            {tool("Pull apart", "Pull apart", () => setApart((v) => !v), apart)}
          </div>
          <p className="sp-ex-hint mono absolute bottom-2 left-0 right-0 text-center">DRAG TO ROTATE · PINCH OR SCROLL TO ZOOM · SHIFT-DRAG OR TWO FINGERS TO PAN · TAP A PART</p>
        </div>

        <aside className="sp-ex-detail order-2 p-4 lg:order-3 lg:min-h-0 lg:overflow-y-auto">
          {p ? (
            <>
              <div className="flex items-center justify-between">
                <span className="mono text-[11px]" style={{ color: "#8fb3cc" }}>{String(idx + 1).padStart(2, "0")} / {PART_ORDER.length}</span>
                <span className="flex gap-1"><button type="button" className="sp-tool" aria-label="Previous part" onClick={() => step(-1)}>‹</button><button type="button" className="sp-tool" aria-label="Next part" onClick={() => step(1)}>›</button></span>
              </div>
              <p className="sp-ex-h mono mt-2">{p.group.toUpperCase()}</p>
              <h3 className="mt-1 text-[22px] font-extrabold leading-tight text-white">{p.name}</h3>
              {p.stat && (
                <p className="mt-2"><span className="sp-ex-stat">{p.stat.value}</span> <span className="text-[12px]" style={{ color: "#8fb3cc" }}>{p.stat.label} · <a className="underline decoration-dotted" href={src(p.stat.source)?.url} target="_blank" rel="noopener noreferrer">{src(p.stat.source)?.publisher}</a></span></p>
              )}
              <div className="sp-ex-card" style={{ borderColor: origins[p.origin].colour }}>
                <p className="sp-ex-h mono">WHO BUILT IT</p>
                <p className="font-bold" style={{ color: origins[p.origin].colour }}>{origins[p.origin].label}</p>
              </div>
              <div className="sp-ex-card"><p className="sp-ex-h mono">WHAT IT DOES</p><p>{p.does}</p></div>
              <div className="sp-ex-card"><p className="sp-ex-h mono">ON NISAR</p><p>{p.inNisar}</p></div>
              <div className="sp-ex-card">
                <p className="sp-ex-h mono">SOURCES</p>
                <p>{p.sources.map((s, i) => <span key={s}>{i ? " · " : ""}<a className="underline decoration-dotted" href={src(s)?.url} target="_blank" rel="noopener noreferrer">{src(s)?.publisher}</a></span>)}</p>
              </div>
            </>
          ) : (
            <>
              <p className="sp-ex-h mono">NISAR · NASA–ISRO SYNTHETIC APERTURE RADAR</p>
              <h3 className="mt-1 text-[20px] font-extrabold leading-tight text-white">Pick a part</h3>
              <p className="mt-2 text-[13px] leading-[1.55]" style={{ color: "#b8cbdb" }}>Tap a part on the model or in the list. Colours are who built it. Filter by builder or by system above; pull it apart to see inside the bus.</p>
              <ul className="mt-3 space-y-1 text-[12.5px]">
                {ORIGINS.map((o) => <li key={o} className="flex items-center gap-2"><span className="sp-dot" style={{ background: origins[o].colour }} aria-hidden />{origins[o].label} · {parts.filter((x) => x.origin === o).length} parts</li>)}
              </ul>
              <div className="sp-ex-card mt-4">
                <LiveReadout live={live} feed={{ status: feedOk ? "ok" : live ? "ok" : "none", nisar: feedOk }} />
              </div>
              <p className="mt-3 text-[11px] leading-[1.5]" style={{ color: "#7f97aa" }}>The model is NISAR&apos;s layout, not its blueprint: the 12 m reflector and 9 m boom are drawn to their published lengths, the rest is sized to be legible.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
