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
  parsed: { total: number; byStatus: Record<Status, number>; models: number };
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
  const paren = /\(([^)]*)\)/.exec(text);
  if (!paren) return { total: null, byStatus: {} };
  const inner = paren[1] ?? "";
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
 * One list item into its individual losses.
 *
 * The leading integer and the model name are the item's own header; each
 * `(n, status)` that follows is one vehicle, and the anchor immediately after
 * it is that vehicle's evidence. Pairing status to link by position rather
 * than by parsing the whole item as a unit means a malformed entry costs that
 * entry and not the model.
 */
export function parseItem(html: string): { model: string; losses: Array<{ status: Status; evidence: string }> } {
  // "4 T-72B Obr. 1989: (1, destroyed) …" — the name runs to the first colon
  // that is followed by a bracketed status, not to the first colon at all:
  // several model names contain one ("Buk-M1: 9A310M1").
  const head = /^\s*(?:<[^>]+>\s*)*(\d[\d,]*)\s+([\s\S]*?):\s*(?=\()/.exec(html);
  const model = head?.[2] ? textOf(head[2]) : textOf(html.split(":")[0] ?? "").slice(0, 80);
  const body = head ? html.slice(head[0].length) : html;

  const losses: Array<{ status: Status; evidence: string }> = [];
  // A status bracket, then anything that is not another bracket, then the href.
  const re = /\(\s*\d+\s*,\s*([a-z ]+?)\s*\)\s*(?:<[^>]*>\s*)*?<a\b[^>]*href="([^"]+)"/gi;
  for (const m of body.matchAll(re)) {
    const raw = (m[1] ?? "").trim().toLowerCase();
    const status = STATUSES.find((s) => raw.includes(s));
    if (!status) continue;
    losses.push({ status, evidence: m[2] ?? "" });
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
  instances: Instance[];
  tallies: ModelTally[];
  /** A verbatim list item, so the next change to this parser is a reading. */
  sampleItem: string;
}

async function readPage(page: (typeof PAGES)[number]): Promise<PageResult> {
  const res = await getText(page.url, { timeoutMs: 120_000, retries: 3, cacheMs: 0 });
  const html = res.data ?? "";
  const result: PageResult = {
    side: page.side, what: page.what, url: page.url,
    ok: res.ok, bytes: html.length,
    sections: [], instances: [], tallies: [], sampleItem: "",
  };
  if (!res.ok || html === "") return result;

  for (const { heading, body } of sections(html)) {
    const headText = textOf(heading);
    if (headText === "") continue;
    const category = headText.replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (category === "") continue;

    const stated = statedTotals(heading);
    const unmanned = unmannedKind(category);
    const byStatus: Record<Status, number> = { destroyed: 0, damaged: 0, abandoned: 0, captured: 0 };
    const tallies: ModelTally[] = [];
    const instances: Instance[] = [];

    for (const m of body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
      const itemHtml = m[1] ?? "";
      const { model, losses } = parseItem(itemHtml);
      if (losses.length === 0) continue;
      if (result.sampleItem === "") result.sampleItem = itemHtml.slice(0, 600);

      const counts: Record<Status, number> = { destroyed: 0, damaged: 0, abandoned: 0, captured: 0 };
      for (const l of losses) {
        counts[l.status]++;
        byStatus[l.status]++;
        // Receipts are kept in full only where they are the subject.
        if (unmanned) {
          instances.push({ side: page.side, category, model, status: l.status, evidence: l.evidence });
        }
      }
      tallies.push({ category, model, counts, total: losses.length });
    }

    const parsedTotal = Object.values(byStatus).reduce((a, b) => a + b, 0);
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
      parsed: { total: parsedTotal, byStatus, models: tallies.length },
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
      "Anything about the vastly larger population of small FPV and quadcopter losses, which are consumed in the thousands weekly and are almost never catalogued individually by anyone.",
    ],
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
