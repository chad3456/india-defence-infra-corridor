/**
 * Who publishes India's defence export figures, and will they answer a script?
 *
 * `npm run defence:probe`. Writes data/live/defence-exports-probe.json.
 * Publishes no figures and is not allowed to.
 *
 * ── Why a probe and not a connector ──────────────────────────────────────
 *
 * The customs layer next door (connectors/defence-trade.ts) can say what
 * crossed the border under HS 8710, 8802, 8806, 8807, 8906 and chapter 93.
 * It cannot say the two things a reader actually wants:
 *
 *   The headline. India's defence export figure is a Ministry of Defence
 *   number in rupees, counting contract value including services, offsets and
 *   platforms that never pass a customs post. It is not derivable from trade
 *   data at any level of effort, and it is repeated so widely — in crore, in
 *   dollars, with and without the DPSU split — that it can be recited from
 *   memory, wrongly, with total confidence. Nothing is written down here until
 *   a source answers.
 *
 *   The spread. "Exports to N countries" is the other half of the claim, and
 *   the HS6 files carry no partner dimension at all: the upstream ingest pins
 *   partner to World because not pinning it splits every commodity into 215
 *   rows. Destination spread is not hard in that dataset, it is absent. It has
 *   to come from MoD, from SIPRI's transfer register, or from nowhere.
 *
 * So the question is which of these publishers answers a script at all, and
 * what shape the answer is in — HTML with a number in it, a PDF, a rendered
 * application, a query form, or a 403. That is what this records. Extraction
 * is a later job and a different file.
 *
 * ── What is already known to fail, and is not retried blind ──────────────
 *
 * The arsenal layer probed fourteen Our World in Data arms-transfer slugs
 * across two rounds and every one returned 404; its spine ended up carrying
 * military spending and personnel instead, and its committed `gap` field says
 * so. That history is why there is exactly one OWID target here and it is a
 * CONTROL: military-spending-sipri, the slug that demonstrably works. If the
 * control answers and the arms-transfer candidates 404, the finding is "the
 * slugs do not exist"; if the control also fails, the finding is "OWID is
 * unreachable from this runner" — two different conclusions that a probe
 * without a control cannot tell apart, and the previous rounds could not.
 *
 * PIB, MEA and several Indian government publishers answer 403 to anything
 * identifying as a bot, including for their own public feeds; the fetch helper
 * already retries such a response presenting as a browser. A 403 that survives
 * that is a real refusal and is recorded as one.
 *
 * ── There is no network in the sandbox this was written in ───────────────
 *
 * The egress proxy refuses nearly every host, so every status in the output
 * file will have been written by a GitHub Actions run, not by a developer
 * machine. That is also why the findings are written after each target rather
 * than at the end: a job that dies on target nine keeps the first eight.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { isEntryPoint } from "./lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "live", "defence-exports-probe.json");
const WIKI = "https://en.wikipedia.org/w/api.php";

type Kind = "mod" | "pib" | "dpsu" | "sipri" | "wiki" | "owid" | "portal";

interface Target {
  id: string;
  kind: Kind;
  what: string;
  url: string;
  /** What this target could answer that no other one can. */
  wants: "headline" | "spread" | "both" | "method";
  /** Words that must appear for the page to be carrying what it claims to. */
  look?: string[];
  note?: string;
}

const wikiPage = (page: string, wants: Target["wants"], look: string[], note?: string): Target => ({
  id: `wiki-${page.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 44)}`,
  kind: "wiki",
  what: `Wikipedia: ${page.replace(/_/g, " ")}`,
  url: `${WIKI}?action=parse&page=${encodeURIComponent(page)}&redirects=1&prop=wikitext&formatversion=2&format=json`,
  wants,
  look,
  ...(note ? { note } : {}),
});

const TARGETS: Target[] = [
  // ── The department that owns the number ───────────────────────────────
  {
    id: "ddp-home", kind: "mod", wants: "headline",
    what: "Department of Defence Production, Ministry of Defence",
    url: "https://www.ddpmod.gov.in/",
    look: ["defence", "production"],
    note:
      "DDP is the office that compiles the export authorisation figures the MoD then " +
      "announces. If any Indian site carries the series in machine-readable form it is this one.",
  },
  {
    id: "ddp-exports", kind: "mod", wants: "both",
    what: "DDP: defence exports section",
    url: "https://www.ddpmod.gov.in/defence-exports",
    look: ["export"],
    note:
      "A guessed path off the DDP root. If it 404s, the root's own links are the map; " +
      "that is what the linked-page harvest below is for.",
  },
  {
    id: "defence-exim", kind: "portal", wants: "spread",
    what: "Defence Export Portal (defenceexim.gov.in)",
    url: "https://defenceexim.gov.in/",
    look: ["export", "authorisation"],
    note:
      "The export authorisation portal. Authorisations are issued per destination, so this " +
      "is the only Indian system that could in principle hold the country spread as data " +
      "rather than as a sentence in a press release.",
  },
  {
    id: "mod-home", kind: "mod", wants: "headline",
    what: "Ministry of Defence",
    url: "https://www.mod.gov.in/",
    look: ["defence"],
  },
  {
    id: "mod-annual-reports", kind: "mod", wants: "both",
    what: "MoD annual reports index",
    url: "https://www.mod.gov.in/documents/annual-report",
    look: ["annual", "report"],
    note:
      "The annual report is the authoritative narrative source and carries both the export " +
      "value and, in some years, a destination-country count. It is a PDF, which this " +
      "project has a table reader for and trusts least.",
  },

  // ── PIB, which is where the figure is actually announced ──────────────
  {
    id: "pib-mod-feed", kind: "pib", wants: "headline",
    what: "PIB RSS: Ministry of Defence releases",
    url: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
    look: ["rss", "item"],
    note:
      "PIB rejected all sixteen ministry feeds with a 403 on this project's first live run " +
      "until the fetch helper learned to retry as a browser. A 403 that survives that retry " +
      "is a genuine refusal, not a user-agent problem.",
  },
  {
    id: "pib-search-exports", kind: "pib", wants: "both",
    what: "PIB release archive, Ministry of Defence",
    url: "https://pib.gov.in/allRel.aspx",
    look: ["ministry", "defence"],
    note:
      "The annual export figure is announced as a PIB release, usually at the start of the " +
      "financial year. If the archive is queryable by ministry and date the series is " +
      "reconstructible release by release, each one citable on its own.",
  },

  // ── SIPRI, which has the spread but in its own units ──────────────────
  {
    id: "sipri-armstransfers", kind: "sipri", wants: "spread",
    what: "SIPRI Arms Transfers Database (landing page)",
    url: "https://www.sipri.org/databases/armstransfers",
    look: ["arms", "transfer"],
    note:
      "SIPRI's transfer register is the only independent source for who received what from " +
      "India. Its values are TIV, a volume index, NOT money — a TIV total placed beside a " +
      "rupee export figure would be a category error, and the page must never do that.",
  },
  {
    id: "sipri-trade-register", kind: "sipri", wants: "spread",
    what: "SIPRI arms trade register query form",
    url: "https://armstrade.sipri.org/armstrade/page/trade_register.php",
    look: ["register", "supplier"],
    note:
      "The arsenal layer already established that this sits behind a query form rather than " +
      "a downloadable file. Re-probed to record whether the form endpoint answers a plain " +
      "GET at all, which decides whether a connector is possible or the whole avenue is shut.",
  },
  {
    id: "sipri-export-values", kind: "sipri", wants: "spread",
    what: "SIPRI TIV export values by supplier",
    url: "https://armstrade.sipri.org/armstrade/html/export_values.php",
    look: ["tiv", "value"],
  },

  // ── OWID: one control and two candidates, so a 404 means something ────
  {
    id: "owid-control-milex", kind: "owid", wants: "method",
    what: "OWID CONTROL: military-spending-sipri (known to work)",
    url: "https://ourworldindata.org/grapher/military-spending-sipri.csv",
    look: ["entity", "year"],
    note:
      "Not wanted for its data — the arsenal spine already carries it. It is here so that a " +
      "404 on the two candidates below can be read as 'that slug does not exist' rather " +
      "than 'OWID is unreachable'. Fourteen arms slugs were probed blind before and the " +
      "difference was never established.",
  },
  {
    id: "owid-arms-exports", kind: "owid", wants: "spread",
    what: "OWID candidate: arms-exports-sipri",
    url: "https://ourworldindata.org/grapher/arms-exports-sipri.csv",
    look: ["entity", "year"],
    note: "A candidate, not a known URL. Fourteen siblings of this slug have already 404'd.",
  },
  {
    id: "owid-arms-imports", kind: "owid", wants: "spread",
    what: "OWID candidate: arms-imports-sipri",
    url: "https://ourworldindata.org/grapher/arms-imports-sipri.csv",
    look: ["entity", "year"],
    note: "Same caveat. Recorded as a candidate so the next round does not re-guess it.",
  },

  // ── The exporters themselves, who report to shareholders ─────────────
  {
    id: "hal", kind: "dpsu", wants: "headline",
    what: "Hindustan Aeronautics Limited",
    url: "https://hal-india.co.in/",
    look: ["aeronautics"],
    note:
      "A listed company files audited revenue with an export split. That is a different and " +
      "in some ways harder number than MoD's — it is company revenue, not national exports — " +
      "and the two must never be added together or substituted for each other.",
  },
  {
    id: "bel", kind: "dpsu", wants: "headline",
    what: "Bharat Electronics Limited",
    url: "https://bel-india.in/",
    look: ["electronics"],
  },
  {
    id: "brahmos", kind: "dpsu", wants: "spread",
    what: "BrahMos Aerospace",
    url: "https://www.brahmos.com/",
    look: ["brahmos"],
    note:
      "The single export that changed the country-spread story. Whether the company says " +
      "anything a script can read is worth knowing; it is also exactly the sort of page that " +
      "turns out to be a rendered application.",
  },

  // ── Wikipedia, as an index of where a figure exists ───────────────────
  wikiPage("Defence_industry_of_India", "both", ["export", "crore"],
    "Carries a figure with a citation behind it. An index of where the number lives, never " +
    "the number's source."),
  wikiPage("Defence_Research_and_Development_Organisation", "headline", ["export"]),
  wikiPage("Hindustan_Aeronautics_Limited", "headline", ["export", "revenue"]),
  wikiPage("BrahMos", "spread", ["philippines", "export"],
    "Export customers are named in prose here. A country list assembled from prose is a " +
    "list of what Wikipedia mentions, not of where India exports."),
  wikiPage("List_of_countries_by_arms_exports", "spread", ["sipri", "india"],
    "SIPRI-derived and therefore in TIV. Useful for rank, unusable as money."),
  wikiPage("Arms_industry", "method", ["export", "sipri"]),
];

interface Finding {
  id: string; kind: Kind; what: string; wants: Target["wants"]; url: string;
  ok: boolean; status: string; bytes: number | null;
  /** What the body turned out to be, as far as a script can tell. */
  shape?: "html" | "json" | "csv" | "xml-feed" | "pdf" | "js-app" | "empty" | "unknown";
  found?: string[]; missing?: string[];
  /** Sentences that look like they carry an export claim. Evidence of shape, not data. */
  claimsNearby?: string[];
  /** Links off the page that mention exports, so a 404 on a guessed path is recoverable. */
  exportLinks?: string[];
  note?: string;
}

/**
 * What did the server actually hand back?
 *
 * Checked before anything else, because "200 OK, 180kB" has meant an empty
 * React shell every other time this project probed an Indian government site,
 * and a probe that records only the status code reports that as a success and
 * sends the next session off to write a connector against nothing.
 */
export function shapeOf(body: string, contentHint: string): Finding["shape"] {
  const head = body.slice(0, 4000);
  if (body.length === 0) return "empty";
  if (head.startsWith("%PDF")) return "pdf";
  if (/^\s*[[{]/.test(head)) return "json";
  if (/<rss|<feed|<channel/i.test(head)) return "xml-feed";
  if (!/<html/i.test(head) && /^[^\n]*,[^\n]*\n/.test(head) && contentHint.includes("csv")) return "csv";
  if (/<html/i.test(head)) {
    // A shell: almost no prose, and a script tag doing the work.
    const text = body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    if (text.trim().length < 600 && /<script/i.test(body)) return "js-app";
    return "html";
  }
  if (/^[^\n]*,[^\n]*\n/.test(head)) return "csv";
  return "unknown";
}

/**
 * Sentences that look like an export claim.
 *
 * Recorded so a later session can see the phrasing an extractor will face, and
 * so "reachable" can be distinguished from "reachable and carrying the thing".
 * These are quotations of what a page says. They are not figures, nothing
 * downstream reads them, and the file says so in its own header.
 */
export function claimsNearby(body: string): string[] {
  const text = body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const out = new Set<string>();
  for (const raw of text.split(/(?<=[.!?])\s+/)) {
    const s = raw.trim();
    if (s.length < 30 || s.length > 300) continue;
    if (!/\bdefence export|\bdefense export|export authorisation|arms export/i.test(s)) continue;
    if (!/\d/.test(s)) continue;
    out.add(s);
    if (out.size >= 5) break;
  }
  return [...out];
}

/**
 * Links whose text or href mentions exports.
 *
 * Two of the targets above are guessed paths off a department root. When a
 * guess 404s the recovery is the root's own navigation, so it is harvested
 * here rather than guessed again next round — this project has burned two
 * probe rounds re-guessing slugs it could have read off a page it already had.
 */
export function exportLinks(body: string, base: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const href = m[1] ?? "";
    const label = (m[2] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!/export|annual.report|production/i.test(`${href} ${label}`)) continue;
    try {
      out.add(`${label.slice(0, 60)} -> ${new URL(href, base).toString().slice(0, 140)}`);
    } catch {
      // A malformed href is not worth failing a probe over.
    }
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

    const f: Finding = {
      id: t.id, kind: t.kind, what: t.what, wants: t.wants, url: t.url.slice(0, 130),
      ok: res.ok,
      status: res.ok ? "200" : (res.error ?? "failed"),
      bytes: res.ok ? body.length : null,
      ...(res.ok ? { shape: shapeOf(body, t.url) } : {}),
      ...(res.ok && t.look
        ? {
            found: t.look.filter((w) => lower.includes(w.toLowerCase())),
            missing: t.look.filter((w) => !lower.includes(w.toLowerCase())),
          }
        : {}),
      ...(t.note ? { note: t.note } : {}),
    };
    if (res.ok) {
      const claims = claimsNearby(body);
      if (claims.length > 0) f.claimsNearby = claims;
      if (t.kind === "mod" || t.kind === "portal" || t.kind === "dpsu") {
        const links = exportLinks(body, res.finalUrl ?? t.url);
        if (links.length > 0) f.exportLinks = links;
      }
    }
    findings.push(f);

    console.log(
      `  ${(f.ok ? "ok" : "dead").padEnd(5)} ${t.kind.padEnd(7)} ${f.id.padEnd(46)} ` +
      `${String(f.bytes ?? 0).padStart(8)}  ${f.shape ?? f.status}` +
      (f.claimsNearby ? `  claim: ${(f.claimsNearby[0] ?? "").slice(0, 70)}` : ""),
    );

    // Written after every target: a job that dies on target nine keeps eight.
    await mkdir(join(ROOT, "data", "live"), { recursive: true });
    await writeFile(OUT, JSON.stringify({
      probedAt: new Date().toISOString(),
      note:
        "Reachability and shape only. No figure is published from this file and nothing on " +
        "the site reads it. The `claimsNearby` strings are quotations of what a page says, " +
        "recorded so a later extractor knows what phrasing it will meet.",
      question:
        "Which publisher of India's defence export value and its destination-country spread " +
        "answers a script, and in what shape — HTML with the number in it, a PDF, a rendered " +
        "application, a query form, or a refusal?",
      whyNotTrade:
        "The HS6 customs files carry no partner dimension: the upstream ingest pins partner " +
        "to World because not pinning it splits every commodity into 215 rows. Country spread " +
        "is not difficult in that dataset, it is absent. And the MoD headline counts contract " +
        "value including services and offsets, which never cross a customs border at all.",
      priorFailure:
        "Fourteen Our World in Data arms-transfer slugs were probed across two earlier rounds " +
        "and every one returned 404. Only one OWID slug here is a candidate pair; the third " +
        "is a control on a slug known to work, so that a 404 can be told apart from an " +
        "unreachable host. Nothing is assumed about any OWID arms URL.",
      refusal:
        "Until one of these answers with a figure and a citation, this project states no " +
        "defence export value and no country count. The widely repeated numbers are exactly " +
        "the ones a model can recite from memory and get subtly wrong, and a wrong figure " +
        "with a confident citation is worse than an admitted gap.",
      unitsTrap:
        "SIPRI publishes TIV, a volume index designed for comparing transfer volumes over " +
        "time. It is not money and must never be placed in the same column as a rupee or " +
        "dollar contract value.",
      // When nothing at all answered, the run says so about itself rather than
      // leaving behind a file that reads as a verdict on twenty-two publishers.
      // A committed file listing SIPRI and Wikipedia as dead, written from a
      // sandbox whose proxy refuses every host, would be believed by the next
      // session and would retire two live sources on no evidence.
      ...(findings.length > 0 && findings.every((f) => !f.ok)
        ? {
            egress:
              "Every target failed, including Wikipedia and the OWID control slug that are " +
              "known to work. That is a blocked egress, not twenty-two dead publishers. " +
              "Nothing about any individual source can be concluded from this run; it must " +
              "be repeated from GitHub Actions before any finding here is acted on.",
          }
        : {}),
      findings,
    }, null, 2) + "\n", "utf8");
  }

  console.log("");
  for (const kind of ["mod", "portal", "pib", "sipri", "owid", "dpsu", "wiki"] as const) {
    const l = findings.filter((f) => f.kind === kind);
    if (l.length === 0) continue;
    const live = l.filter((f) => f.ok).length;
    const usable = l.filter((f) => f.ok && f.shape !== "js-app" && f.shape !== "empty").length;
    const carrying = l.filter((f) => (f.claimsNearby?.length ?? 0) > 0).length;
    console.log(
      `${kind.padEnd(8)} ${live}/${l.length} reachable, ${usable} not a rendered shell, ` +
      `${carrying} carrying a visible export claim`,
    );
  }

  const control = findings.find((f) => f.id === "owid-control-milex");
  const candidates = findings.filter((f) => f.kind === "owid" && f.id !== "owid-control-milex");
  if (control) {
    console.log(
      control.ok
        ? `\nOWID control answered, so ${candidates.filter((c) => !c.ok).length} of ` +
          `${candidates.length} candidate slugs failing means those slugs do not exist.`
        : "\nOWID control FAILED, so nothing can be concluded about the candidate slugs: " +
          "the host is unreachable from this runner.",
    );
  }

  console.log(`\nwrote ${OUT}`);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
