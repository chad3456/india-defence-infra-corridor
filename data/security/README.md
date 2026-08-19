# Hand-entered security figures

`curated.json` holds the series that have no machine-readable source anywhere —
LWE-affected districts, stone-pelting incidents, communal incidents, J&K tourist
arrivals, squadron strength, bulletproof jacket production. They live in MHA
annual reports, parliamentary answers and NCRB volumes: PDFs and prose,
published once a year, in a layout that changes.

Scraping those is how a set of wrong fatality numbers reached the site. So these
are typed in, against a citation each.

## Shape

```json
[
  {
    "seriesId": "lwe-affected-districts",
    "points": [
      {
        "period": "2015",
        "value": 106,
        "sourceId": "mha-annual-report-2015-16",
        "note": "Criteria revised this year; not comparable with 2014 without adjustment."
      }
    ]
  }
]
```

## Rules the connector enforces

- **`seriesId`** must be declared in `lib/security-catalogue.ts`.
- **`sourceId` is required on every point**, not on the series. Each year of an
  MHA series comes from a different document; one series-level citation would
  point at one of them and imply all of them.
- **Every `sourceId` must resolve** in `data/sources.json`. Add the document
  there first — id, publisher, URL, access date, tier.
- **`period`** is `"2015"` or `"FY2015-16"`. Nothing else parses.
- **A figure you do not have is `null`**, never omitted and never zero. A gap
  renders as a break in the line; a zero is a claim that nothing happened.
- **One bad point rejects the whole series.** A silently shortened series about
  violence is exactly the failure this file exists to prevent.
- **An empty file is fine.** The charts stay visibly pending. That is a promise
  not yet kept; figures typed from memory would be a promise broken.

Run `npm run security:check` after editing. It validates without touching the
network, and CI runs it too.
