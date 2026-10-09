"use client";

/**
 * The electronics atlas explorer on /breakneck/india: 250-odd product lines,
 * filterable by sector, searchable, sortable by China's share of world
 * exports, India's, or how much of India's supply comes from China.
 *
 * Every number arrives computed on the server from UN Comtrade data; this
 * component only filters and orders it. A line with no data yet sorts last and
 * says so rather than showing a zero.
 */
import { useMemo, useState } from "react";
import { usd, type AtlasRow } from "@/lib/electronics-atlas-shared";

type SortKey = "china" | "india" | "dependence" | "world" | "imports";
const SORTS: Array<[SortKey, string]> = [
  ["china", "China's share of world exports"],
  ["dependence", "India's reliance on China"],
  ["india", "India's share of world exports"],
  ["world", "Size of world trade"],
  ["imports", "India's imports"],
];

const val = (r: AtlasRow, k: SortKey): number | null =>
  k === "china" ? r.chinaShare : k === "india" ? r.indiaShare : k === "dependence" ? r.indiaFromChina : k === "world" ? r.world : r.indiaImports;

const p = (v: number | null, d = 0) => (v === null ? "—" : `${v < 1 && v > 0 && d === 0 ? v.toFixed(1) : v.toFixed(d)}%`);

export function AtlasExplorer({ rows, sectors }: { rows: AtlasRow[]; sectors: Array<{ id: string; label: string }> }) {
  const [sector, setSector] = useState<string>("all");
  const [q, setQ] = useState("");
  const [ai, setAi] = useState(false);
  const [sort, setSort] = useState<SortKey>("china");
  const [all, setAll] = useState(false);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) =>
      (sector === "all" || r.sector === sector)
      && (!ai || r.ai)
      && (!needle || r.name.toLowerCase().includes(needle) || r.official.toLowerCase().includes(needle) || r.hs.startsWith(needle)));
    return out.sort((a, b) => (val(b, sort) ?? -1) - (val(a, sort) ?? -1));
  }, [rows, sector, q, ai, sort]);

  const visible = all ? shown : shown.slice(0, 30);

  return (
    <div className="ax">
      <div className="ax-controls">
        <div className="ax-chips" role="group" aria-label="Sector">
          <button type="button" aria-pressed={sector === "all"} onClick={() => setSector("all")}>All {rows.length}</button>
          {sectors.map((s) => (
            <button key={s.id} type="button" aria-pressed={sector === s.id} onClick={() => setSector(s.id)}>{s.label}</button>
          ))}
        </div>
        <div className="ax-row">
          <label className="ax-search">
            <span>Search</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="camera, drone, 8542…" />
          </label>
          <label className="ax-sort">
            <span>Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label className="ax-ai">
            <input type="checkbox" checked={ai} onChange={(e) => setAi(e.target.checked)} />
            <span>AI and data-centre supply chain only</span>
          </label>
        </div>
        <p className="ax-count" aria-live="polite">{shown.length} line{shown.length === 1 ? "" : "s"}</p>
      </div>

      <ol className="ax-list">
        <li className="ax-head" aria-hidden="true">
          <span>Product · HS code</span><span>World exports</span><span>China</span><span>India</span><span>India&rsquo;s imports from China</span>
        </li>
        {visible.map((r) => (
          <li key={r.hs} className="ax-item">
            <div className="ax-name">
              <b>{r.name}</b>
              <span className="ax-hs">HS {r.hs} · {r.sectorLabel}{r.ai ? " · AI" : ""}</span>
              {r.top.length > 0 && (
                <span className="ax-top">Top: {r.top.slice(0, 3).map((t) => `${t.name.replace(/ \(as 'Other Asia, nes'\)/, "")} ${t.share.toFixed(0)}%`).join(", ")}</span>
              )}
            </div>
            <div className="ax-cell" data-l="World exports">{r.world === null ? <i>awaiting data</i> : usd(r.world)}</div>
            <div className="ax-cell" data-l="China">
              <Meter v={r.chinaShare} ink="cn" />
              <span>{p(r.chinaShare)}{r.chinaRank ? <small> #{r.chinaRank}</small> : null}</span>
            </div>
            <div className="ax-cell" data-l="India">
              <Meter v={r.indiaShare} ink="in" />
              <span>{p(r.indiaShare, r.indiaShare !== null && r.indiaShare < 10 ? 1 : 0)}{r.indiaRank ? <small> #{r.indiaRank}</small> : null}</span>
            </div>
            <div className="ax-cell" data-l="India's imports from China">
              <Meter v={r.indiaFromChina} ink="us" />
              <span>{p(r.indiaFromChina)}{r.indiaImports ? <small> of {usd(r.indiaImports)}</small> : null}</span>
            </div>
          </li>
        ))}
      </ol>
      {shown.length > 30 && (
        <button type="button" className="ax-more" onClick={() => setAll(!all)}>{all ? "Show the first 30" : `Show all ${shown.length}`}</button>
      )}
    </div>
  );
}

function Meter({ v, ink }: { v: number | null; ink: "cn" | "in" | "us" }) {
  return <span className={`ax-meter ${ink}`} aria-hidden="true"><span style={{ width: `${v === null ? 0 : Math.min(100, Math.max(v > 0 ? 1.5 : 0, v))}%` }} /></span>;
}
