import Link from "next/link";
import { loadPublicOrder, type SeriesPoint } from "@/lib/public-order";
import { getSeries, getSource } from "@/lib/data";
import { loadMhaRead } from "@/lib/ministry";
import { Insight, YearBars, Rows, Split, NotPublished, type YearPoint } from "./Glance";

/**
 * Home Affairs, at a glance: the questions a reader brings to the ministry —
 * how many riots, what was destroyed, who died, how the security picture has
 * moved, what the ministry spends its month on — answered from figures that
 * have already passed their checks.
 *
 * Three different records are used, and each card says whose it is:
 *   - the National Crime Records Bureau, an office of the Home Ministry, and
 *     the ministry's own statements (via /protests, each figure re-found in
 *     its source's text);
 *   - the South Asia Terrorism Portal, a think-tank, for deaths in
 *     terrorist and Maoist violence (the ministry publishes no annual series
 *     this site has been able to read);
 *   - the ministry's monthly reports, read on this page.
 */

const n = (v: number) => Math.round(v).toLocaleString("en-IN");
const pc = (a: number, b: number) => Math.round(Math.abs(((b - a) / a) * 100));
const dir = (a: number, b: number) => (b < a ? "down" : "up");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
/** A label inside a sentence: lower-cased unless it starts with a proper name. */
const inline = (label: string) => (/^(Jammu|Union|Left)/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1));
const pcs = (parts: Array<{ label: string; v: number }>) => { const t = parts.reduce((a, p) => a + p.v, 0); return parts.map((p) => `${Math.round((p.v / t) * 100)}% ${inline(p.label)}`).join(", "); };

function fill(points: Array<{ x: number; v: number }>, from?: number, to?: number): YearPoint[] {
  if (!points.length) return [];
  const a = from ?? points[0]!.x, b = to ?? points.at(-1)!.x;
  const by = new Map(points.map((p) => [p.x, p.v]));
  return Array.from({ length: b - a + 1 }, (_, i) => ({ x: a + i, v: by.get(a + i) ?? null }));
}

export default function HomeGlance() {
  const po = loadPublicOrder();
  const S = (id: string) => po.file.series.find((s) => s.id === id);
  /** A public-order series' figures that passed their check, oldest first. */
  const pts = (id: string): SeriesPoint[] => (S(id)?.points ?? []).filter((p) => po.ok.has(p)).sort((a, b) => a.x - b.x);
  const srcName = (id: string) => { const s = po.file.sources[id]; return s ? `${s.publisher}, ${s.title}` : id; };

  // ── Riots ────────────────────────────────────────────────────────────
  const riots = pts("riots-total");
  const rL = riots.at(-1), rF = riots[0], rPeak = riots.reduce((a, b) => (b.v > a.v ? b : a), riots[0]!);
  const rLowest = riots.every((p) => p.v >= (rL?.v ?? 0));
  const rPrev = riots.at(-2);

  // Why: every motive head the police recorded for the latest year.
  const yL = rL?.x ?? 0;
  const motives = po.file.series
    .filter((s) => s.id.startsWith("riots-") && !["riots-total", "riots-rate"].includes(s.id))
    .flatMap((s) => { const p = s.points.find((q) => q.x === yL && po.ok.has(q)); return p ? [{ id: s.id, label: s.title.replace(/^Rioting cases:\s*/, ""), v: p.v, src: p.src }] : []; })
    .sort((a, b) => b.v - a.v);
  const other = motives.find((m) => m.id === "riots-other");
  const named = motives.filter((m) => m.id !== "riots-other");
  const communal = motives.find((m) => m.id === "riots-communal");

  // ── Public property ──────────────────────────────────────────────────
  const pdpp = pts("pdpp");
  const pL = pdpp.at(-1), pPeak = pdpp.reduce((a, b) => (b.v > a.v ? b : a), pdpp[0]!);
  const losses = po.file.episodes.filter((e) => e.loss && po.ok.has(e.loss)).map((e) => ({ name: e.name, year: e.start.slice(0, 4), loss: e.loss! }));

  // ── Police who died on duty ──────────────────────────────────────────
  const comm = pts("commemoration");
  const cL = comm.at(-1);
  const ncrbPolice = pts("police-killed").at(-1);

  // ── Communal incidents, the ministry's own count ─────────────────────
  const ci = pts("mha-communal-incidents"), ck = pts("mha-communal-killed");
  const ciL = ci.at(-1), ckL = ck.find((p) => p.x === ciL?.x);
  const unbroken = ci.length > 1 && ci.at(-1)!.x - ci[0]!.x + 1 === ci.length && ck.length === ci.length;
  const ciSum = ci.reduce((a, p) => a + p.v, 0), ckSum = ck.reduce((a, p) => a + p.v, 0);

  // ── Terrorism and Maoist violence (think-tank record) ────────────────
  const satp = (id: string) => {
    const s = getSeries(id);
    if (!s) return { full: [] as Array<{ x: number; v: number }>, partial: null as null | { x: number; v: number }, s };
    // The year the datasheet was last read is not over: shown as "so far", never drawn beside full years.
    const openYear = Number((s.lastVerified ?? "").slice(0, 4));
    const all = s.points.filter((p) => p.value != null).map((p) => ({ x: Number(p.period), v: p.value as number }));
    return { full: all.filter((p) => p.x < openYear), partial: all.find((p) => p.x === openYear) ?? null, s };
  };
  const jk = satp("terror-total-fatalities"), lwe = satp("lwe-total-fatalities");
  const who = (prefix: string, y: number) => {
    const get = (id: string) => satp(id).full.find((p) => p.x === y)?.v;
    return prefix === "terror"
      ? [{ label: "Civilians", v: get("terror-civilians-killed"), colour: "var(--series-2)" }, { label: "Security forces", v: get("terror-security-forces-killed"), colour: "var(--series-1)" }, { label: "Militants", v: get("terror-militants-killed"), colour: "var(--series-3)" }]
      : [{ label: "Civilians", v: get("lwe-civilians-killed"), colour: "var(--series-2)" }, { label: "Security forces", v: get("lwe-security-forces-killed"), colour: "var(--series-1)" }, { label: "Maoist cadre", v: get("lwe-insurgents-killed"), colour: "var(--series-3)" }];
  };
  const satpSource = getSource("satp-jk-fatalities");

  // ── From the monthly reports ─────────────────────────────────────────
  const mr = loadMhaRead();
  const sanction = (mr?.stated ?? []).filter((s) => s.series === "uapa-sanction");
  const sYears = [...new Set(sanction.map((s) => s.month.slice(0, 4)))].sort();
  const sRows = sYears.map((y) => { const xs = sanction.filter((s) => s.month.startsWith(y)); return { label: `${y} · ${xs.length} of 12 months stated`, v: xs.reduce((a, s) => a + s.v, 0) }; });
  const sMax = sanction.reduce((a, b) => (b.v > a.v ? b : a), sanction[0] ?? { v: 0, month: "" } as { v: number; month: string });
  const sTotal = sanction.reduce((a, s) => a + s.v, 0);

  const readable = (mr?.file.reports ?? []).filter((r) => r.readable && r.month);
  const yearsFull = [...new Set(readable.map((r) => r.month!.slice(0, 4)))].filter((y) => readable.filter((r) => r.month!.startsWith(y)).length >= 10).sort();
  const tY = yearsFull.at(-1);
  const tItems = (mr?.items ?? []).filter((i) => i.quote && tY && i.month.startsWith(tY));
  const themes = (mr?.file.themes ?? []).map((t) => ({ label: t.label, v: tItems.length ? (tItems.filter((i) => i.themes.includes(t.id)).length / tItems.length) * 100 : 0, note: t.rule })).sort((a, b) => b.v - a.v);

  const jkWho = jk.full.length ? who("terror", jk.full.at(-1)!.x).filter((p) => p.v != null) as Array<{ label: string; v: number; colour: string }> : [];
  const lweWho = lwe.full.length ? who("lwe", lwe.full.at(-1)!.x).filter((p) => p.v != null) as Array<{ label: string; v: number; colour: string }> : [];

  return (
    <section aria-labelledby="glance" className="mt-8">
      <h2 id="glance" className="story-display text-[24px] sm:text-[28px]">At a glance</h2>
      <p className="mt-2 max-w-[70ch] text-[13.5px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>
        The questions people ask about the Home Ministry, answered in plain numbers. Each card says who counted: the National Crime Records Bureau (an office of the ministry),
        the ministry itself, or — for deaths in terrorist and Maoist violence, which the ministry does not publish as a yearly series this site can read — an independent tracker.
        Sentences are written from the numbers by code, so they change when the numbers do.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {rL && rF && (
          <Insight wide q="How many riots do the police deal with?" answer={n(rL.v)} unit={`rioting cases registered in ${rL.x}`}
            sentence={<>That is {pc(rF.v, rL.v)}% {dir(rF.v, rL.v)} on {rF.x} ({n(rF.v)}) and {pc(rPeak.v, rL.v)}% below the peak of {n(rPeak.v)} in {rPeak.x}
              {rPrev ? <>; {dir(rPrev.v, rL.v)} {pc(rPrev.v, rL.v)}% on {rPrev.x}</> : null}.{rLowest ? <> It is the lowest of the {riots.length} years with a figure here.</> : null} These are cases the police registered, not riots counted on the ground — registration habits differ by state.</>}
            source={<>National Crime Records Bureau, Crime in India · each year&apos;s figure checked against the volume&apos;s text · a dash marks a year whose volume has not been read · <Link className="underline decoration-dotted" href="/protests">full detail</Link></>}>
            <YearBars points={fill(riots)} colour="var(--series-1)" unit="cases" />
          </Insight>
        )}

        {other && rL && named.length > 0 && (
          <Insight q={`Why did riots happen in ${yL}?`} answer={`${Math.round((other.v / rL.v) * 100)}%`} unit="had no motive recorded"
            sentence={<>The police wrote down no motive for {n(other.v)} of the {n(rL.v)} cases. Where they did, the commonest was {inline(named[0]!.label)} ({n(named[0]!.v)}){named[1] ? <>, then {inline(named[1].label)} ({n(named[1].v)})</> : null}.
              {communal ? <> Communal or religious riots were {n(communal.v)} — about 1 in {n(rL.v / communal.v)} of all rioting cases.</> : null}</>}
            source={<>{srcName(other.src)} · motive as the police recorded it</>}>
            <Rows rows={named.slice(0, 8)} colour="var(--series-1)" />
          </Insight>
        )}

        {pL && (
          <Insight q="How much public property is destroyed in riots and protests?" answer="Not published" unit=""
            sentence={<>No government body puts a national rupee figure on it. What is counted is prosecutions: {n(pL.v)} cases were filed in {pL.x} under the law against damaging public property (the
              Prevention of Damage to Public Property Act, 1984){pPeak && pPeak.x !== pL.x ? <>, against a high of {n(pPeak.v)} in {pPeak.x}</> : null}. A case is a prosecution begun, not a measure of damage.</>}
            source={<>National Crime Records Bureau, Crime in India · rupee figures from the officials named</>}>
            <YearBars points={fill(pdpp)} colour="var(--series-4)" unit="cases" height={140} />
            {losses.length > 0 && (
              <div className="mt-3">
                <NotPublished>
                  The only rupee figures on record are for single episodes, stated by an official:{" "}
                  {losses.map((l, i) => (
                    <span key={l.name}>{i ? "; " : ""}{l.name}, {l.year}: <b>₹{l.loss.v.toLocaleString("en-IN")} crore</b> of {l.loss.what}</span>
                  ))}.
                </NotPublished>
              </div>
            )}
          </Insight>
        )}

        {cL && (
          <Insight q="How many police die on duty?" answer={n(cL.v)} unit={`in the year to 31 August ${cL.x}`}
            sentence={<>The figure announced on Police Commemoration Day, 21 October {cL.x}{cL.who ? <>, by {cL.who.replace(/,\s*21 October \d{4}$/, "")}</> : null} — state police and central armed police together.
              {ncrbPolice ? <> NCRB&apos;s own table counts differently (state police, calendar year) and gave {n(ncrbPolice.v)} for {ncrbPolice.x}; the two are not comparable.</> : null}</>}
            source={<>Announcements on Police Commemoration Day, as reported · a dash marks a year whose announcement has not been found</>}>
            <YearBars points={fill(comm)} colour="var(--series-2)" unit="police" height={140} />
          </Insight>
        )}

        {ciL && ckL && (
          <Insight q="How much communal violence is there?" answer={n(ciL.v)} unit={`communal incidents in ${ciL.x}`}
            sentence={<>States reported {n(ciL.v)} communal incidents to the Home Ministry in {ciL.x}, in which {n(ckL.v)} people were killed.
              {unbroken ? <> Over the {ci.length} years from {ci[0]!.x}, the ministry&apos;s count comes to {n(ciSum)} incidents and {n(ckSum)} deaths.</> : null} This count stops at {ciL.x} in what the ministry has released; police records of communal rioting continue in the card on riots above.</>}
            derived={unbroken}
            source={<>Ministry of Home Affairs — Lok Sabha annexure and RTI reply · totals added up here</>}>
            <YearBars points={fill(ci)} colour="var(--series-3)" unit="incidents" height={140} />
          </Insight>
        )}

        {sanction.length > 0 && (
          <Insight q="How many people did the ministry clear for prosecution under the anti-terror law?" answer={n(sTotal)} unit={`people, in the ${sanction.length} months whose report states it`}
            sentence={<>Under the Unlawful Activities (Prevention) Act a prosecution needs the government&apos;s sanction, and the monthly reports from {sYears[0]} to {sYears.at(-1)} often say for how many people it was given. The most in one month was {n(sMax.v)}, in {monthName(sMax.month)}.
              The reports stopped stating it after {monthName(sanction.map((s) => s.month).sort().at(-1)!)} — a change in what is reported, not evidence that sanctions stopped.</>}
            derived
            source={<>The Home Ministry&apos;s monthly reports, each figure quoted from its report · added up here by year</>}>
            <Rows rows={sRows} colour="var(--series-4)" />
          </Insight>
        )}

        {jk.full.length > 1 && (
          <Insight q="Is terrorist violence in Jammu & Kashmir falling?" answer={n(jk.full.at(-1)!.v)} unit={`deaths in ${jk.full.at(-1)!.x}`}
            sentence={<>Deaths in terrorist violence — civilians, security forces and militants together — were {n(jk.full[0]!.v)} in {jk.full[0]!.x} and {n(jk.full.at(-1)!.v)} in {jk.full.at(-1)!.x}, {pc(jk.full[0]!.v, jk.full.at(-1)!.v)}% {dir(jk.full[0]!.v, jk.full.at(-1)!.v)}.
              {jkWho.length > 1 ? <> Of those killed in {jk.full.at(-1)!.x}: {pcs(jkWho)}.</> : null}{jk.partial ? <> {jk.partial.x} so far: {n(jk.partial.v)} (not drawn; the year is not over).</> : null}</>}
            source={<>{satpSource?.publisher ?? "South Asia Terrorism Portal"} — an independent tracker compiled from news reports, not a government count</>}>
            <YearBars points={fill(jk.full)} colour="var(--series-2)" unit="deaths" height={150} />
            {jkWho.length > 1 && <div className="mt-2"><p className="mb-1 text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>Who died, {jk.full.at(-1)!.x}</p><Split parts={jkWho} /></div>}
          </Insight>
        )}

        {lwe.full.length > 1 && (
          <Insight q="And Maoist (left-wing extremist) violence?" answer={n(lwe.full.at(-1)!.v)} unit={`deaths in ${lwe.full.at(-1)!.x}`}
            sentence={<>Deaths in Maoist violence were {n(lwe.full[0]!.v)} in {lwe.full[0]!.x} and {n(lwe.full.at(-1)!.v)} in {lwe.full.at(-1)!.x}, {pc(lwe.full[0]!.v, lwe.full.at(-1)!.v)}% {dir(lwe.full[0]!.v, lwe.full.at(-1)!.v)}; the most in one year was {n(lwe.full.reduce((a, b) => (b.v > a.v ? b : a)).v)} in {lwe.full.reduce((a, b) => (b.v > a.v ? b : a)).x}.
              {lweWho.length > 1 ? <> Of those killed in {lwe.full.at(-1)!.x}: {pcs(lweWho)}.</> : null}{lwe.partial ? <> {lwe.partial.x} so far: {n(lwe.partial.v)} (not drawn).</> : null}</>}
            source={<>South Asia Terrorism Portal — an independent tracker compiled from news reports, not a government count</>}>
            <YearBars points={fill(lwe.full)} colour="var(--series-3)" unit="deaths" height={150} />
            {lweWho.length > 1 && <div className="mt-2"><p className="mb-1 text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>Who died, {lwe.full.at(-1)!.x}</p><Split parts={lweWho} /></div>}
          </Insight>
        )}

        {tY && themes.length > 0 && (
          <Insight wide q={`What did the Home Ministry report working on in ${tY}?`} answer={`${Math.round(themes[0]!.v)}%`} unit={`of items concerned ${inline(themes[0]!.label)}`}
            sentence={<>Of the {n(tItems.length)} items in the ministry&apos;s {tY} monthly reports, {Math.round(themes[0]!.v)}% concerned {inline(themes[0]!.label)}, {Math.round(themes[1]!.v)}% {inline(themes[1]!.label)} and {Math.round(themes[2]!.v)}% {inline(themes[2]!.label)}.
              An item can touch several subjects. This is what the ministry chose to report, not a measure of its budget or staff.</>}
            derived
            source={<>The Home Ministry&apos;s monthly reports · subjects by the keyword rules printed below · hover a subject for its rule</>}>
            <Rows rows={themes.map((t) => ({ ...t, v: Math.round(t.v) }))} colour="var(--series-1)" format={(v) => `${v}%`} />
          </Insight>
        )}
      </div>
    </section>
  );
}
