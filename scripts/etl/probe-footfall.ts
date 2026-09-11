/**
 * Who actually counts temple visitors, and will they tell a script?
 *
 * `npm run footfall:probe`. The request asked for visitor numbers on the
 * temple map. The book they were meant to come from has none — it is a
 * historical polemic — so the question becomes who publishes footfall at all.
 *
 * Three kinds of source, and they are not equally good:
 *
 *   The trusts. Tirumala, Vaishno Devi, Shirdi, Siddhivinayak and Somnath each
 *   administer one shrine and publish its own numbers, sometimes daily. This is
 *   the primary record and it covers perhaps a dozen temples in the country.
 *
 *   The state. The ASI ticket-counts its protected monuments and the Ministry
 *   of Tourism publishes them; several are temples. Audited, comparable across
 *   sites, and silent on every living temple that does not sell tickets —
 *   which is almost all of them.
 *
 *   Wikipedia. Carries a footfall figure for many famous temples, each cited to
 *   somewhere else. Useful as an index of where a number exists, never as the
 *   number itself.
 *
 * ── What this cannot become ──────────────────────────────────────────────
 *
 * A visitor column on a map of 3,466 sites. Whatever this returns will cover
 * tens of temples, not thousands, and a field that is populated for Tirumala
 * and empty for everything else is not a variable — it is a list of famous
 * places wearing a quantitative costume. The probe exists to find out how many
 * can be done properly, so the page can say "here are the twenty temples that
 * publish a count" instead of pretending to a national figure.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "./lib/http";
import { isEntryPoint } from "./lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "live", "footfall-probe.json");
const WIKI = "https://en.wikipedia.org/w/api.php";

interface Target {
  id: string;
  kind: "trust" | "state" | "wiki";
  what: string;
  url: string;
  /** Words that must appear for the page to be carrying a count. */
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
  // ── The trusts, who count their own pilgrims ──────────────────────────
  {
    id: "ttd-tirumala", kind: "trust",
    what: "Tirumala Tirupati Devasthanams",
    url: "https://www.tirumala.org/",
    look: ["darshan", "pilgrim"],
    note: "Publishes daily pilgrim and laddu counts. The largest footfall in the country.",
  },
  {
    id: "vaishno-devi", kind: "trust",
    what: "Shri Mata Vaishno Devi Shrine Board",
    url: "https://www.maavaishnodevi.org/",
    look: ["yatra", "pilgrim"],
    note: "Publishes annual yatra figures going back decades.",
  },
  {
    id: "shirdi-sai", kind: "trust",
    what: "Shri Saibaba Sansthan Trust, Shirdi",
    url: "https://www.sai.org.in/",
    look: ["darshan", "devotee"],
  },
  {
    id: "siddhivinayak", kind: "trust",
    what: "Shree Siddhivinayak Ganapati Temple Trust",
    url: "https://www.siddhivinayak.org/",
    look: ["darshan"],
  },
  {
    id: "somnath-trust", kind: "trust",
    what: "Shree Somnath Trust",
    url: "https://somnath.org/",
    look: ["darshan", "visitor"],
  },

  // ── The state, which ticket-counts what it protects ───────────────────
  {
    id: "ogd-asi-visitors", kind: "state",
    what: "data.gov.in: ASI monument-wise visitor statistics",
    url: "https://api.data.gov.in/catalog?format=json&filters%5Btitle%5D=monument&api-key=",
    look: ["monument"],
    note: "Needs an API key this project does not have. A 403 here is an answer, not a failure.",
  },
  {
    id: "tourism-stats", kind: "state",
    what: "Ministry of Tourism, India Tourism Statistics",
    url: "https://tourism.gov.in/market-research-and-statistics",
    look: ["statistic"],
    note: "Monument-wise domestic and foreign footfall, published annually as a PDF.",
  },
  {
    id: "asi-ticketed", kind: "state",
    what: "ASI list of ticketed monuments",
    url: "https://asi.nic.in/ticketed-monuments/",
    look: ["monument"],
    note: "The ASI's own site returned a rendered application last time it was asked for a table.",
  },

  // ── Wikipedia, as an index of where a number exists ───────────────────
  wikiPage("Tirumala_Venkateswara_Temple", ["pilgrims", "visitors", "daily"],
    "If the footfall is cited here, the citation names the primary source."),
  wikiPage("Vaishno_Devi", ["pilgrims", "yatra", "million"]),
  wikiPage("Kashi_Vishwanath_Temple", ["pilgrims", "visitors", "crore"]),
  wikiPage("Meenakshi_Temple", ["visitors", "pilgrims", "daily"]),
  wikiPage("Jagannath_Temple,_Puri", ["pilgrims", "visitors"]),
  wikiPage("Golden_Temple", ["visitors", "pilgrims", "daily"],
    "Not a Hindu temple; included because it is among the most visited religious sites in India and tests the method."),
  wikiPage("List_of_Hindu_temples_in_India", ["temple"]),
];

interface Finding {
  id: string; kind: string; what: string; url: string;
  ok: boolean; status: string; bytes: number | null;
  found?: string[]; missing?: string[];
  /** Numbers near a footfall word, as a hint that a count is really there. */
  numbers?: string[];
  note?: string;
}

/** Figures sitting next to a visitor word — evidence a count is on the page. */
function countsNear(body: string): string[] {
  const out = new Set<string>();
  const re = /([\d][\d,.]{2,})\s*(crore|lakh|million|billion)?\s*(?:\w+\s+){0,3}(pilgrims?|visitors?|devotees?|footfall)/gi;
  for (const m of body.matchAll(re)) {
    out.add(`${m[1]}${m[2] ? " " + m[2] : ""} ${m[3]}`.replace(/\s+/g, " ").trim());
    if (out.size >= 8) break;
  }
  return [...out];
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
    const numbers = res.ok ? countsNear(body) : [];

    const f: Finding = {
      id: t.id, kind: t.kind, what: t.what, url: t.url.slice(0, 110),
      ok: res.ok,
      status: res.ok ? "200" : (res.error ?? "failed"),
      bytes: res.ok ? body.length : null,
      ...(look ? { found: look.found, missing: look.missing } : {}),
      ...(numbers.length > 0 ? { numbers } : {}),
      ...(t.note ? { note: t.note } : {}),
    };
    findings.push(f);
    console.log(
      `  ${(f.ok ? "ok" : "dead").padEnd(5)} ${t.kind.padEnd(6)} ${f.id.padEnd(40)} ` +
      `${f.bytes ?? 0}${numbers.length > 0 ? `  counts: ${numbers.slice(0, 2).join(" / ")}` : ""}`,
    );

    await mkdir(join(ROOT, "data", "live"), { recursive: true });
    await writeFile(OUT, JSON.stringify({
      probedAt: new Date().toISOString(),
      note: "Reachability only. No figures are published from this file.",
      question:
        "Which temples publish a visitor count that a script can read, and from whom?",
      refusal:
        "Whatever this finds will cover tens of temples, not the 3,466 on the map. A visitor " +
        "field populated for Tirumala and empty everywhere else is not a variable, it is a " +
        "list of famous places wearing a quantitative costume. The page will say how many " +
        "temples publish a count, and name them, rather than implying a national figure.",
      findings,
    }, null, 2) + "\n", "utf8");
  }

  for (const kind of ["trust", "state", "wiki"]) {
    const l = findings.filter((f) => f.kind === kind);
    const live = l.filter((f) => f.ok).length;
    const withNumbers = l.filter((f) => (f.numbers?.length ?? 0) > 0).length;
    console.log(`\n${kind}: ${live} of ${l.length} reachable, ${withNumbers} carrying a visible count`);
  }
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
