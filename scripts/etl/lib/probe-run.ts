/**
 * The plumbing every probe was writing for itself.
 *
 * A probe is a list of questions put to a list of publishers, and the loop
 * around it — fetch, classify, count, write after every target, summarise by
 * kind — was copied into each new probe with small divergences. The important
 * one was that some wrote the report only at the end, so a run killed by a
 * slow host left a log and no artifact. Writing after every target is not an
 * optimisation here; the file is the diagnosis.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getText } from "./http";
import { shapeOf, countOf, differs, type Shape } from "./probe-shape";

export interface Target {
  id: string;
  /** A grouping label, printed in the summary. */
  kind: string;
  what: string;
  url: string;
  /** Words the page must contain to be carrying what it claims to. */
  look?: string[];
  /** Named counts: how many times each pattern matches. Counts, never matches. */
  count?: Record<string, RegExp>;
  /**
   * Count against a string nested inside the JSON response, not the raw body.
   *
   * MediaWiki serves wikitext as a JSON string value, so every real newline in
   * it is the two characters backslash and n. A pattern anchored with `^` in
   * multiline mode can never match, and the first run of this probe duly
   * reported zero table rows for "List of large language models" — a page
   * that is almost entirely tables. The count was an artefact of the encoding
   * and would have been read as a finding about the source.
   *
   * Dotted path into the parsed body, e.g. "parse.wikitext".
   */
  decode?: string;
  /**
   * A second URL differing only in its parameters.
   *
   * If the two responses come back the same, the parameter is decorative and
   * the source cannot be walked — which is exactly the trap PIB's archive set.
   */
  paired?: string;
  /** Which part of the eventual dataset this source could settle. */
  settles: string;
}

export interface Finding {
  id: string; kind: string; what: string; url: string; settles: string;
  ok: boolean; status: string; bytes: number | null;
  shape?: Shape;
  found?: string[]; missing?: string[];
  counts?: Record<string, number>;
  /** Present only when `paired` was set: whether the parameter changed anything. */
  parameterWorks?: boolean;
  parameterNote?: string;
  note?: string;
}

export interface ProbeReport {
  probedAt: string;
  question: string;
  /** What this file deliberately does not publish. */
  refusal: string;
  [key: string]: unknown;
}

export async function runProbe(
  targets: Target[],
  out: string,
  header: Omit<ProbeReport, "probedAt">,
): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const t of targets) {
    const res = await getText(t.url, { cacheMs: 0, retries: 1, timeoutMs: 45_000 });
    const body = res.data ?? "";
    const f: Finding = {
      id: t.id, kind: t.kind, what: t.what, url: t.url.slice(0, 140), settles: t.settles,
      ok: res.ok,
      status: res.ok ? "200" : (res.error ?? "failed"),
      bytes: res.ok ? body.length : null,
    };
    if (res.ok) {
      f.shape = shapeOf(body);
      if (t.look) {
        const low = body.toLowerCase();
        f.found = t.look.filter((w) => low.includes(w.toLowerCase()));
        f.missing = t.look.filter((w) => !low.includes(w.toLowerCase()));
      }
      if (t.count) {
        let subject = body;
        if (t.decode) {
          try {
            let cur: unknown = JSON.parse(body);
            for (const key of t.decode.split(".")) {
              cur = (cur as Record<string, unknown> | undefined)?.[key];
            }
            if (typeof cur === "string") subject = cur;
            else f.note = `decode path "${t.decode}" did not reach a string; counted the raw body`;
          } catch {
            f.note = "the body is not JSON; counted it raw";
          }
        }
        f.counts = Object.fromEntries(
          Object.entries(t.count).map(([k, re]) => [k, countOf(subject, re)]),
        );
      }
      if (t.paired) {
        const other = await getText(t.paired, { cacheMs: 0, retries: 1, timeoutMs: 45_000 });
        if (!other.ok || !other.data) {
          f.parameterWorks = false;
          f.parameterNote = `the paired request failed: ${other.error ?? "no body"}`;
        } else {
          const v = differs(body, other.data);
          f.parameterWorks = v.differs;
          f.parameterNote = v.why;
        }
      }
    }
    findings.push(f);

    console.log(
      `  ${(f.ok ? "ok" : "dead").padEnd(5)} ${t.kind.padEnd(10)} ${f.id.padEnd(34)} ` +
      `${String(f.bytes ?? 0).padStart(8)}  ${(f.shape ?? "").padEnd(8)}` +
      `${f.counts ? "  " + Object.entries(f.counts).map(([k, v]) => `${k}=${v}`).join(" ") : ""}` +
      `${f.parameterWorks === false ? "  PARAMETER IGNORED" : f.parameterWorks ? "  parameter works" : ""}`,
    );

    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, JSON.stringify(
      { probedAt: new Date().toISOString(), ...header, findings }, null, 2) + "\n", "utf8");
  }

  const kinds = [...new Set(targets.map((t) => t.kind))];
  for (const kind of kinds) {
    const l = findings.filter((f) => f.kind === kind);
    const live = l.filter((f) => f.ok).length;
    const readable = l.filter((f) => f.ok && f.shape !== "js-app" && f.shape !== "empty").length;
    console.log(`\n${kind}: ${live} of ${l.length} answered, ${readable} in a readable shape`);
  }
  const ignored = findings.filter((f) => f.parameterWorks === false);
  if (ignored.length > 0) {
    console.log(
      `\n${ignored.length} source(s) returned the same answer for different parameters: ` +
      ignored.map((f) => f.id).join(", ") +
      "\nThose cannot be walked, whatever their status code said.",
    );
  }
  if (findings.every((f) => !f.ok)) {
    console.log(
      "\nEvery target refused. That is this sandbox's egress, not a wall of dead publishers — " +
      "nothing about any individual source can be concluded from this run.",
    );
  }
  return findings;
}
