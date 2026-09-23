# Overview — what was built and why

*These docs are for you, not the interviewer. They are gitignored.*

## The one-sentence version

Three messy spreadsheets go in; a local web app comes out that can tell you, for
any project, whether it made money — and can prove its own arithmetic.

## The shape of it

There are four layers, and the separation between them is the main thing a
reviewer will look at.

```
 xlsx file
    │
    ▼
 ┌──────────────┐   src/lib/ingest/
 │  INGESTION   │   Reads a workbook into typed rows + a list of issues.
 └──────────────┘   Knows nothing about cost or SQL.
    │
    ▼
 ┌──────────────┐   src/lib/db/
 │ PERSISTENCE  │   SQLite. Stores rows. Owns the re-upload rules.
 └──────────────┘   Knows nothing about cost.
    │
    ▼
 ┌──────────────┐   src/lib/domain/
 │ CALCULATION  │   Pure functions. Rows in, costed rows out.
 └──────────────┘   Knows nothing about React, Next or SQLite.
    │
    ▼
 ┌──────────────┐   src/app/ + src/components/
 │      UI      │   Every page is a projection of one CostModel.
 └──────────────┘
```

Each layer only knows about the one above it. That is why `npm run reconcile`
works from the command line with no browser involved — it uses the same
calculation layer the dashboard does.

## Why this order of work mattered

The brief has a self-check: run a full year with overhead at zero, and total cost
must equal total salaries exactly. That check was satisfied **before any UI
existed** — first in a throwaway script against the raw workbooks, then in a test,
then through the real database via `npm run reconcile`.

This matters because the assessment weights correctness at 30%. Every page built
afterwards is a view over numbers already known to be right, so no time was spent
debugging a dashboard that looked plausible and was wrong.

## The file map

| Path | What lives there |
| --- | --- |
| `src/lib/domain/cost-model.ts` | **The heart.** Rates, the indirect pool, costing, gaps, reconciliation |
| `src/lib/domain/aggregate.ts` | Every view: project summaries, productivity, categories, departments |
| `src/lib/domain/period.ts` | Year/month handling and labels |
| `src/lib/domain/types.ts` | The vocabulary of the whole app |
| `src/lib/ingest/cells.ts` | Cell-level cleaning: dashes, currency text, month formats |
| `src/lib/ingest/header.ts` | Finds the header row wherever it is |
| `src/lib/ingest/workbook.ts` | ExcelJS → plain grid |
| `src/lib/ingest/{timesheet,salaries,projects}.ts` | One parser per file type |
| `src/lib/db/repository.ts` | Reads, writes, and the re-upload rules |
| `src/lib/db/schema.ts` | The tables |
| `src/lib/model.ts` | Builds the CostModel once per request |
| `src/app/*/page.tsx` | One file per page |
| `src/components/ui-kit/` | Table, stat card, bars, health panels |
| `scripts/` | seed, reconcile, reset, make:messy |
| `tests/` | 53 tests |

## The numbers you should know by heart

For the supplied 2025 data:

| Figure | Value |
| --- | --- |
| Timesheet rows | 562 |
| Total hours | 19,815.2 |
| Billable hours | 15,265.6 |
| Productivity | 77.0% |
| Total salaries | AED 2,400,000 |
| Total cost (overhead 0) | AED 2,400,000 — **balanced** |
| Total contract value | AED 5,012,000 |
| Overall margin | 52.1% |
| Best project | Q2025027f Harbourline, 83.9% |
| Worst project | E2025050a Meridian SEO, −112.0% |

The headline insight to mention out loud: **enhancements and hosting lose money.**
Three of the eleven jobs are underwater, and all three are the small ones —
E2025050a (−112%), H2025060c (−109%), E2025055b (−25%). The big development
projects carry the agency. That is the sort of thing leadership could not see
before and can see in one glance now.

Read `01-the-maths.md` next — it is the part you will be asked about.
