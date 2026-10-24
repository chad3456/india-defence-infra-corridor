import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Eyebrow, Standfirst, WhatThisCannotSay, Sources } from "@/components/stories/Kit";
import { TbmStory, type TbmStep } from "@/components/tbm/TbmStory";
import { TbmHeadlines } from "@/components/tbm/TbmHeadlines";
import { findPlace } from "@/lib/gazetteer";
import { indiaOutline } from "@/lib/tbm-geo";
import { PART_ORDER, type TbmPublished, type TbmStageData, type StagePlace } from "@/lib/tbm";

/**
 * India's tunnel boring machines: the October 2026 claim that India now builds
 * them, the Chinese export controls behind it, and every machine reported at
 * work in India — told as a scroll-driven particle story, then laid out as a
 * sourced register. Every figure is quoted from a named report; where two
 * reports disagree, both are shown.
 */

export const metadata = {
  title: "India's tunnel boring machines: who builds them, and what was claimed · Bharat Tracker",
  description: "A 3D particle story of the tunnel boring machines digging India's metros, bullet train and Himalayan railways: how a TBM works, every machine to scale, where they are digging, where they are built, China's export controls from 18 November 2026, and what the claim that India now makes 8 m and 15 m TBMs does and does not mean.",
};

const load = (): TbmPublished => JSON.parse(readFileSync(join(process.cwd(), "data", "tbm", "published.json"), "utf8")) as TbmPublished;
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Devprayag, where Tunnel No. 8 begins; not in the site gazetteer, so placed here by its coordinates. */
const EXTRA_PLACES: StagePlace[] = [{ id: "devprayag", name: "Devprayag", lon: 78.6, lat: 30.15 }];

const LEGEND = {
  part: [
    { colour: "#ffb547", label: "Cutterhead" }, { colour: "#ff7d5c", label: "Main drive" }, { colour: "#7cb6ff", label: "Shield" },
    { colour: "#9fa8ff", label: "Thrust cylinders" }, { colour: "#c9a2ff", label: "Segment erector" }, { colour: "#7fe3c4", label: "Muck conveyor" }, { colour: "#71809e", label: "Back-up gantries" },
  ],
  origin: [
    { colour: "#3ddc97", label: "Reported made in India" }, { colour: "#ff6b6b", label: "Reported imported" },
    { colour: "repeating-linear-gradient(90deg, #3ddc97 0 4px, #ff6b6b 4px 8px)", label: "Both, for different machines" }, { colour: "#5b6377", label: "Not reported" },
  ],
  sizes: [{ colour: "#7cb6ff", label: "Machine reported in India, true relative size" }, { colour: "#ffffff", label: "A 1.8 m person, for scale" }],
  claims: [{ colour: "#ffb547", label: "Stated as made in India now" }, { colour: "#ff7d5c", label: "Stated as being prepared", dashed: true }, { colour: "#3ddc97", label: "BEML's first planned machine (reported)", dashed: true }],
  map: [{ colour: "#ffb547", label: "One bead per machine named in reporting" }, { colour: "#3ddc97", label: "Where TBMs are built or designed in India" }],
  supply: [{ colour: "#7cb6ff", label: "Core components, Germany to Chennai" }, { colour: "#3ddc97", label: "Chennai-built machines to projects" }, { colour: "#ff6b6b", label: "China-built machines, and the licence wall" }],
};

export default function TbmPage() {
  const d = load();
  const src = (id: string) => d.sources.find((s) => s.id === id)!;
  const Cite = ({ ids }: { ids: string[] }) => (
    <span className="tbm-cite">{ids.map((id, i) => <span key={id}>{i ? " · " : ""}<a href={src(id).url} target="_blank" rel="noopener noreferrer">{src(id).publisher}</a></span>)}</span>
  );
  const m = (id: string) => d.machines.find((x) => x.id === id)!;
  const claim = (id: string) => d.claims.find((x) => x.id === id)!;
  const part = (id: string) => d.parts.find((x) => x.id === id)!;

  const geo = indiaOutline();
  const place = (id: string): StagePlace | null => { const p = findPlace(id); return p ? { id, name: p.name, lon: p.coords[0], lat: p.coords[1] } : EXTRA_PLACES.find((x) => x.id === id) ?? null; };
  const places = [...new Set(d.machines.map((x) => x.place))].map(place).filter((p): p is StagePlace => !!p);
  const chennai = place("chennai"), bengaluru = place("bengaluru");
  if (chennai) places.push({ ...chennai, id: "maker:chennai", name: "Herrenknecht, Chennai" });
  if (bengaluru) places.push({ ...bengaluru, id: "maker:bengaluru", name: "BEML, Bengaluru (design calls)" });
  // One bead per machine named at each place; a place where no report gives a count gets a hollow marker instead.
  const perPlace = new Map<string, { counts: Array<number | null>; floor: boolean }>();
  for (const x of d.machines) {
    const e = perPlace.get(x.place) ?? { counts: [], floor: false };
    e.counts.push(x.count);
    e.floor = e.floor || /\bfloor\b|or more/i.test(`${x.name} ${x.notes ?? ""}`);
    perPlace.set(x.place, e);
  }
  const beadCount = (c: Array<number | null>) => (c.every((v) => v === null) ? null : c.reduce<number>((a, v) => a + (v ?? 0), 0));
  const stage: TbmStageData = {
    outline: geo.outline, borders: geo.borders, places,
    beads: [...perPlace].map(([p, e]) => { const c = beadCount(e.counts); return { place: p, count: c, floor: e.floor, label: c === null ? "fleet size not reported" : `${c}${e.floor ? "+" : ""} named` }; }),
    rings: [
      { d: m("kolkata").diameter!, label: `${m("kolkata").diameter} m · Kolkata Metro`, kind: "built" },
      { d: m("shakti").diameter!, label: `${m("shakti").diameter} m · Shakti, Himalaya`, kind: "built" },
      { d: m("tbtt").diameter!, label: `${m("tbtt").diameter} m · Nayak, Arjuna`, kind: "built" },
      { d: m("mahsr").diameter!, label: `${m("mahsr").diameter} m · bullet train`, kind: "built" },
      { d: m("vdlr").diameter!, label: `${m("vdlr").diameter} m · coastal road`, kind: "built" },
      { d: 6.5, label: "6.5 m · BEML's first, planned", kind: "planned" },
      { d: 8, label: "8 m · 'now manufacturing'", kind: "stated" },
      { d: 15, label: "15 m · 'now manufacturing'", kind: "stated" },
      { d: 16, label: "over 16 m · 'preparing'", kind: "target" },
    ],
    parts: PART_ORDER.map((id) => ({ id, name: part(id).name, where: part(id).where })),
  };

  const mahsr = m("mahsr"), shakti = m("shakti"), vdlr = m("vdlr"), tbtt = m("tbtt"), kol = m("kolkata");
  const steps: TbmStep[] = [
    {
      id: "rock", kicker: `${day("2026-10-22")} · the claim`,
      content: (<>
        <h3>India says it now builds the machines that dig its tunnels</h3>
        <p>&ldquo;{claim("made-8-15").quote}&rdquo; — {claim("made-8-15").who}, who added that India is preparing to build machines wider than 16 metres.</p>
        <p>He spoke three days after China announced that, from {day(d.controls.effective)}, tunnel boring machines and their parts would need its permission to leave the country.</p>
        <p><Cite ids={["dh-vaishnaw", "channeliam", "globaltimes-controls"]} /></p>
      </>),
    },
    {
      id: "machine", kicker: "What a TBM is", legend: LEGEND.part,
      content: (<>
        <h3>A factory that walks underground</h3>
        <p>A tunnel boring machine cuts the ground, carries it away and builds the tunnel&apos;s concrete wall behind itself, in one continuous pass, without opening the street above.</p>
        <p className="tbm-big">{mahsr.diameter} m</p>
        <p>The cutterhead of each machine boring the bullet train&apos;s tunnel under Mumbai and Thane Creek. Each is 96 m long and weighs 3,200 tonnes — 3,000 in another report.</p>
        <p><Cite ids={["equipment-mahsr", "fpj-mahsr"]} /> · <span className="tbm-cite">the machine drawn here is a generic diagram, not to scale</span></p>
      </>),
    },
    {
      id: "exploded", kicker: "Seven parts", legend: LEGEND.part,
      content: (<>
        <h3>Taken apart</h3>
        <ol className="mt-2 space-y-1.5 text-[13px] leading-snug" style={{ color: "var(--story-ink-2)" }}>
          {d.parts.map((p, i) => <li key={p.id}><b style={{ color: "var(--story-ink)" }}>{String(i + 1).padStart(2, "0")} {p.name}.</b> {p.does}</li>)}
        </ol>
      </>),
    },
    {
      id: "boring", kicker: "How it advances", legend: LEGEND.part,
      content: (<>
        <h3>Cut, push, line, repeat</h3>
        <p>The cutterhead turns against the face. The thrust rams push off the last ring of lining, moving the machine forward one ring&apos;s length; then the erector bolts the next ring of segments into place, and the cycle repeats.</p>
        <p className="tbm-big">413 m</p>
        <p>Average a month for Shakti, the 9.11 m machine that bored 10.4 km of the 14.57 km Tunnel No. 8 on the Rishikesh–Karnaprayag line — the first TBM drive on mountain rail in India, through Himalayan phyllite.</p>
        <p><Cite ids={shakti.sources} /></p>
      </>),
    },
    {
      id: "sizes", kicker: "India's machines, to scale", legend: LEGEND.sizes,
      content: (<>
        <h3>From a metro tube to a six-lane road</h3>
        <p>Each circle is a machine reported at work or on order in India, drawn at its reported diameter. The smallest are metro machines; Chennai&apos;s Corridor 4 machines, at 6.67 m, would sit on Kolkata&apos;s ring.</p>
        <p>The largest, two {vdlr.diameter} m Mixshields for Mumbai&apos;s Versova–Dahisar Link Road, are the biggest ever ordered for India.</p>
        <p><Cite ids={["mrg-durga", "lt-shakti", "meil-nayak", "equipment-mahsr", "herrenknecht-vdlr", "tt-chennai"]} /></p>
      </>),
    },
    {
      id: "claims", kicker: "What was claimed, to scale", legend: LEGEND.claims,
      content: (<>
        <h3>8 m, 15 m — and &ldquo;over 16&rdquo;</h3>
        <p>{claim("made-8-15").check}</p>
        <p>{claim("beyond-16").check}</p>
        <p>BEML, the state-owned machinery maker, called for a foreign design consultant in July 2025 for machines of about 6 m to 16.5 m, reportedly starting with a 6.5 m machine, possibly with Delhi Metro. No partner has been reported.</p>
        <p><Cite ids={["dh-vaishnaw", "herrenknecht-vdlr", "mrg-vdlr", "hellorail-ecosystem", "beml-eoi", "tdn-beml"]} /></p>
      </>),
    },
    {
      id: "origin", kicker: "How much of a TBM is Indian?", legend: LEGEND.origin,
      content: (<>
        <h3>Steel here, the heart abroad</h3>
        <p>Herrenknecht&apos;s plant at Chennai fabricates shields and cutterhead steelwork, makes cutting tools and assembles whole machines. The {tbtt.diameter} m Thane–Borivali machines were &ldquo;supplied through its Indian manufacturing facility in Chennai, with core components sourced from its primary production base in Germany&rdquo;.</p>
        <p>For Kolkata&apos;s {kol.diameter} m machines, &ldquo;{kol.quote.split(", while")[0]}&rdquo;. Colours show what reporting says, part by part; grey is a part no report places.</p>
        <p><Cite ids={["equipment-tbtt", "mrg-durga", "nbmcw-kolkata", "nbmcw-herrenknecht"]} /></p>
      </>),
    },
    {
      id: "map", kicker: "Where they are digging", legend: LEGEND.map,
      content: (<>
        <h3>Seven named in Mumbai alone</h3>
        <p>One bead for each machine named in reporting: three on the bullet train, two on the Thane–Borivali twin tunnel and two on order for the coastal road in Mumbai; fifteen or more on Chennai Metro Phase 2; two in Kolkata; two in the Himalaya; four for Indore; Bhopal&apos;s first. Delhi&apos;s Phase 4 fleet size is not reported — Phase 3 used about 30.</p>
        <p>No official register of TBMs in India exists, so this is a floor, not a census.</p>
        <p><Cite ids={["nhsrcl-second-tbm", "meil-arjuna", "herrenknecht-vdlr", "tt-chennai", "cw-kolkata", "to-indore", "ani-bhopal", "tribune-delhi"]} /></p>
      </>),
    },
    {
      id: "supply", kicker: "Where they come from", legend: LEGEND.supply,
      content: (<>
        <h3>The wall goes up on {day(d.controls.effective)}</h3>
        <p>Most of Herrenknecht&apos;s large machines are built in Guangzhou. The bullet train&apos;s were held in China from 2024 and only unloaded at Mumbai on 23 March 2026; Germany&apos;s ambassador said Chinese customs had blocked at least three.</p>
        <p>China&apos;s new rule covers {d.controls.covers.charAt(0).toLowerCase() + d.controls.covers.slice(1)} {d.controls.licence} {d.controls.threshold}</p>
        <p><Cite ids={["swarajya-bullet-tbm", "theprint-herrenknecht", "globaltimes-controls", "easternherald-controls", "bt-controls"]} /> · <span className="tbm-cite">map schematic: Schwanau and Guangzhou placed for legibility</span></p>
      </>),
    },
    {
      id: "finale", kicker: "What to watch",
      content: (<>
        <h3>Four things will tell whether the claim holds</h3>
        <ol className="mt-2 space-y-1.5 text-[13px] leading-snug" style={{ color: "var(--story-ink-2)" }}>
          <li><b style={{ color: "var(--story-ink)" }}>The incentive scheme.</b> {claim("scheme").check}</li>
          <li><b style={{ color: "var(--story-ink)" }}>A design partner for BEML.</b> Both its 2025 calls have closed; none has been named.</li>
          <li><b style={{ color: "var(--story-ink)" }}>Licences after 18 November.</b> Whether China grants them for India, and how fast.</li>
          <li><b style={{ color: "var(--story-ink)" }}>The core components.</b> A main drive and bearing made in India would change the colours above; no report yet says one is.</li>
        </ol>
      </>),
    },
  ];

  const machinesSorted = [...d.machines].sort((a, b) => (b.diameter ?? 0) - (a.diameter ?? 0));
  const ORIGIN_LABEL = { "india-assembled": "Reported built in India, core parts imported", "china-built": "Reported built in China", unstated: "Not reported" } as const;

  return (
    <article className="pt-6">
      <Eyebrow tone="hot">India · Infrastructure · Tunnel boring machines</Eyebrow>
      <h1 className="story-display mt-3 max-w-[20ch] text-[34px] sm:text-[50px]">The machines that dig India&apos;s tunnels</h1>
      <Standfirst>
        On {day("2026-10-22")} the Railway Minister said India, which used to import every tunnel boring machine it used, now builds them — 8 metres and 15 metres wide — and is
        preparing to build ones wider than 16. This page shows what a TBM is, every machine reported at work in India, where they are built, and what the claim does and does
        not mean. It is built from news reporting and company statements, because no official register of India&apos;s TBMs exists; every figure names its source.
      </Standfirst>

      <div className="mt-8">
        <TbmStory steps={steps} data={stage} />
      </div>

      <section id="claims" className="mt-14 scroll-mt-20">
        <h2 className="story-display text-[26px]">The claims, checked</h2>
        <p className="mt-1 max-w-[74ch] text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-3)" }}>What was said, by whom, and what the rest of the reporting shows. &ldquo;Stated&rdquo; is a minister&apos;s word as reported; &ldquo;confirmed&rdquo; has a company or official record behind it; &ldquo;reported&rdquo; rests on unnamed sources.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {d.claims.map((c) => (
            <div key={c.id} className="story-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[14.5px] font-bold leading-snug">{c.claim}</p>
                <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]" style={{ borderColor: "var(--story-rule)", color: c.status === "confirmed" ? "var(--s-cool)" : c.status === "reported" ? "var(--story-ink-3)" : "var(--s-hot)" }}>{c.status}</span>
              </div>
              <p className="mt-1 text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>{c.who} · {day(c.date)}</p>
              <blockquote className="mt-2 border-l-2 pl-3 text-[12.5px] italic leading-[1.5]" style={{ borderColor: "var(--story-rule)", color: "var(--story-ink-2)" }}>&ldquo;{c.quote}&rdquo;</blockquote>
              <p className="mt-2 text-[12.5px] leading-[1.55]">{c.check}</p>
              <p className="mt-2"><Cite ids={c.sources} /></p>
            </div>
          ))}
        </div>
      </section>

      <section id="fleet" className="mt-14 scroll-mt-20">
        <h2 className="story-display text-[26px]">Every machine reported, largest first</h2>
        <p className="mt-1 max-w-[74ch] text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-3)" }}>From company releases, project owners and the trade press. A blank is a figure no report gives. This is a floor, not a census: smaller drives and machines between projects rarely make the news.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-[0.05em]" style={{ color: "var(--story-ink-3)" }}>
                <th className="py-1.5 pr-2 font-semibold">Project</th>
                <th className="px-2 py-1.5 text-right font-semibold">Diameter</th>
                <th className="px-2 py-1.5 text-right font-semibold">Machines</th>
                <th className="px-2 py-1.5 font-semibold">Type · maker</th>
                <th className="px-2 py-1.5 font-semibold">Where built</th>
                <th className="py-1.5 pl-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {machinesSorted.map((x) => (
                <tr key={x.id} className="border-t align-top" style={{ borderColor: "var(--story-rule)" }}>
                  <td className="py-2 pr-2"><b>{x.name}</b><span className="block" style={{ color: "var(--story-ink-2)" }}>{x.project}</span><span className="mt-1 block"><Cite ids={x.sources} /></span></td>
                  <td className="mono px-2 py-2 text-right tabular-nums">{x.diameter === null ? "—" : `${x.diameter} m`}</td>
                  <td className="mono px-2 py-2 text-right tabular-nums">{x.count === null ? "—" : x.count}</td>
                  <td className="px-2 py-2">{x.type}<span className="block" style={{ color: "var(--story-ink-3)" }}>{x.maker}</span></td>
                  <td className="px-2 py-2"><span className="font-semibold" style={{ color: x.origin === "china-built" ? "var(--s-hot)" : x.origin === "india-assembled" ? "var(--s-cool)" : "var(--story-ink-3)" }}>{ORIGIN_LABEL[x.origin]}</span><span className="block text-[11.5px]" style={{ color: "var(--story-ink-3)" }}>{x.builtIn}</span></td>
                  <td className="py-2 pl-2 text-[12px] leading-snug">{x.status}{x.notes && <span className="mt-1 block text-[11px]" style={{ color: "var(--story-ink-3)" }}>{x.notes}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="makers" className="mt-14 scroll-mt-20">
        <h2 className="story-display text-[26px]">Who builds them, and who wants to</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {d.makers.map((x) => (
            <div key={x.id} className="story-card p-4">
              <p className="text-[15px] font-bold">{x.name}</p>
              <p className="mt-1.5 text-[12.5px] leading-[1.55]" style={{ color: "var(--story-ink-2)" }}>{x.what}</p>
              <p className="mt-2"><Cite ids={x.sources} /></p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {d.parts.map((p) => (
            <div key={p.id} className="flex gap-3 rounded-md border p-3" style={{ borderColor: "var(--story-rule)" }}>
              <span aria-hidden className="mt-1 inline-block h-3 w-3 flex-none rounded-full" style={{ background: p.where === "india" ? "#3ddc97" : p.where === "imported" ? "#ff6b6b" : p.where === "mixed" ? "linear-gradient(90deg,#3ddc97 50%,#ff6b6b 50%)" : "#8a90a2" }} />
              <div>
                <p className="text-[13px] font-bold">{p.name} <span className="font-normal" style={{ color: "var(--story-ink-3)" }}>· {p.where === "india" ? "reported made in India" : p.where === "imported" ? "reported imported" : p.where === "mixed" ? "both reported, for different machines" : "not reported"}</span></p>
                <p className="mt-0.5 text-[12px] leading-[1.5]" style={{ color: "var(--story-ink-2)" }}>{p.india}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="timeline" className="mt-14 scroll-mt-20">
        <h2 className="story-display text-[26px]">Two years, from a blockade to a claim</h2>
        <ol className="mt-4 border-l-2 pl-5" style={{ borderColor: "var(--story-rule)" }}>
          {d.timeline.map((e) => (
            <li key={e.date + e.what} className="relative pb-4">
              <span aria-hidden className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2" style={{ borderColor: e.future ? "var(--s-hot)" : "var(--story-ink-2)", background: e.future ? "transparent" : "var(--story-card)" }} />
              <p className="mono text-[11px] font-bold" style={{ color: e.future ? "var(--s-hot)" : "var(--story-ink-3)" }}>{day(e.date)}{e.future ? " · ahead" : ""}</p>
              <p className="text-[13.5px] leading-[1.5]">{e.what} <Cite ids={e.sources} /></p>
            </li>
          ))}
        </ol>
      </section>

      <section id="trade" className="mt-12 scroll-mt-20">
        <h2 className="story-display text-[26px]">The one trade figure, and why it says little</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="story-card p-4">
            <p className="text-[12px] font-semibold" style={{ color: "var(--story-ink-2)" }}>{d.trade.label}</p>
            <ul className="mt-3 space-y-1.5">
              {d.trade.rows.map((r) => {
                const max = Math.max(...d.trade.rows.map((x) => x.value));
                return (
                  <li key={r.year} className="grid grid-cols-[3rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-[12px]">
                    <span>{r.year}</span>
                    <span className="block h-3 rounded-r-[3px]" style={{ width: `${Math.max(1.5, (100 * r.value) / max)}%`, background: "var(--series-1)" }} />
                    <span className="mono text-right tabular-nums">${r.value}m</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2"><Cite ids={d.trade.sources} /></p>
          </div>
          <p className="text-[13px] leading-[1.6]" style={{ color: "var(--story-ink-2)" }}>{d.trade.caveat} <Cite ids={d.trade.context} /></p>
        </div>
      </section>

      <section id="live" className="mt-12 scroll-mt-20">
        <h2 className="story-display text-[26px]">Reporting now</h2>
        <p className="mt-1 max-w-[74ch] text-[12.5px]" style={{ color: "var(--story-ink-3)" }}>The past fortnight&apos;s headlines on tunnel boring machines in India, in English and Hindi, refreshed while the page is open. A headline points to a report; it becomes a figure above only once it has been checked against the company or project owner.</p>
        <div className="mt-3"><TbmHeadlines /></div>
      </section>

      <WhatThisCannotSay items={[
        { q: "How many TBMs are working in India?", a: "No one publishes the number. The machines on this page are the ones named in reporting, which makes their total a floor. Delhi's Phase 4 fleet, for one, is unreported." },
        { q: "Does \"made in India\" mean an Indian machine?", a: "Not yet. Every Indian-built machine named in reporting is Herrenknecht's, assembled and largely fabricated in Chennai with core components from Germany. An Indian-designed TBM — BEML's stated aim — has not been reported." },
        { q: "Will the export controls stop India's projects?", a: "Unknown. The rule requires a licence, not a ban, and names no country. Machines already in India keep working; new orders built in China are what is exposed." },
        { q: "Is the bullet train's tunnel on schedule?", a: "This page tracks machines, not project schedules. Two of its three TBMs had started by July 2026; reporting found no start date for the third." },
      ]} />

      <Sources>
        Every figure on this page is quoted from the sources below, accessed {day(d.accessed)}: {d.sources.map((s, i) => <span key={s.id}>{i ? "; " : ""}<a className="underline decoration-dotted" href={s.url} target="_blank" rel="noopener noreferrer">{s.publisher}, &ldquo;{s.title}&rdquo;</a>{s.published ? ` (${day(s.published)})` : ""}</span>)}.
        Map outline from the site&apos;s state boundaries. The 3D machine is a generic diagram; its rings, beads and part colours are drawn from the figures above.
      </Sources>
    </article>
  );
}
