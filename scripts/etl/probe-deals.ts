/**
 * Who publishes India's defence contracts, and in what shape?
 *
 * `npm run deals:probe`. The ask is every defence deal, collaboration and
 * project sale signed by the Government of India since 2014. That is a real
 * and finite set — contracts above a threshold are announced — but it is
 * scattered across four publishers who each hold a different piece, and none
 * of them holds it as a table.
 *
 * ── Why this needs a probe at all ────────────────────────────────────────
 *
 * Because the numbers are recallable and wrong. Anyone who reads Indian
 * defence coverage can produce a plausible sentence about the Rafale contract,
 * the S-400 deal, the P-8I follow-ons, the emergency procurement tranches. The
 * plausible version is the danger: contract values get quoted variously as
 * signed value, as sanctioned cost, as AoN clearance, and in rupees or dollars
 * at whichever exchange rate flattered the headline. A deal ledger assembled
 * from memory would be wrong in exactly the way that is hardest to detect.
 *
 * So nothing is written until a source is read. This probe establishes which
 * publishers answer a script and what shape their pages are in.
 *
 * ── The four kinds of source, and what each can settle ───────────────────
 *
 *   The Cabinet Committee on Security clears the large acquisitions, and PIB
 *   announces the clearance. That gives a date and a value with government
 *   authority behind it, and it is the strongest single source.
 *
 *   The Defence Acquisition Council grants Acceptance of Necessity. An AoN is
 *   NOT a contract — it is permission to begin procuring — and conflating the
 *   two inflates any ledger badly, because many AoNs never become contracts.
 *
 *   MoD annual reports list contracts concluded in the year, in an appendix,
 *   in a PDF.
 *
 *   SIPRI's transfer database records deliveries rather than signatures, on a
 *   trend-indicator value that is deliberately not a price.
 *
 * Those four measure different things. The eventual ledger has to keep them
 * apart or it will silently add a clearance to a contract to a delivery.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { isEntryPoint } from "./lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "live", "deals-probe.json");
const WIKI = "https://en.wikipedia.org/w/api.php";

type Kind = "pib" | "mod" | "sipri" | "wiki" | "vendor";

interface Target {
  id: string;
  kind: Kind;
  what: string;
  url: string;
  /** Words the page must contain to be carrying what it claims to. */
  look?: string[];
  /** Which part of the ledger this source could settle. */
  settles: string;
}

const wikiPage = (page: string, look: string[], settles: string): Target => ({
  id: `wiki-${page.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
  kind: "wiki",
  what: `Wikipedia: ${page.replace(/_/g, " ")}`,
  url: `${WIKI}?action=parse&page=${encodeURIComponent(page)}&redirects=1&prop=wikitext&formatversion=2&format=json`,
  look,
  settles,
});

const TARGETS: Target[] = [
  // ── The government's own announcements ────────────────────────────────
  {
    id: "pib-rss-mod", kind: "pib",
    what: "PIB RSS, Ministry of Defence",
    url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
    look: ["defence", "item"],
    settles: "Contract signatures and CCS clearances, dated, but only the current window.",
  },
  {
    id: "pib-archive", kind: "pib",
    what: "PIB release archive",
    url: "https://www.pib.gov.in/allRel.aspx",
    look: ["release"],
    settles: "The back catalogue, if it can be addressed by date rather than by PRID.",
  },
  {
    id: "ddp-home", kind: "mod",
    what: "Department of Defence Production",
    url: "https://ddpmod.gov.in/",
    look: ["production", "defence"],
    settles: "Production value, indigenisation and the DPSU side of contracts.",
  },
  {
    id: "ddp-exports", kind: "mod",
    what: "DDP, defence exports",
    url: "https://ddpmod.gov.in/defence-exports",
    look: ["export"],
    settles: "Export authorisations and the destination spread the HS data cannot give.",
  },
  {
    id: "mod-annual", kind: "mod",
    what: "MoD annual reports index",
    url: "https://www.mod.gov.in/en/documents/annual-report",
    look: ["annual", "report"],
    settles: "Contracts concluded per year, in a PDF appendix.",
  },
  {
    id: "mod-home", kind: "mod",
    what: "Ministry of Defence",
    url: "https://www.mod.gov.in/",
    look: ["defence"],
    settles: "Navigation to the acquisition and DAP documents.",
  },

  // ── SIPRI, which records deliveries rather than signatures ────────────
  {
    id: "sipri-transfers", kind: "sipri",
    what: "SIPRI arms transfers database",
    url: "https://www.sipri.org/databases/armstransfers",
    look: ["transfer", "arms"],
    settles: "Deliveries by supplier and year — not contract values, and not signatures.",
  },
  {
    id: "sipri-register", kind: "sipri",
    what: "SIPRI trade register",
    url: "https://armstrade.sipri.org/armstrade/page/trade_register.php",
    look: ["register"],
    settles: "Ordered and delivered quantities per deal, the closest thing to a ledger.",
  },

  // ── Wikipedia, as an index of where a contract is citable ─────────────
  wikiPage("List_of_military_equipment_of_the_Indian_Army", ["procure", "order"],
    "Which types are on order, as an index of what to look up."),
  wikiPage("Defence_Acquisition_Council", ["Acceptance of Necessity", "council"],
    "What an AoN is, and why it is not a contract."),
  wikiPage("Make_in_India", ["defence", "manufacturing"],
    "The policy frame the collaborations sit inside."),
  wikiPage("Dassault_Rafale_procurement_by_India", ["contract", "2016"],
    "One well-documented contract, as a shape test for the others."),
  wikiPage("S-400_missile_system", ["India", "contract"],
    "A government-to-government deal with a disputed published value."),
  wikiPage("BrahMos", ["Philippines", "export", "contract"],
    "The clearest Indian defence export contract of the period."),
  wikiPage("Indian_Navy", ["indigenous", "commissioned"],
    "Domestic warship programmes, which are projects rather than purchases."),
  wikiPage("Hindustan_Aeronautics_Limited", ["contract", "order"],
    "The largest DPSU's order book."),

  // ── A vendor, to see whether industry sources are readable at all ─────
  {
    id: "hal-home", kind: "vendor",
    what: "Hindustan Aeronautics Limited",
    url: "https://hal-india.co.in/",
    look: ["aeronautics"],
    settles: "Order book announcements, if the site is not a rendered application.",
  },
];

interface Finding {
  id: string; kind: Kind; what: string; url: string; settles: string;
  ok: boolean; status: string; bytes: number | null;
  shape?: "html" | "js-app" | "pdf" | "xml-feed" | "json" | "empty";
  found?: string[]; missing?: string[];
  /** Whether a money-shaped figure appears at all — never which figure. */
  moneyMentions?: number;
  note?: string;
}

/**
 * How many money-shaped mentions a page carries, and not one of their values.
 *
 * Deliberately a count. A probe log that quotes "₹59,000 crore" beside a URL
 * is a figure with a filename where a citation should be, and the next person
 * to read it — including me — will treat it as sourced. The count says a
 * figure exists to go and read; it cannot be mistaken for the reading.
 */
function moneyMentions(body: string): number {
  const re = /(?:₹|Rs\.?|INR|US\$|\$)\s?[\d,]+(?:\.\d+)?\s*(?:crore|lakh|billion|million|bn|mn)?/gi;
  return [...body.matchAll(re)].length;
}

function shapeOf(body: string, contentType: string): Finding["shape"] {
  if (body.length < 200) return "empty";
  if (/^%PDF/.test(body) || /application\/pdf/i.test(contentType)) return "pdf";
  if (/^\s*[[{]/.test(body)) return "json";
  if (/<rss|<feed/i.test(body.slice(0, 600))) return "xml-feed";
  // A shell that ships no server-rendered prose is an application, not a page.
  const text = body.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").trim();
  if (text.length < body.length / 40) return "js-app";
  return "html";
}

export async function run(): Promise<void> {
  const findings: Finding[] = [];

  for (const t of TARGETS) {
    const res = await getText(t.url, { cacheMs: 0, retries: 1, timeoutMs: 45_000 });
    const body = res.data ?? "";
    const look = res.ok && t.look
      ? {
          found: t.look.filter((w) => body.toLowerCase().includes(w.toLowerCase())),
          missing: t.look.filter((w) => !body.toLowerCase().includes(w.toLowerCase())),
        }
      : null;

    const f: Finding = {
      id: t.id, kind: t.kind, what: t.what, url: t.url.slice(0, 110), settles: t.settles,
      ok: res.ok,
      status: res.ok ? "200" : (res.error ?? "failed"),
      bytes: res.ok ? body.length : null,
      ...(res.ok ? { shape: shapeOf(body, ""), moneyMentions: moneyMentions(body) } : {}),
      ...(look ? { found: look.found, missing: look.missing } : {}),
    };
    findings.push(f);
    console.log(
      `  ${(f.ok ? "ok" : "dead").padEnd(5)} ${t.kind.padEnd(7)} ${f.id.padEnd(42)} ` +
      `${String(f.bytes ?? 0).padStart(8)}  ${f.shape ?? ""}` +
      `${f.moneyMentions ? `  ${f.moneyMentions} money mentions` : ""}`,
    );

    await mkdir(join(ROOT, "data", "live"), { recursive: true });
    await writeFile(OUT, JSON.stringify({
      probedAt: new Date().toISOString(),
      note: "Reachability and shape only. No contract, value or date is published from this file.",
      question:
        "Which publishers hold India's defence contracts since 2014, and can a script read them?",
      refusal:
        "No figure is recorded here, only whether a figure exists on the page. A probe log that " +
        "quotes a contract value beside a URL is a number with a filename where a citation " +
        "should be, and it will be treated as sourced by the next person who reads it.",
      fourMeasures:
        "A CCS clearance, a DAC Acceptance of Necessity, a signed contract and a SIPRI delivery " +
        "are four different events. An AoN is permission to begin procuring and many never " +
        "become contracts, so a ledger that adds them together overstates itself badly. The " +
        "eventual dataset must keep them in separate columns.",
      findings,
    }, null, 2) + "\n", "utf8");
  }

  for (const kind of ["pib", "mod", "sipri", "wiki", "vendor"] as Kind[]) {
    const l = findings.filter((f) => f.kind === kind);
    if (l.length === 0) continue;
    const live = l.filter((f) => f.ok).length;
    const readable = l.filter((f) => f.ok && f.shape !== "js-app" && f.shape !== "empty").length;
    console.log(`\n${kind}: ${live} of ${l.length} answered, ${readable} in a readable shape`);
  }

  const allDead = findings.every((f) => !f.ok);
  if (allDead) {
    console.log(
      "\nEvery target refused. That is this sandbox's egress, not thirteen dead publishers — " +
      "nothing about any individual source can be concluded from this run.",
    );
  }
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
