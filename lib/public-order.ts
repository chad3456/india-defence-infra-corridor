/**
 * Server-side loader for /protests: the curated record, checked figure by
 * figure against the text of its source before anything is drawn.
 *
 * A figure whose quote cannot be found in the document it cites — or whose
 * quote does not contain the figure — is dropped from its chart and listed on
 * the page as unverified. Nothing is drawn on trust.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { allCited, verify, type Cited, type ProbeDoc, type PublicOrderFile } from "./public-order-shared";

export type * from "./public-order-shared";

interface ProbeFile { probedAt: string; documents: ProbeDoc[] }

export interface PublicOrderView {
  file: PublicOrderFile;
  probedAt: string;
  /** Figures that passed, keyed by object identity. */
  ok: WeakSet<Cited>;
  failed: Array<{ where: string; why: string; src: string }>;
  checked: number;
  readAt: Record<string, string | undefined>;
}

let cached: PublicOrderView | null = null;

export function loadPublicOrder(): PublicOrderView {
  if (cached) return cached;
  const dir = join(process.cwd(), "data", "protests");
  const file = JSON.parse(readFileSync(join(dir, "public-order.json"), "utf8")) as PublicOrderFile;
  const probe = JSON.parse(readFileSync(join(dir, "public-order-probe.json"), "utf8")) as ProbeFile;
  const docs = new Map(probe.documents.filter((d) => d.ok).map((d) => [d.id, d]));
  const ok = new WeakSet<Cited>();
  const failed: PublicOrderView["failed"] = [];
  const all = allCited(file);
  for (const { where, c } of all) {
    const v = verify(c, docs, file.sources);
    if (v.ok) ok.add(c);
    else failed.push({ where, why: v.why, src: c.src });
  }
  const readAt: Record<string, string | undefined> = {};
  for (const id of Object.keys(file.sources)) readAt[id] = docs.get(id)?.readAt;
  cached = { file, probedAt: probe.probedAt, ok, failed, checked: all.length, readAt };
  return cached;
}
