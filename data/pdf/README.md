# Source PDFs

Statistical documents committed so their figures can be extracted, checked and
cited without depending on a live host.

Put files here as `<publisher>-<document>-<year>.pdf`, for example
`mof-econ-survey-2025-stat-appendix.pdf`.

## Why they live in the repository

The development sandbox's network policy denies every Indian government host,
so nothing here can be fetched at author time. More importantly, a committed
PDF cannot change shape between the run that read it and the run that checks
it — which is exactly what went wrong when a connector was written against an
assumed layout on a live page and published incident counts as civilian deaths.

A pinned document can also be looked at, page by page, and the extraction
compared against what the page actually says.

## Reading one

```bash
npm run pdf:read -- data/pdf/mof-econ-survey-2025-stat-appendix.pdf --pages 12-14
npm run pdf:read -- <file> --pages 12 --years     # data rows only
npm run pdf:read -- <file> --pages 12 --json      # machine-readable
```

This prints a reconstructed grid and publishes nothing. Compare it against the
page, then enter the figures in `data/security/curated.json` with a `sourceId`
naming the document, and register that document in `data/sources.json` with its
URL and access date.

## Size

Keep them to what is needed. A full Economic Survey runs to tens of megabytes
and git keeps every version for ever. Prefer the statistical appendix over the
whole Survey, and a page range extracted from it over the appendix, whenever the
publisher offers one.
