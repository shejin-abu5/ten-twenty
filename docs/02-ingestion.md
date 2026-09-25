# Ingestion — how a messy spreadsheet becomes trustworthy rows

Worth 20% of the grade ("messy headers, blank cells and odd date formats are
absorbed rather than crashing").

## The pipeline

```
Buffer → workbook.ts → Grid → header.ts → column map → parser → { rows, issues }
```

Four small steps, each testable on its own.

### `workbook.ts` — ExcelJS to a plain grid

Turns a workbook into `(string | number | Date | null)[][]`. It flattens
ExcelJS's richer cell shapes (formula results, rich text, hyperlinks) down to a
scalar, and throws a clear `IngestError` if the bytes aren't a workbook at all.

**Why a plain grid:** every parser downstream can then be tested with literal
arrays — no fixture files, no ExcelJS in the tests. It also means swapping the
spreadsheet library would touch exactly one file.

### `header.ts` — find the header row wherever it is

The brief says headers aren't always in row 1 (and indeed the salary sheet has a
title row above it). Rather than hardcoding a row:

1. For each of the first 20 rows, score every (column, expected-field) pair:
   exact caption match = 100, prefix = 60, contains = 35.
2. Greedily assign the strongest pairs, each column and field used once.
3. The highest-scoring row wins.
4. If a `required` field didn't match, throw with a message naming what's missing.

The greedy assignment is what stops "Employee Name" and "Employee No." from
fighting over each other: the exact match is taken first, so the loose "contains
name" hit can't steal the column.

The salary sheet gets an extra scoring hook: a row containing many month names
scores heavily. That's simultaneously how the header is located and how the file
is recognised as a salary sheet at all.

### `cells.ts` — the cell-level cleaning

Three functions, and they carry most of the messiness:

- **`cleanString`** — collapses whitespace, and maps `-`, `–`, `—`, `N/A`, `nil`,
  `null`, `#N/A` and empty to `null`.
- **`parseNumber`** — handles `560000`, `"560,000"`, `"AED 560,000.50"`, and
  `"(1,200)"` → −1200. Returns `null` rather than 0 for anything unreadable, so
  a bad cell becomes a *visible issue* instead of a silent zero.
- **`parseMonth`** — the interesting one.

### How `parseMonth` works

Lowercase, insert boundaries between letters and digits (so `March2025` splits),
then split on anything non-alphanumeric. Walk the tokens: numbers go in a list,
words are matched against month names by prefix (so `sept` → September, but
anything under three characters is refused as too ambiguous).

- A four-digit 1900–2100 number is the year.
- If a month name was found but no four-digit year, a 0–99 number becomes 20xx.
- If **no** month name was found, fall back to the all-numeric forms
  (`2025-05`, `05/2025`) or a bare 1–12.

Handles: `May '25`, `January 2026`, `January`, `Jan-25`, `Sept 2025`, `2025-05`,
`05/2025`, `March2025`, real `Date` cells, and Excel serial numbers.

**The bug I shipped and caught.** The bare-number fallback originally accepted
`"Q1"` as January — it tokenises to `["q", "1"]`, and my code only looked at the
numbers. Twenty hours got filed under the wrong month, which then absorbed a
whole month's indirect pool and threw the reconciliation out by 97,000. The
`parseMonth` test caught it. Fix: track whether any word appeared that *wasn't*
a month name, and if so refuse the numeric fallback entirely. `Q1`, `Q1 2025` and
`Total 12` all return `null` now.

This is a good story to tell if asked about testing: the test existed to
demonstrate a feature and instead found a real defect. It lives in
`tests/ingest.test.ts`, under "refuses to guess at something that is not a
month".

### Year inference

Some rows say only `January`. The parser makes two passes: the first reads every
month cell and finds the **most common year in the file**; the second uses it for
any row that lacked one. If no row has a year at all, the filename is tried
(`timesheet-2025.xlsx`). If that fails too, those rows are skipped with an error
rather than guessed.

The salary sheet is different: it looks at the month column headings, then any
row above the header (which catches `Salary Overview 2025 (AED)`), then the
filename. If none of them say, it refuses the file — the whole sheet would
otherwise land in the wrong year.

## Errors versus issues

Two different things, deliberately:

- **`IngestError` is thrown.** The file is unusable — not a workbook, no header,
  no month columns, no year. The upload fails and says why.
- **`IngestIssue` is collected.** One row was odd. Parsing continues. Each issue
  carries severity, the 1-based sheet row (so it matches what you see in Excel)
  and the column name.

Issues are stored with the upload and shown on the Data page. So "we skipped
row 13 because its month said Q1" is visible rather than silent.

## Detecting the wrong file

There is no separate sniffing step. `locateHeader` looks for the columns the
chosen parser needs, and if the required ones are not there it throws:

> Could not find the expected header row in sheet "Salaries".
> Missing columns: hours. Checked the first 20 row(s). Is this the right file?

So dropping the salary sheet into the timesheet slot gives a readable message
naming what was missing, rather than a stack trace. The upload page shows that
message verbatim.

## Rows that get dropped

| Row | What happens |
| --- | --- |
| Entirely blank | Ignored silently |
| No employee name (a totals row) | Skipped, warning with the row number |
| Unreadable month | Skipped, **error** with the row number |
| Hours blank/`-`/0 | Skipped, counted, one summary warning |
| Negative hours | Skipped, error |
| No category | **Kept**, as `Uncategorised`, with a warning |

Zero-hour rows are dropped because they affect no calculation and would otherwise
clutter every table with empty rows — but the count is always reported, so the
number never just disappears.
