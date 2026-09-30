"use client";

/**
 * Every place on the board, as a list — the table view for anyone who would
 * rather read than play, and for every place that has no coordinates.
 */
import { useMemo, useState } from "react";
import type { BoardPlace, BoardFigure } from "./NamesakesBoard";
import { CATEGORY_LABEL, TIER_LABEL } from "@/lib/namesakes-shared";

const PAGE = 60;

export function NamesakesList({ places, figures }: { places: BoardPlace[]; figures: BoardFigure[] }) {
  const [q, setQ] = useState("");
  const [fig, setFig] = useState("all");
  const [n, setN] = useState(PAGE);
  const name = useMemo(() => new Map(figures.map((f) => [f.id, f.name])), [figures]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return places.filter((p) =>
      (fig === "all" || p.figures.includes(fig)) &&
      (!needle || `${p.name} ${p.state ?? ""} ${p.locatedIn ?? ""}`.toLowerCase().includes(needle)));
  }, [places, q, fig]);

  return (
    <div className="ns-list">
      <div className="ns-list-controls">
        <input type="search" placeholder="Search a name, town or state" value={q} onChange={(e) => { setQ(e.target.value); setN(PAGE); }} aria-label="Search places" />
        <select value={fig} onChange={(e) => { setFig(e.target.value); setN(PAGE); }} aria-label="Named after">
          <option value="all">Named after anyone</option>
          {figures.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <span className="ns-list-count">{rows.length.toLocaleString("en-IN")} places</span>
      </div>
      <div className="ns-table-wrap">
        <table className="ns-table">
          <thead>
            <tr><th>Place</th><th>Named after</th><th>What it is</th><th>Where</th><th>Proof</th></tr>
          </thead>
          <tbody>
            {rows.slice(0, n).map((p) => {
              const best = p.evidence[0]!;
              return (
                <tr key={p.i}>
                  <td><b>{p.name}</b>{p.x === null && <span className="ns-nocoord" title="No coordinates of its own, so it is listed but not pinned"> · not on map</span>}</td>
                  <td>{p.figures.map((f) => name.get(f)).join(", ")}</td>
                  <td>{CATEGORY_LABEL[p.category]}</td>
                  <td>{[p.locatedIn, p.state].filter(Boolean).filter((x, k, a) => a.indexOf(x) === k).join(", ") || "—"}</td>
                  <td><a href={best.url} target="_blank" rel="noreferrer">{TIER_LABEL[best.tier]} ↗</a></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {n < rows.length && <button className="ns-btn" onClick={() => setN(n + PAGE * 3)}>Show more</button>}
    </div>
  );
}
