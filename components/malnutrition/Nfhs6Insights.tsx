import { displayLabel, fmtNum, isPercent, type Insights, type Nfhs6States } from "@/lib/nfhs6";

/**
 * What NFHS-6's India and State/UT fact sheet says, theme by theme. Every
 * figure here is computed from the fact sheet by lib/nfhs6.ts `insights()` —
 * changes, gaps and rankings are derived and say so; none is typed by hand.
 * "Rose" and "fell" are directions, not verdicts: more caesareans or more
 * traditional contraception is not plainly better or worse.
 */

const sign = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "±");

export interface InsightCopy { eyebrow: string; title: string; intro: string; gapNote: string; label: string }

export const NFHS6_COPY: InsightCopy = {
  eyebrow: "NFHS-6 · 2023–24 against 2019–21",
  title: "What the fact sheets say, theme by theme",
  intro: "Every figure below is read from IIPS's India and State/UT fact sheet; every change, gap and ranking is computed from it here and is derived.",
  gapNote: "Schooling and internet use are for ages 15–49; blood sugar, blood pressure, tobacco and alcohol for ages 15 and over. Child marriage is left out: the fact sheet measures it for women before 18 and men before 21, which are not the same measure.",
  label: "NFHS-6 insights by theme",
};

export function Nfhs6Insights({ data, ins, copy = NFHS6_COPY }: { data: Nfhs6States; ins: Insights; copy?: InsightCopy }) {
  const ind = (n: number) => data.indicators.find((i) => i.n === n)!;
  const u = (n: number) => (isPercent(ind(n).unit) ? "%" : "");
  const pts = (n: number) => (isPercent(ind(n).unit) ? " pts" : "");
  const val = (n: number, v: number) => `${fmtNum(v, ind(n).unit)}${u(n)}`;
  const delta = (n: number, v: number) => `${sign(v)}${fmtNum(Math.abs(v), ind(n).unit)}${pts(n)}`;
  const rounds = (n: number) => (ind(n).now ? <span className="n6-ex">{ind(n).prev} → {ind(n).now}</span> : null);
  const maxMove = Math.max(...ins.movers.map((m) => Math.max(m.now, m.then)), 1);

  return (
    <section className="mt-12 n6-ins" aria-label={copy.label}>
      <p className="mal-eyebrow">{copy.eyebrow}</p>
      <h2 className="mal-h2">{copy.title}</h2>
      <p className="mal-note">
        {copy.intro} Themes are
        this site&apos;s grouping of the fact sheet&apos;s modules. &ldquo;Rose&rdquo; and &ldquo;fell&rdquo; are directions, not verdicts. The largest state rises and falls
        are among states only — union territories are small samples and swing widely — and leave out any figure the source marks as a small sample. Changes of a few points in one state are often within sampling error.
      </p>

      <h3 className="n6-ins-h">India&apos;s largest moves since the earlier round</h3>
      <ol className="n6-movers">
        {ins.movers.map((m) => (
          <li key={m.n}>
            <span className="n6-mv-l">{m.n}. {displayLabel(ind(m.n))}{rounds(m.n)}</span>
            <span className="n6-mv-bar" aria-hidden>
              <i style={{ left: `${(100 * Math.min(m.then, m.now)) / maxMove}%`, width: `${(100 * Math.abs(m.now - m.then)) / maxMove}%` }} />
              <b className="n6-then" style={{ left: `${(100 * m.then) / maxMove}%` }} />
              <b className="n6-now" style={{ left: `${(100 * m.now) / maxMove}%` }} />
            </span>
            <span className="n6-mv-v">{val(m.n, m.then)} → <b>{val(m.n, m.now)}</b> <em>{delta(m.n, m.change)}</em></span>
          </li>
        ))}
      </ol>
      <p className="mal-note">Hollow dot the earlier round, filled dot the latest. Percentage indicators only, ranked by the size of the change in points.</p>

      <div className="n6-themegrid">
        {ins.themes.filter((t) => t.theme.id !== "sex").map((t) => (
          <article key={t.theme.id} className="n6-theme">
            <h3>{t.theme.name}</h3>
            <p className="n6-theme-b">{t.theme.blurb}</p>
            <table className="n6-mini">
              <tbody>
                {t.lead.map((m) => {
                  const ex = t.extremes.find((e) => e.n === m.n);
                  return (
                    <tr key={m.n}>
                      <td>
                        {displayLabel(ind(m.n))}
                        {rounds(m.n)}
                        {ex && (ex.rise || ex.fall) && (
                          <span className="n6-ex">
                            {ex.rise && <>Largest rise: {ex.rise.geo} {delta(m.n, ex.rise.v)}</>}
                            {ex.rise && ex.fall && " · "}
                            {ex.fall && <>largest fall: {ex.fall.geo} {delta(m.n, ex.fall.v)}</>}
                          </span>
                        )}
                      </td>
                      <td className="n6-dim">{val(m.n, m.then)}</td>
                      <td><b>{val(m.n, m.now)}</b></td>
                      <td className={m.change > 0 ? "n6-up" : m.change < 0 ? "n6-down" : "n6-dim"}>{delta(m.n, m.change)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </article>
        ))}
      </div>
      <p className="mal-note">Columns: India in the earlier round, India in the latest, change (derived). Pick a theme above the map to see all of its indicators.</p>

      <h3 className="n6-ins-h">Women and men</h3>
      <div className="mal-tablewrap">
        <table className="mal-table n6-gaps">
          <thead><tr><th>Measured for both</th><th>Women</th><th>Men</th><th>Gap, latest</th><th>Gap, earlier round</th><th>States and UTs where women are higher</th></tr></thead>
          <tbody>
            {ins.gaps.map((g) => (
              <tr key={g.short}>
                <td>{g.short}</td>
                <td>{fmtNum(g.women)}%</td>
                <td>{fmtNum(g.men)}%</td>
                <td><b>{sign(g.now)}{fmtNum(Math.abs(g.now))} pts</b></td>
                <td className="n6-dim">{g.then === null ? "—" : `${sign(g.then)}${fmtNum(Math.abs(g.then))} pts`}</td>
                <td>{g.womenAhead} of {g.of}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mal-note">
        Women&apos;s figure minus men&apos;s, India, in points (derived). {copy.gapNote}
      </p>

      <h3 className="n6-ins-h">The widest gaps between town and village</h3>
      <ol className="n6-movers">
        {ins.urbanRural.map((r) => (
          <li key={r.n}>
            <span className="n6-mv-l">{r.n}. {displayLabel(ind(r.n))}</span>
            <span className="n6-mv-bar" aria-hidden>
              <i style={{ left: `${Math.min(r.urban, r.rural)}%`, width: `${Math.abs(r.gap)}%` }} />
              <b className="n6-then" style={{ left: `${r.rural}%` }} />
              <b className="n6-now" style={{ left: `${r.urban}%` }} />
            </span>
            <span className="n6-mv-v">rural {fmtNum(r.rural)}% · urban <b>{fmtNum(r.urban)}%</b> <em>{sign(r.gap)}{fmtNum(Math.abs(r.gap))} pts</em></span>
          </li>
        ))}
      </ol>
      <p className="mal-note">Hollow dot rural, filled dot urban, on a 0–100% scale. Urban minus rural, India, latest round, in points (derived).</p>
    </section>
  );
}
