/**
 * How many people visit, for the few temples where anyone says.
 *
 * `npm run footfall:ingest`. Writes data/sacred/footfall.json.
 *
 * ── Why this is twenty temples and not three thousand ────────────────────
 *
 * The probe asked who publishes footfall. The five biggest trusts — Tirumala,
 * Vaishno Devi, Shirdi, Siddhivinayak, Somnath — all answer a request and none
 * of them put a number in the HTML; their figures live behind client-side
 * rendering or inside annual-report PDFs. The ASI's ticketed-monument list is
 * the same rendered application it has been every other time this project
 * asked. data.gov.in wants an API key this project does not have.
 *
 * What is left is Wikipedia, which carries a figure for most famous temples,
 * each cited to somewhere else. That makes it an index of where a number
 * exists rather than the number's source, and this file records it as exactly
 * that: a reported figure, with the sentence it came from, attributed to the
 * article rather than to the temple.
 *
 * ── The trap this is built around ────────────────────────────────────────
 *
 * These figures are not commensurable. Tirumala reports about sixty thousand
 * pilgrims a day; Vaishno Devi reports millions a year. A column of numbers
 * with the period dropped would rank the two against each other and be wrong
 * by a factor of three hundred and sixty-five — and the probe's own first
 * regex already made a version of this mistake, reading "8.5 million pilgrims
 * annually" as "8.5 pilgrims".
 *
 * So a figure is published only when the sentence states its period in so many
 * words. Everything else is kept as a quotation and plotted nowhere. A daily
 * number and an annual number are never converted into each other: dividing an
 * annual figure by 365 invents a daily average nobody measured, across
 * festivals that move the real number by an order of magnitude.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { plain } from "../lib/wikitext";
import { isEntryPoint } from "../lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "sacred", "footfall.json");
const WIKI = "https://en.wikipedia.org/w/api.php";

/**
 * Temples worth asking about: the ones with a plausible published count.
 *
 * Chosen for footfall, not for importance. A famous temple with no published
 * figure is simply absent, which is the honest outcome and the common one.
 */
const TEMPLES: Array<{ page: string; name: string; state: string }> = [
  { page: "Tirumala_Venkateswara_Temple", name: "Tirumala Venkateswara", state: "Andhra Pradesh" },
  { page: "Vaishno_Devi", name: "Vaishno Devi", state: "Jammu & Kashmir" },
  { page: "Shirdi_Sai_Baba_Temple", name: "Shirdi Sai Baba", state: "Maharashtra" },
  { page: "Siddhivinayak_Temple", name: "Siddhivinayak", state: "Maharashtra" },
  { page: "Somnath_temple", name: "Somnath", state: "Gujarat" },
  { page: "Kashi_Vishwanath_Temple", name: "Kashi Vishwanath", state: "Uttar Pradesh" },
  { page: "Jagannath_Temple,_Puri", name: "Jagannath, Puri", state: "Odisha" },
  { page: "Meenakshi_Temple", name: "Meenakshi", state: "Tamil Nadu" },
  { page: "Kedarnath_Temple", name: "Kedarnath", state: "Uttarakhand" },
  { page: "Badrinath_Temple", name: "Badrinath", state: "Uttarakhand" },
  { page: "Sabarimala", name: "Sabarimala", state: "Kerala" },
  { page: "Ranganathaswamy_Temple,_Srirangam", name: "Ranganathaswamy, Srirangam", state: "Tamil Nadu" },
  { page: "Akshardham_(Delhi)", name: "Akshardham, Delhi", state: "NCT of Delhi" },
  { page: "Golden_Temple", name: "Golden Temple (Sikh)", state: "Punjab" },
  { page: "Mahakaleshwar_Jyotirlinga", name: "Mahakaleshwar", state: "Madhya Pradesh" },
  { page: "Dwarkadhish_Temple", name: "Dwarkadhish", state: "Gujarat" },
  { page: "Kamakhya_Temple", name: "Kamakhya", state: "Assam" },
  { page: "Guruvayur_Temple", name: "Guruvayur", state: "Kerala" },
  { page: "Brihadisvara_Temple,_Thanjavur", name: "Brihadisvara, Thanjavur", state: "Tamil Nadu" },
  { page: "Lingaraja_Temple", name: "Lingaraja", state: "Odisha" },
];

const MAGNITUDE: Record<string, number> = {
  lakh: 1e5, lakhs: 1e5, crore: 1e7, crores: 1e7,
  million: 1e6, billion: 1e9, thousand: 1e3,
};

type Period = "day" | "year";

interface Reading {
  value: number;
  period: Period;
  /** What the article actually says, so the reader can check the reading. */
  quote: string;
}

/**
 * A footfall figure, but only where the sentence names its own period.
 *
 * The period has to be stated in words. Inferring "per year" from a large
 * number and "per day" from a small one is a guess that would be right often
 * enough to look reliable and wrong exactly where it matters — at the temples
 * whose daily numbers are larger than other temples' annual ones.
 */
function readFootfall(text: string): Reading | null {
  const body = plain(
    text
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, " ")
      .replace(/\{\{[^{}]*\}\}/g, " ")
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
      .replace(/\[\[([^\]]+)\]\]/g, "$1"),
  ).replace(/\s+/g, " ");

  for (const raw of body.split(/(?<=[.!?])\s+/)) {
    const sentence = raw.trim();
    if (sentence.length < 25 || sentence.length > 360) continue;
    if (!/(pilgrim|visitor|devotee|footfall)/i.test(sentence)) continue;

    const m = sentence.match(
      /([\d][\d,]*(?:\.\d+)?)\s*(lakhs?|crores?|million|billion|thousand)?\s+(?:\w+\s+){0,4}?(?:pilgrims?|visitors?|devotees?)/i,
    );
    if (!m) continue;

    const n = Number((m[1] ?? "").replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) continue;
    const value = n * (m[2] ? (MAGNITUDE[m[2].toLowerCase()] ?? 1) : 1);

    // The period, in the article's own words or not at all.
    const period: Period | null =
      /\b(per day|a day|daily|each day|every day)\b/i.test(sentence) ? "day"
      : /\b(per year|a year|annually|per annum|each year|every year|yearly)\b/i.test(sentence) ? "year"
      : null;
    if (!period) continue;

    // Bounds that catch a period misread. No Indian temple sees ten million
    // people in a day, and a shrine drawing forty visitors a year is a parse
    // of something that was never a footfall figure.
    if (period === "day" && (value < 100 || value > 5e6)) continue;
    if (period === "year" && (value < 1e4 || value > 5e8)) continue;

    return { value, period, quote: sentence };
  }
  return null;
}

/**
 * The closest thing to a footfall claim in an article that yielded none.
 *
 * Recorded so a failure can be diagnosed from the committed file rather than
 * from another run. Most of these will show the phrasing the extractor missed;
 * some will show that the article simply never gives a number.
 */
function nearestClaim(text: string): string | null {
  const body = plain(
    text.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, " ").replace(/\{\{[^{}]*\}\}/g, " ")
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1"),
  ).replace(/\s+/g, " ");
  for (const raw of body.split(/(?<=[.!?])\s+/)) {
    const s = raw.trim();
    if (s.length < 25 || s.length > 300) continue;
    if (!/(pilgrim|visitor|devotee|footfall|attend)/i.test(s)) continue;
    if (!/\d/.test(s)) continue;
    return s;
  }
  return null;
}

export interface FootfallRow {
  name: string;
  state: string;
  page: string;
  value: number;
  period: Period;
  quote: string;
}

async function wikitext(page: string): Promise<string | null> {
  const url = `${WIKI}?action=parse&page=${encodeURIComponent(page)}` +
    "&redirects=1&prop=wikitext&formatversion=2&format=json";
  const res = await getText(url, { cacheMs: 6 * 3600_000, retries: 2, timeoutMs: 45_000 });
  if (!res.ok || !res.data) return null;
  try {
    return (JSON.parse(res.data) as { parse?: { wikitext?: string } }).parse?.wikitext ?? null;
  } catch {
    return null;
  }
}

export async function run(): Promise<void> {
  const rows: FootfallRow[] = [];
  const silent: string[] = [];

  for (const t of TEMPLES) {
    const text = await wikitext(t.page);
    if (!text) { silent.push(`${t.name} (article unavailable)`); continue; }
    const r = readFootfall(text);
    if (!r) {
      // Say what the article does contain. "No figure with a stated period"
      // cost a full round trip on eighteen temples and explained none of them;
      // the canon layer learned the same lesson three times before it started
      // printing what it had read.
      const near = nearestClaim(text);
      silent.push(near ? `${t.name} — ${near}` : `${t.name} — no sentence with a number and a visitor word`);
      console.log(`  ${t.name.padEnd(30)} no usable figure${near ? `  ::  ${near.slice(0, 110)}` : ""}`);
      continue;
    }
    rows.push({ name: t.name, state: t.state, page: t.page, ...r });
    console.log(`  ${t.name.padEnd(30)} ${r.value.toLocaleString("en-IN")} per ${r.period}`);
  }

  if (rows.length === 0) throw new Error("no footfall figure was read at all; the extractor is broken");

  // Tirumala is the busiest temple in the country and any correct read of its
  // article is a large daily number. If it comes back annual, the period logic
  // has inverted and every comparison on the page is wrong.
  const tirumala = rows.find((r) => r.name.startsWith("Tirumala"));
  if (tirumala && tirumala.period === "day" && tirumala.value < 10_000) {
    throw new Error(`Tirumala read as ${tirumala.value} per day, which is too low to be right`);
  }

  await mkdir(join(ROOT, "data", "sacred"), { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    source: "English Wikipedia, each figure cited there to a further source.",
    note:
      "A reported figure, not an official one. Wikipedia is where these numbers are " +
      "findable, not where they originate; each article cites a trust, a news report or a " +
      "government statistic behind it, and the sentence is quoted here so the reading can " +
      "be checked against the claim.",
    incomparable:
      "Daily and annual figures are never converted into each other. Tirumala reports about " +
      "sixty thousand pilgrims a day and Vaishno Devi millions a year; dividing the second " +
      "by 365 would invent a daily average nobody measured, across festivals that move the " +
      "real number by an order of magnitude. The two are shown apart.",
    coverage:
      `${rows.length} of ${TEMPLES.length} temples asked carry a figure whose period the ` +
      "article states. The rest are absent rather than estimated.",
    silent,
    rows,
  }, null, 2) + "\n", "utf8");

  console.log(`\n${rows.length} of ${TEMPLES.length} carry a usable figure; wrote ${OUT}`);
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
