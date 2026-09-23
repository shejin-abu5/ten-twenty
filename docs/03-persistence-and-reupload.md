# Persistence and the re-upload rules

## Why SQLite

The brief wants persistence with no cloud account and no service to run.
`better-sqlite3` gives a single file in `data/margin.db`, synchronous calls (no
async noise through the whole app), real transactions, and prebuilt binaries so
`npm install` works on a clean Mac without build tools.

The schema is created idempotently on every open — same code path for a fresh
checkout and an existing database. Note `serverExternalPackages: ['better-sqlite3']`
in `next.config.ts`: it's a native addon and must not be bundled, or the `.node`
binary never reaches the server build.

## The tables

| Table | Key | Notes |
| --- | --- | --- |
| `timesheet_entries` | auto id | Indexed on (year, month), ref_code, employee_no |
| `salaries` | **(employee_no, year, month)** | The composite key is what makes the upsert work |
| `projects` | **ref_code** | |
| `uploads` | auto id | Filename, sheet, header row, counts, periods, issues as JSON |
| `settings` | key | Billable categories, overhead, a data version counter |

## The re-upload rules

This is 20% of the grade — "re-uploading a corrected month must not duplicate or
destroy the rest of the year" — and each rule is a deliberate answer to a
different failure mode.

### Timesheet: replace by period

```
for each period in the file:  DELETE FROM timesheet_entries WHERE year=? AND month=?
then: INSERT every parsed row
```

All inside one transaction.

- Upload a corrected March → March is rewritten, the other eleven months are
  untouched.
- Upload the same file twice → identical result, no duplication.
- Upload a full-year file → all twelve months replaced.

The scope of the delete is exactly the set of periods the file contains, which is
why the parser returns `periods` alongside the rows.

**Why not upsert per row?** There's no natural key — one person can legitimately
log two rows in the same category in the same month. Replace-by-period is the
only rule that is both idempotent and correct.

### Salaries: upsert per person per month

```sql
ON CONFLICT(employee_no, year, month) DO UPDATE SET amount = excluded.amount, ...
```

A blank or `-` cell was already dropped during parsing, so it never reaches here
— meaning it leaves the stored figure alone. That is the point: a partial sheet
cannot silently zero a month that was already right. People absent from the file
keep their salaries.

### Project prices: upsert per ref code

Projects missing from the file keep their price. A ref code appearing twice in
one file resolves to the later row, and the collision is reported as an issue.

All three rules are covered by `tests/re-upload.test.ts`, which runs against a
real SQLite file in a temp directory.

## Employee identity

The join key is the employee number. If a sheet has no employee-number column,
the parser synthesises `name:ayesharahman`.

`reconcileEmployeeKeys` in the repository then stitches them: it builds a
name → number map from whichever records *do* have numbers, and rewrites any
`name:` key it can resolve. Without this, a salary sheet with no numbers would
produce one person with hours and no salary plus another with salary and no
hours — two phantom gaps and a broken reconciliation.

This is the one place I knowingly left a limitation: two people with the same
name and no employee numbers would merge. Fixing it properly needs an identity
table the agency would have to maintain, which is more machinery than the problem
justifies. It's written down in `NOTES.md` rather than hidden.

## Building the model

`src/lib/model.ts` is four lines but does something important:

```ts
export const getCostModel = cache((): CostModel => {
  const inputs = loadModelInputs();
  return buildCostModel({ ...inputs, assumptions: readAssumptions() });
});
```

React's `cache` dedupes per request. The dashboard renders five tables and a KPI
row from one model; without this it would hit the database and rebuild the cost
model six times. With it, once.

`export const dynamic = 'force-dynamic'` in the root layout applies to the whole
route tree — every page reads the database at request time, so nothing is
prerenderable.

## A trap I hit

`IDLE_UPLOAD_STATE` was originally exported from the `'use server'` actions file.
A `'use server'` module may only export **async functions** — the constant arrived
on the client as `undefined` and the page 500'd on `shown.outcomes.length`.

Types and constants now live in `src/app/upload/types.ts`; the actions file
exports only actions. Worth remembering, because the failure is silent at build
time and only shows up at runtime.
