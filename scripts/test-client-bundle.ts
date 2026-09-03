/**
 * No client component may reach a node builtin, however indirectly.
 *
 * A "use client" file that transitively imports node:fs fails the Turbopack
 * build with "the chunking context (unknown) does not support external modules
 * (request: node:fs)" — a message that names the builtin but not the component
 * that pulled it in, and not the import chain between them. That has now cost
 * two debugging rounds on this project: once when AtlasMap imported from
 * lib/census.ts, and again when ElectionMap imported from lib/elections.ts.
 * Both were fixed by splitting the pure half into a *-shared module.
 *
 * This walks the import graph from every client component and prints the chain
 * when it finds one, so the third time is a test failure with a path in it
 * rather than a build error without one.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const ROOT = process.cwd();
const ROOTS = ["app", "components", "lib", "scripts"];
const EXTS = [".ts", ".tsx"];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXTS.some((e) => p.endsWith(e))) out.push(p);
  }
  return out;
}

/** Local imports only — a bare specifier is a package, not our graph. */
function importsOf(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const specs = [...src.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)].map((m) => m[1]!);
  const out: string[] = [];
  for (const spec of specs) {
    let base: string | null = null;
    if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
    else if (spec.startsWith(".")) base = resolve(dirname(file), spec);
    if (base === null) continue;
    const hit = [...EXTS.map((e) => base + e), ...EXTS.map((e) => join(base!, "index" + e)), base]
      .find((c) => existsSync(c) && statSync(c).isFile());
    if (hit) out.push(hit);
  }
  return out;
}

const NODE_BUILTIN = /(?:from|import)\s*["'](node:[a-z_/]+)["']/;

/** Depth-first to the first builtin, returning the chain that reached it. */
function chainToBuiltin(entry: string): { builtin: string; chain: string[] } | null {
  const seen = new Set<string>();
  const stack: Array<{ file: string; chain: string[] }> = [{ file: entry, chain: [entry] }];
  while (stack.length > 0) {
    const { file, chain } = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const m = NODE_BUILTIN.exec(readFileSync(file, "utf8"));
    if (m) return { builtin: m[1]!, chain };
    for (const dep of importsOf(file)) stack.push({ file: dep, chain: [...chain, dep] });
  }
  return null;
}

const files = ROOTS.filter((r) => existsSync(join(ROOT, r))).flatMap((r) => walk(join(ROOT, r)));
const clients = files.filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")));

console.log(`\nClient bundle\n  ${clients.length} client component(s) checked`);
let bad = 0;
for (const c of clients) {
  const hit = chainToBuiltin(c);
  if (!hit) continue;
  bad++;
  console.log(`  FAIL ${c.replace(ROOT + "/", "")} reaches ${hit.builtin}`);
  for (const step of hit.chain.slice(1)) console.log(`         via ${step.replace(ROOT + "/", "")}`);
  console.log(`         split the pure half into a *-shared module, as lib/census-shared.ts does`);
}

if (bad > 0) {
  console.error(`\n${bad} client component(s) reach a node builtin.`);
  process.exit(1);
}
console.log("  ok   no client component reaches a node builtin");
