# Bharat Tracker

A source-cited record of Indian defence, infrastructure, trade and manufacturing since 2001 —
with an honest assessment of how good it actually is, measured against global benchmarks rather
than against India's own past.

**The core rule:** every number rendered on this site must be traceable to a named source with a
URL and a verification date. This is enforced mechanically — `npm run validate` fails the build
if any series lacks a definition, a unit, a resolvable source, or a confidence grade.

---

## Quick start

```bash
npm ci
npm run dev            # http://localhost:3000
```

No environment variables are needed. The site ships with committed data and works offline.

```bash
npm test               # validate data + audit registry + typecheck
npm run etl            # refresh World Bank series and the news tracker
npm run etl:dry        # show what would be fetched, touch no network
```

## Getting it live on Vercel (free tier)

1. Push this branch and open <https://vercel.com/new>.
2. **Import** `chad3456/india-defence-infra-corridor`.
3. Framework preset auto-detects as **Next.js**. Leave the defaults — `vercel.json` already
   sets the build command so the data-validation gate runs before every deploy.
4. Click **Deploy**. Nothing else is required; there are no mandatory env vars.

Region is pinned to `bom1` (Mumbai) in `vercel.json`, which is closest to the audience.

### Optional: the live Postgres tracker

Without a database the news tracker refreshes when the site rebuilds (the scheduled
GitHub Action commits fresh data daily). With Supabase it refreshes continuously.

1. Create a free Supabase project. *(Note: the free tier allows two active projects. At the time
   of writing this account is at that limit, so a project must be paused or deleted first.)*
2. Run `supabase/migrations/0001_init.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local` and fill in the three keys.
4. Add the same keys in **Vercel → Settings → Environment Variables**, and add
   `SUPABASE_SERVICE_ROLE_KEY` as a **GitHub repository secret** so the pipeline can write.

The service role key has write access — never expose it to the browser.

---

## How it is put together

```
data/
  sources.json            # the source register — every publisher, URL, tier, access date
  series/*.json           # chart data, one file per domain; ETL owns wdi.json
  geo/                    # India basemap + corridor geometry
  live/                   # pipeline output: news.json, last-run.json
lib/
  types.ts                # the data model, and the rules encoded in it
  data.ts                 # loaders
  transforms.ts           # yoy / index / cagr / share — all labelled as derived
  registry.ts             # generates the chart specs
  wdi-catalogue.ts        # 66 World Bank indicators the ETL tracks
  assessment.ts           # the graded verdicts
scripts/
  validate.ts             # the data gate — runs before every build
  audit-registry.ts       # fails if the gallery drops below its target size
  etl/                    # connectors + orchestrator
```

### Charts are specs, not components

421 charts are generated from ~40 series × a set of transforms, rendered by one SVG chart
component. Two rules keep the gallery honest:

1. A spec is only emitted when the transform is **meaningful** for that series — no
   year-on-year chart drawn across non-adjacent periods, no index chart off a zero base.
2. Specs for series the ETL has not yet populated are still emitted, flagged `pending`, and
   render an explicit *awaiting data* state rather than an empty axis pretending to be a finding.

At the time of writing: **117 charts live on committed data, 304 fill on the first ETL run.**

### The data model encodes the editorial rules

`scripts/lib/validate-series.ts` refuses to publish a series that breaks any of these:

- no sources → rejected
- `confidence: "low"` without a note explaining the uncertainty → rejected
- `provenance: "think-tank"` graded `high` confidence → rejected (estimates are not records)
- backed only by tier-3 press sources but graded above low → warned

Gaps stay gaps. Where a figure could not be located the period is stored as `null` and the
chart shows a break in the line. Nothing is interpolated or back-filled.

### The pipeline

Two connectors, both fail-soft:

- **World Bank** — full 2001-present history for 66 indicators across India and five comparator
  countries. Rewritten in full each run, never appended to, because the World Bank revises history.
- **News tracker** — RSS from ThePrint, The Hindu, Swarajya, OpIndia, NDTV, India Today and
  Rest of World, filtered to relevant topics.

Nothing from the news connector ever becomes chart data. Press reports of government figures are
tier-3 evidence: they flag that a number may have moved, and a human verifies against the primary
release before any series changes.

A connector that fails leaves the previous committed data in place and marks the run `partial`,
so the site keeps serving last-known-good values. Output is written only after validation passes.

`.github/workflows/pipeline.yml` runs this daily at 02:15 UTC and commits only if data changed.

---

## Known limitations

Read `/methodology` on the site for the full list. The big ones:

- **Nominal rupees.** Indian financial series are stored as published. A large share of the
  apparent growth in defence exports, production and budget is inflation and depreciation.
- **Definitional drift.** Airport counts vary between releases; highway network length grows
  partly by re-designating existing state roads.
- **Estimates presented as data.** Nuclear warhead counts are external inferences — India
  publishes nothing. Graded low confidence; order-of-magnitude only.
- **Schematic map geometry.** Corridor lines join real geocoded endpoint cities in straight
  segments. They are not surveyed alignments. The opening years are the load-bearing fact.
- **The assessment page is editorial.** Grades are judgements, not computed scores, and say so.
  Each ships with the strongest argument against itself. The data underneath is separable — you
  can reject every grade and still use every number.

## Licence and attribution

Underlying data is public-domain government and multilateral output; each figure links to its
publisher. Not affiliated with any government body, party or contractor.
