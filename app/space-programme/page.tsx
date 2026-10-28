import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Eyebrow, Standfirst, WhatThisCannotSay, Sources } from "@/components/stories/Kit";
import { ProgrammeStory, type ProgrammeStep } from "@/components/isro/ProgrammeStory";
import { daysBetween, type ProgrammePublished, type StageKind } from "@/lib/space-programme";

/**
 * India's space programme as a chaptered holographic story: the rockets to
 * scale and taken apart, the Moon, Mars and the Sun, where ISRO works, and
 * the record. Every figure names its source; day counts are derived.
 */

export const metadata = {
  title: "India's space programme, from Thumba to the Moon · Bharat Tracker",
  description: "An interactive 3D explainer of India's space programme: every Indian rocket drawn to scale and taken apart stage by stage in a rocket explorer, the routes of Chandrayaan-3, the Mars Orbiter and Aditya-L1, ISRO's centres on the map, and the record — the wins, the failures, the money and the private rockets.",
};

const load = (): ProgrammePublished => JSON.parse(readFileSync(join(process.cwd(), "data", "space-programme", "published.json"), "utf8")) as ProgrammePublished;
function when(iso: string) {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number | undefined];
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).toLocaleDateString("en-GB", { ...(d ? { day: "numeric" } : {}), month: d ? "short" : "long", year: "numeric", timeZone: "UTC" });
}
const fmt = (v: number, dp = 0) => v.toLocaleString("en-IN", { maximumFractionDigits: dp, minimumFractionDigits: dp });

export default function SpaceProgrammePage() {
  const d = load();
  const src = (id: string) => d.sources.find((s) => s.id === id)!;
  const Cite = ({ ids }: { ids: string[] }) => (
    <span className="tbm-cite">{[...new Set(ids)].map((id, i) => <span key={id}>{i ? " · " : ""}<a href={src(id).url} target="_blank" rel="noopener noreferrer">{src(id).publisher}</a></span>)}</span>
  );
  const R = (id: string) => d.rockets.find((r) => r.id === id)!;
  const ms = (date: string) => d.milestones.find((m) => m.date === date)!;
  const { moon, mars, sun } = d.missions;
  const kindLegend = (["solid", "liquid", "cryo", "fairing"] as StageKind[]).map((k) => ({ colour: d.kinds[k].colour, label: d.kinds[k].label }));
  const pslv = R("pslv"), gslv = R("gslv"), lvm3 = R("lvm3"), sslv = R("sslv"), v1 = R("vikram1");

  const stage = {
    rockets: d.rockets,
    colours: Object.fromEntries(Object.entries(d.kinds).map(([k, v]) => [k, v.colour])) as Record<StageKind, string>,
    centres: d.centres,
    labels: { moonLanded: when(moon.landed), marsArrived: when(mars.arrived), sunDistance: sun.distance },
  };

  const steps: ProgrammeStep[] = [
    {
      scene: "lineup", kicker: "India's space programme", title: "Seven rockets, to scale", legend: kindLegend,
      hud: d.rockets.map((r) => [r.name, `${r.heightApprox ? "~" : ""}${r.heightM} m`] as [string, string]),
      content: (<>
        <h3>Seven rockets, to scale</h3>
        <p>Every rocket India has flown to orbit, from the 22 m SLV-3 of 1980 to the 640-tonne LVM3, and the first private one, drawn at their published heights beside a person. Colour is what each stage burns.</p>
        <p>Open the rocket explorer, top right, to take any of them apart stage by stage.</p>
        <p><Cite ids={d.rockets.flatMap((r) => r.heightSources)} /> · <span className="tbm-cite">stage proportions and most diameters are drawn, not measured</span></p>
      </>),
    },
    {
      scene: "slv3", kicker: "1963–1980 · The beginning", title: "From Thumba to orbit", explore: "slv3",
      content: (<>
        <h3>From a borrowed rocket to its own</h3>
        <ul className="mt-2 space-y-1.5 text-[13px] leading-snug" style={{ color: "#b8cbdb" }}>
          {["1963-11-21", "1969-08-15", "1975-04-19", "1980-07-18"].map((x) => <li key={x}><b className="mono">{when(x)}</b> {ms(x).what}</li>)}
        </ul>
        <p>Seventeen years from a foreign sounding rocket to an Indian satellite on an Indian launcher.</p>
        <p><Cite ids={["1963-11-21", "1969-08-15", "1975-04-19", "1980-07-18"].flatMap((x) => ms(x).sources)} /></p>
      </>),
    },
    {
      scene: "pslv", kicker: "The workhorse", title: "PSLV", legend: kindLegend, explore: "pslv",
      hud: [["Height", `${pslv.heightM} m`], ["Lift-off", `${pslv.liftoffT} t`], ["Carries", "1,750 kg to SSO"]],
      content: (<>
        <h3>Solid, liquid, solid, liquid</h3>
        <p>The PSLV alternates its stages: a 139-tonne solid first stage with six strap-ons, the liquid Vikas second stage, a solid third and a twin-engine liquid fourth. It carries {pslv.payload}.</p>
        <p className="tbm-big">104</p>
        <p>Satellites launched in one flight on {when("2017-02-15")} — 101 of them for foreign customers — a record at the time.</p>
        <p><Cite ids={[...pslv.stages.flatMap((s) => s.sources), ...pslv.payloadSources, "isro-104"]} /></p>
      </>),
    },
    {
      scene: "pslv-fail", kicker: "2025–26 · Two failures", title: "Where PSLV failed", explore: "pslv",
      hud: [["PSLV flights", `${d.record.pslvFlights} by Jan 2026`], ["Failures 2025–26", "2"], ["Stage", "PS3"]],
      content: (<>
        <h3>Twice in eight months, in the third stage</h3>
        <p>On {when("2025-05-18")} PSLV-C61 failed in its third stage. On {when("2026-01-12")} PSLV-C62 — the rocket&apos;s {d.record.pslvFlights}th flight — failed near the end of the third stage, losing foreign customers&apos; payloads with it.</p>
        <p>The red stage is PS3. For a launcher whose reputation was reliability, the next flights matter more than any record.</p>
        <p><Cite ids={[...ms("2025-05-18").sources, ...ms("2026-01-12").sources]} /></p>
      </>),
    },
    {
      scene: "gslv", kicker: "1992–2014 · The cryogenic engine", title: "The engine India was denied", explore: "gslv",
      hud: [["Height", `${gslv.heightM} m`], ["Lift-off", `${gslv.liftoffT} t`], ["To GTO", "2,250 kg"]],
      content: (<>
        <h3>The engine India was not allowed to buy</h3>
        <p>Reaching geostationary orbit needs a cryogenic stage — liquid hydrogen and oxygen. {ms("1992-05").what}</p>
        <p>{ms("2014-01-05").what}</p>
        <p>The flashing stage is that cryogenic upper stage.</p>
        <p><Cite ids={[...ms("1992-05").sources, ...ms("2014-01-05").sources, ...gslv.heightSources]} /></p>
      </>),
    },
    {
      scene: "lvm3", kicker: "The heavy lifter", title: "LVM3", legend: kindLegend, explore: "lvm3",
      hud: [["Height", `${lvm3.heightM} m`], ["Lift-off", `${lvm3.liftoffT} t`], ["To GTO", "4,000 kg"], ["Successes in a row", `${d.record.lvm3Streak} (Dec 2025)`]],
      content: (<>
        <h3>Two boosters of 205 tonnes each</h3>
        <p>LVM3 straps two S200 solid boosters to a liquid L110 core and tops it with the C25 cryogenic stage, burning 28 tonnes of liquid hydrogen and oxygen in the CE-20 engine. It carries {lvm3.payload}.</p>
        <p>It flew Chandrayaan-3, and on {when("2025-12-24")} its {d.record.lvm3Streak}th success in a row. A human-rated version is to fly Gaganyaan; the uncrewed test, G1, is planned for the last quarter of 2026.</p>
        <p><Cite ids={[...lvm3.stages.flatMap((s) => s.sources), ...d.record.lvm3StreakSources, "wiki-gaganyaan1", "air-g1-dec"]} /></p>
      </>),
    },
    {
      scene: "moon", kicker: "The Moon · Chandrayaan", title: "To the Moon",
      hud: [["Launch", `${when(moon.launch)} · ${moon.vehicle}`], ["Landing", when(moon.landed)], ["Days", `${daysBetween(moon.launch, moon.landed)} (derived)`], ["Cost", `₹${moon.costCrore} crore (one report)`]],
      content: (<>
        <h3>The long way round, on purpose</h3>
        <p>Chandrayaan-3 did not fly straight to the Moon. Its rocket left it in an orbit round Earth; burns raised the far end of that orbit again and again until the Moon could catch it, then lowered its orbit round the Moon, and it landed near the south pole on {when(moon.landed)} — {daysBetween(moon.launch, moon.landed)} days after launch (derived).</p>
        <p>Four years earlier, Chandrayaan-2&apos;s Vikram lander was lost on its final approach; its orbiter kept working. Chandrayaan-1, in 2008, found water and hydroxyl on the Moon&apos;s surface.</p>
        <p><Cite ids={[...moon.sources, ...moon.costSources, ...ms("2019-09").sources, ...ms("2008-10-22").sources]} /> · <span className="tbm-cite">the route is drawn schematically, not to scale</span></p>
      </>),
    },
    {
      scene: "mars", kicker: "Mars · Mangalyaan", title: "To Mars",
      hud: [["Launch", `${when(mars.launch)} · ${mars.vehicle}`], ["Mars orbit", when(mars.arrived)], ["Days", `${daysBetween(mars.launch, mars.arrived)} (derived)`], ["Cost", `₹${mars.costCrore} crore (one report)`]],
      content: (<>
        <h3>First time, first in Asia</h3>
        <p>The Mars Orbiter left on {when(mars.launch)} and entered Mars orbit on {when(mars.arrived)}, {daysBetween(mars.launch, mars.arrived)} days later (derived) — making India the first Asian nation to reach Mars orbit, and the first anywhere to do it on a first attempt.</p>
        <p>A transfer like this is timed so Mars arrives where the spacecraft does; the orbits here keep their real proportions. {mars.ended}</p>
        <p><Cite ids={[...mars.sources, ...mars.costSources, ...mars.endedSources]} /></p>
      </>),
    },
    {
      scene: "sun", kicker: "The Sun · Aditya-L1", title: "To the Sun",
      hud: [["Launch", `${when(sun.launch)} · ${sun.vehicle}`], ["Halo orbit", when(sun.arrived)], ["Where", "L1, ~1.5 million km"]],
      content: (<>
        <h3>Parked where the pulls balance</h3>
        <p>Aditya-L1 watches the Sun from a halo orbit round L1, the point {sun.distance} where the Sun&apos;s and Earth&apos;s gravity balance, so it never passes into Earth&apos;s shadow. It launched on {when(sun.launch)} and reached its orbit on {when(sun.arrived)}, after a cruise of {sun.cruiseDays} days.</p>
        <p><Cite ids={sun.sources} /> · <span className="tbm-cite">drawn not to scale</span></p>
      </>),
    },
    {
      scene: "private", kicker: "2022–26 · Private rockets", title: "Private rockets", explore: "vikram1",
      hud: [["Vikram-1", `~${v1.heightM} m`], ["SSLV", `${sslv.heightM} m`], ["Vikram-1 carries", "~350 kg to LEO"]],
      content: (<>
        <h3>The first private rockets</h3>
        <p>{ms("2022-11-18").what} {ms("2026-07-18").what}</p>
        <p>Beside it, ISRO&apos;s own small launcher, the SSLV: three solid stages and a liquid trimming module, {sslv.payload}.</p>
        <p><Cite ids={[...ms("2022-11-18").sources, ...ms("2026-07-18").sources, ...sslv.payloadSources]} /></p>
      </>),
    },
    {
      scene: "map", kicker: "Where ISRO works", title: "ISRO's centres",
      content: (<>
        <h3>From Thiruvananthapuram to Sriharikota</h3>
        <p>Rockets are designed in Thiruvananthapuram, engines tested at Mahendragiri, satellites built and flown from Bengaluru, payloads made in Ahmedabad, data received in Hyderabad — and everything launched from Sriharikota. A second spaceport is being built at Kulasekarapattinam.</p>
        <p>Pillar height is the number of ISRO units the centres page lists in each city (derived).</p>
        <p><Cite ids={d.centres.map((c) => c.source)} /></p>
      </>),
    },
    {
      scene: "map", kicker: "Money and dependence", title: "Money and dependence",
      hud: [["Dept of Space 2026-27", `₹${fmt(d.money.budget.value, 1)} cr`], ["Space economy", `$${d.money.economy.now}bn`], ["Target 2033", `$${d.money.economy.target}bn`], ["Satellites working", String(d.money.fleet.total)]],
      content: (<>
        <h3>A small budget, imported chips</h3>
        <p>The Department of Space has ₹{fmt(d.money.budget.value, 1)} crore for {d.money.budget.year}, {d.money.budget.change}. {d.money.unspent.text}</p>
        <p>India&apos;s space economy is about ${d.money.economy.now} billion, {d.money.economy.nowShare}; the target is ${d.money.economy.target} billion by {d.money.economy.targetYear}. {d.money.economy.note}</p>
        <p>By ISRO&apos;s own figures, {d.money.dependence.satellitesImportedPct} of a satellite&apos;s content is imported, against {d.money.dependence.launchersImportedPct} of a launcher&apos;s.</p>
        <p><Cite ids={[d.money.budget.source, d.money.unspent.source, d.money.economy.source, d.money.dependence.source]} /></p>
      </>),
    },
    {
      scene: "finale", kicker: "What next", title: "What to watch", legend: kindLegend,
      content: (<>
        <h3>What to watch</h3>
        <ol className="mt-2 space-y-1.5 text-[13px] leading-snug" style={{ color: "#b8cbdb" }}>
          <li><b style={{ color: "#fff" }}>Gaganyaan G1.</b> {d.milestones.find((m) => m.tone === "next")?.what}</li>
          <li><b style={{ color: "#fff" }}>The PSLV&apos;s return.</b> Whether the third-stage fault is fixed.</li>
          <li><b style={{ color: "#fff" }}>A second private rocket.</b> One company in orbit is a milestone; two is an industry.</li>
          <li><b style={{ color: "#fff" }}>Kulasekarapattinam.</b> Commissioning is targeted in 2026–27.</li>
        </ol>
        <p><Cite ids={[...d.milestones.filter((m) => m.tone === "next").flatMap((m) => m.sources), "nbm-kulasekarapattinam"]} /></p>
      </>),
    },
  ];

  return (
    <article className="pt-6">
      <Eyebrow tone="cool">India · Space · Programme</Eyebrow>
      <h1 className="story-display mt-3 max-w-[22ch] text-[34px] sm:text-[50px]">India&apos;s space programme, from Thumba to the Moon</h1>
      <Standfirst>
        In 1963 India launched a borrowed American sounding rocket from Thumba, near Thiruvananthapuram. Sixty years later it landed near the Moon&apos;s south pole.
        This page draws every Indian orbital rocket to scale and lets you take each one apart, follows the routes to the Moon, Mars and the Sun, maps where ISRO works,
        and sets the record straight — the failures and the money included. How a single satellite works is on <a className="underline decoration-dotted" href="/space">its own page</a>.
      </Standfirst>

      <div className="mt-8">
        <ProgrammeStory steps={steps} stage={stage} rockets={d.rockets} kinds={d.kinds} sources={d.sources.map((s) => ({ id: s.id, publisher: s.publisher, url: s.url }))} />
      </div>

      <section id="rockets" className="mt-14 scroll-mt-20">
        <h2 className="story-display text-[26px]">Every rocket</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-[0.05em]" style={{ color: "var(--story-ink-3)" }}>
                <th className="py-1.5 pr-2 font-semibold">Rocket</th><th className="px-2 py-1.5 font-semibold">Flew</th><th className="px-2 py-1.5 text-right font-semibold">Height</th><th className="px-2 py-1.5 text-right font-semibold">Lift-off</th><th className="px-2 py-1.5 font-semibold">Carries</th><th className="py-1.5 pl-2 font-semibold">Stages</th>
              </tr>
            </thead>
            <tbody>
              {d.rockets.map((r) => (
                <tr key={r.id} className="border-t align-top" style={{ borderColor: "var(--story-rule)" }}>
                  <td className="py-2 pr-2"><b>{r.name}</b><span className="mt-1 block"><Cite ids={[...r.heightSources, ...r.payloadSources, ...r.liftoffSources]} /></span></td>
                  <td className="px-2 py-2">{r.era}</td>
                  <td className="mono px-2 py-2 text-right tabular-nums">{r.heightApprox ? "~" : ""}{r.heightM} m</td>
                  <td className="mono px-2 py-2 text-right tabular-nums">{r.liftoffT === null ? "—" : `${r.liftoffT} t`}</td>
                  <td className="px-2 py-2">{r.payload}</td>
                  <td className="py-2 pl-2 text-[12px]">{r.stages.filter((s) => s.role !== "fairing").map((s) => `${s.count > 1 ? `${s.count}× ` : ""}${s.name.split(" — ")[0]}`).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="record" className="mt-14 scroll-mt-20">
        <h2 className="story-display text-[26px]">Sixty-three years, wins and losses</h2>
        <ol className="mt-4 border-l-2 pl-5" style={{ borderColor: "var(--story-rule)" }}>
          {d.milestones.map((e) => (
            <li key={e.date + e.what} className="relative pb-4">
              <span aria-hidden className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2" style={{ borderColor: e.tone === "loss" ? "var(--s-hot)" : e.tone === "next" ? "var(--s-cool)" : "var(--story-ink-2)", background: e.tone === "next" ? "transparent" : "var(--story-card)" }} />
              <p className="mono text-[11px] font-bold" style={{ color: e.tone === "loss" ? "var(--s-hot)" : "var(--story-ink-3)" }}>{e.label ?? when(e.date)}{e.tone === "loss" ? " · setback" : e.tone === "next" ? " · ahead" : ""}</p>
              <p className="text-[13.5px] leading-[1.5]">{e.what} <Cite ids={e.sources} /></p>
            </li>
          ))}
        </ol>
      </section>

      <section id="centres" className="mt-12 scroll-mt-20">
        <h2 className="story-display text-[26px]">Where ISRO works</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {d.centres.map((c) => (
            <div key={c.id} className="story-card p-4">
              <p className="text-[15px] font-bold">{c.city}</p>
              <p className="mt-1 text-[12.5px]" style={{ color: "var(--story-ink-2)" }}>{c.units.join(" · ")}</p>
              <p className="mt-1.5 text-[12.5px] leading-[1.5]">{c.role}</p>
              <p className="mt-1"><Cite ids={[c.source]} /></p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>Coordinates on the map locate each city; ISRO lists centres by city, not by coordinate. The centres page lists the Liquid Propulsion Systems Centre under both Thiruvananthapuram and Bengaluru.</p>
      </section>

      <WhatThisCannotSay items={[
        { q: "Are the rockets' stages drawn to scale?", a: "The overall heights are the published ones, so the line-up is to scale. How each rocket's height divides between stages, and most diameters, are drawn to be legible; LVM3's 5 m fairing is ISRO's figure." },
        { q: "Are the mission costs exact?", a: "No. ₹615 crore for Chandrayaan-3 and ₹450 crore for the Mars Orbiter each rest on a single press report, so they are labelled that way. Neither is an audited total." },
        { q: "How reliable is the PSLV now?", a: "Two failures in eight months after decades of near-perfect flights. Counts of its total flights differ slightly between reports; this page uses the 64th flight for PSLV-C62, which two reports give." },
        { q: "Why not every mission?", a: "This page follows the programme's milestones and setbacks. The full flight list is on Wikipedia and ISRO's site; a satellite's inside story is on /space." },
      ]} />

      <Sources>
        Every figure on this page is quoted from the sources below, accessed {when(d.accessed)}: {d.sources.map((s, i) => <span key={s.id}>{i ? "; " : ""}<a className="underline decoration-dotted" href={s.url} target="_blank" rel="noopener noreferrer">{s.publisher}, &ldquo;{s.title}&rdquo;</a>{s.published ? ` (${when(s.published)})` : ""}</span>)}.
        Map outline from the site&apos;s state boundaries; globes from Natural Earth via world-atlas. Day counts are derived from the dates given.
      </Sources>
    </article>
  );
}
