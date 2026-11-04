/**
 * Charts for /elections/since-2020, server-rendered SVG: the timeline of every
 * election against the world's shocks and India's economy, a tile map of who
 * governs, and paired bars for 2019 against 2024.
 */
import type { Election, SinceFile } from "@/lib/since-2020";
import { TILES } from "@/lib/since-2020";

const T0 = Date.UTC(2020, 0, 1), T1 = Date.UTC(2027, 0, 1);
const tOf = (ym: string) => { const [y, m = "1", d = "15"] = ym.split("-"); return Date.UTC(Number(y), Number(m) - 1, Number(d)); };

export function Timeline({ elections, events, growth, inflation }: {
  elections: Election[];
  events: SinceFile["events"];
  growth: Array<{ year: number; v: number }>;
  inflation: Array<{ year: number; v: number }>;
}) {
  const W = 1100, L = 44, R = 16;
  // Rounded, so the server and the browser print identical coordinates.
  const x = (t: number) => Math.round((L + ((t - T0) / (T1 - T0)) * (W - L - R)) * 10) / 10;
  // Lanes: events, elections (vote share), economy.
  const EV = 14, E0 = 70, E1 = 300, C0 = 340, C1 = 430;
  const y = (share: number) => Math.round((E1 - (share / 60) * (E1 - E0)) * 10) / 10;
  const gy = (v: number) => Math.round((C0 + ((10 - v) / 16) * (C1 - C0)) * 10) / 10;
  // Elections in the same month sit side by side, not on top of each other.
  const seen = new Map<string, number>();
  const placed = elections.map((e) => {
    const k = e.date, i = seen.get(k) ?? 0; seen.set(k, i + 1);
    return { e, cx: x(tOf(e.date)) + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 9, r: Math.round((4 + Math.sqrt(e.house) * 0.55) * 10) / 10 };
  });
  const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
  return (
    <figure className="s20-timeline">
      <svg viewBox={`0 0 ${W} 470`} role="img" aria-label="Timeline of elections since 2020, with world events and India's growth and inflation">
        {years.map((yr) => (
          <g key={yr}>
            <line x1={x(Date.UTC(yr, 0, 1))} x2={x(Date.UTC(yr, 0, 1))} y1={EV} y2={C1} className="s20-grid" />
            <text x={x(Date.UTC(yr, 6, 1))} y={455} textAnchor="middle" className="s20-year">{yr}</text>
          </g>
        ))}
        {/* World events */}
        <text x={4} y={EV + 4} className="s20-lane">World</text>
        {events.map((ev, i) => (
          <g key={ev.date}>
            <line x1={x(tOf(ev.date))} x2={x(tOf(ev.date))} y1={EV + 8} y2={E1} className={`s20-evline s20-${ev.kind}`} />
            <circle cx={x(tOf(ev.date))} cy={EV + 26} r={9} className={`s20-evdot s20-${ev.kind}`}><title>{`${ev.date}: ${ev.text}`}</title></circle>
            <text x={x(tOf(ev.date))} y={EV + 30} textAnchor="middle" className="s20-evnum">{i + 1}</text>
          </g>
        ))}
        {/* Elections */}
        <text x={4} y={E0 - 14} className="s20-lane">BJP vote share</text>
        {[0, 20, 40, 60].map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="s20-hgrid" /><text x={L - 6} y={y(v) + 3} textAnchor="end" className="s20-tick">{v}%</text></g>)}
        {placed.map(({ e, cx, r }) => e.bjpShare === null ? (
          <g key={e.key}>
            <circle cx={cx} cy={E1 + 14} r={r * 0.6} className={e.ndaGovernment ? "s20-won" : "s20-lost"} opacity={0.55}><title>{`${e.state}, ${e.label}: BJP ${e.bjpSeats}/${e.house} seats; vote share not read`}</title></circle>
          </g>
        ) : (
          <g key={e.key}>
            <circle cx={cx} cy={y(e.bjpShare)} r={r} className={e.ndaGovernment ? "s20-won" : "s20-lost"}><title>{`${e.state}, ${e.label}: BJP ${e.bjpSeats}/${e.house} seats, ${e.bjpShare.toFixed(1)}% of the vote${e.ndaSeats !== null && e.ndaSeats !== e.bjpSeats ? `; NDA ${e.ndaSeats}` : ""}. ${e.ndaGovernment ? "NDA formed the government" : "NDA did not form the government"}`}</title></circle>
            {r > 9 && <text x={cx} y={y(e.bjpShare) + 3} textAnchor="middle" className="s20-abbr">{TILES[e.state]?.[2] ?? ""}</text>}
          </g>
        ))}
        {/* The economy */}
        <text x={4} y={C0 + 4} className="s20-lane">Economy</text>
        <line x1={L} x2={W - R} y1={gy(0)} y2={gy(0)} className="s20-zero" />
        {growth.filter((g) => g.year >= 2020).map((g) => {
          const x0 = x(Date.UTC(g.year, 0, 1)) + 6, x1 = x(Date.UTC(g.year + 1, 0, 1)) - 6;
          return <rect key={g.year} x={x0} width={x1 - x0} y={Math.min(gy(g.v), gy(0))} height={Math.abs(gy(g.v) - gy(0))} className={g.v < 0 ? "s20-gneg" : "s20-gpos"}><title>{`GDP growth ${g.year}: ${g.v.toFixed(1)}%`}</title></rect>;
        })}
        {growth.filter((g) => g.year >= 2020).map((g) => <text key={`t${g.year}`} x={x(Date.UTC(g.year, 6, 1))} y={g.v < 0 ? gy(g.v) + 12 : gy(g.v) - 4} textAnchor="middle" className="s20-gval">{g.v > 0 ? "+" : ""}{g.v.toFixed(1)}%</text>)}
        <path d={inflation.filter((g) => g.year >= 2020).map((g, i) => `${i ? "L" : "M"}${x(Date.UTC(g.year, 6, 1)).toFixed(1)},${gy(g.v).toFixed(1)}`).join("")} className="s20-infl" />
        {inflation.filter((g) => g.year >= 2020).map((g) => <circle key={g.year} cx={x(Date.UTC(g.year, 6, 1))} cy={gy(g.v)} r={3} className="s20-infldot"><title>{`Consumer price inflation ${g.year}: ${g.v.toFixed(1)}%`}</title></circle>)}
      </svg>
      <figcaption>
        <span><i className="s20-key s20-won" /> NDA formed the government</span>
        <span><i className="s20-key s20-lost" /> it did not</span>
        <span>Circle size: seats in the house · height: the BJP&apos;s vote share · low faint circles: vote share not read</span>
        <span><i className="s20-key s20-gpos" /> GDP growth <i className="s20-key s20-inflkey" /> consumer price inflation (World Bank, yearly)</span>
      </figcaption>
      <ol className="s20-events">
        {events.map((ev, i) => (
          <li key={ev.date}><b className={`s20-evbadge s20-${ev.kind}`}>{i + 1}</b><span>{new Date(ev.date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })} — {ev.url.startsWith("/") ? <a href={ev.url}>{ev.text}</a> : <a href={ev.url} target="_blank" rel="noopener noreferrer">{ev.text}</a>}</span></li>
        ))}
      </ol>
    </figure>
  );
}

/** A tile map: each state one square, coloured by the alliance governing it now, labelled with the BJP's latest assembly vote share. */
export function TileMap({ governs, latest }: { governs: Array<{ state: string; alliance: string; party: string }>; latest: Record<string, Election> }) {
  const S = 62, G = 5;
  const name = (s: string) => (s === "NCT of Delhi" ? "Delhi" : s);
  const gov = new Map(governs.map((g) => [name(g.state), g]));
  return (
    <figure className="s20-tiles">
      <svg viewBox={`0 0 ${8 * (S + G)} ${7 * (S + G)}`} role="img" aria-label="Map of India's states by governing alliance">
        {Object.entries(TILES).map(([st, [c, r, ab]]) => {
          const g = gov.get(st), e = latest[st];
          const cls = !g ? "s20-t-none" : g.alliance === "NDA" ? (g.party === "BJP" ? "s20-t-bjp" : "s20-t-nda") : g.alliance === "INDIA" ? "s20-t-india" : "s20-t-other";
          return (
            <g key={st} transform={`translate(${c * (S + G)},${r * (S + G)})`}>
              <rect width={S} height={S} rx={8} className={cls}><title>{`${st}: ${g ? `governed by ${g.party} (${g.alliance})` : "no elected legislature"}${e ? `; BJP ${e.bjpSeats}/${e.house} seats${e.bjpShare !== null ? `, ${e.bjpShare.toFixed(1)}%` : ""} in ${e.label}` : ""}`}</title></rect>
              <text x={S / 2} y={24} textAnchor="middle" className="s20-tab">{ab}</text>
              <text x={S / 2} y={42} textAnchor="middle" className="s20-tsub">{g ? g.party : "—"}</text>
              {e?.bjpShare !== null && e?.bjpShare !== undefined && <text x={S / 2} y={55} textAnchor="middle" className="s20-tsub2">BJP {e.bjpShare.toFixed(0)}%</text>}
            </g>
          );
        })}
      </svg>
      <figcaption>
        <span><i className="s20-key s20-t-bjp" /> BJP chief minister</span>
        <span><i className="s20-key s20-t-nda" /> NDA ally&apos;s chief minister</span>
        <span><i className="s20-key s20-t-india" /> INDIA bloc</span>
        <span><i className="s20-key s20-t-other" /> neither</span>
        <span><i className="s20-key s20-t-none" /> no elected legislature</span>
      </figcaption>
    </figure>
  );
}

/** Two values side by side as bars against a shared maximum. */
export function PairBars({ rows, max, unit = "", same = false }: { rows: Array<{ label: string; a: number; b: number; aLabel: string; bLabel: string }>; max: number; unit?: string; same?: boolean }) {
  // Before-and-after pairs shade the earlier bar lighter; two groups at one time (women, men) share one colour.
  return (
    <div className="s20-pairs">
      {rows.map((r) => (
        <div key={r.label} className="s20-pair">
          <p>{r.label}</p>
          <div className="s20-bar"><i className={same ? "s20-c" : "s20-a"} style={{ width: `${(100 * r.a) / max}%` }} /><span>{r.aLabel} <b>{unit === "%" ? r.a.toFixed(r.a % 1 ? 2 : 0) : r.a.toLocaleString("en-IN")}{unit}</b></span></div>
          <div className="s20-bar"><i className={same ? "s20-c" : "s20-b"} style={{ width: `${(100 * r.b) / max}%` }} /><span>{r.bLabel} <b>{unit === "%" ? r.b.toFixed(r.b % 1 ? 2 : 0) : r.b.toLocaleString("en-IN")}{unit}</b></span></div>
        </div>
      ))}
    </div>
  );
}
