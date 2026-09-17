/**
 * A workflow must not be able to publish less data than it started with.
 *
 * ── The shape of the failure ─────────────────────────────────────────────
 *
 * The OWID registry job clears its output directory, fetches for up to
 * forty-six minutes writing incrementally, and commits at the end with
 * `if: always()` so that a run killed by the workflow timeout keeps whatever
 * it managed to fetch. Each of those three decisions is right on its own.
 *
 * Together, with `cancel-in-progress: true`, they destroyed the registry. An
 * unrelated push cancelled a run ninety seconds in. By then it had deleted the
 * committed output and written one incremental pass of about fifty indicators
 * and no index. The commit step asked "did this run write anything", saw a
 * non-empty directory, and published it: 684 indicators replaced by 50, with
 * the index — the file that names them and carries their units and citations —
 * deleted outright. Shards without an index are inert, so the site read no
 * registry at all.
 *
 * Nothing failed. The workflow went green.
 *
 * ── What this test checks ────────────────────────────────────────────────
 *
 * Any workflow that both commits unconditionally and deletes before it writes
 * must not cancel its own runs, because a cancelled run then publishes a
 * deletion. That is a property of the pair, checkable from the files.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), ".github", "workflows");
let failures = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) failures++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${name}${ok || !detail ? "" : `\n        ${detail}`}`);
}

console.log("A cancelled run cannot publish a deletion");
for (const file of readdirSync(DIR).filter((f) => f.endsWith(".yml"))) {
  const yml = readFileSync(join(DIR, file), "utf8");
  const commitsAlways = /if:\s*always\(\)/.test(yml);
  const cancels = /cancel-in-progress:\s*true/.test(yml);
  if (!commitsAlways || !cancels) continue;

  /**
   * The exemption: a job whose script does not delete before it writes has
   * nothing to lose by being cancelled, because the worst it publishes is the
   * previous content unchanged.
   */
  const scripts = [...yml.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]!);
  check(
    `${file} commits on cancel, so it must not cancel its own runs`,
    false,
    `it has both \`if: always()\` and \`cancel-in-progress: true\`, and runs ${scripts.join(", ")}. `
      + "A run cancelled after its first write publishes a partial output over a complete one.",
  );
}

/**
 * The registry's own guard, checked directly rather than by inference: the
 * commit step must refuse a missing or empty index.
 */
{
  const yml = readFileSync(join(DIR, "owid.yml"), "utf8");
  check(
    "the registry commit refuses a missing index.json",
    /-s data\/owid\/index\.json/.test(yml),
    "without this, shards from a cut-short run replace a complete registry and the index is deleted",
  );
  check(
    "and refuses an index carrying no indicators",
    /indicators\.length/.test(yml),
    "an empty registry must never be published over a good one",
  );
  check("the registry job does not cancel itself", /cancel-in-progress:\s*false/.test(yml));
}

/**
 * And the connector's side of the same guarantee: the index is written by the
 * incremental writer, not only after the loop. If it is not, every partial
 * state on disk is a pile of unreadable shards and the guard above turns from
 * free into a way to lose a timed-out run.
 */
{
  const src = readFileSync(join(process.cwd(), "scripts/etl/connectors/owid.ts"), "utf8");
  const write = src.slice(src.indexOf("const write = async"), src.indexOf("const dropStaleShards"));
  check(
    "the incremental writer writes index.json too",
    write.includes("index.json"),
    "otherwise a run killed by the timeout leaves shards no reader can use",
  );
  check(
    "and the output directory is not cleared before the run",
    !/await rm\(OUT_DIR/.test(src),
    "clearing up front is what lets a cancelled run publish a deletion",
  );
}

console.log(failures === 0 ? "\nAll data-loss tests passed." : `\n${failures} data-loss test(s) failed.`);
if (failures > 0) process.exit(1);
