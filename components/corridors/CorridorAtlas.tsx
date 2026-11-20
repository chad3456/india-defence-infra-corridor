"use client";

import { useState } from "react";

/**
 * The corridor index and its two maps. Each card lights its route; each route
 * selects its card. Basemaps are static SVG files; routes are drawn here on
 * top of them, in the same coordinates, and draw themselves in on first view.
 */

export interface AtlasCorridor {
  id: string; name: string; scope: "international" | "national" | "industrial"; mode: string; partners: string[];
  started: number; startedNote: string; status: string; statusNote: string; progress?: number; progressLabel?: string;
  facts: string[]; sources: string[];
}
export interface AtlasView { width: number; height: number; routes: Array<{ id: string; d: string; mode: string }>; nodes: Array<{ id: string; name: string; x: number; y: number }>; labels: Array<{ id: string; x: number; y: number }> }

export const STATUS_LABEL: Record<string, string> = {
  operational: "Operational", "partly-operational": "Partly operational", "under-construction": "Under construction", stalled: "Stalled", framework: "Framework only",
};
const SCOPES = [
  { id: "all", label: "All" }, { id: "international", label: "International" }, { id: "national", label: "National transport" }, { id: "industrial", label: "Industrial" },
] as const;

/** A published range such as "75–80%": drawn solid to the low end and faint to the high, never as a midpoint. */
const range = (c: AtlasCorridor): [number, number] | null => { const m = c.progressLabel?.match(/^(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)%$/); return m ? [Number(m[1]), Number(m[2])] : null; };
const host = (u: string) => (u.startsWith("/") ? "this site" : new URL(u).hostname.replace(/^www\./, ""));

export function CorridorAtlas({ corridors, world, india }: { corridors: AtlasCorridor[]; world: AtlasView; india: AtlasView }) {
  const [scope, setScope] = useState<(typeof SCOPES)[number]["id"]>("all");
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const list = corridors.filter((c) => scope === "all" || c.scope === scope);
  const active = hover ?? sel;
  const picked = corridors.find((c) => c.id === sel) ?? null;
  const pick = (id: string) => setSel((s) => (s === id ? null : id));

  const Map = ({ v, src, label, show }: { v: AtlasView; src: string; label: string; show: (id: string) => boolean }) => (
    <figure className="cor-map">
      <div className="cor-mapbox" style={{ aspectRatio: `${v.width} / ${v.height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" aria-hidden className="cor-base" />
        <svg viewBox={`0 0 ${v.width} ${v.height}`} role="img" aria-label={label} className="cor-routes">
          {v.routes.filter((r) => show(r.id)).map((r, i) => {
            const c = corridors.find((x) => x.id === r.id)!;
            const dim = active !== null && active !== r.id;
            return (
              <path key={`${r.id}-${i}`} d={r.d} pathLength={1}
                className={`cor-route cor-m-${r.mode} cor-s-${c.status}${dim ? " cor-dim" : ""}${active === r.id ? " cor-on" : ""}`}
                style={{ animationDelay: `${(i % 12) * 0.12}s` }}
                onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)} onClick={() => pick(r.id)}>
                <title>{c.name}</title>
              </path>
            );
          })}
          {v.nodes.map((n) => (
            <g key={n.id} className={active && active !== "defence" ? "cor-dim" : ""} onMouseEnter={() => setHover("defence")} onMouseLeave={() => setHover(null)} onClick={() => pick("defence")}>
              <rect x={n.x - 4} y={n.y - 4} width={8} height={8} transform={`rotate(45 ${n.x} ${n.y})`} className="cor-node"><title>{`${n.name} — defence corridor node`}</title></rect>
            </g>
          ))}
          {v.labels.map((l) => {
            const c = corridors.find((x) => x.id === l.id)!;
            if (!show(l.id)) return null;
            return <text key={l.id} x={l.x} y={l.y - 8} textAnchor="middle" className={`cor-label${active && active !== l.id ? " cor-dim" : ""}`} onClick={() => pick(l.id)}>{c.name.replace(/\s*\(.*\)$/, "").replace(/ (Economic|Transport|Transit|Motor Vehicles).*$/, "").replace(/^India–/, "")}</text>;
          })}
        </svg>
      </div>
    </figure>
  );

  return (
    <div className="cor-atlas">
      <div className="cor-chips" role="radiogroup" aria-label="Kind of corridor">
        {SCOPES.map((s) => (
          <button key={s.id} type="button" role="radio" aria-checked={scope === s.id} onClick={() => { setScope(s.id); setSel(null); }}>
            {s.label} <em>{s.id === "all" ? corridors.length : corridors.filter((c) => c.scope === s.id).length}</em>
          </button>
        ))}
      </div>
      <div className="cor-grid">
        <div className="cor-maps">
          {(scope === "all" || scope === "international") && <Map v={world} src="/corridors/world.svg" label="International corridors India is part of" show={(id) => list.some((c) => c.id === id)} />}
          {(scope === "all" || scope !== "international") && <Map v={india} src="/corridors/india.svg" label="National freight, road, rail and industrial corridors" show={(id) => list.some((c) => c.id === id)} />}
          <p className="cor-legend">
            <span><i className="cor-k cor-m-sea" /> sea</span><span><i className="cor-k cor-m-rail" /> rail</span><span><i className="cor-k cor-m-road" /> road</span>
            <span><i className="cor-k cor-m-river" /> river</span><span><i className="cor-k cor-m-industrial" /> industrial corridor</span><span><i className="cor-k cor-kn" /> defence corridor node</span>
            <span className="cor-legsep">Colour: status —</span>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <span key={k}><i className={`cor-k cor-ks cor-s-${k}`} /> {v.toLowerCase()}</span>)}
          </p>
        </div>
        <ol className="cor-list">
          {list.map((c) => (
            <li key={c.id} className={`cor-card${sel === c.id ? " cor-open" : ""}${active === c.id ? " cor-lit" : ""}`} onMouseEnter={() => setHover(c.id)} onMouseLeave={() => setHover(null)}>
              <button type="button" className="cor-cardhead" onClick={() => pick(c.id)} aria-expanded={sel === c.id}>
                <span className={`cor-dot cor-s-${c.status}`} aria-hidden />
                <span className="cor-name">{c.name}</span>
                <span className="cor-meta">{c.started < 2014 ? `Begun ${c.started}, before 2014` : `Begun ${c.started}`} · {STATUS_LABEL[c.status]}</span>
                {(c.progress !== undefined || c.progressLabel) && (
                  <span className="cor-prog">
                    {range(c) ? <><i style={{ width: `${range(c)![0]}%` }} /><i className="cor-proghi" style={{ left: `${range(c)![0]}%`, width: `${range(c)![1] - range(c)![0]}%` }} /></> : <i style={{ width: `${c.progress ?? 0}%` }} />}
                    <b>{c.progressLabel ?? `${c.progress}%`}</b>
                  </span>
                )}
              </button>
              {sel === c.id && (
                <div className="cor-body">
                  <p className="cor-mode">{c.mode} · {c.partners.join(", ")}</p>
                  <p><b>Begun:</b> {c.startedNote}</p>
                  <p><b>Now:</b> {c.statusNote}</p>
                  <ul>{c.facts.map((f) => <li key={f}>{f}</li>)}</ul>
                  <p className="cor-src">Checked against {c.sources.map((u, i) => <span key={u}>{i ? ", " : ""}<a href={u} target={u.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer">{host(u)}</a></span>)}</p>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
      {picked && <p className="cor-sr" aria-live="polite">{picked.name}: {STATUS_LABEL[picked.status]}</p>}
    </div>
  );
}
