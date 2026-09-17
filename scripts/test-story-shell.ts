/**
 * A page in the story register must actually be in the story register.
 *
 * ── The failure this exists to catch ─────────────────────────────────────
 *
 * `.story` carries the register's three tone variables. A page that uses the
 * register's components without a `.story` ancestor does not error, does not
 * warn, and does not look broken — it looks plainer. Custom properties that
 * are not defined fall back to the property's initial value, and the two
 * initial values involved point in opposite directions:
 *
 *   fill:   var(--s-cool)  →  black          (visible, looks intentional)
 *   stroke: var(--s-cool)  →  none           (invisible)
 *
 * So on /growth-100 every sparkline lost its line and kept its two end dots.
 * A hundred panels rendered as a hundred pairs of dots, on a page whose entire
 * subject is change over time, and the markup was correct in all of them. It
 * survived a build, a typecheck, a full-page screenshot at two widths and an
 * overflow check. What found it was measuring one path's computed stroke.
 *
 * ── Why this test is static rather than rendered ─────────────────────────
 *
 * A DOM test would be the direct one, and it needs a browser that CI does not
 * have here. The route tree is enough: a page importing the register's kit
 * must have an ancestor layout that mounts the shell. That is the same
 * condition, checked one level up from the pixels.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";

const APP = join(process.cwd(), "app");
let failures = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) failures++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${name}${ok || !detail ? "" : `\n        ${detail}`}`);
}

/** Every page.tsx under app/, at any depth. */
function pages(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...pages(p));
    else if (e.name === "page.tsx") out.push(p);
  }
  return out;
}

/**
 * Walking up from a page's own folder to app/, does any layout mount the
 * shell? A layout that renders `<StoryShell>` is the wrapper; one that merely
 * imports it without rendering is not, which is why the check is on the tag.
 */
function shellAbove(pagePath: string): boolean {
  let dir = dirname(pagePath);
  for (;;) {
    const layout = join(dir, "layout.tsx");
    if (existsSync(layout) && /<StoryShell[\s>]/.test(readFileSync(layout, "utf8"))) return true;
    if (dir === APP) return false;
    dir = dirname(dir);
  }
}

console.log("Pages in the story register are inside it");
const KIT = /@\/components\/stories\/(Kit|Charts)/;
let checked = 0;
for (const page of pages(APP)) {
  const src = readFileSync(page, "utf8");
  if (!KIT.test(src)) continue;
  checked++;
  check(
    `/${relative(APP, dirname(page)) || ""} has a .story ancestor`,
    shellAbove(page),
    "it imports the story kit, so its tone variables are undefined without one: "
      + "every stroke becomes `none` and every fill becomes black, silently",
  );
}
check("the register has pages to check at all", checked > 0, `found ${checked}`);
console.log(`  ${checked} page(s) use the story kit`);

console.log(failures === 0 ? "\nAll story shell tests passed." : `\n${failures} story shell test(s) failed.`);
if (failures > 0) process.exit(1);
