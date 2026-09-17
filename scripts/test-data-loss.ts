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

/**
 * A commit step must clear its own output before it checks out a branch.
 *
 * Both commit paths save the run's output to a temporary directory, reset onto
 * the branch, and replay it. `git reset --hard` reverts tracked files and
 * leaves untracked ones alone — so a path this run created that the branch has
 * since begun tracking survives the reset, and the checkout then refuses to
 * clobber it and aborts.
 *
 * That is git protecting work it cannot see is already saved, and it is
 * invisible until the shapes diverge. The registry job ran cleanly for weeks,
 * then every indicator gained a map tier, the run began producing thirteen map
 * shards where the branch had four, and the nine new ones aborted the
 * checkout. 726 indicators and forty-seven minutes of a charity's bandwidth,
 * thrown away at the last line of the job, after the build had printed its
 * success.
 */
console.log("\nA commit step clears its output before checking out");
{
  const yml = readFileSync(join(DIR, "owid.yml"), "utf8");
  const before = yml.indexOf("rm -rf data/owid");
  const checkout = yml.indexOf('git checkout -q -B "$GITHUB_REF_NAME"');
  check(
    "the registry job removes data/owid before its checkout",
    before !== -1 && checkout !== -1 && before < checkout,
    "otherwise a shard this run created, which the branch has since started tracking, "
      + "aborts the checkout and the whole run is lost at the last step",
  );

  const sh = readFileSync(join(process.cwd(), ".github/scripts/commit-generated.sh"), "utf8");
  const rm = sh.indexOf('rm -f "$FILE"');
  const co = sh.indexOf('git checkout -q -B "$BRANCH"');
  check(
    "and the shared helper removes its file before its checkout",
    rm !== -1 && co !== -1 && rm < co,
    "same failure, one file at a time",
  );
}

console.log(failures === 0 ? "\nAll data-loss tests passed." : `\n${failures} data-loss test(s) failed.`);
if (failures > 0) process.exit(1);
