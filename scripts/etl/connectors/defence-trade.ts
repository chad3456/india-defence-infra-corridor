/**
 * What India's customs data says about defence trade — which is much less than
 * it looks like it says.
 *
 * `npm run defence:trade`. Reads data/trade/hs6-YYYY.json, writes
 * data/defence/trade.json. No network: the HS6 files are already on disk, and
 * this connector is pure arithmetic over them so it can be run and checked
 * offline, which is the only way anything gets verified in this sandbox.
 *
 * ── The mistake this file exists to prevent ──────────────────────────────
 *
 * HS chapter 93 is called "Arms and ammunition". It is the obvious thing to
 * sum, it produces a tidy series, and it is not India's defence trade. Two
 * separate errors are buried in that one move:
 *
 *   It mixes military and civil in lines that cannot be separated. The first
 *   draft of this docblock asserted that chapter 93 is mostly sporting guns;
 *   the data says otherwise and the assertion was removed rather than kept as
 *   a plausible-sounding guess. What the 2024 file actually shows is that
 *   chapter 93 is ammunition: 930690, "ammunition n.e.c.", is $338m of the
 *   $491m exported — and that single line pools artillery shells with air-gun
 *   pellets, because n.e.c. means whatever did not fit the named lines. Next
 *   is 930510, parts of revolvers and pistols, at $76m. The heading the
 *   classification itself calls military, 9301, is $15.6m: three percent.
 *   Sporting shotguns, target rifles, air guns and swords are all in here too.
 *   None of this can be graded military or civil from the code.
 *
 *   It excludes what is. Combat aircraft are chapter 88. Warships are 8906.
 *   Armoured vehicles are 8710. Radar, sonar, avionics and electronic warfare
 *   are chapter 85 and 90, indistinguishable from their civil equivalents at
 *   six digits. Missiles — BrahMos, Akash, the export line the Indian state
 *   actually talks about — have no HS heading of their own at all; a missile
 *   is classified by what it is made of and what it does, and lands in 9306
 *   (ammunition), 8802 (if it flies), 8526 (guidance) or nowhere visible.
 *   Components sold to Boeing, Airbus, Dassault and Lockheed — which is the
 *   bulk of what the export figure counts — are 8807 parts, sitting in the
 *   same line as civil airliner parts.
 *
 * So chapter 93 is a floor, and a bad one, and every group written here
 * carries a `captures` and a `misses` string saying in words what it does and
 * does not contain. The page must print those next to the number.
 *
 * ── Four classification traps found in the actual data ───────────────────
 *
 *  1. 8906 is not warships. The heading reads "other vessels, including
 *     warships", but the six-digit split is 890610 warships and 890690 "other,
 *     ... other than warships". Summing the heading adds dredgers, tugs, rigs
 *     and supply vessels to frigates. In India's data 890690 runs to hundreds
 *     of millions a year and 890610 is close to nothing, so a summed 8906
 *     would be almost entirely civil shipping presented as naval trade. The
 *     two are separate groups here and 890690 is labelled as not-warships.
 *
 *  2. Aircraft parts moved. HS2017 and earlier put them in 8803; HS2022 moved
 *     them to the new heading 8807 and gave unmanned aircraft their own 8806.
 *     In these files 8803 stops after 2018 and 8807 starts in 2022. Treated as
 *     separate groups, aircraft parts would appear to collapse to zero between
 *     2018 and 2022 — a classification change read as an industrial event.
 *     They are one group with both code sets and a stated concordance.
 *
 *  3. 8802 contains spacecraft. 880250/880260 are satellites and launch
 *     vehicles, which belong to a different story than combat aircraft. They
 *     are excluded from the aircraft group and kept as their own, rather than
 *     silently dropped — a reader who sums the groups should be able to get
 *     back to the heading.
 *
 *  4. Codes split across HS vintages within a chapter. 930110 became
 *     930111/930119 and back; 930520 split into 930521/930529; 930590 into
 *     930591/930599; 890600 into 890610/890690. Summing a whole chapter is
 *     only safe if no year contains both a parent line and its children. That
 *     is asserted below rather than assumed, because the version where it is
 *     assumed double-counts and still looks plausible.
 *
 * ── Absence is not zero, and this file will not pretend otherwise ────────
 *
 * The upstream ingest drops rows where both flows are zero, so a code missing
 * from a year is one of three different things: no trade, the code not in
 * force that year, or the reporter not reporting it. They cannot be told apart
 * from these files. Every group-year therefore records which of its codes were
 * present and which were absent, and a group-year with no codes present is
 * written as `reported: false` with null values rather than as a zero. 8710
 * disappears after 2022 and India obviously did not stop trading armoured
 * vehicles; that is a hole in the record, and a chart drawing it to the axis
 * would be inventing a fact.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isEntryPoint } from "../lib/entry";

const ROOT = process.cwd();
const TRADE_DIR = join(ROOT, "data", "trade");
const OUT_DIR = join(ROOT, "data", "defence");
const OUT = join(OUT_DIR, "trade.json");

interface YearRow { code: string; m: number; x: number }
interface Universe { builtAt: string; source: string; names: Record<string, string> }

/**
 * A group is a named set of six-digit codes plus an honest description of its
 * own edges.
 *
 * `captures` and `misses` are not documentation, they are payload: they are
 * written into the output and the page is required to show them. A number on
 * this subject without its boundary stated is worse than no number, because it
 * will be read as "India's defence exports" whatever the axis label says.
 */
interface GroupSpec {
  id: string;
  label: string;
  /** Exact six-digit codes, or six-digit prefixes — both are resolved against the data. */
  match: (code: string) => boolean;
  /** Human-readable statement of the code range, for the page. */
  codeRange: string;
  captures: string;
  misses: string;
  /** Set where this group's codes are a subset of another group's. */
  subsetOf?: string;
  /** Set where the codes changed heading mid-series. */
  concordance?: string;
  military: "military" | "mixed" | "civil-dominant";
}

const SPACECRAFT = new Set(["880250", "880260"]);

const GROUPS: GroupSpec[] = [
  {
    id: "ch93-arms",
    label: "Arms and ammunition (HS chapter 93, in full)",
    match: (c) => c.startsWith("93"),
    codeRange: "All of chapter 93: 9301–9307",
    military: "mixed",
    captures:
      "Everything customs files as arms: military weapons and their parts, revolvers and " +
      "pistols, sporting and hunting shotguns and rifles, air and spring guns, all ammunition " +
      "including shotgun cartridges, and swords, bayonets and scabbards. In India's recent " +
      "years the chapter is mostly one line, 930690 'ammunition n.e.c.', which pools artillery " +
      "shells with air-gun pellets and is gradeable as neither.",
    misses:
      "Nearly all of India's actual defence trade. No aircraft, no ships, no armoured " +
      "vehicles, no radar or avionics, no missiles as such, no aerostructures or components. " +
      "This is a floor and a poor proxy, not a measure of the defence industry.",
  },
  {
    id: "ch93-military-weapons",
    label: "Military weapons only (HS 9301 and 930591)",
    match: (c) => c.startsWith("9301") || c === "930591",
    codeRange: "9301 (artillery, rocket launchers, other military weapons) and 930591 (their parts)",
    subsetOf: "ch93-arms",
    military: "military",
    captures:
      "The only lines in the whole HS that are defined as military by the classification " +
      "itself: artillery pieces, rocket and grenade launchers, flame-throwers, torpedo tubes, " +
      "other military weapons, and parts of them.",
    misses:
      "Ammunition for those weapons, which sits in 9306 alongside shotgun cartridges. And " +
      "everything the weapon is mounted on, carried by or aimed with.",
    concordance:
      "930110 split into 930111/930119 under one HS vintage and reverted; 930100 was the " +
      "single line in HS1996-era filings. No year here carries both a parent and its children.",
  },
  {
    id: "armour-8710",
    label: "Tanks and armoured fighting vehicles (HS 8710)",
    match: (c) => c === "871000",
    codeRange: "871000, a single six-digit line",
    military: "military",
    captures:
      "Tanks and other motorised armoured fighting vehicles, with or without weapons fitted, " +
      "and parts of such vehicles — so hulls and turrets count here too.",
    misses:
      "Soft-skinned and mine-protected vehicles that customs does not call armoured; they go " +
      "to 8703/8704 with civilian cars and lorries. The line also carries no trade at all in " +
      "the two most recent sampled years, which is a hole in the record and not a stoppage.",
  },
  {
    id: "aircraft-8802",
    label: "Aircraft: helicopters and aeroplanes (HS 8802, spacecraft removed)",
    match: (c) => c.startsWith("8802") && !SPACECRAFT.has(c),
    codeRange: "880211, 880212, 880220, 880230, 880240 — heading 8802 less 880250/880260",
    military: "mixed",
    captures:
      "Every powered manned aircraft crossing the border, banded by weight: helicopters above " +
      "and below two tonnes, and aeroplanes in three weight classes.",
    misses:
      "The distinction the reader wants. A Rafale, a 787 and a business jet over fifteen " +
      "tonnes are the same line, 880240. Nothing in these files separates military from " +
      "civil aircraft, and most of the value here is civil.",
  },
  {
    id: "spacecraft-8802",
    label: "Spacecraft and launch vehicles (HS 880250/880260)",
    match: (c) => SPACECRAFT.has(c),
    codeRange: "880250 and 880260",
    military: "mixed",
    captures:
      "Satellites, suborbital and spacecraft launch vehicles. Kept as its own group so that " +
      "the aircraft group plus this one adds back up to heading 8802.",
    misses:
      "Launch services, which are a service and never appear in merchandise trade at all. " +
      "This is hardware crossing a border, not the commercial launch business.",
  },
  {
    id: "aircraft-parts",
    label: "Aircraft and spacecraft parts (HS 8803 to 2018, HS 8807 from 2022)",
    match: (c) => c.startsWith("8803") || c.startsWith("8807"),
    codeRange: "880310/320/330/390 in earlier vintages; 880710/720/730/790 from HS2022",
    military: "mixed",
    concordance:
      "HS2022 retired heading 8803 and moved aircraft parts to the new heading 8807. In these " +
      "files 8803 is present through 2018 and 8807 from 2022, with no overlap. Read as two " +
      "groups the series would appear to collapse to zero and recover — a renumbering " +
      "mistaken for an industrial event. They are one group here.",
    captures:
      "Propellers, rotors, undercarriages and the large residual 'other parts' line, which is " +
      "where most aerostructure and component trade lands.",
    misses:
      "Any split between military and civil work. Fuselage sections for a civil airliner and " +
      "for a transport aircraft are the same code. Engines are not here at all — aero engines " +
      "are chapter 84 (8407/8411), pooled with every other turbine.",
  },
  {
    id: "unmanned-8806",
    label: "Unmanned aircraft (HS 8806, from HS2022 only)",
    match: (c) => c.startsWith("8806"),
    codeRange: "880610 through 880699, banded by take-off weight and control mode",
    military: "mixed",
    concordance:
      "Heading 8806 did not exist before HS2022. Its first year in these files is 2022, so " +
      "there is no earlier series to compare against and none is implied.",
    captures:
      "Drones as hardware, split by whether they are remote-controlled and by take-off weight " +
      "— 250g, 7kg, 25kg, 150kg and above.",
    misses:
      "Armed and unarmed are the same code at every weight. A hobby quadcopter and a MALE " +
      "strike drone differ only by the weight band. Loitering munitions may be filed here or " +
      "in chapter 93 depending on the declarant.",
  },
  {
    id: "warships-890610",
    label: "Warships (HS 890610)",
    match: (c) => c === "890610" || c === "890600",
    codeRange: "890610; plus 890600, the undivided heading, in the one year it was used",
    military: "military",
    concordance:
      "890600 was the undivided heading in the earliest sampled year and split into " +
      "890610 warships and 890690 other vessels thereafter. The undivided line is folded in " +
      "here and flagged, because it cannot be apportioned between the two.",
    captures:
      "Vessels the declarant filed as warships, and nothing else. In India's sampled years " +
      "this line is close to empty: a few hundred thousand dollars in two of eleven years, " +
      "against hundreds of millions on the non-warship vessel line beside it.",
    misses:
      "Essentially everything. Naval shipbuilding for the Indian Navy is domestic and never " +
      "crosses a customs border, so it cannot appear in trade data by construction. Exported " +
      "patrol vessels are frequently filed as 890690 or 8903/8904 rather than as warships. " +
      "This line being near-empty is a fact about the classification, not about the shipyards.",
  },
  {
    id: "other-vessels-890690",
    label: "Other vessels, explicitly NOT warships (HS 890690)",
    match: (c) => c === "890690",
    codeRange: "890690",
    military: "civil-dominant",
    captures:
      "The residual vessel line: 'other, including lifeboats other than rowing boats, other " +
      "than warships'. Rigs, tugs, supply boats, dredgers and any patrol craft the declarant " +
      "did not call a warship.",
    misses:
      "Nothing is missing so much as too much is present. This group is published only " +
      "because summing heading 8906 without it would be wrong in the other direction — it is " +
      "a companion to the warship line, not a defence measure, and must never be charted as " +
      "one.",
  },
];

/** Group ids whose codes are counted inside another group. */
const SUBSETS = new Set(GROUPS.filter((g) => g.subsetOf).map((g) => g.id));

function readJson<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Years with a file on disk, ascending. Nothing else may appear in the output. */
function sampledYears(): number[] {
  const years: number[] = [];
  for (const f of readdirSync(TRADE_DIR)) {
    const m = /^hs6-(\d{4})\.json$/.exec(f);
    if (m?.[1]) years.push(Number(m[1]));
  }
  return years.sort((a, b) => a - b);
}

/**
 * Parent/child pairs that must never co-occur in one year.
 *
 * Each is a line that was split or merged between HS vintages. If both the
 * parent and a child are reported in the same year, summing the chapter
 * double-counts. The run aborts rather than publishing a number that is
 * quietly twice what it should be.
 */
const VINTAGE_SPLITS: Array<{ parent: string; children: string[] }> = [
  { parent: "930100", children: ["930110", "930111", "930119", "930120", "930190"] },
  { parent: "930110", children: ["930111", "930119"] },
  { parent: "930520", children: ["930521", "930529"] },
  { parent: "930590", children: ["930591", "930599"] },
  { parent: "890600", children: ["890610", "890690"] },
  { parent: "880100", children: ["880110", "880190"] },
  { parent: "880520", children: ["880521", "880529"] },
];

export interface GroupYear {
  year: number;
  /** False when not one of the group's codes was reported that year. */
  reported: boolean;
  /** Null when `reported` is false. Absence is not zero. */
  imports: number | null;
  exports: number | null;
  balance: number | null;
  codesPresent: string[];
  codesAbsent: string[];
}

/**
 * The biggest lines inside a group, in its most recent reported year.
 *
 * Written because a group total invites the reader to imagine what is in it,
 * and what is in it is usually not what the group's name suggests. The
 * aircraft group is one code — airliners over fifteen tonnes. Chapter 93 is
 * one code — ammunition n.e.c. Showing the composition is the difference
 * between a total and an argument about what the total means.
 */
export interface TopLine {
  code: string;
  name: string;
  imports: number;
  exports: number;
  /** This line's turnover as a share of the group's, with the denominator beside it. */
  shareOfGroupTurnover: number;
  groupTurnover: number;
}

export interface DefenceGroup {
  id: string;
  label: string;
  codeRange: string;
  military: GroupSpec["military"];
  captures: string;
  misses: string;
  concordance?: string;
  subsetOf?: string;
  /** Every code in the universe that this group matches, whether traded or not. */
  codes: Array<{ code: string; name: string }>;
  years: GroupYear[];
  /** Composition of the latest year in which anything was reported. */
  composition: { year: number; lines: TopLine[] } | null;
}

export interface DefenceTradeFile {
  builtAt: string;
  source: string;
  classification: string;
  caveat: string;
  cannotSay: string[];
  years: number[];
  /** All-commodity totals, so every share on the page has its denominator. */
  denominators: Array<{ year: number; imports: number; exports: number; codesReported: number }>;
  groups: DefenceGroup[];
  checks: string[];
}

export async function run(): Promise<void> {
  const years = sampledYears();
  if (years.length === 0) throw new Error(`no hs6-YYYY.json files in ${TRADE_DIR}; run the trade ingest first`);

  const universe = readJson<Universe>(join(TRADE_DIR, "hs6-universe.json"));
  if (!universe) throw new Error(`${join(TRADE_DIR, "hs6-universe.json")} missing; run \`npm run trade:universe\``);

  // year -> code -> row
  const byYear = new Map<number, Map<string, YearRow>>();
  for (const y of years) {
    const rows = readJson<YearRow[]>(join(TRADE_DIR, `hs6-${y}.json`));
    if (!rows) throw new Error(`hs6-${y}.json is present but unreadable`);
    const m = new Map<string, YearRow>();
    for (const r of rows) {
      if (!r || typeof r.code !== "string") continue;
      m.set(r.code, { code: r.code, m: Number(r.m) || 0, x: Number(r.x) || 0 });
    }
    byYear.set(y, m);
  }

  // Trap 4, asserted rather than assumed.
  const checks: string[] = [];
  for (const { parent, children } of VINTAGE_SPLITS) {
    const clashes: string[] = [];
    for (const y of years) {
      const m = byYear.get(y);
      if (!m?.has(parent)) continue;
      const both = children.filter((c) => m.has(c));
      if (both.length > 0) clashes.push(`${y}: ${parent} with ${both.join(", ")}`);
    }
    if (clashes.length > 0) {
      throw new Error(
        `HS vintage overlap would double-count: ${clashes.join("; ")}. ` +
        `Split ${parent} out of its group or drop the children for those years before publishing.`,
      );
    }
    checks.push(`${parent} never co-occurs with ${children.join("/")} in any sampled year`);
  }

  const denominators = years.map((y) => {
    const m = byYear.get(y) ?? new Map<string, YearRow>();
    let imports = 0, exports = 0;
    for (const r of m.values()) { imports += r.m; exports += r.x; }
    return { year: y, imports, exports, codesReported: m.size };
  });

  const groups: DefenceGroup[] = GROUPS.map((spec) => {
    const codes = Object.keys(universe.names)
      .filter((c) => c.length === 6 && spec.match(c))
      .sort()
      .map((code) => ({ code, name: universe.names[code] ?? `HS ${code}` }));

    const yearRows: GroupYear[] = years.map((y) => {
      const m = byYear.get(y) ?? new Map<string, YearRow>();
      const present: string[] = [];
      const absent: string[] = [];
      let imports = 0, exports = 0;
      for (const { code } of codes) {
        const row = m.get(code);
        if (!row) { absent.push(code); continue; }
        present.push(code);
        imports += row.m;
        exports += row.x;
      }
      // Absence is not zero: a group with nothing reported gets nulls.
      if (present.length === 0) {
        return { year: y, reported: false, imports: null, exports: null, balance: null, codesPresent: [], codesAbsent: absent };
      }
      return {
        year: y, reported: true,
        imports, exports, balance: imports - exports,
        codesPresent: present, codesAbsent: absent,
      };
    });

    // Composition of the latest year that reported anything at all.
    const latest = [...yearRows].reverse().find((y) => y.reported);
    let composition: DefenceGroup["composition"] = null;
    if (latest) {
      const m = byYear.get(latest.year) ?? new Map<string, YearRow>();
      const turnover = (latest.imports ?? 0) + (latest.exports ?? 0);
      const lines = latest.codesPresent
        .map((code) => {
          const row = m.get(code);
          const imports = row?.m ?? 0;
          const exports = row?.x ?? 0;
          return {
            code,
            name: universe.names[code] ?? `HS ${code}`,
            imports,
            exports,
            // The denominator travels with the share, always.
            shareOfGroupTurnover: turnover > 0 ? (imports + exports) / turnover : 0,
            groupTurnover: turnover,
          };
        })
        .sort((a, b) => (b.imports + b.exports) - (a.imports + a.exports))
        .slice(0, 5);
      composition = { year: latest.year, lines };
    }

    return {
      id: spec.id,
      label: spec.label,
      codeRange: spec.codeRange,
      military: spec.military,
      captures: spec.captures,
      misses: spec.misses,
      ...(spec.concordance ? { concordance: spec.concordance } : {}),
      ...(spec.subsetOf ? { subsetOf: spec.subsetOf } : {}),
      codes,
      years: yearRows,
      composition,
    };
  });

  // A subset that exceeds its parent means the match predicates disagree with
  // the claimed nesting, which would silently corrupt every share on the page.
  for (const g of groups) {
    if (!g.subsetOf) continue;
    const parent = groups.find((p) => p.id === g.subsetOf);
    if (!parent) throw new Error(`${g.id} claims to be a subset of ${g.subsetOf}, which is not a group`);
    for (const gy of g.years) {
      const py = parent.years.find((p) => p.year === gy.year);
      if (!gy.reported || !py?.reported) continue;
      if ((gy.imports ?? 0) > (py.imports ?? 0) + 1 || (gy.exports ?? 0) > (py.exports ?? 0) + 1) {
        throw new Error(
          `${g.id} exceeds its parent ${parent.id} in ${gy.year} ` +
          `(${gy.imports}/${gy.exports} vs ${py.imports}/${py.exports}); the subset claim is wrong`,
        );
      }
    }
    checks.push(`${g.id} never exceeds ${g.subsetOf} in any sampled year`);
  }

  const out: DefenceTradeFile = {
    builtAt: new Date().toISOString(),
    source:
      "UN Comtrade, India as reporter, annual HS6 imports and exports in current US dollars, " +
      "as ingested into data/trade/hs6-YYYY.json. Computed offline from those files; this " +
      "connector makes no network call.",
    classification: universe.source,
    caveat:
      "HS chapter 93 is titled 'arms and ammunition' and is NOT India's defence trade. Its " +
      "largest Indian lines are sporting shotguns, target rifles, air guns and shotgun " +
      "cartridges; the one heading the classification itself calls military, 9301, is a " +
      "rounding error beside them. Meanwhile combat aircraft are chapter 88, warships 8906, " +
      "armoured vehicles 8710, and radar, avionics and electronic warfare are pooled with " +
      "their civil equivalents in chapters 85 and 90. Missiles have no heading of their own. " +
      "Chapter 93 is a floor and a poor proxy, and is labelled as exactly that everywhere it " +
      "is shown.",
    cannotSay: [
      "India's official defence export figure. That is a Ministry of Defence measure of " +
      "contract value, covering services, offsets and platforms that never cross a customs " +
      "border, and it cannot be reconstructed from HS data at any level of effort.",
      "How many countries India exports defence equipment to. These files carry no partner " +
      "dimension at all — the ingest pins partner to World to avoid a 215-fold row explosion — " +
      "so destination spread is not merely hard here, it is absent.",
      "Military versus civil within any chapter-88 or chapter-89 line. The classification " +
      "does not make that distinction and no amount of arithmetic will recover it.",
      "Missile exports. BrahMos and Akash have no HS heading; depending on the declarant they " +
      "land in 9306, 8802, 8526 or nowhere separately visible.",
      "Whether a code absent from a year means no trade, a code not yet in force, or a " +
      "reporting gap. The ingest drops rows that are zero on both flows, so the three are " +
      "indistinguishable downstream.",
      "Anything about years that were not sampled. Eleven years are on disk out of the " +
      "period the site covers; the gaps are gaps, not flat lines.",
    ],
    years,
    denominators,
    groups,
    checks,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");

  const usd = (n: number | null): string =>
    (n === null ? "—" : `${(n / 1e6).toFixed(1)}m`).padStart(9);
  for (const g of groups) {
    console.log(`\n${g.label}${g.subsetOf ? `  (subset of ${g.subsetOf})` : ""}`);
    for (const y of g.years) {
      console.log(
        `  ${y.year}  imports ${usd(y.imports)}  exports ${usd(y.exports)}  ` +
        `balance ${usd(y.balance)}  ${y.codesPresent.length}/${g.codes.length} codes` +
        (y.reported ? "" : "   (nothing reported — absence, not zero)"),
      );
    }
    if (g.composition) {
      const top = g.composition.lines[0];
      if (top) {
        console.log(
          `         ${g.composition.year} is ${(top.shareOfGroupTurnover * 100).toFixed(0)}% ` +
          `one line: ${top.code} ${top.name.slice(0, 60)}`,
        );
      }
    }
  }
  console.log(`\n${checks.length} structural checks passed; wrote ${OUT}`);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
