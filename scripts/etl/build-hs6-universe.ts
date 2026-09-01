/**
 * Build the HS6 commodity universe, with official descriptions.
 *
 * `npm run trade:universe`. Two jobs, both of which the ingest depends on:
 *
 *  1. The list of six-digit codes to fetch. The trade endpoint caps at 500 rows
 *     and ignores `maxRecords`, so the only way to cover ~5,300 lines is to name
 *     them explicitly in batches — which requires knowing what they are.
 *
 *  2. The descriptions. The preview endpoint returns `cmdDesc: null` on every
 *     row, so the trade data cannot name its own products. Every label on the
 *     dashboard comes from this file instead.
 *
 * The combined `HS` classification is used rather than a single vintage,
 * because the ingest spans 2002 to 2024 and codes are created and retired
 * across four revisions in that window. A code that existed only under HS2002
 * still needs a name when its line is drawn.
 *
 * This also verifies the curated sector codes against the official
 * descriptions. A sector code whose description does not match its expectation
 * is reported and withheld rather than renamed — the failure mode being guarded
 * against is a chart with a confident title over the wrong product.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJson } from "./lib/http";
import { curatedCodes } from "../../lib/localisation-sectors";
import { CONCORDANCES } from "../../lib/localisation";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/trade/hs6-universe.json");
const REPORT = join(ROOT, "data/live/hs6-universe-report.json");

const REF = "https://comtradeapi.un.org/files/v1/app/reference/HS.json";

interface RefRow {
  id?: string;
  text?: string;
  parent?: string;
  isLeaf?: string;
  /** Comtrade spells this both ways across files. */
  aggrLevel?: number | string;
  aggrlevel?: number | string;
}
interface RefFile { results?: RefRow[] }

function level(r: RefRow): number {
  const v = r.aggrLevel ?? r.aggrlevel;
  return typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
}

async function main(): Promise<void> {
  console.log("Fetching the HS reference…");
  const res = await getJson<RefFile>(REF, { timeoutMs: 120_000, retries: 3, cacheMs: 24 * 3600_000 });
  if (!res.ok || !res.data?.results) {
    console.error(`Reference fetch failed: ${res.error ?? "no results"}`);
    process.exit(1);
  }

  const rows = res.data.results;
  console.log(`  ${rows.length} classification entries.`);

  const codes: Array<{ code: string; desc: string; chapter: string }> = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const id = typeof r.id === "string" ? r.id.trim() : "";
    // Six digits and nothing else. `aggrLevel` is the source's own answer to
    // "how deep is this code", so it is used rather than inferred from length.
    if (!/^\d{6}$/.test(id) || level(r) !== 6) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    codes.push({
      code: id,
      desc: (r.text ?? "").replace(/^\d{6}\s*[-–—]\s*/, "").trim(),
      chapter: id.slice(0, 2),
    });
  }
  codes.sort((a, b) => a.code.localeCompare(b.code));
  console.log(`  ${codes.length} six-digit lines.`);

  if (codes.length < 3000) {
    console.error(`Only ${codes.length} HS6 codes — the reference did not parse as expected. Refusing to write.`);
    process.exit(1);
  }

  // Verify the curated sector codes against what the source calls them.
  const byCode = new Map(codes.map((c) => [c.code, c]));
  const verified: Array<{ code: string; label: string; officialDesc: string }> = [];
  const rejected: Array<{ code: string; label: string; reason: string; officialDesc?: string }> = [];
  // A concordance id is synthetic -- it names a group of real codes rather
  // than a code the reference has ever heard of -- so it is checked through
  // its constituents. Each of those must exist and match the expectation.
  const conById = new Map(CONCORDANCES.map((c) => [c.id, c]));

  for (const c of curatedCodes()) {
    const con = conById.get(c.code);
    const parts = con ? con.codes : [c.code];

    const missing = parts.filter((p) => !byCode.has(p));
    if (missing.length === parts.length) {
      rejected.push({ code: c.code, label: c.label, reason: "not in the HS reference at all" });
      continue;
    }

    const live = parts.filter((p) => byCode.has(p));
    const mismatched = live.filter((p) => !c.expect.test(byCode.get(p)?.desc ?? ""));
    if (mismatched.length > 0) {
      rejected.push({
        code: c.code, label: c.label,
        officialDesc: mismatched.map((p) => `${p}: ${byCode.get(p)?.desc ?? ""}`).join(" | "),
        reason: `description does not match ${c.expect}`,
      });
      continue;
    }
    verified.push({
      code: c.code, label: c.label,
      officialDesc: live.map((p) => byCode.get(p)?.desc ?? "").join(" | "),
    });
  }

  await mkdir(join(ROOT, "data/trade"), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify({
      builtAt: new Date().toISOString(),
      source: REF,
      classification: "HS (combined across revisions)",
      codes: codes.map((c) => c.code),
      names: Object.fromEntries(codes.map((c) => [c.code, c.desc])),
    }) + "\n",
    "utf8",
  );
  await mkdir(join(ROOT, "data/live"), { recursive: true });
  await writeFile(
    REPORT,
    JSON.stringify({ builtAt: new Date().toISOString(), total: codes.length, verified, rejected }, null, 2) + "\n",
    "utf8",
  );

  console.log(`\nCurated sector codes: ${verified.length} verified, ${rejected.length} rejected.`);
  for (const r of rejected) {
    console.log(`  REJECT ${r.code} (${r.label}): ${r.reason}${r.officialDesc ? ` — source says "${r.officialDesc}"` : ""}`);
  }
  console.log(`\nWrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
