/**
 * What has actually been published, by whom, in AI.
 *
 *   npm run ai:build
 *
 * ── Two questions, two evidence bases ────────────────────────────────────
 *
 * The ask is a tracker of LLM development and of what Indian startups are
 * building. Those are not the same question and the evidence for them is not
 * remotely comparable, so this file keeps them apart and says so.
 *
 * A model release leaves a hard artifact. A model on Hugging Face has an
 * author, a creation date, a licence, a task tag and a download figure, served
 * as JSON without a key. That is checkable: anyone can open the same URL and
 * see the same rows. Frontier development has Epoch AI's curated dataset of
 * notable models, with training compute and parameter counts and a citation
 * per row.
 *
 * Startup funding has none of that. Valuations and rounds come from Tracxn and
 * Crunchbase, both of which refused this pipeline outright — 403 and 401 — and
 * from trade press that reports the founders' own figures. The probe expected
 * that and got it. So there are no funding numbers here, and the page must not
 * imply there is a business picture underneath the model record.
 *
 * ── What a Hugging Face author is, and is not ────────────────────────────
 *
 * It is an account that has published model weights. It is not a company, not
 * a lab, and not a measure of whether anyone is doing AI work. A company
 * building applied AI on somebody else's model publishes nothing and is
 * invisible here — which is most of them. An absent author means no published
 * weights under that name, and nothing more than that.
 *
 * Two names in the probe returned zero models: "BharatGPT" and "tensoic". That
 * is recorded rather than dropped, because "this widely-named thing does not
 * publish under this name" is a finding about the naming, not a gap.
 *
 * ── Downloads ────────────────────────────────────────────────────────────
 *
 * Hugging Face's download figure is a rolling thirty-day count, not a
 * cumulative total, and it counts automated pulls. It is a usable ordering
 * signal and a bad absolute number, so it is stored as given and the page
 * ranks by it without ever printing it as an adoption figure.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../lib/http";
import { isEntryPoint } from "../lib/entry";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "ai", "models.json");
const HF = "https://huggingface.co/api";
const EPOCH = "https://epoch.ai/data/notable_ai_models.csv";

/**
 * The accounts to ask about.
 *
 * Indian labs first, then two controls. The controls exist so a reader can see
 * the scale the Indian rows sit at without this page having to assert it:
 * Google's count next to Sarvam's is the comparison, and neither number needs
 * a claim attached.
 *
 * `org` is stated here rather than parsed, because a Hugging Face account name
 * is not a company name and the mapping between them is not in the API.
 */
interface Lab {
  author: string;
  org: string;
  country: "India" | "control";
  /** What this account is, in one line. Stated, and checkable against the page. */
  note: string;
}

const LABS: Lab[] = [
  { author: "sarvamai", org: "Sarvam AI", country: "India",
    note: "Bengaluru lab funded under the IndiaAI Mission; publishes Indic-language models." },
  { author: "ai4bharat", org: "AI4Bharat", country: "India",
    note: "IIT Madras research group behind IndicTrans, IndicBERT and the IndicCorp datasets." },
  { author: "krutrim-ai-labs", org: "Krutrim", country: "India",
    note: "Ola's model group." },
  { author: "CoRover", org: "CoRover.ai", country: "India",
    note: "Builder of BharatGPT; publishes under this account rather than that name." },
  { author: "TWO", org: "Two AI", country: "India",
    note: "Publisher of the SUTRA family." },
  { author: "smallstepai", org: "SmallStep AI", country: "India",
    note: "Small Indian lab, included to test whether the long tail is visible at all." },
  { author: "BharatGPT", org: "BharatGPT", country: "India",
    note: "Probed because the name is widely used. No account publishes under it." },
  { author: "tensoic", org: "Tensoic", country: "India",
    note: "Probed for the same reason; returned nothing." },
  { author: "google", org: "Google", country: "control",
    note: "A control. Not an Indian lab — here so the scale of the rows above is visible." },
  { author: "meta-llama", org: "Meta", country: "control",
    note: "The same, for the most-downloaded open-weight family." },
];

interface Model {
  id: string;
  author: string;
  /** ISO date the repository was created. The closest thing to a release date. */
  createdAt: string | null;
  lastModified: string | null;
  /** Rolling thirty-day downloads as served. Never a cumulative total. */
  downloads: number | null;
  likes: number | null;
  /** The task tag, where the publisher set one. */
  task: string | null;
  license: string | null;
  /** Language tags, which is how Indic coverage is actually declared. */
  languages: string[];
  gated: boolean;
}

interface HfModel {
  id?: string; modelId?: string; createdAt?: string; lastModified?: string;
  downloads?: number; likes?: number; pipeline_tag?: string; tags?: string[];
  gated?: boolean | string;
}

/** ISO 639-1 codes for the scheduled languages, for counting Indic coverage. */
const INDIC = new Set([
  "hi", "bn", "te", "mr", "ta", "ur", "gu", "kn", "ml", "or", "pa", "as",
  "mai", "sa", "ne", "sd", "kok", "doi", "mni", "sat", "ks", "brx", "bho", "awa",
]);

function readModel(m: HfModel, author: string): Model {
  const tags = m.tags ?? [];
  const licence = tags.find((t) => t.startsWith("license:"));
  return {
    id: m.id ?? m.modelId ?? "",
    author,
    createdAt: m.createdAt ?? null,
    lastModified: m.lastModified ?? null,
    downloads: typeof m.downloads === "number" ? m.downloads : null,
    likes: typeof m.likes === "number" ? m.likes : null,
    task: m.pipeline_tag ?? null,
    license: licence ? licence.slice("license:".length) : null,
    // A two-letter tag is a language; everything else on a model card is a
    // library, a dataset, a licence or a keyword.
    languages: tags.filter((t) => /^[a-z]{2,3}$/.test(t)),
    gated: m.gated === true || m.gated === "auto" || m.gated === "manual",
  };
}

/**
 * RFC 4180 enough for Epoch's file.
 *
 * Written rather than imported because the alternative is a dependency for one
 * file, and because the failure mode of a naive split on commas is a row that
 * silently shifts by one column — every value lands under the wrong header and
 * nothing looks wrong until someone checks a number by hand.
 */
export function parseCsv(text: string): { header: string[]; rows: string[][]; dropped: number } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\n") { row.push(field); field = ""; rows.push(row); row = []; continue; }
    if (c === "\r") continue;
    field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  const header = rows.shift() ?? [];
  // A ragged row is a parse failure and is dropped rather than padded into
  // alignment — padding would put every later value under the wrong header.
  // The count is returned, because silently dropping rows is the same data
  // loss as silently misaligning them, only harder to notice.
  const kept = rows.filter((r) => r.length === header.length);
  return { header, rows: kept, dropped: rows.length - kept.length };
}

/** First header whose name contains all of the given words, case-insensitively. */
function columnOf(header: string[], ...words: string[]): number {
  const i = header.findIndex((h) => words.every((w) => h.toLowerCase().includes(w)));
  return i;
}

export async function run(): Promise<void> {
  // ── What Indian labs have published ───────────────────────────────────
  const labs: Array<Lab & { models: Model[]; note2?: string }> = [];
  for (const lab of LABS) {
    const url = `${HF}/models?author=${encodeURIComponent(lab.author)}&limit=500&full=true&sort=downloads&direction=-1`;
    const res = await getText(url, { cacheMs: 3600_000, retries: 2, timeoutMs: 60_000 });
    let models: Model[] = [];
    let note2: string | undefined;
    if (!res.ok || !res.data) {
      note2 = `Hugging Face did not answer for this author: ${res.error ?? "no body"}`;
    } else {
      try {
        const parsed = JSON.parse(res.data) as HfModel[];
        models = parsed.map((m) => readModel(m, lab.author)).filter((m) => m.id.length > 0);
      } catch {
        note2 = "the response was not JSON";
      }
    }
    if (models.length === 0 && !note2) {
      note2 = "No account publishes model weights under this name.";
    }
    labs.push({ ...lab, models, ...(note2 ? { note2 } : {}) });
    console.log(`  ${lab.author.padEnd(18)} ${String(models.length).padStart(4)} models${note2 ? `  — ${note2}` : ""}`);
  }

  // ── The frontier record ───────────────────────────────────────────────
  //
  // Epoch AI's notable-models dataset: one row per model, each with sources.
  // The schema is read from the file rather than assumed, and the column names
  // are written into the output — a connector that hard-codes a column index
  // breaks silently when an upstream file gains a column.
  const epoch = await getText(EPOCH, { cacheMs: 24 * 3600_000, retries: 2, timeoutMs: 120_000 });
  interface FrontierModel {
    name: string;
    /** As served: a multi-institution model lists every one, comma-joined. */
    organisation: string;
    /** The same, one country per organisation and in the same order. */
    country: string;
    /** Deduplicated countries, which is what a count of models per country needs. */
    countries: string[];
    published: string | null;
    parameters: string | null;
    trainingCompute: string | null;
  }
  let frontier: {
    columns: string[];
    rowCount: number;
    droppedRows: number;
    note: string;
    byCountry: Array<{ country: string; models: number }>;
    indiaModels: FrontierModel[];
    models: FrontierModel[];
  } = {
    columns: [], rowCount: 0, droppedRows: 0, note: "",
    byCountry: [], indiaModels: [], models: [],
  };

  if (!epoch.ok || !epoch.data) {
    frontier.note = `Epoch AI's dataset did not answer: ${epoch.error ?? "no body"}`;
  } else {
    const { header, rows, dropped } = parseCsv(epoch.data);
    const iName = columnOf(header, "model");
    const iOrg = columnOf(header, "organization") >= 0
      ? columnOf(header, "organization") : columnOf(header, "organisation");
    const iCountry = columnOf(header, "country");
    const iDate = columnOf(header, "publication", "date") >= 0
      ? columnOf(header, "publication", "date") : columnOf(header, "date");
    const iParams = columnOf(header, "parameters");
    const iCompute = columnOf(header, "training", "compute");

    const models: FrontierModel[] = rows
      .map((r) => {
        const country = iCountry >= 0 ? (r[iCountry] ?? "") : "";
        return {
          name: iName >= 0 ? (r[iName] ?? "") : "",
          organisation: iOrg >= 0 ? (r[iOrg] ?? "") : "",
          country,
          /**
           * A collaboration lists every institution and every country, comma-
           * joined and in the same order — StarCoder names thirty-seven of
           * them. Counting the raw string would make "United States of
           * America,United States of America,Canada,…" its own country. Split,
           * trim and deduplicate, so a model counts once per country.
           */
          countries: [...new Set(
            country.split(",").map((c) => c.trim()).filter((c) => c.length > 0),
          )],
          published: iDate >= 0 && r[iDate] ? r[iDate]! : null,
          parameters: iParams >= 0 && r[iParams] ? r[iParams]! : null,
          trainingCompute: iCompute >= 0 && r[iCompute] ? r[iCompute]! : null,
        };
      })
      .filter((m) => m.name.length > 0);

    const perCountry = new Map<string, number>();
    for (const m of models) for (const c of m.countries) {
      perCountry.set(c, (perCountry.get(c) ?? 0) + 1);
    }

    frontier = {
      columns: header,
      rowCount: models.length,
      droppedRows: dropped,
      note:
        "Epoch AI's notable AI models dataset, read as served. Column names are recorded above " +
        "because they are read by name rather than by position: a connector that hard-codes an " +
        "index breaks silently when the upstream file gains a column. A model with several " +
        "institutions counts once for each distinct country, so these columns overlap and do " +
        "not sum to the row count.",
      byCountry: [...perCountry.entries()]
        .map(([country, n]) => ({ country, models: n }))
        .sort((a, b) => b.models - a.models),
      indiaModels: models.filter((m) => m.countries.includes("India")),
      models,
    };
    console.log(
      `\n  epoch: ${frontier.rowCount} models, ${header.length} columns` +
      `${dropped > 0 ? `, ${dropped} ragged rows dropped` : ""}` +
      `\n  India-affiliated: ${frontier.indiaModels.length}` +
      `\n  top: ${frontier.byCountry.slice(0, 5).map((c) => `${c.country} ${c.models}`).join(", ")}`,
    );
    if (dropped > frontier.rowCount * 0.02) {
      console.warn(`  WARNING: ${dropped} rows did not parse. That is a reader fault, not a file fault.`);
    }
  }

  // ── Roll-ups, all of them arithmetic on the rows above ────────────────
  const indian = labs.filter((l) => l.country === "India");
  const allIndian = indian.flatMap((l) => l.models);
  const indicModels = allIndian.filter((m) => m.languages.some((t) => INDIC.has(t)));
  const byYear = new Map<number, number>();
  for (const m of allIndian) {
    if (!m.createdAt) continue;
    const y = Number(m.createdAt.slice(0, 4));
    if (Number.isFinite(y)) byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  const languageCounts = new Map<string, number>();
  for (const m of allIndian) {
    for (const t of m.languages) {
      if (INDIC.has(t)) languageCounts.set(t, (languageCounts.get(t) ?? 0) + 1);
    }
  }

  await mkdir(join(ROOT, "data", "ai"), { recursive: true });
  await writeFile(OUT, JSON.stringify({
    builtAt: new Date().toISOString(),
    sources: [
      "huggingface.co/api — model metadata as served, no key required.",
      "epoch.ai — notable AI models dataset, curated with a citation per row.",
    ],
    whatAnAuthorIs:
      "A Hugging Face author is an account that has published model weights. It is not a " +
      "company, and it is not a measure of whether anyone is doing AI work: a company building " +
      "applied AI on somebody else's model publishes nothing and is invisible here, which is " +
      "most of them. An absent author means no published weights under that name and nothing more.",
    noFunding:
      "There are no funding figures, valuations or headcounts on this page. Tracxn refused this " +
      "pipeline with a 403 and Crunchbase with a 401, and the rest of that record is trade press " +
      "reporting founders' own numbers. The model record is checkable; a business picture built " +
      "beside it would not be, and putting them together would lend the second the credibility " +
      "of the first.",
    downloadsNote:
      "Hugging Face's download figure is a rolling thirty-day count, not a cumulative total, and " +
      "it counts automated pulls. It orders models usefully and means little as an absolute " +
      "number, so it is stored as served and never printed as an adoption figure.",
    controlsNote:
      "Two non-Indian accounts are included as controls. They are marked as such and excluded " +
      "from every Indian total; they are there so the scale of the Indian rows is visible " +
      "without this page having to assert it.",
    labCount: indian.length,
    indianModelCount: allIndian.length,
    indicModelCount: indicModels.length,
    languagesCovered: [...languageCounts.entries()]
      .map(([code, n]) => ({ code, models: n }))
      .sort((a, b) => b.models - a.models),
    byYear: [...byYear.entries()].map(([year, n]) => ({ year, models: n })).sort((a, b) => a.year - b.year),
    labs,
    frontier,
  }, null, 2) + "\n", "utf8");

  console.log(
    `\n${allIndian.length} models across ${indian.filter((l) => l.models.length > 0).length} ` +
    `Indian accounts; ${indicModels.length} tagged with an Indian language.`,
  );

  const empty = indian.filter((l) => l.models.length === 0);
  if (empty.length > 0) {
    console.log(`  no published weights under: ${empty.map((l) => l.author).join(", ")}`);
  }
  if (allIndian.length === 0) {
    throw new Error(
      "No Indian account returned a single model. That is the API or the author list, not a " +
      "fact about Indian AI — the probe saw 14 from sarvamai alone.",
    );
  }
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
