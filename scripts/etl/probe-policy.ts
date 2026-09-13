/**
 * Who will tell a script what India actually did about the trade deficit?
 *
 * `npm run policy:probe`. The policy layer in `lib/policy-measures.ts` ships
 * with every figure empty on purpose: scheme outlays, indigenisation list
 * lengths, offset thresholds and corridor dates are exactly the facts that sit
 * in memory looking plausible and are wrong. This probe is the other half of
 * that decision — it goes to the departments that notified these measures and
 * records whether their pages answer a plain fetch, and in what shape.
 *
 * ── This probe extracts nothing, and that is a change from its siblings ──
 *
 * `probe-footfall.ts` prints sample figures it finds near visitor words, and
 * for footfall that is harmless: the number is a hint about whether a page
 * carries a count. Here it would be actively dangerous. A scheme outlay copied
 * into a probe log is a figure with a filename beside it instead of a source,
 * and the whole failure mode this layer defends against is a plausible number
 * arriving without the sentence that supports it. So this file counts
 * money-shaped mentions without recording their values, and lists the PDF links
 * it finds because a link is a lead rather than a fact.
 *
 * The extraction step is a separate connector that has not been written, and
 * when it is, it must do what the toponymy layer in
 * `scripts/etl/connectors/sacred.ts` does: find the sentence, store it verbatim
 * beside the number, and drop anything no sentence supports.
 *
 * ── What is already known to be hard ─────────────────────────────────────
 *
 * PIB has no keyword search that answers a GET. Its release pages are addressed
 * by numeric PRID and its search is a POST form, so the three PIB targets here
 * can only establish that the index and the ministry feed are reachable — the
 * release that carries a given outlay has to be found by its PRID and pinned in
 * `data/sources.json` like every other citation on this site.
 *
 * Ministry paths are guesses where the department does not publish a stable
 * scheme URL. A 404 from `meity.gov.in/specs` is a useful answer: it tells the
 * next run to crawl the schemes index instead. Nothing downstream depends on a
 * guessed path resolving.
 *
 * ── Overlap with the probes next door, deliberately kept ─────────────────
 *
 * `probe-semiconductor.ts` already asks ism.gov.in about approved projects, and
 * `probe-defence-exports.ts` already asks ddpmod.gov.in about export values.
 * Those ask what was produced. This asks what was notified — the outlay, the
 * date, the list length — and a host answering one question is not evidence it
 * answers the other, so the hosts are probed again from this angle rather than
 * assumed.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { isEntryPoint } from "./lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "live", "policy-probe.json");
const WIKI = "https://en.wikipedia.org/w/api.php";

type Kind = "ministry" | "portal" | "state" | "audit" | "pib" | "wiki";

interface Target {
  id: string;
  kind: Kind;
  what: string;
  url: string;
  /** Words that must appear for the page to be carrying what it should. */
  look?: string[];
  /** Which measures in lib/policy-measures.ts are waiting on this. */
  answers?: string[];
  note?: string;
}

const wikiPage = (page: string, look: string[], answers: string[], note?: string): Target => ({
  id: `wiki-${page.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 44)}`,
  kind: "wiki",
  what: `Wikipedia: ${page.replace(/_/g, " ")}`,
  url: `${WIKI}?action=parse&page=${encodeURIComponent(page)}&redirects=1&prop=wikitext&formatversion=2&format=json`,
  look,
  answers,
  ...(note ? { note } : {}),
});

export const TARGETS: Target[] = [
  // ── MeitY and the electronics schemes ─────────────────────────────────
  {
    id: "meity-home", kind: "ministry",
    what: "Ministry of Electronics and Information Technology",
    url: "https://www.meity.gov.in/",
    look: ["electronics"],
    answers: [],
    note: "The root, probed first so a dead scheme path can be told apart from a dead ministry.",
  },
  {
    id: "meity-schemes", kind: "ministry",
    what: "MeitY schemes index",
    url: "https://www.meity.gov.in/schemes",
    look: ["scheme"],
    answers: ["pli-large-scale-electronics", "pli-it-hardware", "specs", "semicon-india", "electronics-qco"],
    note: "If any single page settles the electronics outlays, it is this one. Everything else here is a fallback for it.",
  },
  {
    id: "meity-pli-lsem", kind: "ministry",
    what: "MeitY: large-scale electronics manufacturing group",
    url: "https://www.meity.gov.in/ministry/our-groups/electronics-system-design-manufacturing-esdm",
    look: ["electronics", "manufacturing"],
    answers: ["pli-large-scale-electronics"],
    note: "Path taken from the ministry's own group naming. A 404 sends the next run to the schemes index.",
  },
  {
    id: "meity-pli-ithw", kind: "ministry",
    what: "MeitY: production-linked incentive for IT hardware",
    url: "https://www.meity.gov.in/pli-scheme-it-hardware",
    look: ["hardware"],
    answers: ["pli-it-hardware"],
    note: "Two versions of this scheme exist and the second replaced the first. Whatever answers must date itself or it cannot fill either slot.",
  },
  {
    id: "meity-specs", kind: "ministry",
    what: "MeitY: scheme for electronic components and semiconductors",
    url: "https://www.meity.gov.in/specs",
    look: ["component"],
    answers: ["specs"],
  },
  {
    id: "meity-pmp", kind: "ministry",
    what: "MeitY: phased manufacturing programme",
    url: "https://www.meity.gov.in/phased-manufacturing-programme",
    look: ["phased"],
    answers: ["pmp-mobile-handsets"],
    note: "What is wanted here is a table — parts, duty, year — not a headline figure. A page that carries the schedule as a PDF is a success.",
  },
  {
    id: "ism-home", kind: "portal",
    what: "India Semiconductor Mission",
    url: "https://ism.gov.in/",
    look: ["semiconductor"],
    answers: ["semicon-india"],
    note: "probe-semiconductor.ts asks this host about approved projects. This asks it about the programme's outlay and its sanction date.",
  },
  {
    id: "bis-crs", kind: "portal",
    what: "BIS compulsory registration scheme portal",
    url: "https://www.crsbis.in/BIS/",
    look: ["registration"],
    answers: ["electronics-qco"],
    note: "The count that matters is how many product categories are notified, and it is a list length rather than a headline.",
  },
  {
    id: "cbic-tariff", kind: "ministry",
    what: "Central Board of Indirect Taxes and Customs",
    url: "https://www.cbic.gov.in/",
    look: ["customs"],
    answers: ["ict-customs-duty", "pmp-mobile-handsets"],
    note: "Duty rates change every budget. Any rate read from here is worthless without the year it applies to.",
  },
  {
    id: "indiabudget", kind: "ministry",
    what: "Union Budget documents",
    url: "https://www.indiabudget.gov.in/",
    look: ["budget"],
    answers: ["ict-customs-duty", "defence-capital-earmark", "pmp-mobile-handsets"],
    note: "The domestic earmark in defence capital acquisition is a budget line, which makes it the most legible figure in this whole layer.",
  },

  // ── Defence production, the department that runs the lists ────────────
  {
    id: "ddp-home", kind: "ministry",
    what: "Department of Defence Production",
    url: "https://www.ddpmod.gov.in/",
    look: ["defence"],
    answers: ["idex", "defence-offsets", "srijan"],
  },
  {
    id: "ddp-indigenisation", kind: "ministry",
    what: "DDP: indigenisation and the positive indigenisation lists",
    url: "https://www.ddpmod.gov.in/indigenisation",
    look: ["indigenis"],
    answers: ["pil-services-1", "pil-services-2", "pil-services-3", "pil-services-4", "pil-services-5", "pil-dpsu"],
    note: "The single most important target in this file. Five services lists and an unknown number of component lists, each with a date, a length and a staggered embargo schedule.",
  },
  {
    id: "ddp-corridors", kind: "ministry",
    what: "DDP: defence industrial corridors",
    url: "https://www.ddpmod.gov.in/defence-industrial-corridors",
    look: ["corridor"],
    answers: ["corridor-up", "corridor-tn"],
    note: "Wanted here: the designation year and the node count. The investment figures already exist as sourced series and must not be duplicated.",
  },
  {
    id: "srijan-portal", kind: "portal",
    what: "SRIJAN defence indigenisation portal",
    url: "https://srijandefence.gov.in/",
    look: ["indigenis"],
    answers: ["srijan", "pil-dpsu"],
    note: "A public list of what the defence manufacturers still import — a rarer thing than the lists of what they no longer may.",
  },
  {
    id: "idex-home", kind: "portal",
    what: "Innovations for Defence Excellence",
    url: "https://idex.gov.in/",
    look: ["defence"],
    answers: ["idex"],
    note: "Expect activity counts — challenges, startups, grants. The figure that would be a finding is contracts awarded, and it is usually not published.",
  },
  {
    id: "mod-home", kind: "ministry",
    what: "Ministry of Defence",
    url: "https://www.mod.gov.in/",
    look: ["defence"],
    answers: [],
  },
  {
    id: "mod-dap", kind: "ministry",
    what: "MoD: Defence Acquisition Procedure",
    url: "https://www.mod.gov.in/documents/defence-acquisition-procedure",
    look: ["acquisition"],
    answers: ["dap-2020", "defence-offsets"],
    note: "The procedure is a long PDF. The probe wants the link, not the document — the offset threshold and the indigenous-content floors are inside it and need a page read.",
  },
  {
    id: "mod-annual-report", kind: "ministry",
    what: "MoD annual reports",
    url: "https://www.mod.gov.in/documents/annual-report",
    look: ["annual"],
    answers: ["pil-services-1", "pil-dpsu", "idex", "dap-2020", "defence-capital-earmark", "srijan"],
    note: "The annual report is the one document that restates every defence measure in one place with a year attached. If it is reachable as a PDF, it is the best target in this file.",
  },
  {
    id: "cag-reports", kind: "audit",
    what: "Comptroller and Auditor General audit reports",
    url: "https://cag.gov.in/en/audit-report",
    look: ["report"],
    answers: ["defence-offsets"],
    note: "Offsets contracted and offsets discharged are different numbers. Only the auditor publishes the second, which is why an audit site is in a probe about policy.",
  },
  {
    id: "dpiit-fdi-policy", kind: "ministry",
    what: "DPIIT consolidated foreign direct investment policy",
    url: "https://dpiit.gov.in/foreign-direct-investment/foreign-direct-investment-policy",
    look: ["investment"],
    answers: ["defence-fdi-cap"],
  },

  // ── The two corridors, run by state agencies ──────────────────────────
  {
    id: "upeida-corridor", kind: "state",
    what: "Uttar Pradesh Expressways Industrial Development Authority",
    url: "https://upeida.up.gov.in/",
    look: ["corridor"],
    answers: ["corridor-up"],
    note: "The UP corridor is administered by the state, so the node-level detail lives here rather than with the ministry.",
  },
  {
    id: "tidco-corridor", kind: "state",
    what: "Tamil Nadu Industrial Development Corporation",
    url: "https://www.tidco.com/",
    look: ["industrial"],
    answers: ["corridor-tn"],
  },

  // ── The other two ministries running the same instrument ──────────────
  {
    id: "mnre-schemes", kind: "ministry",
    what: "Ministry of New and Renewable Energy",
    url: "https://mnre.gov.in/",
    look: ["solar"],
    answers: ["pli-solar-modules"],
    note: "Carried because solar is the control case: the same instrument, and a trade line that did not do what the story says.",
  },
  {
    id: "heavyindustries-schemes", kind: "ministry",
    what: "Ministry of Heavy Industries",
    url: "https://heavyindustries.gov.in/",
    look: ["scheme"],
    answers: ["pli-acc-battery"],
  },

  // ── PIB, which announces everything and indexes none of it ────────────
  {
    id: "pib-allrel", kind: "pib",
    what: "PIB release index",
    url: "https://pib.gov.in/allRel.aspx",
    look: ["release"],
    answers: ["pli-large-scale-electronics", "pli-it-hardware", "specs", "semicon-india", "pli-solar-modules", "pli-acc-battery"],
    note: "Reachability only. PIB's keyword search is a POST form and its releases are addressed by numeric PRID, so no probe can look up 'the release that announced this outlay'.",
  },
  {
    id: "pib-indexd", kind: "pib",
    what: "PIB search entry page",
    url: "https://pib.gov.in/indexd.aspx",
    look: ["search"],
    answers: ["defence-fdi-cap", "corridor-up", "corridor-tn"],
  },
  {
    id: "pib-rss-mod", kind: "pib",
    what: "PIB ministry release feed",
    url: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
    look: ["item"],
    answers: ["pil-services-1", "pil-services-2", "pil-services-3", "pil-services-4", "pil-services-5", "pil-dpsu", "idex", "defence-capital-earmark"],
    note: "Answers a bot user-agent with 403 and a browser one with a feed. The fetch helper already retries as a browser, which is the only reason this target is worth having.",
  },

  // ── Wikipedia, as an index of where a figure is citable ───────────────
  wikiPage("Make_in_India", ["manufacturing"], [],
    "Not a source for any figure. Useful because its citations name the primary releases, which is the lookup PIB itself will not do."),
  wikiPage("Production_Linked_Incentive", ["scheme", "crore"],
    ["pli-large-scale-electronics", "pli-it-hardware", "pli-solar-modules", "pli-acc-battery"]),
  wikiPage("Defence_industry_of_India", ["indigenis"],
    ["pil-services-1", "defence-fdi-cap"]),
  wikiPage("Semiconductor_industry_in_India", ["semiconductor"],
    ["semicon-india", "specs"]),
  wikiPage("Information_Technology_Agreement", ["tariff"],
    ["ict-customs-duty"],
    "The live dispute behind India's electronics tariffs. Carried so the page can name the dispute rather than settle it."),
  wikiPage("Defence_Acquisition_Procedure_2020", ["offset"],
    ["dap-2020", "defence-offsets"],
    "This article may not exist under this title. A missingtitle answer is a finding: it means the procedure has no encyclopaedia entry and the PDF is the only route."),
];

interface Finding {
  id: string;
  kind: Kind;
  what: string;
  url: string;
  ok: boolean;
  status: string;
  bytes: number | null;
  found?: string[];
  missing?: string[];
  /** Shape, not content. See the docblock on why no values are recorded. */
  shape?: {
    tables: number;
    /** Count of "₹ … crore"-shaped mentions. The values are deliberately not kept. */
    moneyMentions: number;
    /** Count of four-digit years in a plausible policy range. */
    yearMentions: number;
    pdfLinks: number;
    /** First few document links, as leads for a later connector. */
    sampleDocs?: string[];
    /** True when the body is mostly script and almost no prose. */
    looksLikeShell: boolean;
  };
  /** Wikipedia only: the article does not exist under that title. */
  missingArticle?: boolean;
  answers?: string[];
  note?: string;
}

/** Money-shaped mentions, counted and not read. */
function countMoney(body: string): number {
  return [...body.matchAll(/(?:₹|Rs\.?|INR)\s*[\d][\d,.]*\s*(?:lakh|crore|billion|million)?/gi)].length;
}

function countYears(body: string): number {
  return [...body.matchAll(/\b(?:19[9]\d|20[0-3]\d)\b/g)].length;
}

/** Links to documents, which are leads rather than facts. */
function docLinks(body: string, base: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(/href\s*=\s*["']([^"']+\.pdf[^"']*)["']/gi)) {
    const href = m[1];
    if (href === undefined) continue;
    try {
      out.add(new URL(href, base).toString().slice(0, 150));
    } catch {
      out.add(href.slice(0, 150));
    }
    if (out.size >= 5) break;
  }
  return [...out];
}

/**
 * A rendered application pretending to be a page.
 *
 * Several ministry portals return a few kilobytes of script and no prose. That
 * is a different failure from a 404 and the next person needs to know which
 * they are looking at, because one is fixed by finding the right path and the
 * other is not fixed at all without a headless browser.
 */
function looksLikeShell(body: string): boolean {
  const text = body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return body.length > 500 && text.length < body.length * 0.05;
}

export async function run(): Promise<void> {
  const findings: Finding[] = [];
  await mkdir(join(ROOT, "data", "live"), { recursive: true });

  for (const t of TARGETS) {
    const res = await getText(t.url, { cacheMs: 0, retries: 1, timeoutMs: 45_000 });
    const body = res.data ?? "";
    const missingArticle = t.kind === "wiki" && /"code"\s*:\s*"missingtitle"/.test(body);

    const look = res.ok && t.look
      ? {
          found: t.look.filter((w) => body.toLowerCase().includes(w.toLowerCase())),
          missing: t.look.filter((w) => !body.toLowerCase().includes(w.toLowerCase())),
        }
      : null;

    const docs = res.ok ? docLinks(body, t.url) : [];
    const shape = res.ok
      ? {
          tables: [...body.matchAll(/<table\b/gi)].length,
          moneyMentions: countMoney(body),
          yearMentions: countYears(body),
          pdfLinks: [...body.matchAll(/\.pdf\b/gi)].length,
          ...(docs.length > 0 ? { sampleDocs: docs } : {}),
          looksLikeShell: looksLikeShell(body),
        }
      : undefined;

    const f: Finding = {
      id: t.id, kind: t.kind, what: t.what, url: t.url.slice(0, 130),
      ok: res.ok && !missingArticle,
      status: missingArticle ? "missingtitle" : res.ok ? "200" : (res.error ?? "failed"),
      bytes: res.ok ? body.length : null,
      ...(look ? { found: look.found, missing: look.missing } : {}),
      ...(shape ? { shape } : {}),
      ...(missingArticle ? { missingArticle: true } : {}),
      ...(t.answers && t.answers.length > 0 ? { answers: t.answers } : {}),
      ...(t.note ? { note: t.note } : {}),
    };
    findings.push(f);

    console.log(
      `  ${(f.ok ? "ok" : "dead").padEnd(5)} ${t.kind.padEnd(9)} ${f.id.padEnd(34)} ` +
      `${String(f.bytes ?? 0).padStart(7)}` +
      (shape
        ? `  tables:${shape.tables} money:${shape.moneyMentions} pdfs:${shape.pdfLinks}` +
          (shape.looksLikeShell ? "  SHELL" : "")
        : "") +
      (look && look.missing.length > 0 ? `  missing: ${look.missing.join(",")}` : ""),
    );

    // Written after every target, so a run that dies halfway still leaves the
    // half it learned. The probes on this project are long and the hosts are
    // unreliable; a partial file has repeatedly been the useful one.
    await writeFile(OUT, JSON.stringify({
      probedAt: new Date().toISOString(),
      question:
        "Which departments will tell a script what India notified — the outlay, the date, the list length — and in what shape?",
      note:
        "Reachability and shape only. No figure is recorded from any page, including the ones that carry the figures this layer needs.",
      refusal:
        "Money-shaped mentions are counted, never read. A scheme outlay copied into this file would be a number with a filename beside it instead of a source, which is the exact failure lib/policy-measures.ts is built to prevent. Extraction is a separate connector and it must store the sentence.",
      knownLimits: [
        "PIB has no keyword search that answers a GET. Releases are addressed by numeric PRID and the search is a POST form, so the PIB targets confirm reachability and nothing else.",
        "Several ministry scheme paths here are guesses. A 404 tells the next run to crawl the schemes index; nothing downstream assumes a guessed path resolves.",
        "A reachable page is not an answering page. Look at found/missing and the shape block before believing a target is usable.",
      ],
      findings,
    }, null, 2) + "\n", "utf8");
  }

  console.log("");
  for (const kind of ["ministry", "portal", "state", "audit", "pib", "wiki"] as Kind[]) {
    const l = findings.filter((f) => f.kind === kind);
    if (l.length === 0) continue;
    const live = l.filter((f) => f.ok).length;
    const answering = l.filter((f) => f.ok && (f.missing?.length ?? 0) === 0).length;
    const shells = l.filter((f) => f.shape?.looksLikeShell).length;
    console.log(
      `${kind.padEnd(9)} ${live} of ${l.length} reachable, ${answering} carrying every word asked for` +
      (shells > 0 ? `, ${shells} rendered shells` : ""),
    );
  }

  // Which measures have no reachable source at all — the handover number.
  const reachable = new Set(findings.filter((f) => f.ok).flatMap((f) => f.answers ?? []));
  const waiting = new Set(TARGETS.flatMap((t) => t.answers ?? []));
  const stranded = [...waiting].filter((m) => !reachable.has(m)).sort();
  console.log(
    `\n${waiting.size - stranded.length} of ${waiting.size} measures have at least one reachable source.` +
    (stranded.length > 0 ? `\nstranded: ${stranded.join(", ")}` : ""),
  );
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
