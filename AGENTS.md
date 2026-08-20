# AGENTS.md — Bharat Tracker

Instructions for an AI agent working in this repository. Read this before touching anything.

**Bharat Tracker** is a source-cited record of Indian defence, infrastructure, trade and
manufacturing since 2001, plus an honest assessment of the record measured against global
benchmarks rather than against India's own past. Next.js 16 App Router, TypeScript strict,
Tailwind v4, Postgres (Supabase) as the optional store of record.

---

## The one rule that outranks everything else

**Every number rendered on this site must be traceable to a named source with a URL and a
verification date.** This is not a style preference; it is the product. `npm run validate`
fails the build if a series lacks a definition, a unit, a resolvable source id or a
confidence grade.

Three corollaries an agent gets wrong most often:

1. **Never invent a data point to fill a hole.** A missing period is stored as `null` and
   renders as a break in the line. Interpolation, back-filling and "reasonable estimates"
   are all forbidden. If you cannot source it, leave the gap.
2. **News is never data.** Items from the ingest pipeline become map pins and tracker
   headlines. They never become chart series. A press report that a plant was announced is
   tier-3 evidence that a number may have moved — a human verifies against the primary
   release before any series changes.
3. **Derived is labelled derived.** Year-on-year, index-2001, CAGR, share, per-capita and
   delta views are computed in `lib/transforms.ts` and every chart built from them says so.

---

## Authority — what you may do without asking

| Do freely | Ask first |
|---|---|
| Fix bugs, types, styling, chart rendering | Removing or relaxing a validation rule |
| Add a chart spec, transform or page section | Downgrading a source tier or confidence grade |
| Add or disable an ingest feed in `lib/sources.ts` | Changing an editorial verdict in `lib/assessment.ts` |
| Tighten classification rules after a false pin | Creating anything outside the `bharat_tracker` schema |
| Regenerate `data/geo/places.json`, `supabase/seed.sql` | Deleting, pausing or resetting a Supabase project |
| Run the ETL, commit refreshed data | Publishing a number you could not verify |

The Supabase project is **shared with other projects**. Everything this repo creates lives in
the `bharat_tracker` schema. Do not create, alter or drop a single object in `public`.
`npm run test:schema` asserts the isolation against Postgres-in-WASM and will catch you.

`SUPABASE_SERVICE_ROLE_KEY` is write-capable. Repository secret only — never in client code,
never in a committed file, never echoed into a log.

---

## Start here

```bash
npm ci
npm run dev          # http://localhost:3000 — no env vars needed, data is committed
npm test             # the full gate; run this before you say you are done
```

Read in this order when you are new to the repo:

1. `lib/types.ts` — the data model, and the editorial rules encoded in it.
2. `scripts/lib/validate-series.ts` — what the gate actually enforces.
3. `lib/registry.ts` — how 570 charts come out of 117 series.
4. `scripts/etl/run.ts` — the pipeline contract (connectors never throw).
5. `docs/data-sources.mdx` — where every number comes from.

---

## Where things live

| You are changing | Go to |
|---|---|
| A page or route | `app/` — `/`, `/charts`, `/map`, `/tracker`, `/benchmark`, `/sources`, `/methodology` |
| How a chart draws | `components/charts/ChartCanvas.tsx` (one SVG renderer for all 15 kinds) |
| Which charts exist | `lib/registry.ts` — specs, not components |
| A transform (yoy, index, cagr…) | `lib/transforms.ts` |
| The India map, corridors, timelapse | `components/map/IndiaMap.tsx` |
| The map's category panel and 2-day / all-time modes | `components/map/DevelopmentMap.tsx`, `lib/events.ts` |
| Hand-curated series | `data/series/{defence,infrastructure,economy,space}.json` |
| World Bank series | `data/series/wdi.json` — **ETL-owned, never hand-edit** |
| Which WDI indicators are tracked | `lib/wdi-catalogue.ts` (82 indicators, 5 comparator countries) |
| The source register | `data/sources.json` |
| Which feeds are ingested | `lib/sources.ts` — **the only place a publisher is named** |
| Sector keyword searches | `SECTOR_KEYWORDS` in `lib/sources.ts` — searches are built, never pasted |
| Merging a refresh into the stored map | `scripts/etl/lib/merge.ts` |
| The half-hourly wrapper | `scripts/etl/refresh-map.ts` |
| Proving every sector has sources | `scripts/etl/verify-sources.ts` |
| Classification: sector, action gate, geo | `scripts/etl/lib/classify.ts` |
| Near-duplicate collapsing | `scripts/etl/lib/dedupe.ts` |
| Feed parsing / article body extraction | `scripts/etl/lib/{feed,extract}.ts` |
| HTTP retry, backoff, 403 handling, cache | `scripts/etl/lib/http.ts` |
| Place lookup | `lib/gazetteer.ts` reading generated `data/geo/places.json` |
| Database schema | `supabase/migrations/0001_init.sql` |
| Editorial grades | `lib/assessment.ts` |
| The constructed security indices | `lib/security-index.ts` — read the header before touching |
| Which security series exist | `lib/security-catalogue.ts` |
| SATP fatality scraping | `scripts/etl/connectors/satp.ts` (national) and `satp-states.ts` (by state) |
| India-only series (EV, UPI, CPI, schemes) | `lib/india-catalogue.ts` |
| Hand-entered figures | `data/security/curated.json`, validated by `npm run security:check` |
| Reading a committed PDF | `scripts/etl/lib/pdf-table.ts`, `npm run pdf:read` |
| Source PDFs | `data/pdf/` — see its README before adding one |
| The published source catalogue | `docs/data-sources.mdx` — rendered at `/data-sources` |
| How that file is rendered | `lib/markdown.ts`, `components/ui/Markdown.tsx` |

---

## Architecture invariants

**JSON is the build-time cache; Postgres is the store of record.** The site renders fully
from committed JSON with no database at all. `npm run prebuild` pulls from Postgres when
configured and silently keeps the JSON when not. Never make a page fail because a database
is unreachable.

**Connectors never throw.** Each returns `{ data, errors }`. A connector that fails leaves
the previous committed data in place and marks the run `partial`; the site keeps serving
last-known-good values rather than blanking a chart. Only a total connector failure exits
non-zero.

**Output is written only after validation passes.** A malformed upstream response cannot
land in the repo.

**The World Bank connector rewrites history in full, never appends.** The World Bank revises
past years; appending would freeze a stale revision.

**Constructed numbers are never hand-scored.** The Tonality Score and Action Index are the only
figures on this site not reported by someone else. Every dimension is computed from published
counts, so a reader can recompute them. Do not add a hand-assigned dimension, however much more
directly it would track the thing the name implies — an index whose inputs live in the author's
head is worth less than no index at all. Any change to the arithmetic updates `LIMITS` and the
methodology page in the same commit.

**Charts are specs.** A spec is emitted only when the transform is *meaningful* for that
series — no year-on-year across non-adjacent periods, no index off a zero base. A spec for a
series with no data renders an explicit *awaiting data* state, never an empty axis posing as
a finding.

**Events accumulate, and are re-checked.** `data/events.json` is merged across runs so the
map builds history. Every merge re-runs the current action gate over stored rows, so
tightening a rule retroactively removes the pins it should never have created. Rows with a
`seed-` id prefix are hand-verified and exempt. Anything older than 730 days is dropped.

**Unplaceable is a valid outcome.** `detectPlace` returns `null` rather than guessing.
An event with no coordinates is kept out of the map, not pinned to a state capital.

**Tailwind v4 layering.** Base element styles live in `@layer base` in `app/globals.css`.
Unlayered CSS beats `@layer utilities` regardless of specificity — an unlayered
`a { color: inherit }` silently defeats every colour utility on a link. Use
`text-[color:var(--token)]`, not `text-[var(--token)]`; the bare form is ambiguous and gets
dropped.

---

## Data activation rules

Adding data is a two-sided change. One side without the other fails the gate.

- **New series** → add it to a file in `data/series/`, and cite it: every id in
  `sourceIds` must exist in `data/sources.json`.
- **New source** → give it a `tier` (1/2/3), a `provenance`
  (`official` | `multilateral` | `think-tank` | `press` | `derived`), a real URL and an
  `accessed` date.
- **`confidence: "low"`** → requires at least one `notes` entry explaining the uncertainty.
- **`provenance: "think-tank"` + `confidence: "high"`** → rejected. Estimates are not records.
- **New feed** → `lib/sources.ts` only. No ingest code may know about a particular publisher.
  Declare its `domains`; a dead feed gets `disabled: true` with a `note` giving the reason,
  keeping the URL on record.
- **Every sector needs three independent publishers.** `npm run test:ingest` enforces the
  declared floor offline; `npm run sources:verify` proves the feeds answer. Newsrooms are
  counted, not feeds — ET's ten desks are one publisher.
- **Wider sector reach** → add a phrase to `SECTOR_KEYWORDS`, not another hand-written URL.
- **After any registry change** → `npm run docs:sync`, which regenerates the counted tables in
  the published catalogue. Do not hand-edit those numbers; three of them were wrong the one
  time I did.
- **Gazetteer** → `npm run geo:build`. Never hand-edit `data/geo/places.json`; it is
  generated from Natural Earth plus a curated overlay inside `scripts/geo/build-gazetteer.ts`.
- **Any data change at all** → `npm run db:seed-sql` to regenerate `supabase/seed.sql`.
  CI fails on drift (`npm run db:seed-check`).
- **`docs/data-sources.mdx` is published**, not just a README — it is rendered at
  `/data-sources`. `npm run test:docs` fails if a count in it no longer matches the code, so
  changing the feed list or the series set means updating the document in the same commit.

---

## Commands

```bash
npm run dev              # dev server
npm run build            # prebuild pulls from Postgres if configured, then builds
npm run typecheck        # tsc --noEmit; strict + noUncheckedIndexedAccess

npm run validate         # THE GATE — provenance, units, confidence, source resolution
npm run registry:audit   # fails if the gallery drops below its target size
npm run test:schema      # runs the real migration against Postgres-in-WASM
npm run test:ingest      # feed parsing + classification against committed fixtures
npm run test:docs        # the docs render, and their counted claims match the code
npm run test:security    # the constructed indices' arithmetic, and the SATP parser
npm run db:seed-check    # supabase/seed.sql matches the JSON it is generated from
npm test                 # all of the above, in that order

npm run etl              # live run: World Bank + feeds + article bodies + X
npm run etl:dry          # show what would be fetched, touch no network
npm run map:refresh      # the half-hourly wrapper: feeds -> classify -> merge
npm run map:refresh:dry  # same, touching no network
npm run sources:verify   # probe every feed; fails if a sector has <3 publishers
npm run docs:sync        # regenerate the counted tables in docs/data-sources.mdx
npm run sources:probe    # what Indian statistical endpoints actually return
npm run satp:probe       # SATP page structure, before touching that connector
npm run pdf:read -- <f>  # read a table out of a committed PDF; publishes nothing

npm run db:check         # is bharat_tracker reachable?
npm run db:push          # seed Postgres from committed JSON
npm run db:pull          # hydrate JSON from Postgres
npm run db:seed-sql      # regenerate supabase/seed.sql

npm run geo:build        # regenerate data/geo/places.json from Natural Earth
```

---

## Verification

Run `npm test` before claiming anything works. It is ordered deliberately — the data gate
runs first, because if a number lost its source nothing else matters.

For pipeline changes, `npm run etl` and read the funnel line:

```
ingest funnel: 784 items -> 273 candidates -> 24 events
               (lost: 178 no sector, 41 not an action, 30 no place)
```

Losses are the point, not a defect. The gates exist because loosening them produced false
pins: a PM CARES story pinned to Tamil Nadu defence, a High Court marriage ruling filed as
defence, "fire breaks out in old ATC **building**" filed as an airport opening. If you widen
a rule, spot-check the resulting pins by hand and be ready to revert.

Before pushing pipeline changes, sanity-check the outputs:

```bash
node -e "const e=require('./data/events.json'); console.log(e.length, new Set(e.map(x=>x.state)).size+' states')"
```

Cross-check any new headline figure against a second independent source before it becomes a
series. The site's failure mode is not a crash — it is a confidently wrong number.

---

## Delivery

- Work on `claude/india-defence-infra-tracker-qfpsfu`. Push with `git push -u origin <branch>`.
- **Enable the pre-push hook once per clone: `git config core.hooksPath .githooks`.** It runs
  `npm test` and blocks a red push. Added after pushing a failing branch twice in one session —
  both times the test command and the push were separate shell statements, so a non-zero exit
  printed a failure and the push went out anyway. Do not rely on reading the output.
- Commit messages describe the behaviour change, not the file list.
- `data/series/wdi.json`, `data/live/` and `data/events.json` are written by the scheduled
  pipeline. Expect to rebase on bot commits; do not fight them.
- Do not open a pull request unless asked.
- Never commit `.env`, `.env.local`, a service-role key, or any X/Twitter post content.

Two GitHub workflows matter:

- `ci.yml` — validate → registry:audit → test:schema → test:ingest → db:seed-check →
  typecheck → build, on every push.
- `pipeline.yml` — every 6 hours, plus on any push touching `scripts/etl/**`,
  `lib/sources.ts` or `lib/gazetteer.ts`, so a connector fix is exercised against live feeds
  immediately.
- `map-refresh.yml` — every 30 minutes. Ingest only; commits **only when the stored map
  actually changed**, so a quiet half hour costs one workflow minute and no commit.
- `verify-sources.yml` — daily and on any registry change; commits the health report and fails
  if a sector drops below three working publishers.

Note that this sandbox's network policy denies every news host, so feeds cannot be probed
locally — `npm run sources:verify` only means something in Actions.

---

## Honesty obligations

This project's value is that it will report a bad number. Do not soften findings the data
supports, and do not manufacture ones it does not. Current examples that must not be quietly
dropped: manufacturing fell from 15.3% of GDP (2001) to 13.5% (2025) against China's 24.7%;
grounded investment in the defence corridors is roughly 15% of what was committed; India is
the world's fifth-largest economy by nominal GDP, not the fourth.

The 14 graded verdicts in `lib/assessment.ts` are editorial judgements and say so — one A,
six Bs, four Cs, three Ds. Each ships with the strongest good-faith argument against itself.
The data underneath is separable: a reader can reject every grade and still use every number.

---

## References

- `README.md` — setup, deployment, database provisioning.
- `docs/data-sources.mdx` — the source catalogue, tiering and confidence rules.
- `/methodology` on the running site — the full limitations list.
- `supabase/migrations/0001_init.sql` — the editorial rules expressed as CHECK constraints.
