/**
 * The visual vocabulary of /breakneck, rendered on the server.
 *
 * Two inks carry the book's argument through every chart: blueprint blue for
 * China's engineering state, legal red for America's lawyerly society. Grey
 * is everyone else. The pair was checked for colour-blind separation on the
 * paper colour; every chart also labels its marks directly, so colour is
 * never the only key.
 *
 * SVG charts are drawn on a 480-wide canvas and live in half-width cards, so
 * their text stays near its intended size from a phone to a desktop; anything
 * full-width is HTML.
 */
import type { ReactNode } from "react";
import { cite, fmt, show, type BkEvent, type BkFigure } from "@/lib/breakneck";

export type Ink = "cn" | "us" | "x" | "warn";
const INK: Record<Ink, string> = { cn: "#1f5a9e", us: "#b8432a", x: "#8a8f9c", warn: "#b8432a" };

export function Cite({ fs }: { fs: BkFigure[] }) {
  const uniq = [...new Map(fs.map((f) => [`${f.page}|${f.credit}`, f])).values()];
  return <span className="bk-cite">{uniq.map((f) => cite(f)).join(" · ")}</span>;
}

export function Card({ kicker, title, children, fs, derived, wide, note }: {
  kicker?: string; title: string; children: ReactNode; fs: BkFigure[]; derived?: string; wide?: boolean; note?: string;
}) {
  return (
    <figure className={`bk-card${wide ? " wide" : ""}`}>
      {kicker && <p className="bk-kicker">{kicker}</p>}
      <h4>{title}</h4>
      <div className="bk-viz">{children}</div>
      <figcaption>
        <Cite fs={fs} />
        {derived && <span className="bk-derived"><b>Derived</b> {derived}</span>}
        {note && <span className="bk-note">{note}</span>}
      </figcaption>
    </figure>
  );
}

export function Big({ f, which = 1, ink = "cn", sub }: { f: BkFigure; which?: 1 | 2; ink?: Ink; sub?: string }) {
  return (
    <div className="bk-big" style={{ color: INK[ink] }}>
      {f.hedge && which === 1 && <i>{f.hedge}</i>}
      <b>{show(f, which)}</b>
      {sub && <span>{sub}</span>}
    </div>
  );
}

/** Horizontal bars, labelled at both ends. `log` for ranges that span orders of magnitude. */
export function Bars({ rows, log, unit }: { rows: Array<{ label: string; value: number; ink: Ink; text?: string }>; log?: boolean; unit?: string }) {
  const max = Math.max(...rows.map((r) => r.value));
  const min = Math.min(...rows.map((r) => r.value).filter((v) => v > 0));
  const w = (v: number) => (log ? (Math.log10(v) - Math.log10(min) + 0.35) / (Math.log10(max) - Math.log10(min) + 0.35) : v / max) * 100;
  return (
    <div className="bk-bars">
      {rows.map((r) => (
        <div key={r.label} className="bk-bar">
          <span className="bk-bar-l">{r.label}</span>
          <span className="bk-bar-t"><span style={{ width: `${Math.max(1.2, w(r.value))}%`, background: INK[r.ink] }} /></span>
          <span className="bk-bar-v" style={{ color: INK[r.ink] }}>{r.text ?? fmt(r.value, unit ?? "")}</span>
        </div>
      ))}
      {log && <p className="bk-scale">Bar lengths on a log scale: each step is ten times the last.</p>}
    </div>
  );
}

/** Dots, one per unit — for counts small enough to see one by one. */
export function Dots({ groups, per = 1, cols = 40 }: { groups: Array<{ label: string; n: number; ink: Ink }>; per?: number; cols?: number }) {
  return (
    <div className="bk-dots">
      {groups.map((g) => {
        const k = Math.max(1, Math.round(g.n / per));
        const rows = Math.ceil(k / cols);
        const s = 11;
        return (
          <div key={g.label} className="bk-dotgroup">
            <p><b style={{ color: INK[g.ink] }}>{g.n.toLocaleString("en-US")}</b> {g.label}</p>
            <svg viewBox={`0 0 ${cols * s} ${rows * s}`} style={{ maxWidth: `${Math.min(cols, k) * s}px` }} role="img" aria-label={`${g.n} ${g.label}`}>
              {Array.from({ length: k }, (_, i) => (
                <circle key={i} cx={(i % cols) * s + s / 2} cy={Math.floor(i / cols) * s + s / 2} r={s * 0.36} fill={INK[g.ink]} />
              ))}
            </svg>
          </div>
        );
      })}
      {per > 1 && <p className="bk-scale">Each dot is {per.toLocaleString("en-US")}.</p>}
    </div>
  );
}

/** A grid of `total` cells with leading parts filled — "45 of the 100 highest bridges". */
export function Grid({ total, parts, cols = 10, rest = "elsewhere" }: { total: number; parts: Array<{ n: number; ink: Ink; label: string }>; cols?: number; rest?: string }) {
  const cells: Ink[] = [];
  for (const p of parts) for (let i = 0; i < p.n; i++) cells.push(p.ink);
  const s = 18;
  const rows = Math.ceil(total / cols);
  return (
    <div className="bk-grid">
      <svg viewBox={`0 0 ${cols * s} ${rows * s}`} role="img" aria-label={parts.map((p) => `${p.n} ${p.label}`).join(", ") + ` of ${total}`}>
        {Array.from({ length: total }, (_, i) => {
          const ink = cells[i];
          return <rect key={i} x={(i % cols) * s + 2} y={Math.floor(i / cols) * s + 2} width={s - 4} height={s - 4} rx={2}
            fill={ink ? INK[ink] : "none"} stroke={ink ? "none" : "#b9b2a0"} strokeWidth={1} />;
        })}
      </svg>
      <ul className="bk-legend">
        {parts.map((p) => <li key={p.label}><i style={{ background: INK[p.ink] }} />{p.n} {p.label}</li>)}
        <li><i className="empty" />{total - parts.reduce((s2, p) => s2 + p.n, 0)} {rest}</li>
      </ul>
    </div>
  );
}

/** Squares whose areas are proportional to the values, standing on one baseline. */
export function Squares({ items }: { items: Array<{ label: string; value: number; ink: Ink; text: string }> }) {
  const max = Math.max(...items.map((i) => i.value));
  const H = 170;
  return (
    <div className="bk-squares">
      {items.map((it) => {
        const side = Math.max(3, Math.sqrt(it.value / max) * H);
        return (
          <div key={it.label} className="bk-sq">
            <div className="bk-sq-box" style={{ width: side, height: side, background: INK[it.ink] }} />
            <b style={{ color: INK[it.ink] }}>{it.text}</b>
            <span>{it.label}</span>
          </div>
        );
      })}
      <p className="bk-scale">Square areas are proportional to the numbers.</p>
    </div>
  );
}

/** A small multi-series line on a 480-wide canvas; points carry their own labels. */
export function Line({ series, yMax, yLabel, xFrom, xTo, yFmt, bands }: {
  series: Array<{ name: string; ink: Ink; dashed?: boolean; points: Array<{ x: number; y: number; tag?: string }> }>;
  yMax: number; yLabel: string; xFrom: number; xTo: number; yFmt: (v: number) => string;
  bands?: Array<{ from: number; to: number; label: string }>;
}) {
  const W = 480, H = 300, L = 44, R = 18, T = 18, B = 30;
  const sx = (x: number) => L + ((x - xFrom) / (xTo - xFrom)) * (W - L - R);
  const sy = (y: number) => H - B - (y / yMax) * (H - T - B);
  const yt = [0, 0.25, 0.5, 0.75, 1].map((k) => k * yMax);
  const step = (xTo - xFrom) > 80 ? 20 : (xTo - xFrom) > 30 ? 10 : 5;
  const xt: number[] = [];
  for (let x = Math.ceil(xFrom / step) * step; x <= xTo; x += step) xt.push(x);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="bk-svg" role="img" aria-label={yLabel}>
      {bands?.map((b) => (
        <g key={b.label}>
          <rect x={sx(b.from)} y={T} width={sx(b.to) - sx(b.from)} height={H - T - B} className="bk-band" />
          <text x={sx(b.from) + 4} y={T + 12} className="bk-bandtext">{b.label}</text>
        </g>
      ))}
      {yt.map((t) => <g key={t}><line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} className="bk-gridline" /><text x={L - 6} y={sy(t) + 4} textAnchor="end" className="bk-tick">{yFmt(t)}</text></g>)}
      {xt.map((t) => <text key={t} x={sx(t)} y={H - 10} textAnchor="middle" className="bk-tick">{t}</text>)}
      {series.map((s) => (
        <g key={s.name}>
          <path d={s.points.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join("")} fill="none" stroke={INK[s.ink]} strokeWidth={2.4} strokeDasharray={s.dashed ? "6 5" : undefined} />
          {s.points.map((p) => (
            <g key={`${s.name}-${p.x}`}>
              <circle cx={sx(p.x)} cy={sy(p.y)} r={4} fill={s.dashed ? "#f5f0e4" : INK[s.ink]} stroke={INK[s.ink]} strokeWidth={2} />
              {p.tag && <text x={sx(p.x) + (sx(p.x) > W - 110 ? -7 : 7)} y={sy(p.y) - 8} textAnchor={sx(p.x) > W - 110 ? "end" : "start"} className="bk-ptag" fill={INK[s.ink]}>{p.tag}</text>}
            </g>
          ))}
        </g>
      ))}
      <text x={L} y={T - 6} className="bk-axis">{yLabel}</text>
    </svg>
  );
}

/** Two people, ten years apart in birth — the book's thought experiment, on one axis. */
export function Lifelines({ events }: { events: BkEvent[] }) {
  const from = 1945, to = 2025;
  const x = (y: number) => ((y - from) / (to - from)) * 100;
  const rows: Array<{ who: "lu" | "yao"; name: string; born: number }> = [
    { who: "lu", name: "Lu, born 1949", born: 1949 },
    { who: "yao", name: "Yao, born 1959", born: 1959 },
  ];
  return (
    <div className="bk-life">
      {rows.map((r) => (
        <div key={r.who} className={`bk-life-row ${r.who}`}>
          <span className="bk-life-name">{r.name}</span>
          <div className="bk-life-track">
            <span className="bk-life-line" style={{ left: `${x(r.born)}%` }} />
            {events.filter((e) => e.who === r.who).map((e, i) => (
              <span key={e.id} className={`bk-life-ev${i % 2 ? " alt" : ""}${x(e.year) > 82 ? " end" : ""}`} style={{ left: `${x(e.year)}%` }}>
                <i />
                <em>age {e.age}</em>
                <span>{e.what}</span>
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className="bk-life-axis">{[1950, 1970, 1990, 2010].map((y) => <span key={y} style={{ left: `${x(y)}%` }}>{y}</span>)}</div>
    </div>
  );
}

/** Promised against actual: one square a day. */
export function Calendar({ promised, actualDays }: { promised: number; actualDays: number }) {
  return (
    <div className="bk-cal">
      <div className="bk-cal-grid">
        {Array.from({ length: actualDays }, (_, i) => <span key={i} className={i < promised ? "p" : ""} />)}
      </div>
      <ul className="bk-legend">
        <li><i style={{ background: INK.cn }} />{promised} days promised</li>
        <li><i style={{ background: INK.us }} />{actualDays - promised} more days at home</li>
      </ul>
    </div>
  );
}

/** A phone outline filled to a share of its value. */
export function Phones({ items }: { items: Array<{ label: string; pct: number; text: string }> }) {
  return (
    <div className="bk-phones">
      {items.map((it) => (
        <div key={it.label} className="bk-phone">
          <svg viewBox="0 0 60 120" role="img" aria-label={`${it.label}: ${it.text}`}>
            <defs><clipPath id={`ph-${it.label.replace(/\W/g, "")}`}><rect x="4" y="4" width="52" height="112" rx="10" /></clipPath></defs>
            <g clipPath={`url(#ph-${it.label.replace(/\W/g, "")})`}>
              <rect x="0" y={120 - (it.pct / 100) * 120} width="60" height="120" fill={INK.cn} />
            </g>
            <rect x="4" y="4" width="52" height="112" rx="10" fill="none" stroke="#2b2f38" strokeWidth="2.5" />
            <rect x="22" y="9" width="16" height="3" rx="1.5" fill="#2b2f38" />
          </svg>
          <b>{it.text}</b>
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Icons in a row: hard hats for engineers, gavels for lawyers. */
export function Pictos({ n, of, kind, label }: { n: number; of: number; kind: "hat" | "gavel"; label: string }) {
  const ink = kind === "hat" ? INK.cn : INK.us;
  const Hat = ({ on }: { on: boolean }) => (
    <svg viewBox="0 0 32 26" className="bk-picto"><path d="M3 21h26v3H3zM6 21c0-7 4-12 10-12s10 5 10 12z" fill={on ? ink : "none"} stroke={on ? ink : "#b9b2a0"} strokeWidth="1.6" /><path d="M14 9V5h4v4" fill="none" stroke={on ? ink : "#b9b2a0"} strokeWidth="1.6" /></svg>
  );
  const Gavel = ({ on }: { on: boolean }) => (
    <svg viewBox="0 0 32 26" className="bk-picto"><g fill={on ? ink : "none"} stroke={on ? ink : "#b9b2a0"} strokeWidth="1.6"><rect x="6" y="3" width="13" height="7" rx="1.5" transform="rotate(-35 12 6)" /><path d="M14 11l10 9" strokeLinecap="round" /><rect x="3" y="21" width="14" height="3" /></g></svg>
  );
  return (
    <div className="bk-pictos">
      <div>{Array.from({ length: of }, (_, i) => (kind === "hat" ? <Hat key={i} on={i < n} /> : <Gavel key={i} on={i < n} />))}</div>
      <p><b style={{ color: ink }}>{n} of {of}</b> {label}</p>
    </div>
  );
}
