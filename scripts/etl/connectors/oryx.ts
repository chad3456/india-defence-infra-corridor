/**
 * Every piece of equipment either side has been photographed losing.
 *
 * `npm run oryx:ingest`. Writes data/global/oryx.json. CI only — the editing
 * sandbox cannot reach oryxspioenkop.com.
 *
 * ── What this is, and why it is the only citable loss figure there is ────
 *
 * Both governments publish daily tallies of the other side's losses. Neither
 * can be checked by anyone, both are an order of magnitude apart from the
 * other's claim about the same battles, and a chart drawn over either is a
 * press release with axes.
 *
 * Oryx does something different: it lists one entry per individual vehicle,
 * each with a link to the photograph or video that shows it. A reader can
 * click any row and look at the thing. That makes the list an undercount by
 * construction — a vehicle nobody photographed is not in it — and that is
 * precisely what makes it usable. The bias has one direction and it is stated,
 * which is the most anyone can say about a casualty figure in a live war.
 *
 * ── The check that decides whether a number gets published ───────────────
 *
 * Oryx prints its own totals in every section heading:
 *
 *     Tanks (1234, of which destroyed: 800, damaged: 20, captured: 414)
 *
 * This connector parses the entries underneath and then compares its count to
 * that heading. If they disagree the section is recorded as failing its own
 * check and its figures are suppressed rather than published with a warning —
 * a parse that took the wrong bracket produces plausible numbers in the right
 * format, and plausible-and-wrong is worse than absent. The heading is a fact
 * the source states about itself, which is the strongest kind of check this
 * project has.
 *
 * ── Why one <li> is many losses ──────────────────────────────────────────
 *
 * The markup is one list item per *model*, carrying a numbered link per
 * individual vehicle:
 *
 *     <li>4 T-72B: (1, destroyed) <a href="…">1</a>, (2, captured) <a href="…">2</a>, …</li>
 *
 * So 679 list items on the Russian page carry around twenty-one thousand
 * losses between them. Parsing the list items and calling it a loss count
 * would understate the war by a factor of thirty, which is the kind of error
 * that looks like a plausible answer.
 *
 * ── What is kept per row, and what is summarised ─────────────────────────
 *
 * Full per-instance rows, with the evidence link, for the unmanned categories:
 * those are the subject and the receipts are the point. Everything else is
 * aggregated to model and status, because thirty-three thousand URLs is a five
 * megabyte file to make one bar chart taller.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";

const OUT = join(process.cwd(), "data/global/oryx.json");

const PAGES = [
  {
    side: "Russia",
    what: "Russian equipment losses, as photographed",
    url: "https://www.oryxspioenkop.com/2022/02/attack-on-europe-documenting-equipment.html",
  },
  {
    side: "Ukraine",
    what: "Ukrainian equipment losses, as photographed",
    url: "https://www.oryxspioenkop.com/2022/02/attack-on-europe-documenting-ukrainian.html",
  },
] as const;

/**
 * Every post Oryx has published, so "is there a drone list?" is a reading.
 *
 * The two loss lists above were typed in because they are the famous ones. But
 * the main lists turn out to carry almost no unmanned aircraft — a couple of
 * dozen combat drones against thirty-six thousand vehicles — and the obvious
 * next question is whether the drones are catalogued somewhere else on the
 * same site. Guessing URLs would answer that badly: a 404 from a guessed slug
 * is indistinguishable from a page that does not exist.
 *
 * Blogger publishes a post index as JSON. Asking it, and recording every post
 * whose title mentions an unmanned system, turns the guess into a finding
 * either way — including the finding that there is no such list.
 */
const BLOG_INDEX =
  "https://www.oryxspioenkop.com/feeds/posts/summary?alt=json&max-results=500";

const UNMANNED_TITLE = /\b(drone|uav|ucav|unmanned|loitering|shahed|lancet|orlan|bayraktar|fpv)\b/i;

interface BlogEntry { title?: { $t?: string }; link?: Array<{ rel?: string; href?: string }>; published?: { $t?: string } }
interface BlogFeed { feed?: { entry?: BlogEntry[]; openSearch$totalResults?: { $t?: string } } }

async function postIndex(): Promise<{
  total: number;
  posts: number;
  unmannedPosts: Array<{ title: string; url: string; published: string }>;
  note: string;
}> {
  const res = await getText(BLOG_INDEX, { timeoutMs: 60_000, retries: 2, cacheMs: 0 });
  if (!res.ok || !res.data) {
    return { total: 0, posts: 0, unmannedPosts: [], note: `post index failed: ${res.error ?? "no body"}` };
  }
  let feed: BlogFeed;
  try { feed = JSON.parse(res.data) as BlogFeed; }
  catch { return { total: 0, posts: 0, unmannedPosts: [], note: "post index did not parse as JSON" }; }
  const entries = feed.feed?.entry ?? [];
  const unmannedPosts: Array<{ title: string; url: string; published: string }> = [];
  for (const e of entries) {
    const title = e.title?.$t ?? "";
    if (!UNMANNED_TITLE.test(title)) continue;
    const url = e.link?.find((l) => l.rel === "alternate")?.href ?? "";
    unmannedPosts.push({ title, url, published: (e.published?.$t ?? "").slice(0, 10) });
  }
  const total = Number.parseInt(feed.feed?.openSearch$totalResults?.$t ?? "0", 10);
  return {
    total: Number.isFinite(total) ? total : 0,
    posts: entries.length,
    unmannedPosts,
    note: `${entries.length} of ${total} posts indexed, ${unmannedPosts.length} titled for an unmanned system`,
  };
}

/** The statuses Oryx uses. Anything else is recorded as seen and not counted. */
const STATUSES = ["destroyed", "damaged", "abandoned", "captured"] as const;
export type Status = (typeof STATUSES)[number];

/**
 * Which categories are unmanned, and which kind.
 *
 * Matched against the heading text rather than against a list of model names,
 * because Oryx groups by category and the category is the claim. `commercial`
 * is not a category Oryx has — no published loss list separates a hobby
 * quadcopter from a military one — and this file does not invent it. What it
 * can say is which categories are unmanned at all.
 */
function unmannedKind(heading: string): "uav" | "ucav" | "loitering" | null {
  const h = heading.toLowerCase();
  if (/unmanned combat aerial vehicle|ucav/.test(h)) return "ucav";
  if (/loitering munition/.test(h)) return "loitering";
  if (/unmanned aerial vehicle|\buavs?\b|reconnaissance drone/.test(h)) return "uav";
  return null;
}

export interface Instance {
  /** Which side lost it. */
  side: string;
  category: string;
  model: string;
  status: Status;
  /** The source's exact words, which may be compound: "damaged and captured". */
  statusAsWritten: string;
  /** The link Oryx gives as proof. Kept verbatim, never followed. */
  evidence: string;
}

export interface ModelTally {
  category: string;
  model: string;
  counts: Record<Status, number>;
  total: number;
}

export interface Section {
  heading: string;
  category: string;
  unmanned: "uav" | "ucav" | "loitering" | null;
  /** What the heading says about itself. */
  stated: { total: number | null; byStatus: Partial<Record<Status, number>> };
  /** What this parse found. */
  parsed: {
    total: number;
    byStatus: Record<Status, number>;
    models: number;
    /** Losses a model block claimed. */
    attributedToAModel: number;
    /** Losses counted in the section but claimed by no block — nesting, usually. */
    unattributed: number;
  };
  /** Whether the two agree. A section that fails is suppressed, not warned about. */
  agrees: boolean;
  why: string;
}

/** Strip tags and decode the handful of entities Blogger emits. */
export function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The totals a section heading states about itself.
 *
 * Oryx writes them as "Tanks (1234, of which destroyed: 800, damaged: 20…)".
 * The leading number is the section total and the rest is its breakdown. Both
 * are read; either may be absent on a section that has none.
 */
export function statedTotals(heading: string): Section["stated"] {
  const text = textOf(heading);
  // Sections write "Tanks (4447, of which destroyed: 3352, …)"; the two
  // page-level roll-ups write "Russia - 24098, of which: destroyed: 19065, …".
  // Both are read, because the roll-up is the check on the page as a whole.
  /**
   * The bracket that carries the totals, not the first bracket on the line.
   *
   * "Mine-Resistant Ambush Protected (MRAP) Vehicles (64, of which destroyed:
   * 48, …)" opens with an acronym. Taking the first bracket gave "MRAP", no
   * digits, and a section reported as stating no total — unverifiable, and
   * therefore suppressed, for a heading that states its total perfectly well.
   */
  const withTotals = [...text.matchAll(/\(([^)]*)\)/g)]
    .map((m) => m[1] ?? "")
    .filter((inner) => /\d/.test(inner) && /of which/i.test(inner));
  const dash = /[-–—]\s*(\d[\d,]*\s*,\s*of which[\s\S]*)$/i.exec(text);
  const inner = withTotals[withTotals.length - 1] ?? dash?.[1] ?? "";
  if (inner === "") return { total: null, byStatus: {} };
  const lead = /^\s*(\d[\d,]*)/.exec(inner);
  const byStatus: Partial<Record<Status, number>> = {};
  for (const s of STATUSES) {
    const m = new RegExp(`${s}\\s*:?\\s*(\\d[\\d,]*)`, "i").exec(inner);
    if (m?.[1]) byStatus[s] = Number.parseInt(m[1].replace(/,/g, ""), 10);
  }
  return {
    total: lead?.[1] ? Number.parseInt(lead[1].replace(/,/g, ""), 10) : null,
    byStatus,
  };
}

/**
 * One entry block into its individual losses.
 *
 * The markup is a <details>/<summary> pair per model, and each loss is an
 * anchor whose own text is the status:
 *
 *     <summary>… 2 T-54-3M:</summary>
 *     <a href="https://postimg.cc/zBC4NPVv">(1, destroyed)</a>
 *     <a href="https://postimg.cc/s29RHpfN">(1, damaged and abandoned)</a>
 *
 * The first version of this reader assumed the older layout, where the status
 * was plain text and the link followed it. That regex still matched almost
 * everything — by pairing each status with the *next* loss's link, and
 * dropping the last loss of every model because nothing followed it. The
 * result was a count 5% short and, far worse, every receipt attached to the
 * wrong vehicle. The section check caught it; nothing else would have, because
 * the numbers were plausible and the format was right.
 *
 * Both layouts are read now, link-wrapping first.
 */
/**
 * A loss is a status bracket. The anchor around it is its receipt.
 *
 * Tying the count to the anchor was wrong twice over. Any nested markup inside
 * the link — an underline, a span — broke the match, which is where the last
 * two to eight per cent went; and it cannot express the entries Oryx writes as
 * "(1 and 2, destroyed)", which are two vehicles in one photograph and count
 * as two in the source's own totals.
 *
 * So every bracket is found first, and the href is looked up afterwards by
 * walking back to the nearest unclosed anchor. A loss with no receipt this
 * parser could find is still a loss, counted and flagged, because the source's
 * total is the thing being checked against.
 */
const BRACKET = /\(\s*([\d\s,and&+\u2013\u2014-]*?\d)\s*,\s*([^)<]{3,40}?)\s*\)/gi;

/**
 * How many vehicles one bracket describes.
 *
 * "(1, destroyed)" is one. "(1 and 2, destroyed)" is two: Oryx uses it for two
 * vehicles visible in a single photograph, and counts both in the section
 * total. Reading it as one is the difference between agreeing with the source
 * and being quietly short.
 */
export function vehiclesIn(token: string): number {
  const numbers = token.match(/\d+/g);
  return Math.max(1, numbers?.length ?? 1);
}

/**
 * The receipt for a loss at a position: the anchor around it, or the next one.
 *
 * Both layouts are served by one rule. On the current pages the status sits
 * inside the link, so the enclosing anchor is the evidence. On the older ones
 * the link follows the status, so the next anchor is — but only if no further
 * status bracket comes between them, which would mean the link belongs to that
 * one instead. Returns "" rather than guessing, and a loss with no receipt is
 * still counted, because the source's own total is what this is checked
 * against.
 */
export function enclosingHref(html: string, at: number): string {
  const before = html.slice(0, at);
  const open = before.lastIndexOf("<a ");
  if (open >= 0 && before.lastIndexOf("</a>") < open) {
    const href = /href="([^"]+)"/i.exec(html.slice(open, at));
    if (href?.[1]) return href[1];
  }
  const after = html.slice(at);
  const next = /<a\b[^>]*href="([^"]+)"/i.exec(after);
  if (!next) return "";
  const gap = after.slice(0, next.index ?? 0);
  // Another status bracket in between means that link is the other loss's.
  if (/\(\s*\d[^)<]*,\s*[a-z][^)<]*\)/i.test(gap.replace(/^[^)]*\)/, ""))) return "";
  return next[1] ?? "";
}

/**
 * A compound status to the one it is counted under.
 *
 * Oryx writes "damaged and abandoned" and "damaged and captured". Each is one
 * vehicle and must be counted once. The outcome is taken as the later verb —
 * a vehicle that was damaged and then captured is, in the end, captured — and
 * the source's exact words are kept on the row so the choice is inspectable.
 */
export function classify(raw: string): Status | null {
  const s = raw.toLowerCase();
  if (s.includes("captured")) return "captured";
  if (s.includes("abandoned")) return "abandoned";
  if (s.includes("destroyed")) return "destroyed";
  if (s.includes("damaged")) return "damaged";
  return null;
}

export function parseItem(html: string): {
  model: string;
  losses: Array<{ status: Status; raw: string; evidence: string }>;
} {
  // The model name is in the <summary>, after a leading count and any flag
  // image, and ends at the colon.
  const summary = /<summary\b[^>]*>([\s\S]*?)<\/summary>/i.exec(html);
  const head = summary?.[1] ?? html.split(/<a\b/i)[0] ?? "";
  const named = /(\d[\d,]*)\s+([^:<]+?)\s*:/.exec(textOf(head));
  const model = named?.[2]?.trim() || textOf(head).replace(/^\d+\s*/, "").replace(/:$/, "").slice(0, 80);
  // Everything after the summary, so a model name containing a bracket cannot
  // be read as a loss.
  const body = summary ? html.slice((summary.index ?? 0) + summary[0].length) : html;

  const losses: Array<{ status: Status; raw: string; evidence: string }> = [];
  for (const m of body.matchAll(BRACKET)) {
    const raw = (m[2] ?? "").trim();
    const status = classify(raw);
    if (!status) continue;
    const evidence = enclosingHref(body, m.index ?? 0);
    for (let i = 0; i < vehiclesIn(m[1] ?? ""); i++) {
      losses.push({ status, raw, evidence });
    }
  }
  return { model, losses };
}

/** Headings, and the block of HTML that belongs to each. */
function sections(html: string): Array<{ heading: string; body: string }> {
  const out: Array<{ heading: string; body: string }> = [];
  const re = /<h3\b[^>]*>([\s\S]*?)<\/h3>/gi;
  const marks: Array<{ at: number; end: number; heading: string }> = [];
  for (const m of html.matchAll(re)) {
    marks.push({ at: m.index ?? 0, end: (m.index ?? 0) + m[0].length, heading: m[1] ?? "" });
  }
  for (const [i, mark] of marks.entries()) {
    const stop = marks[i + 1]?.at ?? html.length;
    out.push({ heading: mark.heading, body: html.slice(mark.end, stop) });
  }
  return out;
}

interface PageResult {
  side: string;
  what: string;
  url: string;
  ok: boolean;
  bytes: number;
  sections: Section[];
  /** The page-level totals the source states about itself. */
  rollUps: Array<{ heading: string; stated: Section["stated"] }>;
  instances: Instance[];
  tallies: ModelTally[];
  /** A verbatim list item, so the next change to this parser is a reading. */
  sampleItem: string;
}

async function readPage(page: (typeof PAGES)[number]): Promise<PageResult> {
  const res = await getText(page.url, { timeoutMs: 120_000, retries: 3, cacheMs: 0 });
  const html = res.data ?? "";
  const rollUps: Array<{ heading: string; stated: Section["stated"] }> = [];
  const result: PageResult = {
    side: page.side, what: page.what, url: page.url,
    ok: res.ok, bytes: html.length,
    sections: [], rollUps, instances: [], tallies: [], sampleItem: "",
  };
  if (!res.ok || html === "") return result;

  for (const { heading, body } of sections(html)) {
    const headText = textOf(heading);
    if (headText === "") continue;
    // Blogger's own page template emits headings built from JavaScript
    // fragments — "' + g + '" and similar. They are not sections.
    if (/^['"]?\s*\+|\+\s*['"]?$|posttitle/.test(headText)) continue;
    const category = headText.replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (category === "") continue;

    const stated = statedTotals(heading);
    /**
     * The two roll-up headings are page totals, not sections.
     *
     * "Russia - 24098, of which: destroyed: 19065…" and the armoured-vehicle
     * subtotal below it summarise the sections that follow; no entries sit
     * under them. Checked as sections they parse zero against a stated
     * twenty-four thousand and report as a catastrophic failure, which buries
     * the real ones. They are recorded as what they are.
     */
    const isRollUp = /^(russia|ukraine)\s*[-–—]/i.test(category)
      || /^losses of armoured combat vehicles/i.test(category);
    if (isRollUp) {
      rollUps.push({ heading: headText, stated });
      continue;
    }
    const unmanned = unmannedKind(category);
    const byStatus: Record<Status, number> = { destroyed: 0, damaged: 0, abandoned: 0, captured: 0 };
    const tallies: ModelTally[] = [];
    const instances: Instance[] = [];

    /**
     * One block type per section, whichever the page uses.
     *
     * Scanning both double-counted every loss on pages where a <details> sits
     * inside an <li>, which is most of them. Combined with the fallback bug
     * above, the parse came in at 3.8x the stated total — a factor so uniform
     * across every section that it could only be structural.
     */
    /**
     * The section total is counted over the whole section, not block by block.
     *
     * Blocks nest: a <details> inside a <details> makes a lazy regex stop at
     * the inner close tag and truncate the outer block, losing whatever came
     * after it. That is where the last two to eight per cent went, and it is
     * unfixable in general with regular expressions over HTML.
     *
     * So the count that gets checked against the source is a count of status
     * brackets across the entire section body, which no amount of nesting can
     * disturb. Blocks are used only to attribute losses to a model, and any
     * loss the blocks failed to claim is recorded as unattributed rather than
     * dropped — a number that does not add up should say so, not shrink.
     */
    const whole = parseItem(`<summary>${category}:</summary>${body}`);
    for (const l of whole.losses) byStatus[l.status]++;

    const details = [...body.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/gi)];
    const blocks = details.length > 0
      ? details
      : [...body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)];
    for (const m of blocks) {
      const itemHtml = m[1] ?? "";
      const { model, losses } = parseItem(itemHtml);
      if (losses.length === 0) continue;
      if (result.sampleItem === "") result.sampleItem = itemHtml.slice(0, 600);

      const counts: Record<Status, number> = { destroyed: 0, damaged: 0, abandoned: 0, captured: 0 };
      for (const l of losses) {
        counts[l.status]++;
        // Receipts are kept in full only where they are the subject.
        if (unmanned) {
          instances.push({
            side: page.side, category, model,
            status: l.status, statusAsWritten: l.raw, evidence: l.evidence,
          });
        }
      }
      tallies.push({ category, model, counts, total: losses.length });
    }

    const parsedTotal = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const attributed = tallies.reduce((a, b) => a + b.total, 0);
    /**
     * Agreement, within one per cent.
     *
     * Not exact equality: Oryx's headings are hand-maintained and lag the list
     * by an entry or two between edits, and a check that failed on a
     * one-in-two-thousand discrepancy would suppress every section forever. One
     * per cent is loose enough to survive that and far too tight to survive a
     * parse that took the wrong bracket, which is the failure this exists to
     * catch.
     */
    const target = stated.total;
    const drift = target && target > 0 ? Math.abs(parsedTotal - target) / target : 0;
    const agrees = target === null ? false : drift <= 0.01;
    result.sections.push({
      heading: headText,
      category,
      unmanned,
      stated,
      parsed: {
        total: parsedTotal, byStatus, models: tallies.length,
        attributedToAModel: attributed,
        unattributed: parsedTotal - attributed,
      },
      agrees,
      why: target === null
        ? "the heading states no total, so this parse cannot be checked against the source"
        : agrees
          ? `parsed ${parsedTotal} against a stated ${target}`
          : `parsed ${parsedTotal} against a stated ${target} — ${(drift * 100).toFixed(1)}% apart, so this section is suppressed`,
    });
    if (agrees) {
      result.tallies.push(...tallies);
      result.instances.push(...instances);
    }
  }
  return result;
}

async function main(): Promise<void> {
  const index = await postIndex();
  console.log(`Post index: ${index.note}`);
  for (const p of index.unmannedPosts.slice(0, 12)) console.log(`   ${p.published}  ${p.title.slice(0, 80)}`);

  const pages: PageResult[] = [];
  for (const p of PAGES) {
    const r = await readPage(p);
    pages.push(r);
    const good = r.sections.filter((s) => s.agrees);
    console.log(
      `${p.side}: ${r.bytes} bytes, ${r.sections.length} sections, ${good.length} agreed with their own heading, ` +
      `${r.tallies.reduce((a, b) => a + b.total, 0)} losses, ${r.instances.length} unmanned instances kept in full`,
    );
    for (const s of r.sections.filter((x) => !x.agrees)) {
      console.log(`   suppressed  ${s.category.slice(0, 44).padEnd(45)} ${s.why}`);
    }
  }

  const all = pages.flatMap((p) => p.tallies);
  const unmannedSections = pages.flatMap((p) =>
    p.sections.filter((s) => s.unmanned !== null && s.agrees).map((s) => ({ side: p.side, ...s })));

  const out = {
    builtAt: new Date().toISOString(),
    source:
      "Oryx (oryxspioenkop.com), 'Attack On Europe: Documenting Equipment Losses During The " +
      "2022 Russian Invasion Of Ukraine' and its Ukrainian counterpart. One entry per individual " +
      "vehicle, each linking to the photograph or video that confirms it.",
    method:
      "Every section's parsed count is compared with the total the section heading states about " +
      "itself. A section whose parse disagrees by more than one per cent is suppressed entirely " +
      "rather than published with a warning: a parse that took the wrong bracket produces " +
      "plausible numbers in the right format, and plausible-and-wrong is worse than absent. " +
      "Evidence links are kept in full for the unmanned categories and the rest is aggregated " +
      "to model and status.",
    undercount:
      "This is an undercount by construction and cannot be anything else. A vehicle nobody " +
      "photographed is not in it. The bias has one direction, which is what makes the list " +
      "citable, and it is NOT symmetric between the two sides: they are photographed by " +
      "different numbers of people, with different phones, under different rules about posting, " +
      "and by forces with different incentives to publicise a loss. Comparing one side's total " +
      "with the other's measures the photography as much as the war, and no chart built on this " +
      "file may present the ratio between them as a loss exchange rate.",
    refusal:
      "No casualty figure of any kind appears here. Oryx records equipment and this file records " +
      "equipment; nothing in it counts a person. No claim by either government is carried, no " +
      "total is reconciled against one, and no date of loss is recorded because the source does " +
      "not state one — an entry's evidence may be posted long after the event it shows.",
    cannotSay: [
      "When anything was lost. Oryx dates its entries by when the evidence surfaced, not by when the vehicle was hit, and this file records no date at all rather than implying one.",
      "Where anything was lost. No coordinates are published per entry.",
      "Whether a drone was commercial or military. No published loss list separates a hobby quadcopter from a purpose-built military airframe, and this file does not invent the distinction — it can only say which categories are unmanned.",
      "Anything about the vastly larger population of small FPV and quadcopter losses, which are almost never catalogued individually by anyone. The scale of that gap is the most important thing this file has to say, and it says it by absence: the unmanned categories here are a rounding error against the vehicle count, and that is a fact about what can be photographed and archived, not about what is being flown.",
    ],
    postIndex: index,
    counts: {
      pages: pages.length,
      sections: pages.reduce((a, p) => a + p.sections.length, 0),
      sectionsAgreed: pages.reduce((a, p) => a + p.sections.filter((s) => s.agrees).length, 0),
      sectionsSuppressed: pages.reduce((a, p) => a + p.sections.filter((s) => !s.agrees).length, 0),
      models: all.length,
      losses: all.reduce((a, b) => a + b.total, 0),
      unmannedInstances: pages.reduce((a, p) => a + p.instances.length, 0),
    },
    pages: pages.map((p) => ({
      side: p.side, what: p.what, url: p.url, ok: p.ok, bytes: p.bytes,
      sampleItem: p.sampleItem,
      rollUps: p.rollUps,
      sections: p.sections,
    })),
    unmannedSections,
    /** Per-model aggregates for everything that passed its check. */
    tallies: all,
    /** Per-vehicle rows, with the receipt, for the unmanned categories only. */
    unmannedInstances: pages.flatMap((p) => p.instances),
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(
    `\nWrote ${OUT}: ${out.counts.losses} losses across ${out.counts.models} models, ` +
    `${out.counts.sectionsAgreed} sections agreed, ${out.counts.sectionsSuppressed} suppressed.`,
  );
  if (out.counts.losses === 0) {
    throw new Error("no losses parsed — refusing to publish an empty file over a good one");
  }
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
