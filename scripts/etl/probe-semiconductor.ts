/**
 * Who will tell a script anything about India's approved fabs?
 *
 * `npm run semi:probe`. Writes data/live/semiconductor-probe.json. Reachability
 * only: no fact from any of these pages is published by this script, and the
 * output file is a record of which doors opened, not of what was behind them.
 *
 * ── Why a probe and not a connector ──────────────────────────────────────
 *
 * The trade half of this layer is settled — data/semi/trade.json is computed
 * offline from files already in the repository, and says what India's chip
 * import bill is. The other half is the India Semiconductor Mission: five or
 * six approved units, each with an announced investment, an announced capacity
 * and an announced date, none of which has yet produced a commercial wafer at
 * the time this was written.
 *
 * Those are announcements, and announcements are exactly the kind of number
 * this project keeps getting wrong. "₹91,000 crore approved" is a cabinet
 * decision, not spending; "50,000 wafer starts per month" is a design
 * capacity, not output; "production by 2025" is a target that has already
 * moved more than once. Writing any of them into a data file from memory would
 * be the worst thing this repository could do, and this file deliberately
 * contains none. What it does is find out which sources will answer, so the
 * connector that comes later can cite one of them per fact.
 *
 * ── Three kinds of source, ranked by what they can prove ─────────────────
 *
 *   The state. ISM and MeitY approved these units and PIB announces each
 *     approval. This is the primary record for what was sanctioned and when.
 *     It is silent, by construction, on whether anything was built — a press
 *     release announcing groundbreaking is evidence of a ceremony.
 *
 *   The companies. Micron, Tata Electronics, CG Power, Kaynes, Renesas and
 *     PSMC each say things about their own site. Primary for their own
 *     investment and schedule, and structurally optimistic about both.
 *
 *   Wikipedia. Carries a paragraph per unit, cited onward to news reports.
 *     An index of where a number exists, never the number's source. Included
 *     because it is the only one of the three likely to state, in one place,
 *     that a date slipped.
 *
 * ── What this probe is braced for ────────────────────────────────────────
 *
 * Indian government sites have refused this project before, in specific ways
 * worth expecting. PIB answers 403 to anything identifying as a bot (see
 * scripts/etl/lib/http.ts, which retries as a browser for exactly this
 * reason). asi.nic.in returned a rendered application instead of a table. Some
 * ministry sites are behind a WAF that answers 200 with an interstitial, which
 * is why every target carries `look` words: a 200 that does not contain the
 * word "semiconductor" is a failure that reports itself as a success, and
 * without `look` the probe would record a dead source as live.
 *
 * A 403 here is a finding. So is a 200 whose body does not contain the word
 * the page is supposed to be about.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { isEntryPoint } from "./lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "live", "semiconductor-probe.json");
const WIKI = "https://en.wikipedia.org/w/api.php";

interface Target {
  id: string;
  kind: "state" | "company" | "wiki";
  what: string;
  url: string;
  /** Words that must appear for the page to be about what it claims. */
  look?: string[];
  note?: string;
}

const wikiPage = (page: string, look: string[], note?: string): Target => ({
  id: `wiki-${page.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
  kind: "wiki",
  what: `Wikipedia: ${page.replace(/_/g, " ")}`,
  url: `${WIKI}?action=parse&page=${encodeURIComponent(page)}&redirects=1&prop=wikitext&formatversion=2&format=json`,
  look,
  ...(note ? { note } : {}),
});

const TARGETS: Target[] = [
  // ── The state: who approved what, and when ────────────────────────────
  {
    id: "ism", kind: "state",
    what: "India Semiconductor Mission",
    url: "https://ism.gov.in/",
    look: ["semiconductor"],
    note:
      "The mission's own site. Primary for the list of approved units and the scheme terms. " +
      "Everything it publishes is a sanction or a target, never output.",
  },
  {
    id: "ism-approved", kind: "state",
    what: "ISM: approved projects listing",
    url: "https://ism.gov.in/approved-projects",
    look: ["semiconductor"],
    note: "If this URL has moved, the probe should say so rather than the connector guessing a path.",
  },
  {
    id: "meity", kind: "state",
    what: "MeitY: Semiconductors and Display Fab Ecosystem",
    url: "https://www.meity.gov.in/",
    look: ["semiconductor"],
    note: "The parent ministry. The scheme documents and their amendments live here as PDFs.",
  },
  {
    id: "meity-scheme", kind: "state",
    what: "MeitY: semiconductor scheme page",
    url: "https://www.meity.gov.in/ministry/our-groups/semicon-india",
    look: ["semiconductor"],
    note: "Path is a guess from the site's own navigation scheme; a 404 here is useful information.",
  },
  {
    id: "pib-semiconductor", kind: "state",
    what: "PIB release search: semiconductor",
    url: "https://pib.gov.in/indexd.aspx",
    look: ["press"],
    note:
      "PIB answers 403 to a bot user-agent; the http helper retries as a browser. Each cabinet " +
      "approval has a PIB release, which is the citable primary record of the sanction.",
  },

  // ── The companies, primary and structurally optimistic ────────────────
  {
    id: "micron", kind: "company",
    what: "Micron Technology: India",
    url: "https://in.micron.com/",
    look: ["micron"],
    note: "Sanand, Gujarat. An assembly and test plant, not a fab — the distinction the coverage keeps losing.",
  },
  {
    id: "tata-electronics", kind: "company",
    what: "Tata Electronics",
    url: "https://www.tataelectronics.com/",
    look: ["semiconductor"],
    note: "Operates both the Dholera fab (with PSMC) and the Jagiroad, Assam assembly unit.",
  },
  {
    id: "cg-power", kind: "company",
    what: "CG Power and Industrial Solutions",
    url: "https://www.cgglobal.com/",
    look: ["cg power"],
    note: "Sanand ATMP with Renesas and Stars Microelectronics.",
  },
  {
    id: "kaynes", kind: "company",
    what: "Kaynes Technology",
    url: "https://kaynestechnology.co.in/",
    look: ["kaynes"],
    note: "Sanand OSAT.",
  },
  {
    id: "renesas", kind: "company",
    what: "Renesas Electronics",
    url: "https://www.renesas.com/",
    look: ["renesas"],
    note: "Partner in the CG Power unit. A Japanese filer, so its own statements are auditable.",
  },
  {
    id: "psmc", kind: "company",
    what: "Powerchip Semiconductor Manufacturing Corporation (PSMC)",
    url: "https://www.psmc.com.tw/",
    look: ["semiconductor"],
    note: "Technology partner for the Dholera fab. Taiwanese listed company.",
  },
  {
    id: "scl-mohali", kind: "company",
    what: "Semi-Conductor Laboratory, Mohali",
    url: "https://www.scl.gov.in/",
    look: ["semiconductor"],
    note:
      "India's existing government fab, running a legacy node for ISRO and defence. The one unit " +
      "in the story that has actually fabricated wafers, and the one least written about.",
  },

  // ── Wikipedia, as an index of where a number exists ───────────────────
  wikiPage("India_Semiconductor_Mission", ["semiconductor"],
    "If a date has slipped, this is the source most likely to say so in one place."),
  wikiPage("Semiconductor_industry_in_India", ["semiconductor"]),
  wikiPage("Micron_Technology", ["Sanand", "India"],
    "Tests whether the India plant is covered in the corporate article or only in news."),
  wikiPage("Tata_Electronics", ["Dholera", "semiconductor"]),
  wikiPage("Dholera", ["semiconductor"],
    "The special investment region itself. Its article may carry the fab's schedule."),
  wikiPage("Jagiroad", ["semiconductor"],
    "Assam ATMP site. A small-town article is a weak source and is probed to find out how weak."),
  wikiPage("CG_Power_and_Industrial_Solutions", ["semiconductor"]),
  wikiPage("Kaynes_Technology", ["semiconductor"]),
  wikiPage("Powerchip_Semiconductor_Manufacturing_Corporation", ["India"]),
  wikiPage("Semi-Conductor_Laboratory", ["Mohali"]),
];

interface Finding {
  id: string; kind: string; what: string; url: string;
  ok: boolean; status: string; bytes: number | null;
  found?: string[]; missing?: string[];
  /**
   * Phrases where a figure sits next to a fab word. Evidence that a number is
   * on the page and what kind it is — not the number itself, and nothing here
   * is ever promoted into a data file without a connector that cites it.
   */
  claims?: string[];
  note?: string;
}

/**
 * Figures sitting next to a semiconductor word.
 *
 * Deliberately coarse. The point is to learn whether a page states investment
 * in crore, capacity in wafers or units per day, or a date — not to parse any
 * of them. Every one of these is an announcement until a connector proves
 * otherwise, and the shape of the phrase is what tells a later reader which
 * kind of announcement it was.
 */
function claimsNear(body: string): string[] {
  const out = new Set<string>();
  const re =
    /(?:₹\s*)?([\d][\d,.]{1,12})\s*(crore|lakh|billion|million|bn|mn)?\s*(?:\w+\s+){0,4}?(wafer[s]?(?:\s+per\s+month)?|chips?\s+per\s+day|units?\s+per\s+day|investment|fab|assembly|packaging|nm\b)/gi;
  for (const m of body.matchAll(re)) {
    out.add(`${m[1]}${m[2] ? " " + m[2] : ""} … ${m[3]}`.replace(/\s+/g, " ").trim());
    if (out.size >= 10) break;
  }
  return [...out];
}

export async function run(): Promise<void> {
  const findings: Finding[] = [];

  for (const t of TARGETS) {
    const res = await getText(t.url, { cacheMs: 0, retries: 1, timeoutMs: 45_000 });
    const body = res.data ?? "";
    const lower = body.toLowerCase();
    const look = res.ok && t.look
      ? {
          found: t.look.filter((w) => lower.includes(w.toLowerCase())),
          missing: t.look.filter((w) => !lower.includes(w.toLowerCase())),
        }
      : null;
    const claims = res.ok ? claimsNear(body) : [];

    const f: Finding = {
      id: t.id, kind: t.kind, what: t.what, url: t.url.slice(0, 110),
      ok: res.ok,
      status: res.ok ? "200" : (res.error ?? "failed"),
      bytes: res.ok ? body.length : null,
      ...(look ? { found: look.found, missing: look.missing } : {}),
      ...(claims.length > 0 ? { claims } : {}),
      ...(t.note ? { note: t.note } : {}),
    };
    findings.push(f);
    console.log(
      `  ${(f.ok ? "ok" : "dead").padEnd(5)} ${t.kind.padEnd(8)} ${f.id.padEnd(44)} ` +
      `${f.bytes ?? 0}${claims.length > 0 ? `  claims: ${claims.slice(0, 2).join(" / ")}` : ""}` +
      `${look && look.missing.length > 0 ? `  MISSING WORDS: ${look.missing.join(", ")}` : ""}`,
    );

    // Written after every target, not at the end. A probe that dies on target
    // nineteen should still have told us about the eighteen before it; this
    // project has lost a run's worth of findings to an end-of-loop write more
    // than once.
    await mkdir(join(ROOT, "data", "live"), { recursive: true });
    await writeFile(OUT, JSON.stringify({
      probedAt: new Date().toISOString(),
      note:
        "Reachability only. No fact about any fab is published from this file, and nothing in " +
        "it may be copied into a data file without a connector that cites the page it came from.",
      question:
        "Which sources will tell a script what the India Semiconductor Mission approved, for " +
        "how much, at what capacity, and on what date — and which of them will say when a date moved?",
      refusal:
        "Every figure these sources carry is an announcement. A sanctioned amount is a cabinet " +
        "decision, not spending; a stated capacity is a design figure, not output; a stated date " +
        "is a target that has moved before. The page will present them as announcements with the " +
        "announcer named, and will keep them apart from data/semi/trade.json, which is measured. " +
        "Until a unit ships, the import bill is the only number that can be checked.",
      targets: TARGETS.length,
      findings,
    }, null, 2) + "\n", "utf8");
  }

  for (const kind of ["state", "company", "wiki"]) {
    const l = findings.filter((f) => f.kind === kind);
    const live = l.filter((f) => f.ok).length;
    const real = l.filter((f) => f.ok && (f.missing?.length ?? 0) === 0).length;
    const withClaims = l.filter((f) => (f.claims?.length ?? 0) > 0).length;
    console.log(
      `\n${kind}: ${live} of ${l.length} answered, ${real} answered with the words they should ` +
      `contain, ${withClaims} carrying a visible figure`,
    );
  }
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
