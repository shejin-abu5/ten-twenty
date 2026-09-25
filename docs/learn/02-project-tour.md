# A tour of the project

Have the app running while you read this (`npm run dev`). Every claim here can
be checked by opening the file named.

---

## 1. What the app is for, in one sentence

Three spreadsheets go in — a timesheet, a salary sheet, a project price list —
and the app answers one question: **did we actually make money on that
project?**

The hard part is not the web app. It is that the answer requires allocating
*every* dirham of payroll onto *some* project hour, exactly once.

---

## 2. The four layers

This is the first thing to draw on a whiteboard if they ask about structure.

```
   .xlsx file
      |
      v
 +--------------+   src/lib/ingest/     Reads a workbook into typed rows
 |  INGESTION   |                       + a list of issues.
 +--------------+   Knows nothing about cost or SQL.
      |
      v
 +--------------+   src/lib/db/         SQLite. Stores rows.
 | PERSISTENCE  |                       Owns the re-upload rules.
 +--------------+   Knows nothing about cost.
      |
      v
 +--------------+   src/lib/domain/     Pure functions. Rows in, costed rows out.
 | CALCULATION  |
 +--------------+   Knows nothing about React, Next or SQLite.
      |
      v
 +--------------+   src/app/ + src/components/
 |      UI      |   Every page is a projection of one CostModel.
 +--------------+
```

**Why this is the answer to several different questions:**

- *"How do I know the numbers are right?"* — because the calculation layer is
  pure functions and can be tested directly, and `npm run reconcile` runs it
  from a terminal with no browser involved.
- *"How would you swap SQLite for Postgres?"* — only `db/` changes; nothing
  above it knows SQLite exists.
- *"How would you add a mobile app?"* — the calculation layer already has no
  framework in it, so an API would be a thin wrapper over functions that exist.
- *"How do you avoid double-counting?"* — costs are attributed **once**, in one
  file, and every page reads that result rather than recomputing.

---

## 3. Folder by folder

```
src/
  app/                    one folder per URL
    page.tsx                /                dashboard
    layout.tsx              the frame around every page
    globals.css             Tailwind + the colour tokens
    projects/page.tsx       /projects
    projects/[refCode]/     /projects/Q2025001a
    productivity/page.tsx   /productivity
    categories/page.tsx     /categories
    departments/page.tsx    + [name]/ for the drill-down
    upload/                 page.tsx + upload-form.tsx + actions.ts + types.ts
    settings/               page.tsx + assumptions-form.tsx + actions.ts

  components/
    layout/app-shell.tsx    sidebar + main column
    layout/nav.tsx          the links ('use client', needs usePathname)
    filters/period-filter.tsx  year/month dropdowns ('use client')
    ui/                     shadcn/ui primitives — button, table, select, ...
    ui-kit/                 this app's own small kit built on top of ui/
      data-table.tsx          the table every page uses
      stat-card.tsx           the big number tiles
      data-health.tsx         the reconciliation note + gaps panel
      bars.tsx                the two charts
      page-header.tsx         title / eyebrow / description / actions
      export-csv-button.tsx   ('use client', needs onClick)
      empty-state.tsx         "no data yet" panels

  lib/
    domain/               THE CALCULATION LAYER — no React, no SQL
      cost-model.ts         rates, the indirect pool, costing, gaps, reconciliation
      aggregate.ts          every view the pages need
      period.ts             year/month handling and labels
      types.ts              the vocabulary of the whole app
    ingest/               spreadsheet -> typed rows + issues
      workbook.ts           ExcelJS -> a plain grid of cells
      header.ts             finds the header row wherever it is
      cells.ts              "-" -> null, "AED 1,250" -> 1250, "May '25" -> 2025-05
      timesheet.ts / salaries.ts / projects.ts    one parser per file type
      errors.ts / types.ts / index.ts
    db/
      client.ts             opens SQLite, one handle
      schema.ts             the tables
      repository.ts         reads, writes, and the re-upload rules
      settings.ts           assumptions (billable categories, overhead)
    model.ts              builds the CostModel once per request
    format.ts             money / hours / percent formatting
    csv.ts                CSV serialisation for the export button
    period-params.ts      URL <-> period filter
    utils.ts              cn() — merges Tailwind class names

scripts/     seed, reconcile, reset      (plain Node via tsx)
tests/       4 files, 43 tests
sample-data/ the clean workbooks, plus messy/ copies that are deliberately broken
data/        margin.db — created by seed/upload, gitignored
```

### The naming convention worth noticing

`ui/` holds generic primitives (a `Button` knows nothing about margins).
`ui-kit/` holds this app's vocabulary (a `StatCard` knows about labels, hints
and tone). If they ask why two folders: *"`ui/` is vendor code from shadcn that
I could regenerate; `ui-kit/` is mine. Keeping them apart means a shadcn update
never fights my components."*

---

## 4. Journey one: loading the dashboard

Follow along with the files open. This is the journey most likely to be asked
about.

**URL:** `http://localhost:3000/?year=2025&month=3`

### Step 1 — Next picks the file

`src/app/page.tsx`, because the path is `/`. `layout.tsx` runs first and
provides the sidebar.

### Step 2 — the page asks for the model

```tsx
const model = getCostModel();
```

`src/lib/model.ts`:

```ts
export const getCostModel = cache((): CostModel => {
  const inputs = loadModelInputs();
  return buildCostModel({ ...inputs, assumptions: readAssumptions() });
});
```

### Step 3 — the database is read

`src/lib/db/repository.ts` → `loadModelInputs()` runs three plain SELECTs:

```sql
SELECT ... FROM timesheet_entries ORDER BY year, month, employee_name, category
SELECT ... FROM salaries          ORDER BY year, month, employee_name
SELECT ... FROM projects          ORDER BY ref_code
```

Then it maps `snake_case` columns to `camelCase` objects (`toEntry`,
`toSalary`, `toProject`) and calls `reconcileEmployeeKeys`, which stitches
together a person who appears with an employee number in one sheet and only a
name in another.

**Note the scope:** the model is *always* built over **all** loaded data, never
filtered at the database. That matters for revenue, and §6 of
`03-the-maths-baby-steps.md` explains why.

### Step 4 — the maths runs

`src/lib/domain/cost-model.ts` → `buildCostModel()` returns one `CostModel`
object containing:

| Field | What it holds |
| --- | --- |
| `entries` | every timesheet row, now carrying `directCost`, `indirectCost`, `allocatedCost`, `recognisedRevenue`, `isBillable` |
| `months` | per-month rates: pool, indirect rate, billable hours, salary total |
| `projects` | the price list |
| `projectHours` | total billable hours per ref code |
| `gaps` | everything the data could not answer |
| `reconciliation` | the self-check |
| `categories`, `departments`, `assumptions` | supporting lists |

### Step 5 — the URL becomes a filter

```tsx
const years = availableYears(model);
const filter = resolvePeriod(await searchParams, years);   // { year: 2025, month: 3 }
```

`resolvePeriod` (`src/lib/period-params.ts`) is defensive: an unparseable year
falls back to the newest year with data; a month outside 1–12 is ignored; `all`
means "no filter". A dashboard should never be broken by a hand-edited URL.

### Step 6 — the page slices the model

```tsx
const entries  = filterEntries(model, filter);
const totals   = summarise(entries);
const projects = projectSummaries(model, filter).filter((s) => s.hours > 0);
const departments = departmentBreakdown(entries);
const months      = monthlyPoints(entries);
```

All of those live in `src/lib/domain/aggregate.ts` and are pure: arrays in,
arrays out. Nothing here recalculates cost — it only *sums* `allocatedCost`,
which is why totals can never disagree between pages.

### Step 7 — it renders

`StatCard` tiles, the `ReconciliationNote`, the `GapsPanel`, then `DataTable`s.
Each table receives a `columns` array and a `rows` array. React turns it into
HTML on the server; the HTML goes to the browser.

**The single sentence for this journey:** *"The page reads the database, builds
one costed model, slices it for the chosen period, and renders it. There is no
API, no client-side fetching, and no place where a number is computed twice."*

---

## 5. Journey two: uploading a corrected March timesheet

This is the journey that shows judgement, and the brief explicitly asks for it.

### Step 1 — the browser

`src/app/upload/upload-form.tsx` (`'use client'`) has three file inputs named
`timesheet`, `salaries`, `projects`, and:

```tsx
const [state, action, uploading] = useActionState(uploadDatasets, IDLE_UPLOAD_STATE);
...
<form action={(formData) => { setSideState(null); action(formData); }}>
```

### Step 2 — the server action

`src/app/upload/actions.ts` (`'use server'`) → `uploadDatasets(prev, formData)`:

1. For each of the three slots, if a file was supplied and is under 20 MB,
   convert it to a `Buffer`.
2. Call `ingest(kind, buffer, filename)`.
3. `revalidatePath('/', 'layout')` so every page re-renders.
4. Return an array of `DatasetOutcome` objects — which the form then displays as
   cards, including every warning found.

### Step 3 — parsing

`src/lib/ingest/index.ts` → `parseDataset(kind, buffer, filename)`:

- `workbook.ts` turns the `.xlsx` into a plain 2-D array of cells (`Grid`). The
  point of this step is that every parser below is testable with a literal
  array — no Excel file needed.
- `header.ts` → `locateHeader()` scans the first 20 rows, scoring each on how
  well its cells match the expected column captions, and takes the best. That is
  how a sheet with two rows of preamble still works.
- `cells.ts` cleans each value: `-` and `n/a` become `null`; `"AED 1,250"` and
  `"12,500"` become numbers; `(500)` becomes `-500`; `"May '25"`,
  `"March 2025"`, `"Mar-25"`, a real date cell and an Excel serial number all
  become `{ year, month }`.
- The per-type parser (`timesheet.ts`, `salaries.ts`, `projects.ts`) produces
  typed rows **plus** an `issues` array. Nothing is silently dropped: a bad row
  becomes a visible warning.

### Step 4 — saving

`src/lib/db/repository.ts` → `saveDataset()`, all inside **one transaction**:

```ts
return db.transaction((): SaveOutcome => {
  const uploadId = insertUpload(result, filename);
  switch (result.kind) {
    case 'timesheet': return { uploadId, ...writeTimesheet(result.rows, result.periods, uploadId) };
    case 'salaries':  return { uploadId, ...writeSalaries(result.rows, uploadId) };
    case 'projects':  return { uploadId, ...writeProjects(result.rows, uploadId) };
  }
})();
```

The three rules, one per file type — **learn these, they are a guaranteed
question:**

| File | Rule | Why |
| --- | --- | --- |
| Timesheet | **delete then insert, per month present in the file** | There is no natural row key — one person can legitimately log two rows in the same category in the same month. Replace-by-period is the only rule that is both idempotent and correct. A file containing only March replaces March; the other eleven months are untouched. |
| Salaries | **upsert on (employee_no, year, month)** | One salary per person per month is a real key. A blank cell was already dropped at parse time, so re-uploading a partial sheet cannot zero a month that was already right. |
| Projects | **upsert on ref_code** | Projects absent from the file survive. A duplicate ref code in one file resolves to the later row, and the collision is reported. |

Every upload also writes a row into the `uploads` table — filename, sheet,
detected header row, row count, skipped rows, periods and the full issue list —
so you can always see what a file did. That is the Data page's history section.

### Step 5 — back to the screen

`revalidatePath` invalidated everything, so the dashboard's next render calls
`getCostModel()` again, re-reads SQLite, and re-runs the maths. Nothing is
cached across the write.

---

## 6. The database, in one look

`src/lib/db/schema.ts` — four tables, created idempotently every time the
database is opened:

```
uploads            id, kind, filename, sheet_name, header_row,
                   row_count, skipped_rows, periods(json), issues(json), uploaded_at

timesheet_entries  id, year, month, employee_no, employee_name, expense_type,
                   department, designation, category, ref_code, task_name,
                   company, description, hours, upload_id
                   + indexes on (year,month), ref_code, employee_no

salaries           employee_no, employee_name, year, month, amount, upload_id
                   PRIMARY KEY (employee_no, year, month)     <- enables the upsert

projects           ref_code PRIMARY KEY, name, price, sales_year, sales_month,
                   category, status, upload_id

settings           key PRIMARY KEY, value      <- billable categories, overhead, data_version
```

Two pragmas in `migrate()`:

```ts
db.pragma('journal_mode = WAL');   // readers don't block the writer
db.pragma('foreign_keys = ON');    // SQLite has FKs off by default
```

`data/margin.db-wal` and `-shm` in the folder are just WAL's side files.

**If asked "where are your migrations?"** — be honest: *"There is no migration
framework. The schema is created idempotently on open, which is the right amount
of machinery for a local tool at this size. The moment a second person runs it
against a database they care about, it isn't — that is in NOTES.md."*

---

## 7. Where each number on screen comes from

Handy if they point at the screen and ask "where does that come from?"

| On screen | Function | File |
| --- | --- | --- |
| Dashboard stat tiles | `summarise()` | `domain/aggregate.ts` |
| Project table rows | `projectSummaries()` | `domain/aggregate.ts` |
| Project detail page | `projectDetail()` | `domain/aggregate.ts` |
| Per-person contribution | `employeeContributions()` | `domain/aggregate.ts` |
| Productivity page | `employeeProductivity()` | `domain/aggregate.ts` |
| Categories page | `categoryBreakdown()` + `employeeCategoryMatrix()` | `domain/aggregate.ts` |
| Departments | `departmentBreakdown()` + `projectRollup()` | `domain/aggregate.ts` |
| Month-by-month table | `monthlyPoints()` | `domain/aggregate.ts` |
| "Balanced" note | `model.reconciliation` | `domain/cost-model.ts` |
| Gaps panel | `model.gaps` | `domain/cost-model.ts` (`findGaps`) |
| Every money/percent string | `formatMoney` / `formatPercent` / `formatHours` | `lib/format.ts` |

---

## 8. One component worth understanding properly: `DataTable`

Every table in the app is this one component, and it contains a design decision
worth explaining.

```ts
export interface Column<Row> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  value: (row: Row) => CsvValue;   // the plain number or string
  render?: (row: Row) => ReactNode; // optional rich cell
  className?: string;
  headerClassName?: string;
}
```

Two functions per column, and that is the point:

- `value` is the **data** — a number or a plain string.
- `render` is the **presentation** — a link, a coloured figure, a bar.

The CSV export is built from `value`:

```tsx
const matrix: CsvValue[][] = [
  columns.map((column) => column.header),
  ...rows.map((row) => columns.map((column) => column.value(row))),
];
```

So **what you export can never drift from what is on screen.** Add a column and
the CSV updates itself. That is the whole argument for the abstraction, and it
is a strong thing to say when they ask why you built a table component instead
of writing `<table>` in each page.

`Column<Row>` is a **generic**: `Column<ProjectSummary>` guarantees that
`row.project.refCode` type-checks inside the column definitions. If they ask
about TypeScript, this is the best example in the codebase.

---

## 9. What is deliberately *not* here

Be ready to say these, because naming your own omissions is a strong move:

- **No authentication.** Local tool for one agency, as specified.
- **No API routes.** Server components read; Server Actions write.
- **No client-side state library.** The URL holds the filter; the server holds
  everything else.
- **No charts beyond two.** A bar chart for where time goes, a diverging bar for
  margin. Eleven projects do not need a scatter plot.
- **No editing data in the UI.** The spreadsheets stay the source of truth; the
  app is a read model over them. Letting someone patch a salary in the dashboard
  would create a second source of truth.
- **No migration framework, no streaming uploads.** Both in `NOTES.md` with the
  reason.

---

Next: `03-the-maths-baby-steps.md` — the part worth 30% of the grade.
