/**
 * Who publishes what about AI models, and about India's part in building them?
 *
 *   npm run ai:probe
 *
 * The ask is a tracker of LLM development and of what Indian startups are
 * building. Those are two different questions with two different evidence
 * bases, and the probe keeps them apart from the start.
 *
 * ── The model question, which is answerable ──────────────────────────────
 *
 * Model releases leave hard artifacts. A model on Hugging Face has an author,
 * a date, a licence, a parameter count and a download figure, all served as
 * JSON by an API that does not require a key. That is a real series: not "who
 * is winning", but who published what and when, which is the part that can be
 * sourced.
 *
 * ── The startup question, which mostly is not ────────────────────────────
 *
 * Funding rounds, valuations and headcounts come from Tracxn, Crunchbase and
 * trade press — paywalled, unciteable, and routinely wrong in the same
 * direction. This probe asks whether any of it is reachable, and expects the
 * answer to be no. What it looks for instead is the citable residue: a company
 * that has published a model has a Hugging Face page; one that has open-
 * sourced anything has a GitHub org; one funded by the IndiaAI Mission appears
 * in a government list. Those are weaker as a business picture and far
 * stronger as evidence, and a tracker built on them can say where every row
 * came from.
 *
 * ── What this file will not publish ──────────────────────────────────────
 *
 * No download counts, no parameter counts, no benchmark scores, no valuations.
 * Only whether a source answers, in what shape, and how many rows it carries.
 * A probe log that quotes "70B parameters" or "$41M raised" beside a URL is a
 * figure with a filename where a citation should be.
 */
import { join } from "node:path";
import { runProbe, type Target } from "./lib/probe-run";
import { isEntryPoint } from "./lib/entry";

const OUT = join(process.cwd(), "data", "live", "ai-probe.json");
const HF = "https://huggingface.co/api";
const WIKI = "https://en.wikipedia.org/w/api.php";

const wikiPage = (page: string, settles: string, look: string[] = []): Target => ({
  id: `wiki-${page.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 28)}`,
  kind: "wiki",
  what: `Wikipedia: ${page.replace(/_/g, " ")}`,
  url: `${WIKI}?action=parse&page=${encodeURIComponent(page)}&redirects=1&prop=wikitext&formatversion=2&format=json`,
  look,
  count: { tableRows: /^\s*\|-/gm, refs: /<ref/gi },
  settles,
});

/** A Hugging Face author listing, which is the strongest evidence available. */
const hfAuthor = (author: string, settles: string): Target => ({
  id: `hf-${author.toLowerCase()}`,
  kind: "huggingface",
  what: `Hugging Face models by ${author}`,
  url: `${HF}/models?author=${encodeURIComponent(author)}&limit=100&full=false&sort=downloads`,
  count: { entries: /"modelId"/g, dated: /"createdAt"/g },
  settles: `${settles} Each row carries an id, a creation date and a licence.`,
});

const TARGETS: Target[] = [
  // ── The model record ──────────────────────────────────────────────────
  {
    id: "hf-models-recent", kind: "huggingface",
    what: "Hugging Face, most-downloaded text-generation models",
    url: `${HF}/models?pipeline_tag=text-generation&sort=downloads&direction=-1&limit=100`,
    count: { entries: /"modelId"/g, dated: /"createdAt"/g },
    // Two different sorts must not return the same page, or the API is
    // ignoring its parameters and the "record" would be one arbitrary slice.
    paired: `${HF}/models?pipeline_tag=text-generation&sort=createdAt&direction=-1&limit=100`,
    settles: "Whether the model listing can be walked at all, and by which axes.",
  },
  {
    id: "hf-models-indic", kind: "huggingface",
    what: "Hugging Face, models tagged for Indian languages",
    url: `${HF}/models?filter=hi&sort=downloads&direction=-1&limit=100`,
    count: { entries: /"modelId"/g },
    paired: `${HF}/models?filter=ta&sort=downloads&direction=-1&limit=100`,
    settles: "Language coverage as a measurable thing rather than a claim.",
  },
  {
    id: "hf-datasets-ai4bharat", kind: "huggingface",
    what: "Hugging Face datasets by AI4Bharat",
    url: `${HF}/datasets?author=ai4bharat&limit=100`,
    count: { entries: /"id"/g },
    settles: "The corpus side: what Indian-language training data is public.",
  },
  hfAuthor("sarvamai", "Sarvam AI's published models."),
  hfAuthor("ai4bharat", "AI4Bharat's, the IIT Madras group behind IndicTrans and IndicBERT."),
  hfAuthor("krutrim-ai-labs", "Krutrim's, Ola's model group."),
  hfAuthor("BharatGPT", "Whether this name corresponds to a publishing author at all."),
  hfAuthor("CoRover", "BharatGPT's stated builder."),
  hfAuthor("TWO", "Two AI, publisher of SUTRA."),
  hfAuthor("tensoic", "One of the smaller Indian groups, as a test of the long tail."),
  hfAuthor("smallstepai", "Another, for the same reason."),
  hfAuthor("google", "A control: a large publisher whose count we can sanity-check against."),

  // ── The frontier record, for the benchmark half ───────────────────────
  {
    id: "epoch-models", kind: "frontier",
    what: "Epoch AI, notable AI models dataset",
    url: "https://epoch.ai/data/notable_ai_models.csv",
    count: { rows: /\n/g },
    settles:
      "Training compute, parameters and release dates for notable models, curated with sources. " +
      "The single best dataset for the development half if it is fetchable.",
  },
  {
    id: "epoch-api", kind: "frontier",
    what: "Epoch AI, data page",
    url: "https://epoch.ai/data/notable-ai-models",
    look: ["model", "compute"],
    settles: "Where the CSV lives, if the direct link has moved.",
  },
  {
    id: "arxiv-llm", kind: "frontier",
    what: "arXiv API, recent cs.CL submissions",
    url: "http://export.arxiv.org/api/query?search_query=cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=100",
    count: { entries: /<entry>/g },
    paired: "http://export.arxiv.org/api/query?search_query=cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=100",
    settles: "Publication volume as a proxy for research activity, by category and date.",
  },
  {
    id: "arxiv-india", kind: "frontier",
    what: "arXiv API, language-model papers naming Indian institutions",
    url: "http://export.arxiv.org/api/query?search_query=all:%22Indian%20Institute%20of%20Technology%22%20AND%20cat:cs.CL&max_results=100",
    count: { entries: /<entry>/g },
    settles: "Whether Indian research output is separable from the whole by a citable filter.",
  },

  // ── The Indian institutional record ───────────────────────────────────
  {
    id: "indiaai-home", kind: "india",
    what: "IndiaAI Mission",
    url: "https://indiaai.gov.in/",
    look: ["mission", "ai"],
    settles: "The government's own list of funded startups and compute allocations.",
  },
  {
    id: "indiaai-startups", kind: "india",
    what: "IndiaAI, startup listings",
    url: "https://indiaai.gov.in/ai-startups",
    look: ["startup"],
    settles: "A citable roster, if one is published rather than announced in a release.",
  },
  {
    id: "meity-ai", kind: "india",
    what: "MeitY, artificial intelligence",
    url: "https://www.meity.gov.in/artificial-intelligence",
    look: ["artificial intelligence"],
    settles: "Policy documents and the compute tender record.",
  },

  // ── The business record, which is expected to refuse ──────────────────
  {
    id: "tracxn-ai", kind: "business",
    what: "Tracxn, Indian AI startups",
    url: "https://tracxn.com/d/explore/artificial-intelligence-startups-in-india/",
    look: ["startup"],
    settles: "Funding and headcount, if any of it is reachable without a subscription.",
  },
  {
    id: "crunchbase-api", kind: "business",
    what: "Crunchbase, public entry point",
    url: "https://api.crunchbase.com/api/v4/searches/organizations",
    settles: "The same, and whether it needs a key this project does not have.",
  },
  {
    id: "nasscom", kind: "business",
    what: "NASSCOM",
    url: "https://nasscom.in/",
    look: ["technology"],
    settles: "Industry aggregates, which are reported rather than primary.",
  },

  // ── Encyclopaedic, as an index of what to look up ─────────────────────
  wikiPage("List_of_large_language_models",
    "A dated, sourced table of models — the cheapest possible spine for the development half.",
    ["parameters", "release"]),
  wikiPage("Artificial_intelligence_in_India",
    "Which Indian efforts are notable enough to have a citation trail at all.",
    ["India"]),
  wikiPage("Sarvam_AI", "Whether the individual companies have articles worth reading for citations."),
  wikiPage("Krutrim", "The same, for Ola's model group."),
];

export async function run(): Promise<void> {
  await runProbe(TARGETS, OUT, {
    question:
      "What can be sourced about LLM development, and about what Indian companies and labs are " +
      "actually building?",
    refusal:
      "No download count, parameter count, benchmark score, valuation or funding figure is " +
      "recorded here — only whether a source answers, in what shape, and how many rows it " +
      "carries. A probe log that quotes a figure beside a URL is a number with a filename where " +
      "a citation should be, and the next reader will treat it as sourced.",
    twoQuestions:
      "Model releases leave hard artifacts: an author, a date, a licence, a download count, " +
      "served as JSON without a key. Startup funding does not: it comes from paywalled trackers " +
      "and trade press. The eventual tracker must not present the second with the confidence of " +
      "the first, so this probe keeps them in separate kinds and expects the business sources to " +
      "refuse.",
    parameterCheck:
      "Any source taking a parameter is asked twice, for two different values, and the report " +
      "says whether the answers differed. PIB's release archive returned 844 KB and a 200 for " +
      "every date and turned out to ignore its query string entirely; a probe that asks once " +
      "cannot tell that apart from an archive that works.",
  });
}

if (isEntryPoint(import.meta.url)) {
  run().catch((err) => { console.error(err); process.exit(1); });
}
