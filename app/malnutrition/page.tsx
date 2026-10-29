import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MalnutritionTabs } from "@/components/malnutrition/MalnutritionTabs";
import { malnutritionMap } from "@/lib/malnutrition-map";
import { loadNfhs6, loadYouth } from "@/lib/nfhs6-load";
import { cellOf, insights } from "@/lib/nfhs6";
import { Nfhs6Insights } from "@/components/malnutrition/Nfhs6Insights";
import { MEASURE, MEASURES, bandOf, rampFor, ranked, shareAtOrAbove, stateKey, type MeasureId } from "@/lib/malnutrition";

/**
 * Child malnutrition by district: NFHS-5's district measures on a dark,
 * zoomable map, coloured by WHO's severity thresholds, with NFHS-6's newer
 * national figures beside them. Shares of districts and ranks are derived and
 * labelled so; an estimate inherited from a parent district is never drawn.
 */

export const metadata = {
  title: "Child malnutrition, district by district · Bharat Tracker",
  description: "An interactive dark map of every NFHS-6 (2023–24) indicator by state, read from IIPS's fact sheets, and of stunting, wasting, underweight and anaemia in every surveyed district (NFHS-5, 2019–21), coloured by WHO severity thresholds, with the change between rounds.",
};

interface Src { id: string; publisher: string; title: string; url: string; published: string | null; tier: number }
interface Published {
  accessed: string;
  sources: Src[];
  nfhs6: {
    released: { national: string; districts: string; sources: string[] };
    fieldwork: string; districts: number;
    national: Array<{ measure: MeasureId; value: number | null; disputed?: string; note?: string; sources: string[] }>;
    severeWasting: { nfhs5: number; nfhs6: number; sources: string[] };
  };
}

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const pc = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toFixed(1)}%`);

export default function MalnutritionPage() {
  const data = malnutritionMap();
  const pub = JSON.parse(readFileSync(join(process.cwd(), "data", "malnutrition", "published.json"), "utf8")) as Published;
  const src = (id: string) => pub.sources.find((s) => s.id === id)!;
  const Cite = ({ ids }: { ids: string[] }) => (
    <span className="mal-cite">{ids.map((id, i) => <span key={id}>{i ? " · " : ""}<a href={src(id).url} target="_blank" rel="noopener noreferrer">{src(id).publisher}</a></span>)}</span>
  );

  if (!data) {
    return (<article><h1 className="mal-title">Child malnutrition, district by district</h1><p className="mal-lede">The district files this page is built from are not in this build.</p></article>);
  }

  const n6data = loadNfhs6(data.districts);
  const india6 = n6data.states?.geos.India;
  const n6ins = n6data.states ? insights(n6data.states) : null;
  const youth = loadYouth(data.districts);
  const youthIns = youth.states ? insights(youth.states) : null;
  const veryHighStunting = shareAtOrAbove(data.districts, "stunting", 30);
  const veryHighWasting = shareAtOrAbove(data.districts, "wasting", 15);
  const severeAnaemia = shareAtOrAbove(data.districts, "anaemia", 40);
  const worst = (m: MeasureId) => ranked(data.districts, m)[0]!;
  const best = (m: MeasureId) => ranked(data.districts, m).at(-1)!;
  const n6 = (m: MeasureId) => pub.nfhs6.national.find((x) => x.measure === m);
  const stateRows = [...new Set(data.districts.map((d) => d.state))]
    .map((s) => ({ s, v: data.states[stateKey(s)] ?? {} }))
    .filter((r) => r.v.stunting !== undefined)
    .sort((a, b) => (b.v.stunting ?? 0) - (a.v.stunting ?? 0));

  return (
    <article className="mt-5">
      <p className="mal-eyebrow">India · Health · NFHS-6 (2023–24) by state · NFHS-5 (2019–21) by district</p>
      <h1 className="mal-title">Where India&apos;s children are not growing</h1>
      <p className="mal-lede">
        More than a third of India&apos;s children under five — {pc(data.national.stunting.nfhs5)} in NFHS-5 — were too short for their age. That average hides a country of
        extremes: {pc(worst("stunting").v.stunting)} of small children were stunted in {worst("stunting").name}, {pc(best("stunting").v.stunting)} in {best("stunting").name}. This map shows every district the National Family Health Survey measured, on four
        measures of undernutrition, coloured by the thresholds WHO uses to call a level of malnutrition low or very high — and every one of NFHS-6&apos;s 101 indicators, from
        stunting to schooling, internet use, blood sugar and spousal violence, by state, with the change since NFHS-5.
      </p>

      <div className="mal-stats">
        <div><b>{veryHighStunting.n}</b><span>of {veryHighStunting.of} districts have “very high” stunting — 30% or more of children (WHO)</span></div>
        <div><b>{veryHighWasting.n}</b><span>of {veryHighWasting.of} have “very high” wasting — 15% or more</span></div>
        <div><b>{severeAnaemia.n}</b><span>of {severeAnaemia.of} have anaemia at a “severe” public-health level — 40% or more</span></div>
        <div><b>{pc(worst("stunting").v.stunting)}</b><span>stunted in {worst("stunting").name}, {worst("stunting").state} — the highest. Lowest: {best("stunting").name}, {pc(best("stunting").v.stunting)}</span></div>
      </div>
      <p className="mal-note">Counts and ranks are derived from the NFHS-5 district values below. <Cite ids={["spatial-nfhs5", "deonis-2019", "who-anaemia-cdc"]} /></p>

      <section className="mal-nfhs6">
        <p className="mal-eyebrow">Newer national figures · NFHS-6, 2023–24</p>
        <div className="mal-n6grid">
          {MEASURES.map((m) => {
            const x = n6(m), prev = data.national[m].nfhs5;
            return (
              <div key={m}>
                <p className="mal-n6-h">{MEASURE[m].name}</p>
                {x?.value !== null && x?.value !== undefined
                  ? <p className="mal-n6-v">{pc(prev)} <span aria-hidden>→</span> <b>{pc(x.value)}</b></p>
                  : <p className="mal-n6-v"><span className="mal-n6-d">{x?.disputed}</span></p>}
                {x && <p><Cite ids={x.sources} /></p>}
              </div>
            );
          })}
        </div>
        <p className="mal-note">
          NFHS-6 was surveyed {pub.nfhs6.fieldwork} in {pub.nfhs6.districts} districts, every state and UT but Manipur. These figures are read directly from IIPS&apos;s India and
          State/UT fact sheet, released {day(pub.nfhs6.released.national)}{india6 ? <> — severe wasting {pc(cellOf(india6, 71, "prev"))} → {pc(cellOf(india6, 71, "total"))}, overweight {pc(cellOf(india6, 73, "prev"))} → {pc(cellOf(india6, 73, "total"))}</> : null}; the press reports
          beside them are cross-checks. {pub.nfhs6.national.find((x) => x.note)?.note} District fact sheets followed on {day(pub.nfhs6.released.districts)}, as compendiums behind
          IIPS&apos;s download form; {n6data.districtRows ? "they are on the map below." : "they are not on the map yet — the map shows NFHS-6 by state and NFHS-5 by district."} <Cite ids={[...pub.nfhs6.released.sources, "dhs-api"]} />
        </p>
      </section>

      <section className="mt-8" aria-label="District map">
        <MalnutritionTabs data={data} nfhs6={n6data.states} stateOf={n6data.stateOf} districtRows={n6data.districtRows} youth={youth.states ? { states: youth.states, stateOf: youth.stateOf } : null} />
      </section>

      {n6data.states && n6ins && <Nfhs6Insights data={n6data.states} ins={n6ins} />}

      {youth.states && youthIns && (
        <Nfhs6Insights data={youth.states} ins={youthIns} copy={{
          eyebrow: "Youth in India 2022 · ages 15–29 · MoSPI",
          title: "India's young people, theme by theme",
          intro: `MoSPI's National Statistical Office compiles NFHS, UDISE+, AISHE, the Periodic Labour Force Survey and the Sample Registration System for 15–29-year-olds. Every figure below is read from ${youth.states.indicators.length} indicators in its state-wise statements, in the copy committed to this repository; rounds differ by indicator and are named beside each. Every change, gap and ranking is derived.`,
          gapNote: "Enrolment ratios are gross: enrolment of any age over the population of the official age. Female unemployment is a share of a small female labour force, so it moves sharply. Early marriage is left out: it is measured for women before 18 and men before 21.",
          label: "Youth in India 2022 insights by theme",
        }} />
      )}

      <section className="mt-12">
        <h2 className="mal-h2">State by state, NFHS-5</h2>
        <p className="mal-note">Coloured by the same WHO bands as the map. Change is NFHS-4 (2015–16) to NFHS-5 (2019–21), in percentage points — derived. <Cite ids={["dhs-api"]} /></p>
        <div className="mal-tablewrap">
          <table className="mal-table">
            <thead><tr><th>State</th>{MEASURES.map((m) => <th key={m}>{MEASURE[m].name}</th>)}</tr></thead>
            <tbody>
              <tr className="mal-india"><td>India</td>{MEASURES.map((m) => <td key={m}>{pc(data.national[m].nfhs5)}{data.national[m].nfhs4 !== null && data.national[m].nfhs5 !== null && <em> {delta(data.national[m].nfhs5! - data.national[m].nfhs4!)}</em>}</td>)}</tr>
              {stateRows.map((r) => (
                <tr key={r.s}>
                  <td>{r.s}</td>
                  {MEASURES.map((m) => {
                    const v = r.v[m];
                    const bands = MEASURE[m].bands.map((b) => b.from);
                    return <td key={m}>{v === undefined ? "—" : <><span className="mal-cell" style={{ background: rampFor(bandOf(v, bands), bands.length) }} aria-hidden />{pc(v)}</>}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="mal-h2">What these numbers cannot tell you</h2>
        <dl className="mal-caveats">
          <div><dt>Is this the situation today?</dt><dd>No. The district values are from NFHS-5, surveyed 2019–21. NFHS-6&apos;s national figures show stunting falling to 29.3%; its district figures exist but are not on this map yet.</dd></div>
          <div><dt>Is one district really worse than its neighbour?</dt><dd>Often not provably. District samples are a few hundred households; a gap of a few points between two districts is usually inside the survey&apos;s margin of error. Read bands, not decimal places.</dd></div>
          <div><dt>Why are some districts hatched?</dt><dd>Districts created after NFHS-5 have only a value inherited from the district they were carved out of. That is an estimate, not a measurement, and this site does not colour estimates. Areas India claims but does not administer were not surveyed.</dd></div>
          <div><dt>How many children is that?</dt><dd>The map shows shares, not counts. Turning them into numbers of children needs a district child population for the same years, which no census since 2011 provides.</dd></div>
        </dl>
      </section>

      <p className="mal-sources">
        Sources, accessed {day(pub.accessed)}: {pub.sources.map((s, i) => <span key={s.id}>{i ? "; " : ""}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.publisher}, &ldquo;{s.title}&rdquo;</a>{s.published ? ` (${day(s.published)})` : ""}</span>)}.
        District values: {data.attribution} District boundaries from Spatial India; state boundaries from the site&apos;s map. Bands: stunting and wasting by WHO–UNICEF thresholds, anaemia by WHO&apos;s public-health significance; WHO sets no current band for child underweight, so it uses plain ten-point bands.
      </p>
    </article>
  );
}

function delta(d: number) {
  return `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d).toFixed(1)}`;
}
