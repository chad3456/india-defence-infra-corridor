/**
 * Welfare scheme reach, by state, from the schemes that will say.
 *
 * Eleven scheme portals were probed. Most will not answer: MGNREGA, PM-JAY and
 * PMAY-Gramin refuse the connection outright, DPIIT and the PMJDY summary page
 * return JavaScript shells, and Ujjwala, eShram and Jal Jeevan return pages
 * that name states without putting them in a table anything can read.
 *
 * One answers properly. Jan Dhan publishes a statewise table — rural accounts,
 * urban accounts, the total, and deposits in crore — for every state and union
 * territory, in HTML, to a plain fetch. So that is what this reads, and the
 * page says that it is one scheme rather than implying it is the welfare
 * state.
 *
 * ── What an account is not ───────────────────────────────────────────────
 *
 * An account opened is not a person served. Jan Dhan counts accounts, one
 * household can hold several, and a dormant account counts the same as a
 * working one. The deposit figure beside it is the useful corrective: accounts
 * with money moving through them are doing something that accounts merely
 * opened are not. Both are carried, and neither is called beneficiaries.
 *
 * Columns are resolved by header, and the shape of every table read is written
 * into the output — parsing pages this machine cannot fetch has already cost
 * this project two rounds of guessing.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/schemes/jan-dhan.json");
const SOURCE = "https://pmjdy.gov.in/statewise-statistics";

/** Cells that are a number, allowing Indian separators and decimals. */
function num(cell: string): number | null {
  const t = cell.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

function cellsOf(rowHtml: string): string[] {
  return [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
    c[1]!.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
      .replace(/\s+/g, " ").trim());
}

export interface StateRow {
  state: string;
  ruralAccounts: number;
  urbanAccounts: number;
  totalAccounts: number;
  /** Balance held, in rupees crore. */
  croreDeposits: number | null;
}

interface Output {
  builtAt: string;
  source: string;
  /** Date the portal says the figures are as of, when it says. */
  asOf: string | null;
  rows: StateRow[];
  rejected: Array<{ label: string; reason: string }>;
  shape: { headers: string[]; rowWidths: Record<string, number>; sampleRows: string[][] } | null;
}

export async function run(opts: { onProgress?: (s: string) => void } = {}): Promise<{ errors: string[] }> {
  const log = opts.onProgress ?? (() => {});
  const errors: string[] = [];
  await mkdir(join(ROOT, "data/schemes"), { recursive: true });

  const res = await getText(SOURCE, { timeoutMs: 60_000, retries: 2, cacheMs: 0 });
  if (!res.ok || res.data === null) {
    errors.push(`schemes: jan-dhan: ${res.error ?? "no body"}`);
    log(`FAIL ${SOURCE}: ${res.error}`);
    return { errors };
  }
  const html = res.data;

  // The portal states an as-of date in prose; without it the figures are
  // undated, which for a running total is most of what they mean.
  const asOf = /as\s+on\s+([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4}|[0-9]{1,2}\s+\w+\s+[0-9]{4})/i
    .exec(html)?.[1] ?? null;

  const rowsHtml = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  const parsed = rowsHtml.map(cellsOf).filter((c) => c.length >= 4);

  // The header is the row naming a state column beside an account column.
  const headerRow = parsed.find((c) =>
    c.some((x) => /state|ut/i.test(x)) &&
    c.some((x) => /rural|urban|beneficiar/i.test(x)));
  const headers = headerRow ?? [];

  const idx = (want: RegExp): number => headers.findIndex((h) => want.test(h));
  const cState = idx(/state|ut/i);
  const cRural = idx(/rural/i);
  const cUrban = idx(/urban/i);
  const cTotal = idx(/total/i);
  const cDeposit = idx(/deposit|balance/i);

  const widths: Record<string, number> = {};
  for (const r of parsed) widths[String(r.length)] = (widths[String(r.length)] ?? 0) + 1;
  const shape = { headers, rowWidths: widths, sampleRows: parsed.slice(0, 3) };

  if (cState < 0 || cRural < 0 || cUrban < 0) {
    errors.push("schemes: jan-dhan: no header naming a state and rural/urban accounts");
    log("FAIL header not found; shape written for the next run");
    await writeFile(OUT, JSON.stringify(
      { builtAt: new Date().toISOString(), source: SOURCE, asOf, rows: [], rejected: [], shape },
      null, 2) + "\n", "utf8");
    return { errors };
  }

  const rows: StateRow[] = [];
  const rejected: Array<{ label: string; reason: string }> = [];
  for (const cells of parsed) {
    if (cells === headerRow) continue;
    const state = (cells[cState] ?? "").replace(/\*+$/, "").trim();
    if (state === "") continue;
    // The portal ends with a total row, which is not a state and would sit at
    // the top of every ranking.
    if (/^(total|grand\s*total|all\s*india)$/i.test(state)) continue;

    const rural = num(cells[cRural] ?? "");
    const urban = num(cells[cUrban] ?? "");
    if (rural === null || urban === null) {
      rejected.push({ label: state, reason: "rural or urban accounts did not read as a number" });
      continue;
    }
    const statedTotal = cTotal >= 0 ? num(cells[cTotal] ?? "") : null;
    const sum = rural + urban;

    // The table prints its own total, so the parse can be checked against it.
    // A column read one place off still yields a number; it does not yield a
    // number that adds up.
    if (statedTotal !== null && Math.abs(statedTotal - sum) > Math.max(2, sum * 0.001)) {
      rejected.push({
        label: state,
        reason: `rural + urban is ${sum.toLocaleString("en-IN")} but the table says ${statedTotal.toLocaleString("en-IN")}`,
      });
      continue;
    }

    rows.push({
      state, ruralAccounts: rural, urbanAccounts: urban,
      totalAccounts: statedTotal ?? sum,
      croreDeposits: cDeposit >= 0 ? num(cells[cDeposit] ?? "") : null,
    });
  }

  const out: Output = {
    builtAt: new Date().toISOString(), source: SOURCE, asOf, rows, rejected, shape,
  };
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");

  const accounts = rows.reduce((s, r) => s + r.totalAccounts, 0);
  log(`headers: ${headers.join(" | ").slice(0, 140)}`);
  log(`row widths: ${JSON.stringify(widths)}`);
  log(`states kept: ${rows.length}; refused: ${rejected.length}; as on ${asOf ?? "an unstated date"}`);
  log(`accounts across all states: ${accounts.toLocaleString("en-IN")}`);
  for (const r of rejected.slice(0, 10)) log(`  refused ${r.label}: ${r.reason}`);
  return { errors };
}

if (isEntryPoint(import.meta.url)) {
  run({ onProgress: (s) => console.log(s) }).then((r) => {
    for (const e of r.errors) console.error("ERROR " + e);
    console.log(`\nwrote ${OUT}`);
  });
}
