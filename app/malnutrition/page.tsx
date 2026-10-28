import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MalnutritionMap } from "@/components/malnutrition/MalnutritionMap";
import { malnutritionMap } from "@/lib/malnutrition-map";
import { MEASURE, MEASURES, bandOf, rampFor, ranked, shareAtOrAbove, stateKey, type MeasureId } from "@/lib/malnutrition";

/**
 * Child malnutrition by district: NFHS-5's district measures on a dark,
 * zoomable map, coloured by WHO's severity thresholds, with NFHS-6's newer
 * national figures beside them. Shares of districts and ranks are derived and
 * labelled so; an estimate inherited from a parent district is never drawn.
 */

export const metadata = {
  title: "Child malnutrition, district by district · Bharat Tracker",
  description: "An interactive dark map of stunting, wasting, underweight and anaemia among India's children under five in every surveyed district (NFHS-5, 2019–21), coloured by WHO severity thresholds, with state and national comparisons and NFHS-6's newer national figures.",
};

interface Src { id: string; publisher: string; title: string; url: string; published: string | null; tier: number }
interface Published {
  accessed: string;
  sources: Src[];
  nfhs6: {
    released: { national: string; districts: string; sources: string[] };
    fieldwork: string; districts: number;
    national: Array<{ measure: MeasureId; value: number | null; disputed?: string; sources: string[] }>;
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
      <p className="mal-eyebrow">India · Health · Children under five · NFHS-5 districts</p>
      <h1 className="mal-title">Where India&apos;s children are not growing</h1>
      <p className="mal-lede">
        More than a third of India&apos;s children under five — {pc(data.national.stunting.nfhs5)} in NFHS-5 — were too short for their age. That average hides a country of
        extremes: {pc(worst("stunting").v.stunting)} of small children were stunted in {worst("stunting").name}, {pc(best("stunting").v.stunting)} in {best("stunting").name}. This map shows every district the National Family Health Survey measured, on four
        measures of undernutrition, coloured by the thresholds WHO uses to call a level of malnutrition low or very high.
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
          NFHS-6 was surveyed {pub.nfhs6.fieldwork} in {pub.nfhs6.districts} districts. Its national fact sheet came out on {day(pub.nfhs6.released.national)}, and the district fact
          sheets on {day(pub.nfhs6.released.districts)} — as PDF compendiums behind a guest login, which this site cannot yet read. Until it can, the map below is NFHS-5 (2019–21),
          the newest district data the site holds. Severe wasting fell from {pub.nfhs6.severeWasting.nfhs5}% to {pub.nfhs6.severeWasting.nfhs6}%, by one report. NFHS-5 values above are the DHS
          Program&apos;s. <Cite ids={[...pub.nfhs6.released.sources, ...pub.nfhs6.severeWasting.sources, "dhs-api"]} />
        </p>
      </section>

      <section className="mt-8" aria-label="District map">
        <MalnutritionMap data={data} />
      </section>

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
