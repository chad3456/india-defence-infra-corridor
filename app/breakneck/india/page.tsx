import type { ReactNode } from "react";
import { loadBreakneck, cite, fmt, show, type BkFigure } from "@/lib/breakneck";
import { Bars, Squares, INK, type Ink } from "@/components/breakneck/Viz";
import { AtlasExplorer } from "@/components/breakneck/AtlasExplorer";
import { loadIndiaBreakneck, wdi, wdiAt, fmtIn, type InMetric, type InContext, type InValue, type WdiView } from "@/lib/india-breakneck";
import { loadAtlas, usd, type AtlasRow } from "@/lib/electronics-atlas";
import { SECTORS } from "@/lib/electronics-catalogue";

/**
 * Breakneck, measured against India: the book's China-and-America figures
 * with India set beside them, then an atlas of 250-odd electronics lines —
 * who exports each, and how much of India's supply comes from China.
 *
 * Book figures come only through `fig` (verified against the book's text);
 * India figures only through `M` (each cited to a publisher in
 * data/global/india-breakneck.json); World Bank readings from
 * data/series/wdi.json; trade from UN Comtrade via
 * data/trade/electronics-atlas.json. Every comparison carries a label saying
 * whether India's number measures the same thing as the book's.
 */

export const metadata = {
  title: "Breakneck, measured against India · Bharat Tracker",
  description:
    "India set beside the figures Dan Wang's Breakneck uses for China and the United States — metros, high-speed rail, reactors, wind, factories, lawyers, "
    + "births — each India figure cited, each comparison labelled like-for-like or not. Then an atlas of 250+ electronics lines, from phone parts to drones "
    + "and AI hardware: who exports each, and how much of India's supply comes from China.",
};

const BADGE: Record<InMetric["comparable"], string> = {
  direct: "Like for like",
  approximate: "Close, not identical",
  context: "Different measure",
};

const pct = (v: number | null, d = 0) => (v === null ? "—" : `${v.toFixed(d)}%`);
const short = (n: string) => n.replace(/ \(as 'Other Asia, nes'\)/, "");

function fmtW(v: number, w: WdiView): string {
  if (w.unit.includes("%")) return `${v.toFixed(1)}%`;
  if (w.unit.includes("US$")) return usd(v);
  if (w.unit === "people") return v >= 1e9 ? `${(v / 1e9).toFixed(2)}bn` : `${Math.round(v / 1e6)}m`;
  return v.toLocaleString("en-US", { maximumFractionDigits: v < 10 ? 2 : 0 });
}

function peer(w: WdiView, iso3: string) {
  return w.peers.find((p) => p.iso3 === iso3) ?? null;
}

/** A comparison card: the book's figures, India's, and both sets of citations. */
function ICard({ m, fs, title, children, derived, wdis = [], wide }: {
  m?: InMetric | InContext; fs: BkFigure[]; title?: string; children: ReactNode; derived?: string; wdis?: WdiView[]; wide?: boolean;
}) {
  const comparable = m && "comparable" in m ? m.comparable : null;
  return (
    <figure className={`bk-card in-card${wide ? " wide" : ""}`}>
      {comparable && <p className={`in-badge ${comparable}`}>{BADGE[comparable]}</p>}
      <h4>{title ?? m?.title}</h4>
      <div className="bk-viz">{children}</div>
      <figcaption>
        {m && <span className="bk-note">{m.note}</span>}
        {fs.length > 0 && <span className="bk-cite">Book: {[...new Map(fs.map((f) => [`${f.page}|${f.credit}`, f])).values()].map((f) => cite(f)).join(" · ")}</span>}
        {m && (
          <span className="bk-cite in-src">
            India:{" "}
            {m.sources.map((s, i) => (
              <span key={s.url}>{i > 0 ? " · " : ""}<a href={s.url} rel="noopener noreferrer" target="_blank">{s.publisher}</a></span>
            ))}
          </span>
        )}
        {wdis.length > 0 && (
          <span className="bk-cite">World Bank, World Development Indicators: {wdis.map((w) => w.title).join("; ")} — read {wdis[0]!.lastVerified}</span>
        )}
        {derived && <span className="bk-derived"><b>Derived</b> {derived}</span>}
      </figcaption>
    </figure>
  );
}

/** Three countries on one log axis: where India sits between the engineers and the lawyers. */
function Strip({ rows }: { rows: Array<{ what: string; cn: number | null; us: number | null; in: number | null; f: (v: number) => string; note?: string }> }) {
  return (
    <div className="in-strip">
      {rows.map((r) => {
        const vs = [r.cn, r.us, r.in].filter((v): v is number => v !== null && v > 0);
        const lo = Math.log10(Math.min(...vs) / 1.8);
        const hi = Math.log10(Math.max(...vs) * 1.8);
        const x = (v: number) => ((Math.log10(v) - lo) / (hi - lo)) * 100;
        const dots: Array<[Ink, string, number | null]> = [["us", "US", r.us], ["cn", "CN", r.cn], ["in", "IN", r.in]];
        return (
          <div key={r.what} className="in-strip-row">
            <span className="in-strip-what">{r.what}</span>
            <span className="in-strip-track">
              {dots.filter(([, , v]) => v !== null && v > 0).map(([ink, l, v]) => (
                <i key={l} className={`in-dot ${ink}`} style={{ left: `${x(v!)}%`, background: INK[ink] }} title={`${l} ${r.f(v!)}`}>{l}</i>
              ))}
            </span>
            <span className="in-strip-vals">
              {r.cn !== null && <b style={{ color: INK.cn }}>China {r.f(r.cn)}</b>}
              {r.us !== null && <b style={{ color: INK.us }}>US {r.f(r.us)}</b>}
              {r.in !== null && <b style={{ color: INK.in }}>India {r.f(r.in)}</b>}
              {r.note && <em>{r.note}</em>}
            </span>
          </div>
        );
      })}
      <p className="bk-scale">Each row has its own log scale, so a step right is a multiple, not a fixed amount. Letters mark each country; colour is not the only key.</p>
    </div>
  );
}

/** A part as a glass: the blue fill is China's share of world exports. */
function Glass({ r }: { r: AtlasRow }) {
  return (
    <div className="in-glass">
      <span className="in-glass-cup" aria-hidden="true"><span style={{ height: `${r.chinaShare ?? 0}%` }} /></span>
      <b>{r.chinaShare === null ? "—" : `${r.chinaShare.toFixed(0)}%`}</b>
      <span className="in-glass-name">{r.name}</span>
      <span className="in-glass-in">
        {r.indiaFromChina === null ? "India: no import data" : `${r.indiaFromChina.toFixed(0)}% of India's imports from China`}
      </span>
    </div>
  );
}

export default function BreakneckIndiaPage() {
  const bk = loadBreakneck();
  const F = bk.fig;
  const data = loadIndiaBreakneck();
  const byId = new Map<string, InMetric | InContext>([...data.metrics, ...data.electronics].map((m) => [m.id, m]));
  const M = (id: string): InMetric => {
    const m = byId.get(id);
    if (!m || !("comparable" in m)) throw new Error(`india-breakneck: no metric "${id}"`);
    return m;
  };
  const C = (id: string): InContext => {
    const m = byId.get(id);
    if (!m) throw new Error(`india-breakneck: no context "${id}"`);
    return m;
  };
  const V = (m: InMetric | InContext, i: number): InValue => {
    const v = m.india[i];
    if (!v) throw new Error(`india-breakneck: ${m.id} has no value ${i}`);
    return v;
  };
  const sv = (f: BkFigure, key: string): number => {
    const hit = f.series?.find((s) => s.key === key);
    if (!hit) throw new Error(`breakneck: ${f.id} has no series value "${key}"`);
    return hit.value;
  };

  const W = {
    mfg: wdi("wdi-manufacturing-gdp"), pop: wdi("wdi-population"), tfr: wdi("wdi-fertility"), urban: wdi("wdi-urban-population"),
    rd: wdi("wdi-researchers"), ht: wdi("wdi-hightech-exports-usd"), gcf: wdi("wdi-gross-capital-formation"), ind: wdi("wdi-industry-employment"),
  };
  const wv = (w: WdiView, iso: "CHN" | "USA" | "IND") => (iso === "IND" ? w.india?.value ?? null : peer(w, iso)?.value ?? null);
  const wp = (w: WdiView, iso: "CHN" | "USA" | "IND") => (iso === "IND" ? w.india?.period : peer(w, iso)?.period) ?? "";

  const metro = M("metro"), hsr = M("hsr"), hw = M("highways"), nb = M("nuclear-building"), nf = M("nuclear-fleet"), wind = M("wind");
  const cement = M("cement"), infra = M("infra-gdp"), ships = M("ships"), mw = M("mfg-workforce"), apple = M("apple-suppliers"), iph = M("iphone");
  const law = M("lawyers"), veh = M("vehicles"), sex = M("sex-ratio"), covid = M("covid"), mill = M("millionaires");

  // Derived figures, each labelled where shown.
  const pop2023 = wdiAt(law.perCapita!.series, law.perCapita!.period);
  const lawPer = pop2023 ? (V(law, 0).value / pop2023) * law.perCapita!.per : null;
  const boysPer100 = (1000 / V(sex, 0).value) * 100;
  const usJobs = sv(F("us-mfg-jobs"), "2025");

  /* ── the atlas ── */
  const { atlas, rows, sectors } = loadAtlas();
  const live = rows.filter((r) => r.world !== null);
  const R = (hs: string) => rows.find((r) => r.hs === hs)!;
  const chinaFirst = live.filter((r) => r.chinaRank === 1).length;
  const chinaHalf = live.filter((r) => (r.chinaShare ?? 0) >= 50);
  const indiaTop10 = live.filter((r) => r.indiaRank !== null && r.indiaRank <= 10).sort((a, b) => a.indiaRank! - b.indiaRank! || (b.indiaShare ?? 0) - (a.indiaShare ?? 0));
  const withImp = live.filter((r) => r.indiaImports !== null && r.indiaFromChina !== null);
  const impAll = withImp.reduce((s, r) => s + r.indiaImports!, 0);
  const impCn = withImp.reduce((s, r) => s + (r.indiaImports! * r.indiaFromChina!) / 100, 0);
  const biggestFromChina = [...withImp].sort((a, b) => (b.indiaImports! * b.indiaFromChina!) - (a.indiaImports! * a.indiaFromChina!)).slice(0, 12);
  const mostReliant = withImp.filter((r) => r.indiaImports! >= 20e6 && r.indiaFromChina! >= 75).sort((a, b) => b.indiaFromChina! - a.indiaFromChina!);
  const aiRows = live.filter((r) => r.ai).sort((a, b) => (b.world ?? 0) - (a.world ?? 0));
  const sectorsSorted = [...sectors].filter((s) => s.chinaShare !== null).sort((a, b) => b.chinaShare! - a.chinaShare!);
  const phoneParts = ["851713", "854231", "854232", "852492", "853400", "853224", "850760", "900219", "852589", "851829", "851810", "852352"].map(R);
  const droneParts = ["880622", "880621", "850131", "850760", "852589", "852691", "854231", "880730"].map(R);
  const indiaMostExported = [...live].sort((a, b) => (b.indiaExports ?? 0) - (a.indiaExports ?? 0)).slice(0, 8);
  const sm = live.find((r) => r.hs === "851713");

  return (
    <div className="bk-root in-root">
      <header className="in-hero">
        <div className="in-flags" aria-hidden="true">
          <span className="cn">The engineering state</span>
          <span className="in">The third case</span>
          <span className="us">The lawyerly society</span>
        </div>
        <div className="bk-hero-title in-title">
          <p className="bk-kicker">A companion to the Breakneck study guide</p>
          <h1><em>Breakneck</em>, measured against <span className="in-ink">India</span></h1>
          <p className="bk-stand">
            Dan Wang sets China&rsquo;s <b className="cn">engineering state</b> against America&rsquo;s <b className="us">lawyerly society</b>. India is the
            country the book leaves out: as populous as China, a democracy with courts as busy as America&rsquo;s, and building faster than it ever has.
            Here are the book&rsquo;s own numbers with India&rsquo;s set beside them — every India figure cited, every comparison labelled like for like or not —
            then an atlas of {rows.length} electronics lines, from the parts inside a phone to drones and AI hardware.
          </p>
          <nav className="bk-toc" aria-label="Sections">
            <a href="#sits"><b>1</b> Where India sits</a>
            <a href="#build"><b>2</b> Building</a>
            <a href="#make"><b>3</b> Making</a>
            <a href="#people"><b>4</b> People</a>
            <a href="#atlas"><b>5</b> Electronics atlas</a>
            <a href="#insights"><b>6</b> What it says about India</a>
            <a href="/breakneck"><b>←</b> The book</a>
          </nav>
        </div>
      </header>

      <main className="bk-body">
        {/* ── 1 · strip ─────────────────────────────────────────────── */}
        <section id="sits" className="bk-score">
          <h2>Where India sits</h2>
          <p className="bk-lede">
            On the measures where all three countries can be compared like for like, India is rarely between the two. It sits closer to America than to China on
            building and making — and below both on most of them.
          </p>
          <Strip rows={[
            { what: "Reactors under construction", cn: F("nuclear-building").value, us: F("nuclear-building").value2!, in: V(nb, 0).value, f: (v) => String(v) },
            { what: "New wind capacity, 2023 (GW)", cn: F("wind-2023").value2!, us: F("wind-2023").value, in: V(wind, 0).value, f: (v) => String(v) },
            { what: "Manufacturing, % of GDP", cn: wv(W.mfg, "CHN"), us: wv(W.mfg, "USA"), in: wv(W.mfg, "IND"), f: (v) => `${v.toFixed(1)}%`, note: `World Bank; US ${wp(W.mfg, "USA")}` },
            { what: "Investment (capital formation), % of GDP", cn: wv(W.gcf, "CHN"), us: wv(W.gcf, "USA"), in: wv(W.gcf, "IND"), f: (v) => `${v.toFixed(1)}%`, note: "World Bank" },
            { what: "High-technology exports", cn: wv(W.ht, "CHN"), us: wv(W.ht, "USA"), in: wv(W.ht, "IND"), f: usd, note: `World Bank, ${wp(W.ht, "IND")}` },
            { what: "Researchers per million people", cn: wv(W.rd, "CHN"), us: wv(W.rd, "USA"), in: wv(W.rd, "IND"), f: (v) => Math.round(v).toLocaleString("en-US"), note: `World Bank; India ${wp(W.rd, "IND")}` },
            { what: "Urban share of population", cn: wv(W.urban, "CHN"), us: wv(W.urban, "USA"), in: wv(W.urban, "IND"), f: (v) => `${v.toFixed(0)}%`, note: "World Bank" },
            { what: "Children per woman", cn: wv(W.tfr, "CHN"), us: wv(W.tfr, "USA"), in: wv(W.tfr, "IND"), f: (v) => v.toFixed(2), note: `World Bank, ${wp(W.tfr, "IND")}` },
            { what: "Lawyers per 100,000 people", cn: null, us: F("lawyers-per-100k").value, in: lawPer, f: (v) => String(Math.round(v)), note: "India: enrolled advocates, derived" },
          ]} />
          <p className="bk-cite">Book: {[F("nuclear-building"), F("wind-2023"), F("lawyers-per-100k")].map((f) => cite(f)).join(" · ")} · World Bank, World Development Indicators, read {W.mfg.lastVerified} · India sources on each card below</p>
        </section>

        {/* ── 2 · build ─────────────────────────────────────────────── */}
        <section id="build" className="in-part">
          <p className="bk-kicker">Part one · Building</p>
          <h2>Concrete, steel and rail</h2>
          <p className="bk-lede">The book&rsquo;s second chapter: China builds at a scale and price America cannot. India has doubled or quadrupled its stock of nearly everything since 2014 — from a far lower base, and still far below China&rsquo;s pace.</p>
          <div className="bk-cards">
            <ICard m={metro} fs={[F("subway-cities")]} derived={`${(V(metro, 1).value / V(metro, 5).value).toFixed(1)}× the 2014 network length: ${V(metro, 1).value.toLocaleString("en-US")} km ÷ ${V(metro, 5).value} km.`}>
              <Bars unit="" rows={[
                { label: "China, cities with subways (2025)", value: F("subway-cities").value, ink: "cn", text: String(F("subway-cities").value) },
                { label: "India, cities with a metro (2026)", value: V(metro, 0).value, ink: "in", text: String(V(metro, 0).value) },
                { label: "India, 2014", value: V(metro, 4).value, ink: "x", text: String(V(metro, 4).value) },
              ]} />
              <p className="bk-note">India&rsquo;s network: <b>{V(metro, 5).value} km</b> in {V(metro, 4).value} cities in 2014; <b>{V(metro, 2).value.toLocaleString("en-US")} km</b> in {V(metro, 3).value} cities by May 2025; <b>{V(metro, 1).value.toLocaleString("en-US")} km</b> in {V(metro, 0).value} by March 2026. The book notes {F("subway-cities").value2} Chinese cities each have a network longer than New York&rsquo;s.</p>
            </ICard>

            <ICard m={hsr} fs={[F("rail-length"), F("hsr-trips"), F("ca-opening")]}>
              <div className="in-tri">
                <div><span style={{ color: INK.cn }}>China</span><b style={{ color: INK.cn }}>{fmt(F("hsr-trips").value, "")}</b><em>high-speed trips a year</em></div>
                <div><span style={{ color: INK.us }}>California</span><b style={{ color: INK.us }}>{F("ca-opening").value}–{F("ca-opening").value2}</b><em>first segment, maybe</em></div>
                <div><span style={{ color: INK.in }}>India</span><b style={{ color: INK.in }}>{V(hsr, 0).value} km</b><em>in service</em></div>
              </div>
              <div className="in-progress" role="img" aria-label={`Mumbai–Ahmedabad corridor ${V(hsr, 2).value}% built`}>
                <span style={{ width: `${V(hsr, 2).value}%` }} />
                <em>Mumbai–Ahmedabad, {V(hsr, 1).value} km: {V(hsr, 2).value}% built (April 2026). First section targeted {V(hsr, 3).value}, whole line {V(hsr, 4).value}.</em>
              </div>
            </ICard>

            <ICard m={hw} fs={[F("expressway-pace"), F("highways-vs-us")]} derived={`${(((V(hw, 0).value - V(hw, 1).value) / V(hw, 1).value) * 100).toFixed(0)}% longer than in 2014.`}>
              <Bars unit="" rows={[
                { label: "India national highways, 2014", value: V(hw, 1).value, ink: "x", text: `~${V(hw, 1).value.toLocaleString("en-US")} km` },
                { label: "India national highways, Dec 2024", value: V(hw, 0).value, ink: "in", text: `${V(hw, 0).value.toLocaleString("en-US")} km` },
              ]} />
              <p className="bk-note">India built <b>{V(hw, 2).value.toLocaleString("en-US")} km</b> in 2023–24; its record was <b>{V(hw, 3).value} km a day</b> in 2020–21. China, the book says, built an expressway network the length of America&rsquo;s interstates in {F("expressway-pace").value} years — and now has {F("highways-vs-us").value}× the US length.</p>
            </ICard>

            <ICard m={nb} fs={[F("nuclear-building")]}>
              <Bars unit="" rows={[
                { label: "China", value: F("nuclear-building").value, ink: "cn" },
                { label: "India", value: V(nb, 0).value, ink: "in" },
                { label: "United States", value: F("nuclear-building").value2!, ink: "us" },
              ]} />
              <p className="bk-note">India&rsquo;s eight add {V(nb, 1).value.toLocaleString("en-US")} MW. On this measure India is closer to China than to America.</p>
            </ICard>

            <ICard m={nf} fs={[F("nuclear-plants")]}>
              <Bars unit="" rows={[
                { label: "China, plants", value: F("nuclear-plants").value, ink: "cn" },
                { label: "United States, plants", value: F("nuclear-plants").value2!, ink: "us" },
                { label: "India, reactors", value: V(nf, 0).value, ink: "in" },
              ]} />
              <p className="bk-note">India&rsquo;s fleet: {V(nf, 1).value.toLocaleString("en-US")} MW by the operator&rsquo;s count, {V(nf, 2).value.toLocaleString("en-US")} MW in a December 2025 reply to Parliament.</p>
            </ICard>

            <ICard m={wind} fs={[F("wind-2023")]}>
              <Bars unit="" rows={[
                { label: "China", value: F("wind-2023").value2!, ink: "cn", text: `${F("wind-2023").value2} GW` },
                { label: "United States", value: F("wind-2023").value, ink: "us", text: `${F("wind-2023").value} GW` },
                { label: "India", value: V(wind, 0).value, ink: "in", text: `${V(wind, 0).value} GW` },
              ]} />
              <p className="bk-note">India added about {V(wind, 1).value} GW of solar the same year — more than three times its wind.</p>
            </ICard>

            <ICard m={cement} fs={[F("cement")]}>
              <Squares items={[
                { label: "China, two years (2018–19)", value: F("cement").value, ink: "cn", text: `${fmt(F("cement").value, "")} t` },
                { label: "India, one year (2023–24)", value: V(cement, 0).value * 1e6, ink: "in", text: `~${V(cement, 0).value} million t` },
              ]} />
            </ICard>

            <ICard m={infra} fs={[F("infra-gdp")]} wdis={[W.gcf]}>
              <Bars unit="%" rows={[
                { label: "China, infrastructure (2016)", value: F("infra-gdp").value, ink: "cn", text: `${F("infra-gdp").value}%` },
                { label: "US, infrastructure", value: F("infra-gdp").value2!, ink: "us", text: `~${F("infra-gdp").value2}%` },
                { label: "India, central govt capex only", value: V(infra, 0).value, ink: "in", text: `${V(infra, 0).value}%` },
              ]} />
              <p className="in-sub">All investment (gross capital formation), % of GDP — World Bank</p>
              <Bars unit="%" rows={[
                { label: `China (${wp(W.gcf, "CHN")})`, value: wv(W.gcf, "CHN") ?? 0, ink: "cn", text: `${(wv(W.gcf, "CHN") ?? 0).toFixed(1)}%` },
                { label: `India (${wp(W.gcf, "IND")})`, value: wv(W.gcf, "IND") ?? 0, ink: "in", text: `${(wv(W.gcf, "IND") ?? 0).toFixed(1)}%` },
                { label: `US (${wp(W.gcf, "USA")})`, value: wv(W.gcf, "USA") ?? 0, ink: "us", text: `${(wv(W.gcf, "USA") ?? 0).toFixed(1)}%` },
              ]} />
            </ICard>
          </div>
        </section>

        {/* ── 3 · make ──────────────────────────────────────────────── */}
        <section id="make" className="in-part">
          <p className="bk-kicker">Part two · Making</p>
          <h2>Factories and process knowledge</h2>
          <p className="bk-lede">The book&rsquo;s third chapter: technology lives in workforces that learn by doing. India is where China was early in that story — assembling more iPhones each year, with most of the value still made elsewhere.</p>
          <div className="bk-cards">
            <ICard title="Manufacturing as a share of GDP" fs={[F("mfg-share")]} wdis={[W.mfg]}>
              <Bars unit="%" rows={[
                { label: "China, as the book gives it", value: sv(F("mfg-share"), "China"), ink: "cn", text: `${sv(F("mfg-share"), "China")}%` },
                { label: `China, World Bank ${wp(W.mfg, "CHN")}`, value: wv(W.mfg, "CHN") ?? 0, ink: "cn", text: `${(wv(W.mfg, "CHN") ?? 0).toFixed(1)}%` },
                { label: `India, World Bank ${wp(W.mfg, "IND")}`, value: wv(W.mfg, "IND") ?? 0, ink: "in", text: `${(wv(W.mfg, "IND") ?? 0).toFixed(1)}%` },
                { label: `US, World Bank ${wp(W.mfg, "USA")}`, value: wv(W.mfg, "USA") ?? 0, ink: "us", text: `${(wv(W.mfg, "USA") ?? 0).toFixed(1)}%` },
              ]} />
              <p className="bk-note">India&rsquo;s share has not risen in two decades: this site&rsquo;s record shows it lower than in 2001. The book&rsquo;s 28% for China is an older reading than the World Bank&rsquo;s latest.</p>
            </ICard>

            <ICard m={mw} fs={[F("mfg-workforce"), F("us-mfg-jobs")]} wdis={[W.ind]}>
              <Squares items={[
                { label: "China", value: F("mfg-workforce").value, ink: "cn", text: `${fmt(F("mfg-workforce").value, "")}+` },
                { label: "India, registered factories", value: V(mw, 0).value, ink: "in", text: fmtIn({ value: V(mw, 0).value, unit: "" }).trim() },
                { label: "United States (2025)", value: usJobs, ink: "us", text: fmt(usJobs, "") },
              ]} />
              <p className="bk-note">
                All industry, as a share of employment (World Bank): China {(wv(W.ind, "CHN") ?? 0).toFixed(0)}%, India {(wv(W.ind, "IND") ?? 0).toFixed(0)}%, US {(wv(W.ind, "USA") ?? 0).toFixed(0)}% ({wp(W.ind, "IND")}).
              </p>
            </ICard>

            <ICard m={apple} fs={[F("apple-suppliers")]}>
              <Bars unit="" rows={[
                { label: "Suppliers with sites in China (2023)", value: F("apple-suppliers").value, ink: "cn" },
                { label: "With sites in India (2023)", value: V(apple, 0).value, ink: "in" },
                { label: "With sites in India (2018)", value: V(apple, 1).value, ink: "x" },
              ]} />
            </ICard>

            <ICard m={iph} fs={[F("iphone-2007"), F("iphone-x")]}>
              <div className="in-tri two">
                <div><span style={{ color: INK.cn }}>China&rsquo;s share of an iPhone&rsquo;s value</span><b style={{ color: INK.cn }}>{F("iphone-2007").value}% → {F("iphone-x").value}%</b><em>2007 → 2017</em></div>
                <div><span style={{ color: INK.in }}>iPhones made in India, 2024–25</span><b style={{ color: INK.in }}>{fmtIn(V(iph, 0))}</b><em>{fmtIn(V(iph, 1))} exported; about {V(iph, 2).value}% of global assembly, as reported</em></div>
              </div>
            </ICard>

            <ICard m={ships} fs={[F("ships")]}>
              <div className="in-tri">
                <div><span style={{ color: INK.cn }}>China</span><b style={{ color: INK.cn }}>~{F("ships").value.toLocaleString("en-US")}</b><em>ships under construction, 2022</em></div>
                <div><span style={{ color: INK.us }}>United States</span><b style={{ color: INK.us }}>{F("ships").value2}</b><em>ships under construction</em></div>
                <div><span style={{ color: INK.in }}>India</span><b style={{ color: INK.in }}>~{V(ships, 0).value}%</b><em>of the world shipbuilding market</em></div>
              </div>
            </ICard>

            <ICard title="High-technology exports" fs={[F("trade-surplus")]} wdis={[W.ht, W.rd]}>
              <Bars unit="" log rows={[
                { label: `China (${wp(W.ht, "CHN")})`, value: wv(W.ht, "CHN") ?? 0, ink: "cn", text: usd(wv(W.ht, "CHN") ?? 0) },
                { label: `US (${wp(W.ht, "USA")})`, value: wv(W.ht, "USA") ?? 0, ink: "us", text: usd(wv(W.ht, "USA") ?? 0) },
                { label: `India (${wp(W.ht, "IND")})`, value: wv(W.ht, "IND") ?? 0, ink: "in", text: usd(wv(W.ht, "IND") ?? 0) },
              ]} />
              <p className="bk-note">
                Researchers per million people: China {Math.round(wv(W.rd, "CHN") ?? 0).toLocaleString("en-US")}, US {Math.round(wv(W.rd, "USA") ?? 0).toLocaleString("en-US")},
                India {Math.round(wv(W.rd, "IND") ?? 0)} ({wp(W.rd, "IND")}, the latest India has reported). The book: China&rsquo;s record trade surplus passed {fmt(F("trade-surplus").value, F("trade-surplus").unit)} in 2022.
              </p>
            </ICard>
          </div>
        </section>

        {/* ── 4 · people ────────────────────────────────────────────── */}
        <section id="people" className="in-part">
          <p className="bk-kicker">Part three · People</p>
          <h2>Lawyers, births and the count of the dead</h2>
          <p className="bk-lede">Chapters one, four and five. India shares more with the book&rsquo;s China here than its leaders might like: a skewed sex ratio, a pandemic toll official counts missed, and wealthy citizens leaving.</p>
          <div className="bk-cards">
            <ICard m={law} fs={[F("lawyers-per-100k")]} derived={lawPer ? `${Math.round(lawPer)} per 100,000 = ${V(law, 0).value.toLocaleString("en-US")} advocates ÷ India's 2023 population (World Bank).` : undefined}>
              <Bars unit="" rows={[
                { label: "United States", value: F("lawyers-per-100k").value, ink: "us", text: String(F("lawyers-per-100k").value) },
                ...(lawPer ? [{ label: "India (enrolled)", value: lawPer, ink: "in" as const, text: `~${Math.round(lawPer)}` }] : []),
              ]} />
              <p className="bk-note">Per 100,000 people. India has about {(V(law, 0).value / 1e6).toFixed(1)} million advocates on the rolls: more lawyers than America in absolute terms, fewer per head.</p>
            </ICard>

            <ICard m={sex} fs={[F("sex-ratio")]} derived={`${boysPer100.toFixed(1)} = 1,000 ÷ ${V(sex, 0).value} × 100.`}>
              <Bars unit="" rows={[
                { label: "China, 1999", value: F("sex-ratio").value, ink: "cn", text: String(F("sex-ratio").value) },
                { label: "China, now", value: F("sex-ratio").value2!, ink: "cn", text: String(F("sex-ratio").value2) },
                { label: "India, 2019–21", value: boysPer100, ink: "in", text: boysPer100.toFixed(1) },
                { label: "Even", value: 100, ink: "x", text: "100" },
              ]} />
              <p className="bk-note">Boys born per 100 girls. Without selection the ratio sits near 105.</p>
            </ICard>

            <ICard m={covid} fs={[F("covid-deaths")]} derived={`Estimate ÷ official count: China ${(F("covid-deaths").value2! / F("covid-deaths").value).toFixed(0)}×, India ${(V(covid, 1).value / V(covid, 0).value).toFixed(0)}×.`}>
              <Bars unit="" log rows={[
                { label: "China, official", value: F("covid-deaths").value, ink: "cn", text: fmt(F("covid-deaths").value, "") },
                { label: "China, estimate", value: F("covid-deaths").value2!, ink: "cn", text: fmt(F("covid-deaths").value2!, "") },
                { label: "India, official (to 2021)", value: V(covid, 0).value, ink: "in", text: V(covid, 0).value.toLocaleString("en-US") },
                { label: "India, WHO estimate", value: V(covid, 1).value, ink: "in", text: fmt(V(covid, 1).value, "") },
              ]} />
            </ICard>

            <ICard m={mill} fs={[F("millionaires")]}>
              <Bars unit="" rows={[
                { label: "China, 2024", value: F("millionaires").value2!, ink: "cn", text: F("millionaires").value2!.toLocaleString("en-US") },
                { label: "India, 2024", value: V(mill, 0).value, ink: "in", text: V(mill, 0).value.toLocaleString("en-US") },
              ]} />
            </ICard>

            <ICard m={veh} fs={[F("cars")]}>
              <div className="in-tri two">
                <div><span style={{ color: INK.cn }}>Cars in China, 2024</span><b style={{ color: INK.cn }}>{fmt(F("cars").value2!, "")}</b><em>up from {fmt(F("cars").value, "")} in 1990</em></div>
                <div><span style={{ color: INK.in }}>Motor vehicles registered in India</span><b style={{ color: INK.in }}>{fmtIn({ value: V(veh, 0).value, unit: "" }).trim()}</b><em>of every kind, mostly two-wheelers, November 2024</em></div>
              </div>
            </ICard>

            <ICard title="People: how many, where, and how many children" fs={[F("pop-ratio"), F("tfr"), F("urban-growth")]} wdis={[W.pop, W.urban, W.tfr]}>
              <Bars unit="" rows={[
                { label: `India (${wp(W.pop, "IND")})`, value: wv(W.pop, "IND") ?? 0, ink: "in", text: fmtW(wv(W.pop, "IND") ?? 0, W.pop) },
                { label: `China (${wp(W.pop, "CHN")})`, value: wv(W.pop, "CHN") ?? 0, ink: "cn", text: fmtW(wv(W.pop, "CHN") ?? 0, W.pop) },
                { label: `US (${wp(W.pop, "USA")})`, value: wv(W.pop, "USA") ?? 0, ink: "us", text: fmtW(wv(W.pop, "USA") ?? 0, W.pop) },
              ]} />
              <p className="bk-note">
                Living in cities: India {(wv(W.urban, "IND") ?? 0).toFixed(0)}%, China {(wv(W.urban, "CHN") ?? 0).toFixed(0)}%, US {(wv(W.urban, "USA") ?? 0).toFixed(0)}%.
                Children per woman: India {(wv(W.tfr, "IND") ?? 0).toFixed(2)}, China {(wv(W.tfr, "CHN") ?? 0).toFixed(2)}, US {(wv(W.tfr, "USA") ?? 0).toFixed(2)} ({wp(W.tfr, "IND")}) — India too is now below the {F("tfr").value2} that replaces a population.
              </p>
            </ICard>
          </div>
        </section>

        {/* ── 5 · the atlas ─────────────────────────────────────────── */}
        <section id="atlas" className="in-part">
          <p className="bk-kicker">Part four · The electronics atlas</p>
          <h2>Who makes the world&rsquo;s electronics — and how much of India&rsquo;s comes from China</h2>
          <p className="bk-lede">
            {rows.length} product lines, from the materials inside a phone to drones, AI servers and the machines that make chips, each identified by its
            six-digit customs code. For each: China&rsquo;s and India&rsquo;s share of world exports, and how much of what India imports comes from China.
          </p>
          {!atlas ? (
            <p className="in-await">Awaiting data: the UN Comtrade run that fills this atlas has not yet been committed. The catalogue of {rows.length} lines is ready; the numbers appear here when it lands.</p>
          ) : (
            <>
              <div className="in-stats">
                <div><b style={{ color: INK.cn }}>{chinaFirst}</b><span>of {live.length} lines where China is the world&rsquo;s largest exporter</span></div>
                <div><b style={{ color: INK.cn }}>{chinaHalf.length}</b><span>lines where China sells half or more of all world exports</span></div>
                <div><b style={{ color: INK.in }}>{indiaTop10.length}</b><span>lines where India is a top-ten exporter</span></div>
                <div><b style={{ color: INK.us }}>{pct(impAll ? (impCn / impAll) * 100 : null)}</b><span>of India&rsquo;s imports of these lines come from China — {usd(impCn)} of {usd(impAll)}</span></div>
              </div>
              <p className="bk-derived"><b>Derived</b> Counts and shares computed from UN Comtrade, {atlas.year}: world exports are the sum over every reporting country; India&rsquo;s import shares are from India&rsquo;s own customs returns.</p>

              <figure className="bk-card wide in-card">
                <h4>Sector by sector</h4>
                <div className="in-sectors">
                  <div className="in-sec head" aria-hidden="true"><span>Sector</span><span>China&rsquo;s share of world exports</span><span>India&rsquo;s share</span><span>India&rsquo;s imports from China</span></div>
                  {sectorsSorted.map((s) => (
                    <div key={s.id} className="in-sec">
                      <span className="in-sec-l"><b>{s.label}</b><small>{s.lines} lines · world {usd(s.world)}</small></span>
                      <span className="in-sec-b" data-l="China"><i style={{ width: `${s.chinaShare}%`, background: INK.cn }} /><em>{pct(s.chinaShare)}</em></span>
                      <span className="in-sec-b" data-l="India"><i style={{ width: `${Math.max(0.8, s.indiaShare ?? 0)}%`, background: INK.in }} /><em>{pct(s.indiaShare, 1)}</em></span>
                      <span className="in-sec-b" data-l="From China"><i style={{ width: `${s.indiaFromChina ?? 0}%`, background: INK.us }} /><em>{pct(s.indiaFromChina)}</em></span>
                    </div>
                  ))}
                </div>
                <figcaption><span className="bk-cite">UN Comtrade, {atlas.year}, via the public preview API · summed over each sector&rsquo;s lines</span></figcaption>
              </figure>

              <div className="bk-cards">
                <figure className="bk-card in-card">
                  <h4>Inside a smartphone</h4>
                  <div className="in-glasses">{phoneParts.map((r) => <Glass key={r.hs} r={r} />)}</div>
                  <figcaption><span className="bk-note">Each glass fills to China&rsquo;s share of world exports of that part. Below it: how much of India&rsquo;s imports of it come from China.</span><span className="bk-cite">UN Comtrade, {atlas.year}</span></figcaption>
                </figure>
                <figure className="bk-card in-card">
                  <h4>Inside a consumer drone</h4>
                  <div className="in-glasses">{droneParts.map((r) => <Glass key={r.hs} r={r} />)}</div>
                  <figcaption>
                    <span className="bk-note">{C("drones").note}</span>
                    <span className="bk-cite">UN Comtrade, {atlas.year} · India: {C("drones").sources.map((s, i) => <span key={s.url}>{i > 0 ? " · " : ""}<a href={s.url} rel="noopener noreferrer" target="_blank">{s.publisher}</a></span>)}</span>
                  </figcaption>
                </figure>
              </div>

              <figure className="bk-card wide in-card">
                <h4>The AI and data-centre supply chain</h4>
                <table className="in-table">
                  <thead><tr><th>Line</th><th>World exports</th><th>China</th><th>Leader</th><th>India</th><th>India&rsquo;s imports from China</th></tr></thead>
                  <tbody>
                    {aiRows.map((r) => (
                      <tr key={r.hs}>
                        <td><b>{r.name}</b><small>HS {r.hs}</small></td>
                        <td className="num">{usd(r.world!)}</td>
                        <td className="num" style={{ color: INK.cn }}>{pct(r.chinaShare)}{r.chinaRank ? ` #${r.chinaRank}` : ""}</td>
                        <td>{r.top[0] ? `${short(r.top[0].name)} ${r.top[0].share.toFixed(0)}%` : "—"}</td>
                        <td className="num" style={{ color: INK.in }}>{pct(r.indiaShare, 1)}{r.indiaRank ? ` #${r.indiaRank}` : ""}</td>
                        <td className="num">{pct(r.indiaFromChina)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <figcaption><span className="bk-note">Chips are where export shares mislead most: Taiwan, the largest maker of advanced processors, does not report to Comtrade, and its exports appear only as &ldquo;Other Asia, nes&rdquo; where partners record them. Hong Kong and Singapore re-export chips made elsewhere.</span><span className="bk-cite">UN Comtrade, {atlas.year}</span></figcaption>
              </figure>

              <h3 className="in-h3">Explore every line</h3>
              <AtlasExplorer rows={rows} sectors={SECTORS.map((s) => ({ id: s.id, label: s.label }))} />
              <p className="bk-cite">UN Comtrade, {atlas.year}, public preview API; data run {atlas.generatedAt.slice(0, 10)} · {atlas.calls} queries · product names are this site&rsquo;s plain-English labels for the official HS descriptions, which the search also matches.</p>
            </>
          )}
        </section>

        {/* ── 6 · insights ──────────────────────────────────────────── */}
        <section id="insights" className="in-part">
          <p className="bk-kicker">Part five · What it says about India</p>
          <h2>An assembler learning to be a maker</h2>
          {atlas && sm && (
            <ul className="in-insights">
              <li>
                <b>India assembles; China supplies.</b> India is the world&rsquo;s {sm.indiaRank ? `number ${sm.indiaRank}` : "—"} exporter of smartphones
                ({pct(sm.indiaShare, 1)} of world exports, against China&rsquo;s {pct(sm.chinaShare)}), yet across the {live.length} lines of this atlas, {pct(impAll ? (impCn / impAll) * 100 : null)} of
                what India imports comes from China. The phone leaves India; much of what is inside it arrived from China.
              </li>
              <li>
                <b>Where India already competes:</b> India is a top-ten exporter in {indiaTop10.length} of {live.length} lines
                {indiaTop10.length > 0 ? ` — ${indiaTop10.slice(0, 5).map((r) => `${r.name.toLowerCase()} (#${r.indiaRank})`).join(", ")}` : ""}.
              </li>
              <li>
                <b>Where India depends most:</b> in {mostReliant.length} lines India imports at least $20m a year and gets three-quarters or more of it from China
                {mostReliant.length > 0 ? ` — among them ${mostReliant.slice(0, 4).map((r) => r.name.toLowerCase()).join(", ")}` : ""}.
              </li>
              <li>
                <b>China&rsquo;s near-monopolies:</b> China sells half or more of world exports in {chinaHalf.length} lines
                {chinaHalf.length > 0 ? `, ${[...chinaHalf].sort((a, b) => b.chinaShare! - a.chinaShare!).slice(0, 4).map((r) => `${r.name.toLowerCase()} (${pct(r.chinaShare)})`).join(", ")}` : ""}.
                Those are the lines where an Indian factory has no second supplier to turn to.
              </li>
            </ul>
          )}
          <p className="in-sub">These sentences are written from the data: when the atlas is refreshed, they change with it.</p>

          {atlas && (
            <div className="bk-cards">
              <figure className="bk-card in-card">
                <h4>What India buys from China most</h4>
                <Bars unit="" rows={biggestFromChina.map((r) => ({ label: r.name, value: (r.indiaImports! * r.indiaFromChina!) / 100, ink: "us" as const, text: `${usd((r.indiaImports! * r.indiaFromChina!) / 100)} · ${pct(r.indiaFromChina)}` }))} />
                <figcaption><span className="bk-derived"><b>Derived</b> India&rsquo;s imports of the line × the share from China, by India&rsquo;s customs, {atlas.year}.</span></figcaption>
              </figure>
              <figure className="bk-card in-card">
                <h4>What India sells the world most</h4>
                <Bars unit="" rows={indiaMostExported.map((r) => ({ label: r.name, value: r.indiaExports ?? 0, ink: "in" as const, text: `${usd(r.indiaExports ?? 0)}${r.indiaRank ? ` · #${r.indiaRank}` : ""}` }))} />
                <figcaption><span className="bk-cite">UN Comtrade, {atlas.year}: India&rsquo;s exports to the world, and its rank among exporters</span></figcaption>
              </figure>
              <figure className="bk-card in-card">
                <h4>Where India is a top-ten exporter</h4>
                <ol className="in-rank">
                  {indiaTop10.slice(0, 14).map((r) => <li key={r.hs}><b style={{ color: INK.in }}>#{r.indiaRank}</b> {r.name} <em>{pct(r.indiaShare, 1)}</em></li>)}
                </ol>
                <figcaption><span className="bk-cite">UN Comtrade, {atlas.year}</span></figcaption>
              </figure>
              <figure className="bk-card in-card">
                <h4>Most reliant on China</h4>
                <ol className="in-rank">
                  {mostReliant.slice(0, 14).map((r) => <li key={r.hs}><b style={{ color: INK.us }}>{pct(r.indiaFromChina)}</b> {r.name} <em>of {usd(r.indiaImports!)}</em></li>)}
                </ol>
                <figcaption><span className="bk-cite">India&rsquo;s customs via UN Comtrade, {atlas.year}: lines with at least $20m of imports</span></figcaption>
              </figure>
            </div>
          )}

          <div className="bk-cards">
            {data.electronics.map((c) => (
              <ICard key={c.id} m={c} fs={[]}>
                <ul className="bk-facts">
                  {c.india.map((v) => <li key={v.label}><b>{v.hedge ? `${v.hedge} ` : ""}{fmtIn(v)}</b> {v.label.toLowerCase()}{v.year && v.unit !== "year" && !v.label.includes(v.year) ? ` (${v.year})` : ""}</li>)}
                </ul>
              </ICard>
            ))}
          </div>
        </section>

        <section className="bk-method">
          <h2>How to read this page</h2>
          <p>
            <b>The book&rsquo;s figures</b> are the ones on <a href="/breakneck">the study guide</a>, each found in the text of {bk.book.author}&rsquo;s <em>{bk.book.title}</em> and cited to its page.
            <b> India&rsquo;s figures</b> were each read from the publisher linked beneath them, on {data.accessed}; where only a news report carries an official number, the report is named.
            Every card says whether India&rsquo;s number measures <b>the same thing</b> as the book&rsquo;s, <b>nearly</b> the same thing, or <b>something different</b>, shown only for orientation.
            World Bank figures are read from this site&rsquo;s World Development Indicators record and move when the Bank revises.
          </p>
          <p>
            <b>The atlas</b> measures trade, not production. China&rsquo;s share is its share of world exports, summed over every country that reported to UN Comtrade for the year;
            that differs from a production share wherever a country keeps what it makes or re-exports what others made. Taiwan does not report, so lines where it is large — chips
            above all — understate the world total and overstate everyone else&rsquo;s share. Hong Kong, Singapore and the Netherlands re-export. India&rsquo;s imports are valued at the
            border including freight and insurance; China&rsquo;s exports are valued without them, so the two ends of the same trade never match exactly. A line with no data shows a
            dash, never a zero.
          </p>
        </section>
      </main>
    </div>
  );
}
