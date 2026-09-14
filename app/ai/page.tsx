import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import {
  loadAi, publishingLabs, silentLabs, controls, span, languageName,
} from "@/lib/ai";

/**
 * Two records of Indian AI that disagree, and the disagreement is the story.
 *
 * ── The lead ─────────────────────────────────────────────────────────────
 *
 * Six Indian accounts have published 178 models on Hugging Face, 107 of them
 * tagged with an Indian language, covering twelve of the scheduled languages
 * or more. On Epoch AI's dataset of notable models — the one used to talk
 * about frontier development — two of 1,065 name India at all, and only one of
 * those is solely Indian: a 2018 LSTM from the University of Hyderabad.
 *
 * Both numbers are right. They measure different things, and a page that
 * picked one would be an argument rather than a record. The published-weights
 * count measures output; Epoch's "notable" is a judgement about significance,
 * weighted towards training compute, and India's models are small, adapted and
 * language-specific rather than frontier-scale. The interesting question is
 * whether that is a stage or a ceiling, and this page cannot answer it — but
 * it can put both numbers on the same screen and say what each one counts.
 *
 * ── Why there are no funding figures ─────────────────────────────────────
 *
 * Because they could not be sourced. Tracxn refused this pipeline with a 403
 * and Crunchbase with a 401, and the remainder of that record is trade press
 * reporting founders' own numbers. Every figure here is one anybody can
 * reproduce by opening the same URL, and mixing in a valuation would lend it
 * the same standing.
 *
 * ── Why the controls are on the page ─────────────────────────────────────
 *
 * Google's account and Meta's are shown beside the Indian ones. Not to
 * belittle anything — to give the reader the scale without this page having to
 * assert it in a sentence they would have to take on trust.
 */

export const metadata = {
  title: "AI in India · Bharat Tracker",
  description:
    "What Indian labs have actually published, from the Hugging Face API, set against the " +
    "frontier record — with no funding figures, because none could be sourced.",
};

function Bar({ value, max, colour = "var(--series-1)" }: { value: number; max: number; colour?: string }) {
  return (
    <span className="block h-[10px] rounded-sm" style={{
      width: `${max > 0 ? Math.max(value > 0 ? 1.5 : 0, (value / max) * 100) : 0}%`,
      background: colour,
    }} />
  );
}

export default function AiPage() {
  const d = loadAi();

  if (!d.present) {
    return (
      <div>
        <PageHeader
          eyebrow="technology · models and who publishes them"
          title="AI in India"
          lede="What Indian labs have published, from the registries that serve it as data."
        />
        <p className="mt-8 max-w-[56ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
          The record has not been built in this deployment. It is assembled in CI, because
          huggingface.co cannot be reached from the editing sandbox. Run the{" "}
          <span className="mono">Build the AI model record</span> workflow, or{" "}
          <span className="mono">npm run ai:build</span> somewhere with network access.
        </p>
      </div>
    );
  }

  const labs = publishingLabs(d);
  const silent = silentLabs(d);
  const ctrl = controls(d);
  const maxLab = Math.max(1, ...labs.map((l) => l.models.length), ...ctrl.map((l) => l.models.length));
  const maxLang = Math.max(1, ...d.languagesCovered.map((l) => l.models));
  const maxYear = Math.max(1, ...d.byYear.map((y) => y.models));
  const topCountries = d.frontier.byCountry.slice(0, 10);
  const maxCountry = Math.max(1, ...topCountries.map((c) => c.models));
  const indiaFrontier = d.frontier.indiaModels.length;

  return (
    <div>
      <PageHeader
        eyebrow="technology · models and who publishes them"
        title="AI in India"
        lede={
          <>
            What Indian labs have actually published, read from the registries that serve it as
            data. No funding figures, no valuations, no headcounts — see below for why.
          </>
        }
        stats={[
          { k: "Models published", v: String(d.indianModelCount) },
          { k: "Tagged Indic", v: String(d.indicModelCount) },
          { k: "Languages", v: String(d.languagesCovered.length) },
          { k: "Notable models naming India", v: `${indiaFrontier} of ${d.frontier.rowCount}` },
        ]}
      />

      {/* ── The two records ───────────────────────────────────────────── */}
      <section className="mt-10 grid gap-5 sm:grid-cols-2">
        <div className="rounded-lg border border-[color:var(--baseline)] bg-[var(--surface-2)] p-5">
          <p className="eyebrow">published weights</p>
          <p className="display mt-3 text-[54px] leading-none tracking-tight">{d.indianModelCount}</p>
          <p className="mt-2.5 text-[13px] leading-[1.6] text-[color:var(--text-secondary)]">
            models from {labs.length} Indian accounts on Hugging Face, {d.indicModelCount} of them
            tagged with an Indian language. Anyone can open the same API and count the same rows.
          </p>
        </div>
        <div className="rounded-lg border border-[color:var(--baseline)] bg-[var(--surface-2)] p-5">
          <p className="eyebrow">notable models naming India</p>
          <p className="display mt-3 text-[54px] leading-none tracking-tight">
            {indiaFrontier}
            <span className="ml-2 align-baseline text-[20px] tracking-normal text-[color:var(--text-secondary)]">
              of {d.frontier.rowCount}
            </span>
          </p>
          <p className="mt-2.5 text-[13px] leading-[1.6] text-[color:var(--text-secondary)]">
            on Epoch AI&rsquo;s curated dataset of notable models — the one used to discuss
            frontier development — and only {indiaFrontier > 1 ? "one of those is" : "that one is"}{" "}
            solely Indian.
          </p>
        </div>
      </section>

      <p className="mt-5 max-w-[64ch] text-[13.5px] leading-[1.75]">
        Both numbers are right, and they measure different things. The first counts output; the
        second counts significance, on a judgement weighted heavily towards training compute.
        India&rsquo;s published models are small, adapted and language-specific rather than
        frontier-scale. Whether that is a stage or a ceiling is a real question and this page
        cannot settle it — what it can do is put both counts on one screen and say exactly what
        each one counts.
      </p>

      {/* ── Who publishes ─────────────────────────────────────────────── */}
      <section className="mt-14 border-t pt-12">
        <h2 className="display text-[28px] leading-tight sm:text-[34px]">Who publishes</h2>
        <p className="mt-3 max-w-[60ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
          {d.whatAnAuthorIs}
        </p>
        <div className="mt-7 space-y-4">
          {labs.map((l) => {
            const s = span(l.models);
            return (
              <div key={l.author} className="border-b border-[color:var(--hairline)] pb-4 last:border-b-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[14px] font-semibold">{l.org}</span>
                  <a
                    href={`https://huggingface.co/${l.author}`}
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                    className="mono link-underline text-[11px] text-[color:var(--text-muted)]"
                  >
                    {l.author}
                  </a>
                  <span className="mono ml-auto text-[15px]">{l.models.length}</span>
                </div>
                <div className="mt-2"><Bar value={l.models.length} max={maxLab} /></div>
                <p className="mt-2 max-w-[70ch] text-[12.5px] leading-[1.55] text-[color:var(--text-secondary)]">
                  {l.note}
                  {s.first && (
                    <> First published {s.first.slice(0, 7)}, most recent {s.last?.slice(0, 7)}.</>
                  )}
                </p>
              </div>
            );
          })}
        </div>

        {ctrl.length > 0 && (
          <div className="mt-8 rounded-md border border-dashed border-[color:var(--baseline)] p-4">
            <p className="eyebrow">for scale · not Indian, not counted in any total above</p>
            <div className="mt-3 space-y-3">
              {ctrl.map((c) => (
                <div key={c.author}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px]">{c.org}</span>
                    <span className="mono text-[13px]">{c.models.length}</span>
                  </div>
                  <div className="mt-1.5">
                    <Bar value={c.models.length} max={maxLab} colour="var(--text-muted)" />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] leading-[1.55] text-[color:var(--text-muted)]">
              {d.controlsNote} Both are capped by the API&rsquo;s page limit, so their real counts
              are higher than shown — which only widens the gap.
            </p>
          </div>
        )}

        {silent.length > 0 && (
          <p className="mt-6 max-w-[64ch] text-[12.5px] leading-[1.65] text-[color:var(--text-muted)]">
            Asked and found nothing: {silent.map((l) => l.author).join(", ")}. That is a finding
            about the name rather than a gap — BharatGPT&rsquo;s weights are published by CoRover,
            under its own account. A company with no published weights is invisible to this
            method, and most companies doing AI work have none.
          </p>
        )}
      </section>

      {/* ── Languages: the strongest thing in the record ──────────────── */}
      {d.languagesCovered.length > 0 && (
        <section className="mt-14 border-t pt-12">
          <h2 className="display text-[28px] leading-tight sm:text-[34px]">
            Which languages have models
          </h2>
          <p className="mt-3 max-w-[60ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
            Models tagged with each language by their own publisher. This is the clearest thing
            the record says: the work that exists is overwhelmingly about Indian languages, which
            is a different bet from competing at frontier scale. A tag is a publisher&rsquo;s
            claim, not a benchmark — it says a model was meant for the language, not that it is
            good at it.
          </p>
          <div className="mt-7 space-y-2.5">
            {d.languagesCovered.map((l) => (
              <div key={l.code} className="flex items-center gap-3">
                <span className="w-[6.5rem] shrink-0 text-[12.5px]">{languageName(l.code)}</span>
                <span className="min-w-0 flex-1"><Bar value={l.models} max={maxLang} /></span>
                <span className="mono w-[2.5rem] shrink-0 text-right text-[12px]">{l.models}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── When ──────────────────────────────────────────────────────── */}
      {d.byYear.length > 0 && (
        <section className="mt-14 border-t pt-12">
          <h2 className="display text-[28px] leading-tight sm:text-[34px]">When they arrived</h2>
          <p className="mt-3 max-w-[60ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
            By the date the repository was created, which is the closest thing the API has to a
            release date. It is not the same thing: a repository can be created long before
            weights are uploaded, and a re-upload resets nothing. Read the shape, not the month.
          </p>
          <div className="mt-7 flex items-end gap-2">
            {d.byYear.map((y) => (
              <div key={y.year} className="min-w-0 flex-1">
                <div className="flex h-[110px] items-end">
                  <div
                    className="w-full rounded-sm"
                    style={{
                      height: `${(y.models / maxYear) * 100}%`,
                      minHeight: y.models > 0 ? 2 : 0,
                      background: "var(--series-1)",
                    }}
                  />
                </div>
                <p className="mono mt-1.5 text-center text-[11px] text-[color:var(--text-secondary)]">
                  {y.models}
                </p>
                <p className="mono text-center text-[10px] text-[color:var(--text-muted)]">{y.year}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── The frontier record ───────────────────────────────────────── */}
      {d.frontier.rowCount > 0 && (
        <section className="mt-14 border-t pt-12">
          <h2 className="display text-[28px] leading-tight sm:text-[34px]">
            The frontier record, for comparison
          </h2>
          <p className="mt-3 max-w-[62ch] text-[13.5px] leading-[1.7] text-[color:var(--text-secondary)]">
            Epoch AI&rsquo;s dataset of notable models, one row per model with a citation on each.
            {" "}{d.frontier.note}
          </p>
          <div className="mt-7 space-y-2.5">
            {topCountries.map((c) => (
              <div key={c.country} className="flex items-center gap-3">
                <span className="w-[11rem] shrink-0 truncate text-[12.5px]" title={c.country}>
                  {c.country}
                </span>
                <span className="min-w-0 flex-1">
                  <Bar
                    value={c.models}
                    max={maxCountry}
                    colour={c.country === "India" ? "var(--series-2)" : "var(--series-1)"}
                  />
                </span>
                <span className="mono w-[2.75rem] shrink-0 text-right text-[12px]">{c.models}</span>
              </div>
            ))}
          </div>
          {!topCountries.some((c) => c.country === "India") && (
            <p className="mt-3 text-[12px] text-[color:var(--text-muted)]">
              India is not in the top ten. It has {indiaFrontier}.
            </p>
          )}

          {d.frontier.indiaModels.length > 0 && (
            <div className="mt-8">
              <p className="eyebrow">every notable model that names India</p>
              <ul className="mt-3 m-0 list-none space-y-3 p-0">
                {d.frontier.indiaModels.map((m) => (
                  <li key={m.name} className="border-b border-[color:var(--hairline)] pb-3 last:border-b-0">
                    <p className="text-[13.5px] font-medium">
                      {m.name}
                      {m.published && (
                        <span className="mono ml-2 text-[11px] font-normal text-[color:var(--text-muted)]">
                          {m.published}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 max-w-[74ch] text-[11.5px] leading-[1.5] text-[color:var(--text-secondary)]">
                      {m.countries.length === 1
                        ? m.organisation
                        : `${m.countries.length} countries across ${m.organisation.split(",").length} institutions — India is one of them.`}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ── What this cannot tell you ─────────────────────────────────── */}
      <section className="mt-14 border-t pt-12">
        <h2 className="display text-[28px] leading-tight sm:text-[34px]">
          What this cannot tell you
        </h2>
        <dl className="mt-6 max-w-[64ch] space-y-4 text-[13.5px] leading-[1.7]">
          <div>
            <dt className="font-semibold">What anything is worth</dt>
            <dd className="mt-1 text-[color:var(--text-secondary)]">{d.noFunding}</dd>
          </div>
          <div>
            <dt className="font-semibold">How much anything is used</dt>
            <dd className="mt-1 text-[color:var(--text-secondary)]">{d.downloadsNote}</dd>
          </div>
          <div>
            <dt className="font-semibold">How good any of it is</dt>
            <dd className="mt-1 text-[color:var(--text-secondary)]">
              Nothing here is a benchmark. Leaderboard scores for Indic tasks exist, disagree with
              one another, and are mostly self-reported by the labs being ranked — so this page
              counts what was published and stops there.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Who is doing AI work without publishing</dt>
            <dd className="mt-1 text-[color:var(--text-secondary)]">
              Most of them. A company building on somebody else&rsquo;s model publishes no weights
              and leaves no trace in this record. The IndiaAI Mission&rsquo;s own startup list
              would be the corrective and indiaai.gov.in answered this pipeline with a 403.
            </dd>
          </div>
        </dl>
        <p className="mt-6 text-[12px] leading-[1.6] text-[color:var(--text-muted)]">
          {d.sources.join(" ")}{d.builtAt && ` Built ${d.builtAt.slice(0, 10)}.`}
          {d.frontier.droppedRows > 0 && ` ${d.frontier.droppedRows} rows of the frontier file did not parse and were dropped rather than padded into alignment.`}
        </p>
        <p className="mt-5 text-[12.5px]">
          <Link href="/growth" className="link-underline">
            The wider technology picture: payments, space, literacy →
          </Link>
        </p>
      </section>
    </div>
  );
}
