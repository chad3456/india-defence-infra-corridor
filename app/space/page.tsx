import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Eyebrow, Standfirst, WhatThisCannotSay, Sources } from "@/components/stories/Kit";
import { SpaceStory, type SpaceStep } from "@/components/space/SpaceStory";
import { ORIGINS, PART_ORDER, circularPeriodMin, circularSpeedKms, type SpacePublished } from "@/lib/space-story";

/**
 * How a satellite works, part by part, through one real Indian satellite —
 * NISAR — and where India stands in space. A chaptered holographic story with
 * an X-ray explorer, then the sourced register laid out. Every figure names
 * its source; figures this page computes (an orbit's period, a recorder's
 * download time) are marked derived.
 */

export const metadata = {
  title: "How a satellite works, and India in space · Bharat Tracker",
  description: "An interactive 3D explainer: NISAR, the NASA–ISRO radar satellite launched from Sriharikota, taken apart part by part — power, pointing, radar, data, heat — with an X-ray explorer, NISAR's live position, India's fleet in orbit now, ISRO's ground stations, and the record: launches, failures, money and dependence.",
};

const load = (): SpacePublished => JSON.parse(readFileSync(join(process.cwd(), "data", "space-story", "published.json"), "utf8")) as SpacePublished;
function when(iso: string) {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number | undefined];
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return date.toLocaleDateString("en-GB", { ...(d ? { day: "numeric" } : {}), month: d ? "short" : "long", year: "numeric", timeZone: "UTC" });
}
const fmt = (v: number, dp = 0) => v.toLocaleString("en-IN", { maximumFractionDigits: dp, minimumFractionDigits: dp });

export default function SpacePage() {
  const d = load();
  const src = (id: string) => d.sources.find((s) => s.id === id)!;
  const Cite = ({ ids }: { ids: string[] }) => (
    <span className="tbm-cite">{[...new Set(ids)].map((id, i) => <span key={id}>{i ? " · " : ""}<a href={src(id).url} target="_blank" rel="noopener noreferrer">{src(id).publisher}</a></span>)}</span>
  );
  const part = (id: string) => d.parts.find((p) => p.id === id)!;
  const n = d.nisar;
  const period = circularPeriodMin(n.orbit.altitudeKm), speed = circularSpeedKms(n.orbit.altitudeKm);
  const dumpMin = (n.recorderTbit * 1e12) / (n.kaGbps * 1e9) / 60;
  const byOrigin = Object.fromEntries(ORIGINS.map((o) => [o, d.parts.filter((p) => p.origin === o).length])) as Record<string, number>;
  const originLegend = ORIGINS.map((o) => ({ colour: d.origins[o].colour, label: `${d.origins[o].label} · ${byOrigin[o]}` }));
  const fails = d.timeline.filter((t) => t.tone === "loss");

  const stage = {
    parts: PART_ORDER.map((id) => { const p = part(id); return { id, name: p.name, origin: p.origin, stat: p.stat ? `${p.stat.value} ${p.stat.label.split(" (")[0]}` : null }; }),
    originColours: Object.fromEntries(ORIGINS.map((o) => [o, d.origins[o].colour])) as Record<(typeof ORIGINS)[number], string>,
    places: d.places.map((p) => ({ id: p.id, name: p.name, kind: p.kind, lat: p.lat, lon: p.lon })),
    nisar: { altKm: n.orbit.altitudeKm, inclinationDeg: n.orbit.inclinationDeg },
  };

  const steps: SpaceStep[] = [
    {
      scene: "hero", kicker: "NISAR · NASA–ISRO Synthetic Aperture Radar", title: "A radar that sees through cloud",
      hud: [["Mass at launch", `${fmt(n.massKg)} kg`], ["Orbit", `${n.orbit.altitudeKm} km, ${n.orbit.kind.toLowerCase()}`], ["Inclination", `${n.orbit.inclinationDeg}°`], ["Launched", `${n.launch.vehicle} · ${when(n.launch.date)}`]],
      content: (<>
        <h3>One satellite, taken apart</h3>
        <p>To see how a satellite works, follow one real one. NISAR was launched from Sriharikota on {when(n.launch.date)} at {n.launch.time} on India&apos;s {n.launch.vehicle}. It weighs {fmt(n.massKg)} kg and maps almost every piece of land and ice on Earth every {n.repeatDays} days — by radar, so cloud and night do not stop it.</p>
        <p>ISRO built the body and one radar; NASA&apos;s JPL built the other radar and the data system. That split, part by part, is one of the things this page shows.</p>
        <p><Cite ids={[...n.launch.sources, n.massSource, ...n.coverageSources]} /></p>
      </>),
    },
    {
      scene: "orbit", kicker: "Chapter 1 · The orbit", title: "Pole to pole", live: true,
      content: (<>
        <h3>Pole to pole, with the Sun always at the same angle</h3>
        <p>NISAR circles at {n.orbit.altitudeKm} km, tilted {n.orbit.inclinationDeg}° to the equator — just past the poles. At that tilt Earth&apos;s bulge swings the orbit round once a year, in step with the Sun, so every pass over a place comes at the same local time. That is a <b>sun-synchronous</b> orbit, and it makes this month&apos;s image comparable with last month&apos;s.</p>
        <p className="tbm-big">{fmt(period, 1)} min</p>
        <p>One lap, at {fmt(speed, 2)} km/s — {fmt(1440 / period, 1)} laps a day. <span className="tbm-cite">derived from the published altitude with Kepler&apos;s third law</span></p>
        <p>The marker is NISAR now, propagated in your browser from its public orbital elements; speed the clock up to watch the ground turn beneath it.</p>
        <p><Cite ids={[...n.orbit.sources, d.live.source]} /></p>
      </>),
    },
    {
      scene: "launch", kicker: "Chapter 2 · The launch", title: "From Sriharikota",
      hud: [["Site", "13.72° N, 80.23° E"], ["Vehicle", n.launch.vehicle], ["Lift-off", `${n.launch.time}, ${when(n.launch.date)}`]],
      content: (<>
        <h3>From an island on the Bay of Bengal</h3>
        <p>Every Indian orbital launch leaves from {n.launch.site}, on Sriharikota island. A rocket bound for a polar orbit flies south, over open sea, so spent stages fall into water rather than on towns.</p>
        <p>India&apos;s second spaceport, at Kulasekarapattinam in Tamil Nadu, is being built for small rockets; {src("nbm-kulasekarapattinam").publisher} reports ₹985.96 crore allocated and commissioning targeted in 2026–27.</p>
        <p><Cite ids={[...n.launch.sources, "nbm-kulasekarapattinam"]} /> · <span className="tbm-cite">the flight path drawn is schematic</span></p>
      </>),
    },
    {
      scene: "deploy", kicker: "Chapter 3 · Unfolding", title: "Folded for launch",
      hud: [["Reflector", `${n.reflectorM} m across`], ["Boom", `${n.boomM} m`], ["Deployed", `${when(n.deployed.from)} – ${when(n.deployed.to)}`]],
      content: (<>
        <h3>Folded for launch, opened in orbit</h3>
        <p>A {n.reflectorM} m dish does not fit inside a rocket&apos;s nose. NISAR&apos;s is a gold-plated wire mesh that furls like an umbrella; a {n.boomM} m boom, hinged in sections, swings it out from the spacecraft.</p>
        <p>Unfolding took a week — from {when(n.deployed.from)} to {when(n.deployed.to)}. A deployment that jams is one of the commonest ways a satellite is lost, so it is done slowly, one hinge at a time, from the ground.</p>
        <p><Cite ids={[...n.reflectorSources, n.deployed.source]} /></p>
      </>),
    },
    {
      scene: "power", kicker: "Chapter 4 · Power", title: "Power",
      hud: [["Solar arrays", part("solar").stat!.value], ["Battery", part("battery").stat!.value]],
      content: (<>
        <h3>Sunlight in, battery for the dark</h3>
        <p>{part("solar").does} NISAR has two, about 23 m² together, giving about 5 kW in full sun.</p>
        <p>{part("battery").does} NISAR&apos;s is {part("battery").stat!.value}.</p>
        <p>Even in a sun-synchronous orbit part of each lap can fall in Earth&apos;s shadow — the readout in chapter 1 says which, for NISAR, right now.</p>
        <p><Cite ids={["jpl-spacecraft", "jpl-facts"]} /></p>
      </>),
    },
    {
      scene: "pointing", kicker: "Chapter 5 · Pointing", title: "Pointing",
      content: (<>
        <h3>Knowing which way it faces, and turning without fuel</h3>
        <p><b>Star sensors.</b> {part("startrackers").does}</p>
        <p><b>Reaction wheels.</b> {part("wheels").does}</p>
        <p><b>Thrusters.</b> {part("propulsion").does}</p>
        <p><Cite ids={part("wheels").sources} /> · <span className="tbm-cite">the sight lines to stars are illustrative</span></p>
      </>),
    },
    {
      scene: "radar", kicker: "Chapter 6 · The radar", title: "The radar",
      hud: [["L-band", part("lband").stat!.value], ["S-band", part("sband").stat!.value], ["Swath", `${n.swathKm} km`], ["Repeat", `${n.repeatDays} days`]],
      legend: [{ colour: "#5fd4ff", label: "Pulse out" }, { colour: "#ff6b8b", label: "Echo back" }, { colour: "#3ddc97", label: "Strip being imaged" }],
      content: (<>
        <h3>It makes its own light</h3>
        <p>A camera needs sunlight and clear sky. A radar sends its own pulses and times the echoes, so it sees at night and through cloud and smoke. The feeds on the drum fire at the {n.reflectorM} m reflector, which focuses the beam on a strip of ground {n.swathKm} km wide.</p>
        <p>&ldquo;Synthetic aperture&rdquo; is the trick: combining the echoes the satellite records as it flies turns a 12 m dish into the sharpness of an antenna kilometres long.</p>
        <p>Two radars share the dish. {part("lband").does} {part("sband").does} ISRO&apos;s S-band radar began work on {when(n.firstLight.date)}.</p>
        <p><Cite ids={[...part("lband").sources, "nasa-nisar", n.firstLight.source]} /> · <span className="tbm-cite">pulses are drawn slow and few; the real radar fires far faster</span></p>
      </>),
    },
    {
      scene: "data", kicker: "Chapter 7 · Data", title: "Data",
      hud: [["Recorder", part("recorder").stat!.value], ["Downlink", part("kaband").stat!.value], ["Full recorder", `~${fmt(dumpMin)} min (derived)`]],
      content: (<>
        <h3>Store it, then throw it down</h3>
        <p>{part("recorder").does} NISAR&apos;s holds about {n.recorderTbit} terabits. {part("kaband").does}</p>
        <p className="tbm-big">~{fmt(dumpMin)} min</p>
        <p>To empty a full recorder at {n.kaGbps} Gbps. <span className="tbm-cite">derived: {n.recorderTbit} Tbit ÷ {n.kaGbps} Gbps</span> A pass over a station lasts minutes, so the data comes down over several.</p>
        <p>{part("gps").does} {part("ttc").does}</p>
        <p><Cite ids={["eo-nisar", "isro-istrac"]} /></p>
      </>),
    },
    {
      scene: "heat", kicker: "Chapter 8 · Heat", title: "Heat",
      content: (<>
        <h3>Baking on one side, freezing on the other</h3>
        <p>{part("thermal").does}</p>
        <p>In orbit there is no air to carry heat away: a sunlit face bakes and a shaded one freezes, and electronics work only in a narrow band. The gold you see on most satellites is the blanket; the mirrored panels are the radiators.</p>
        <p><Cite ids={part("thermal").sources} /></p>
      </>),
    },
    {
      scene: "exploded", kicker: "Chapter 9 · Who built what", title: "Who built what", legend: originLegend,
      content: (<>
        <h3>Taken apart, coloured by who built it</h3>
        <p><b style={{ color: d.origins.india.colour }}>ISRO:</b> {n.split.india}.</p>
        <p><b style={{ color: d.origins.us.colour }}>NASA&apos;s JPL:</b> {n.split.us}.</p>
        <p>Of the sixteen parts drawn, {byOrigin.india! + byOrigin["india-bus"]!} are ISRO&apos;s, {byOrigin.us} NASA&apos;s and {byOrigin.joint} joint. Open the X-ray explorer, top right, to take any one apart.</p>
        <p><Cite ids={n.split.sources} /></p>
      </>),
    },
    {
      scene: "scale", kicker: "Chapter 10 · Scale", title: "To scale",
      hud: [["Reflector", `Ø ${n.reflectorM} m`], ["Boom", `${n.boomM} m`], ["Person", "1.75 m"]],
      content: (<>
        <h3>A dish nearly seven people wide</h3>
        <p>The reflector and boom are drawn at their published lengths, beside a 1.75 m person. The rest of the model is sized to be legible, not measured.</p>
        <p><Cite ids={n.reflectorSources} /></p>
      </>),
    },
    {
      scene: "ground", kicker: "Chapter 11 · The ground", title: "Ground stations", live: true,
      content: (<>
        <h3>Who is listening</h3>
        <p>A satellite is flown from the ground. ISRO&apos;s Telemetry, Tracking and Command Network — ISTRAC — runs it from Bengaluru, with stations from Mauritius to Biak in Indonesia so a pass is heard across a wide arc.</p>
        <p>The green lines are the stations that can see NISAR now — above five degrees from their horizon, computed from its live position.</p>
        <p><Cite ids={["isro-istrac", d.live.source]} /></p>
      </>),
    },
    {
      scene: "fleet", kicker: "Chapter 12 · India's fleet", title: "India's fleet, now", live: true,
      legend: [{ colour: "#5fd4ff", label: "Low orbit" }, { colour: "#ffb547", label: "Geostationary" }, { colour: "#c9a2ff", label: "Other" }],
      hud: d.fleet.rows.map((r) => [r.kind, String(r.n)] as [string, string]),
      content: (<>
        <h3>{d.fleet.total} working satellites</h3>
        <p>{d.fleet.rows.map((r, i) => `${i ? (i === d.fleet.rows.length - 1 ? " and " : ", ") : ""}${r.n} ${r.kind.toLowerCase()}`).join("")}, per a reply to Parliament. {d.fleet.note.split(". ")[1]}</p>
        <p>Every dot here is an Indian satellite in the public catalogue at its live position, working or not: the cloud close in is low orbit; the ring far out is the geostationary belt, where communication satellites hang over one longitude. Retired ones drift off it, tilted.</p>
        <p>{d.fleet.plan}</p>
        <p><Cite ids={[d.fleet.source, d.fleet.catalogueSource, d.fleet.planSource, d.live.source]} /></p>
      </>),
    },
    {
      scene: "india", kicker: "Chapter 13 · The record", title: "Wins and losses",
      content: (<>
        <h3>A landing, a docking — and two failures</h3>
        <ul className="mt-2 space-y-1.5 text-[13px] leading-snug" style={{ color: "var(--story-ink-2)" }}>
          {d.timeline.filter((t) => t.tone !== "next").map((t) => (
            <li key={t.date + t.what}><b className="mono" style={{ color: t.tone === "loss" ? "var(--s-hot)" : "var(--story-ink)" }}>{t.label ?? when(t.date)}</b> {t.what}</li>
          ))}
        </ul>
        <p><Cite ids={d.timeline.flatMap((t) => t.sources)} /></p>
      </>),
    },
    {
      scene: "india", kicker: "Chapter 14 · Money and dependence", title: "Money and dependence",
      hud: [["Dept of Space 2026-27", `₹${fmt(d.money.budget.value, 1)} cr`], ["Space economy", `$${d.money.economy.now}bn`], ["Target 2033", `$${d.money.economy.target}bn`]],
      content: (<>
        <h3>Small money, big targets, imported chips</h3>
        <p>The Department of Space has ₹{fmt(d.money.budget.value, 1)} crore for {d.money.budget.year}, {d.money.budget.change}. {d.money.unspent.text}</p>
        <p>India&apos;s space economy is about ${d.money.economy.now} billion — {d.money.economy.nowShare}. The government&apos;s aim is ${d.money.economy.target} billion by {d.money.economy.targetYear}, {d.money.economy.targetShare}. {d.money.economy.note}</p>
        <p>By ISRO&apos;s own figures, {d.dependence.satellitesImportedPct} of a satellite&apos;s content is imported — {d.dependence.what.split("— ")[1]} — against {d.dependence.launchersImportedPct} of a launcher&apos;s. {d.dependence.progress}</p>
        <p><Cite ids={[d.money.budget.source, d.money.unspent.source, d.money.economy.source, d.dependence.source, d.dependence.progressSource]} /></p>
      </>),
    },
    {
      scene: "india", kicker: "Chapter 15 · Next", title: "What comes next",
      content: (<>
        <h3>What to watch</h3>
        <ol className="mt-2 space-y-1.5 text-[13px] leading-snug" style={{ color: "var(--story-ink-2)" }}>
          <li><b style={{ color: "var(--story-ink)" }}>Gaganyaan G1.</b> {d.timeline.find((t) => t.tone === "next")?.what}</li>
          <li><b style={{ color: "var(--story-ink)" }}>The PSLV.</b> {fails.length} failures in eight months, after decades as the workhorse; the next flights will say whether the fix holds.</li>
          <li><b style={{ color: "var(--story-ink)" }}>Private rockets.</b> Vikram-1 reached orbit in July 2026; a second flight, and a second company, would make it an industry.</li>
          <li><b style={{ color: "var(--story-ink)" }}>The fleet.</b> {d.fleet.plan}</li>
        </ol>
        <p><Cite ids={[...d.timeline.flatMap((t) => t.sources), d.fleet.planSource]} /></p>
      </>),
    },
  ];

  const maxFleet = Math.max(...d.fleet.rows.map((r) => r.n));
  return (
    <article className="pt-6">
      <Eyebrow tone="cool">India · Space · How it works</Eyebrow>
      <h1 className="story-display mt-3 max-w-[22ch] text-[34px] sm:text-[50px]">How a satellite works — and where India stands in space</h1>
      <Standfirst>
        A satellite is a power station, a compass, a radio, a refrigerator and an instrument, in one box, flying at about {fmt(speed, 1)} km a second (derived from NISAR&apos;s altitude). This page takes one real one apart —
        NISAR, the radar ISRO launched with NASA in 2025 — and then sets India&apos;s space programme against the record: what flies, what failed, what it costs and
        how much is still imported. Scroll through the chapters, or open the X-ray explorer and take it apart yourself. Every figure names its source.
      </Standfirst>

      <div className="mt-8">
        <SpaceStory steps={steps} stage={stage} parts={d.parts} origins={d.origins} sources={d.sources.map((s) => ({ id: s.id, publisher: s.publisher, url: s.url }))} />
      </div>

      <section id="parts" className="mt-14 scroll-mt-20">
        <h2 className="story-display text-[26px]">Every part, and who built it</h2>
        <p className="mt-1 max-w-[74ch] text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-3)" }}>The sixteen parts drawn in the model. &ldquo;ISRO bus subsystem&rdquo; means the part is in the spacecraft ISRO supplied; its maker inside India is not published.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {PART_ORDER.map((id, i) => {
            const p = part(id);
            return (
              <div key={id} className="flex gap-3 rounded-md border p-3" style={{ borderColor: "var(--story-rule)" }}>
                <span aria-hidden className="mt-1 inline-block h-3 w-3 flex-none rounded-full" style={{ background: d.origins[p.origin].colour }} />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold">{String(i + 1).padStart(2, "0")} {p.name} <span className="font-normal" style={{ color: "var(--story-ink-3)" }}>· {d.origins[p.origin].label}</span></p>
                  {p.stat && <p className="mono mt-0.5 text-[12px]"><b>{p.stat.value}</b> {p.stat.label} <Cite ids={[p.stat.source]} /></p>}
                  <p className="mt-0.5 text-[12.5px] leading-[1.5]" style={{ color: "var(--story-ink-2)" }}>{p.does} {p.inNisar}</p>
                  <p className="mt-1"><Cite ids={p.sources} /></p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="fleet" className="mt-14 scroll-mt-20">
        <h2 className="story-display text-[26px]">India&apos;s working satellites</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="story-card p-4">
            <p className="text-[12px] font-semibold" style={{ color: "var(--story-ink-2)" }}>Operational satellites by job, {d.fleet.total} in all</p>
            <ul className="mt-3 space-y-1.5">
              {d.fleet.rows.map((r) => (
                <li key={r.kind} className="grid grid-cols-[8.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-[12px]">
                  <span>{r.kind}</span>
                  <span className="block h-3 rounded-r-[3px]" style={{ width: `${(100 * r.n) / maxFleet}%`, background: "var(--series-1)" }} />
                  <span className="mono text-right tabular-nums">{r.n}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2"><Cite ids={[d.fleet.source]} /></p>
          </div>
          <p className="text-[13px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>{d.fleet.note} {d.fleet.plan} <Cite ids={[d.fleet.catalogueSource, d.fleet.planSource]} /> The live view in chapter 12 draws every Indian satellite in the public catalogue whose name the site recognises; the <a className="underline decoration-dotted" href="/satellites">satellite tracker</a> shows them over India second by second.</p>
        </div>
      </section>

      <section id="record" className="mt-14 scroll-mt-20">
        <h2 className="story-display text-[26px]">The record, 2023–2026</h2>
        <ol className="mt-4 border-l-2 pl-5" style={{ borderColor: "var(--story-rule)" }}>
          {d.timeline.map((e) => (
            <li key={e.date + e.what} className="relative pb-4">
              <span aria-hidden className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2" style={{ borderColor: e.tone === "loss" ? "var(--s-hot)" : e.tone === "next" ? "var(--s-cool)" : "var(--story-ink-2)", background: e.tone === "next" ? "transparent" : "var(--story-card)" }} />
              <p className="mono text-[11px] font-bold" style={{ color: e.tone === "loss" ? "var(--s-hot)" : "var(--story-ink-3)" }}>{e.label ?? when(e.date)}{e.tone === "loss" ? " · failure" : e.tone === "next" ? " · ahead" : ""}</p>
              <p className="text-[13.5px] leading-[1.5]">{e.what} <Cite ids={e.sources} /></p>
            </li>
          ))}
        </ol>
      </section>

      <section id="places" className="mt-12 scroll-mt-20">
        <h2 className="story-display text-[26px]">Where</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-[0.05em]" style={{ color: "var(--story-ink-3)" }}>
                <th className="py-1.5 pr-2 font-semibold">Place</th><th className="px-2 py-1.5 font-semibold">Role</th><th className="px-2 py-1.5 text-right font-semibold">Lat, lon</th><th className="py-1.5 pl-2 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody>
              {d.places.map((p) => (
                <tr key={p.id} className="border-t align-top" style={{ borderColor: "var(--story-rule)" }}>
                  <td className="py-2 pr-2"><b>{p.name}</b>{p.note && <span className="block" style={{ color: "var(--story-ink-2)" }}>{p.note}</span>}</td>
                  <td className="px-2 py-2">{p.kind === "launch" ? "Launch site" : "ISRO tracking station"}</td>
                  <td className="mono px-2 py-2 text-right tabular-nums">{p.lat.toFixed(2)}, {p.lon.toFixed(2)}</td>
                  <td className="py-2 pl-2"><Cite ids={[p.source]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>Coordinates locate each town to about a kilometre for the globe; ISRO lists the stations by place, not by coordinate.</p>
      </section>

      <WhatThisCannotSay items={[
        { q: "Is the model NISAR's real design?", a: "Its layout, not its blueprint. The reflector (12 m) and boom (9 m) are drawn at their published lengths; the bus, drum, arrays and smaller parts are placed and sized to be legible. Internal positions of the battery, wheels and tank are illustrative." },
        { q: "Is the live position exact?", a: "To within a few kilometres. It is computed with SGP4 from CelesTrak's public element sets, which age; the readout says how old. Station contact assumes a five-degree horizon and a spherical Earth." },
        { q: "How Indian is an Indian satellite?", a: <>By ISRO&apos;s own figures, {d.dependence.satellitesImportedPct} of a satellite&apos;s content is imported, mainly electronics. Which of NISAR&apos;s bus components are imported is not published, so this page colours the bus as ISRO&apos;s and does not guess further.</> },
        { q: "Is the $44 billion a forecast?", a: "No. It is a policy target from IN-SPACe's Decadal Vision. Estimates of the current space economy also differ by method; the $8.4 billion is the government's figure." },
      ]} />

      <Sources>
        Every figure on this page is quoted from the sources below, accessed {when(d.accessed)}: {d.sources.map((s, i) => <span key={s.id}>{i ? "; " : ""}<a className="underline decoration-dotted" href={s.url} target="_blank" rel="noopener noreferrer">{s.publisher}, &ldquo;{s.title}&rdquo;</a>{s.published ? ` (${when(s.published)})` : ""}</span>)}.
        Globe outlines from Natural Earth via world-atlas, and the site&apos;s state boundaries. Live positions computed in the browser from CelesTrak element sets. Orbital period, speed and download time are derived and labelled so.
      </Sources>
    </article>
  );
}
