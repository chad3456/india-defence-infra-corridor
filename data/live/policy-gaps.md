# Policy measures: the gap register

What India did about its trade deficit in defence and electronics, what each
measure still needs before it can appear on the site, and which source would
settle it.

Written 2026-09-13. Nothing in this register is filled. That is the intended
state: `lib/policy-measures.ts` ships 23 measures carrying 54 empty figure
slots, and a slot stays empty until a connector finds a sentence in a named
document and stores that sentence beside the number. An empty field with a
probe target next to it is a success here; a plausible figure with nothing
behind it is the failure this whole layer was built to prevent.

Run `npm run policy:probe` to find out which of the sources below will answer a
script at all. It writes `data/live/policy-probe.json` and it extracts nothing —
it counts money-shaped mentions without reading them, for the same reason.

## How to read an entry

Each measure lists its slots. A slot is a question with a unit, a plausibility
band and the words a source sentence must contain. `readSlot` in
`lib/policy-measures.ts` refuses a sentence that fails any of the three, and
refusal is the common case by design.

Probe target ids in the "settled by" lines are the ids in
`scripts/etl/probe-policy.ts`. `scripts/test-policy.ts` fails if a measure
points at a target that does not exist, so these two files cannot drift apart
silently.

---

## Electronics

### `pli-large-scale-electronics` — Production-linked incentive for large-scale electronics manufacturing
*MeitY · production-subsidy*

| needs | unit | settled by |
| --- | --- | --- |
| Year the scheme was notified | year | `meity-pli-lsem`, `meity-schemes` |
| Total outlay approved | rupees | `meity-schemes`, `pib-allrel` |
| Years the incentive runs for | count | scheme guidelines PDF, via `meity-schemes` |

The measure most often credited with the handset reversal on the made-in-India
dashboard. Note that the outlay is an authorisation, not a disbursement; if a
source gives both, they are two different figures and the second is the rarer
and better one.

### `pli-it-hardware` — Production-linked incentive for IT hardware
*MeitY · production-subsidy*

| needs | unit | settled by |
| --- | --- | --- |
| Year first notified | year | `meity-pli-ithw`, `meity-schemes` |
| Outlay approved | rupees | `meity-schemes`, `pib-allrel` |
| Year of the revised scheme, if one exists | year | `meity-pli-ithw` |

Two versions of this scheme exist and the second replaced the first after the
first was judged to have underperformed. Any figure read here must say which
version it belongs to, or it flatters both.

### `pmp-mobile-handsets` — Phased manufacturing programme
*MeitY · phased-manufacturing*

| needs | unit | settled by |
| --- | --- | --- |
| Year notified | year | `meity-pmp` |
| Number of stages in the schedule | count | `meity-pmp` |
| **The duty schedule itself** | table | CBIC notifications via `cbic-tariff`, budget annexes via `indiabudget` |

The schedule — which part, at what duty, from which year — is the only thing on
this register that does not fit the slot shape, and it is also the most
testable measure in the set, because `INSTRUMENTS` predicts a specific
staircase in the component import lines that this project already has. It needs
a small ingest of its own. That ingest is not written.

### `ict-customs-duty` — Customs duty on IT goods
*CBIC · tariff*

| needs | unit | settled by |
| --- | --- | --- |
| Basic customs duty on handsets, latest rate | percent | `cbic-tariff`, `indiabudget` |
| The year the rate applies to | year | same document as the rate |

Rates move every budget. A rate without its year is worse than no rate. The
Information Technology Agreement dispute sits behind this entry and should be
named on the page rather than resolved — `wiki-information-technology-agreement`
is the index to where that argument is documented, not a source for it.

### `electronics-qco` — Quality control orders
*BIS / MeitY · quality-orders*

| needs | unit | settled by |
| --- | --- | --- |
| Year compulsory registration began for electronics | year | `bis-crs` |
| Product categories covered | count | `bis-crs` (a list length, not a headline) |

The toys sector on the localisation dashboard is the clean test of this
instrument. For electronics the orders are staggered and product-specific, so
the coverage count matters more than any single date.

### `pli-acc-battery` — Advanced chemistry cell batteries
*Ministry of Heavy Industries · production-subsidy*

| needs | unit | settled by |
| --- | --- | --- |
| Year notified | year | `heavyindustries-schemes` |
| Outlay approved | rupees | `heavyindustries-schemes`, `pib-allrel` |
| Contracted capacity, GWh | count | `heavyindustries-schemes` |

Filed under electronics because lithium-ion accumulators sit there as a
component input in `lib/localisation-sectors.ts` — and also appear in that
file's list of lines where dependence deepened, which is the argument for the
scheme and the thing to watch.

## Semiconductors

### `semicon-india` — Semicon India programme
*MeitY / India Semiconductor Mission · capital-subsidy*

| needs | unit | settled by |
| --- | --- | --- |
| Year approved | year | `ism-home`, `meity-schemes` |
| Programme outlay | rupees | `ism-home`, `pib-allrel` |
| Projects approved | count | `ism-home` |
| **Plants in commercial production** | count | no known source volunteers this |

The last row is the one that settles anything and the one no press release
carries. If it stays empty the page should say the programme has approvals, and
report approvals as approvals. `probe-semiconductor.ts` already asks ism.gov.in
about approved projects from the production side; this asks the same host about
the sanction.

### `specs` — Electronic components and semiconductors scheme
*MeitY · capital-subsidy*

| needs | unit | settled by |
| --- | --- | --- |
| Year notified | year | `meity-specs`, `meity-schemes` |
| Outlay approved | rupees | `meity-specs`, `pib-allrel` |
| Share of capital expenditure reimbursed | percent | scheme guidelines via `meity-specs` |

If the assembly critique of the handset story is right, this is the scheme that
answers it. The components it targets are the same HS lines the localisation
dashboard already carries as inputs, so an effect would be visible in data this
project holds.

## Defence

### `pil-services-1` … `pil-services-5` — The five positive indigenisation lists
*DMA / MoD · procurement*

Each list needs, separately:

| needs | unit | settled by |
| --- | --- | --- |
| Date notified | year | `ddp-indigenisation`, `mod-annual-report` |
| Items on the list | count | `ddp-indigenisation` |
| **Embargo dates per item** | table | the list PDF itself, linked from `ddp-indigenisation` |

Five measures rather than one with a count, because each list has its own date,
its own length and its own staggered embargo schedule. The sum across the five
is a number nobody published and this register will not create it.

The embargo schedule is the part that matters and the part that never gets
quoted. A list whose embargo dates run years into the future is a different
fact from a list already in force, and the item count is identical in both
cases. Treat an item count with no dates beside it as half a finding.

### `pil-dpsu` — Component lists for the defence manufacturers
*DDP · procurement*

| needs | unit | settled by |
| --- | --- | --- |
| How many such lists exist | count | `ddp-indigenisation`, `srijan-portal` |
| Items across them, if a total is stated | count | `mod-annual-report` |

Deliberately carries no count, not even an approximate one. Whether these are
genuinely distinct from the five services lists is a question for the probe.
If they are, they are the more interesting half: the services lists embargo
platforms, a component list embargoes the imports inside a platform already
called indigenous.

### `idex` — Innovations for Defence Excellence
*DDP / DIO · innovation-grant*

| needs | unit | settled by |
| --- | --- | --- |
| Year launched | year | `idex-home`, `mod-annual-report` |
| Maximum grant per winner | rupees | `idex-home` |
| **Procurement contracts resulting** | count | `mod-annual-report`, and probably nowhere |

Everything this programme publishes is an activity measure: challenges
launched, startups engaged, grants sanctioned. Activity is not output. The
absence of a conversion figure is itself worth stating on the page.

### `defence-offsets` — Defence offset policy
*MoD · offset-obligation*

| needs | unit | settled by |
| --- | --- | --- |
| Contract value threshold | rupees | DAP PDF via `mod-dap` |
| Share of contract value to be offset | percent | DAP PDF via `mod-dap` |
| Year of the version described | year | same document |
| **Obligations discharged against contracted** | rupees | `cag-reports` — the auditor, not the ministry |

The worst ratio of citation to evidence in Indian defence policy. Obligations
contracted and obligations discharged are different numbers and the first is
the one quoted. The policy has been revised repeatedly, including removal from
some categories of purchase, so an entry without a year is meaningless.

### `dap-2020` — Defence Acquisition Procedure
*MoD · procurement*

| needs | unit | settled by |
| --- | --- | --- |
| Year of the procedure in force | year | `mod-dap` |
| Indigenous content floor, highest-priority category | percent | DAP PDF via `mod-dap` |
| **Content floors for every other category** | table | DAP PDF |

This is the rule that decides what counts as indigenous, which makes it the
rule the other defence measures depend on. Its content thresholds are
self-certified — the failure mode `INSTRUMENTS` already names for procurement
preference.

### `defence-capital-earmark` — Domestic share of the capital acquisition budget
*MoD / MoF · procurement*

| needs | unit | settled by |
| --- | --- | --- |
| Share earmarked for domestic procurement | percent | `indiabudget`, `pib-rss-mod` |
| Financial year it applies to | year | same release |
| Amount earmarked | rupees | `indiabudget` |
| **Amount actually spent domestically** | rupees | `mod-annual-report` |

The most legible defence measure here, because it is a budget line rather than
a scheme with a brochure. The gap between earmarked and spent is the finding,
and the two are routinely reported as one number.

### `defence-fdi-cap` — Foreign investment limits
*DPIIT · ownership-rule*

| needs | unit | settled by |
| --- | --- | --- |
| Share permitted by the automatic route | percent | `dpiit-fdi-policy` |
| Year of the revision | year | `dpiit-fdi-policy`, `pib-indexd` |

Raised more than once, by different routes, with a higher ceiling available
under government approval. Whether it worked is a question about FDI inflows
into the sector — a separate series to read this against, not a figure this
measure can carry.

### `corridor-up`, `corridor-tn` — The two defence industrial corridors
*MoD with UP and TN · industrial-corridor*

| needs | unit | settled by |
| --- | --- | --- |
| Year announced | year | `ddp-corridors`, `upeida-corridor`, `tidco-corridor` |
| Designated nodes | count | state agency sites |
| Per-corridor split of investment | rupees | **already on this site — see below** |

**These already have a home.** `data/series/defence.json` carries
`defence-corridor-committed`, `defence-corridor-grounded`,
`defence-corridor-nodes`, `defence-corridor-jobs` and
`defence-corridor-mous`, with sources attached and — more importantly — with
committed and grounded kept apart, which is the whole honest content of the
corridor story. `lib/assessment.ts` already states the ratio between them. The
policy measures do not restate any of it; they record the policy act and point
at the series. Two copies of a figure is one copy too many.

What is genuinely missing is the per-corridor split: the existing series are
national totals across both corridors.

### `srijan` — SRIJAN indigenisation portal
*DDP · procurement*

| needs | unit | settled by |
| --- | --- | --- |
| Items displayed for indigenisation | count | `srijan-portal` |
| Items reported indigenised through it | count | `srijan-portal`, `mod-annual-report` |

A matchmaking portal, not a mandate, and worth carrying for exactly that: it
publishes a list of what the defence manufacturers still import, which is a
rare public admission. Only the second row is an outcome.

## Solar — carried as the control case

### `pli-solar-modules` — High-efficiency solar modules
*MNRE · production-subsidy*

| needs | unit | settled by |
| --- | --- | --- |
| Year notified | year | `mnre-schemes` |
| Outlay approved across tranches | rupees | `mnre-schemes`, `pib-allrel` |

Here because the same instrument was applied to solar as to handsets and the
trade line did not do what the story says — `lib/localisation-sectors.ts` grades
the relevant bundle and finds India a substantial net importer now. A policy
layer carrying only the schemes credited with successes would be an
advertisement.

---

## Deliberately excluded

These are real, important, and not in `MEASURES`. Each would need a decision
before it could be added, and the decision is recorded here rather than made
quietly.

**The umbrella PLI across fourteen sectors.** Its headline outlay is a national
total spanning sectors this site does not track. Filing it under `electronics`
would put a national figure behind a sector heading, and no sector in
`SECTORS` is the right home. Adding it needs either a cross-sector measure type
or a separate national-programmes layer.

**The public procurement (Make in India) preference order.** DPIIT's order
applies across all government buying, not to one sector. Same problem, same
options. It is arguably the most important procurement instrument for defence
localisation, which makes filing it wrongly worse rather than better.

**Sector-specific PLI schemes outside this site's sectors** — pharmaceuticals
bulk drugs, medical devices, telecom equipment, drones, textiles, food, white
goods, autos, steel. Bulk drugs in particular is a direct match for the
pharmaceuticals sector's input lines and is the strongest candidate for the
next addition.

**State-level incentive packages.** States offer their own capital subsidies to
electronics and defence investors. No common format, and no national
compilation this project could read.

**Anything measuring whether a measure worked.** Attribution is refused here as
it is refused in `lib/localisation.ts`. The join between a measure and a
commodity line is a date, not an arrow.

## Known source problems, before anyone starts

- **PIB cannot be searched by a script.** Releases are addressed by numeric
  PRID; the keyword search is a POST form. The release that announced a given
  outlay has to be found by hand and pinned in `data/sources.json` like every
  other citation on this site. The three PIB probe targets confirm reachability
  and nothing more.
- **Several ministry scheme paths in the probe are guesses.** A 404 is an
  answer — it says crawl the schemes index instead. Nothing assumes a guessed
  path resolves.
- **Ministry portals render in JavaScript.** The schemes connector already
  found this: DPIIT and several scheme portals return shells to a plain fetch.
  The probe flags a shell separately from a 404 because one is fixed by finding
  the right path and the other is not fixed without a headless browser.
- **The documents that carry the real answers are PDFs.** The DAP, the
  indigenisation lists, the MoD annual report and the scheme guidelines are all
  PDFs. `scripts/pdf-read.ts` exists; no connector here uses it yet.
- **A reachable page is not an answering page.** Check `found`/`missing` and the
  shape block in `data/live/policy-probe.json` before believing a target is
  usable.

## Status

| | |
| --- | --- |
| Measures declared | 23 |
| Figure slots declared | 54 |
| Slots with a source sentence behind them | 0 |
| Measures fully verified | 0 |

`npm run test:policy` prints these figures and fails only on a figure that
arrived without provenance — never on one that is absent.
