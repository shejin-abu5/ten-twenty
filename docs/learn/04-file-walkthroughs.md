# Walking them through a file

> "we will pick a file and ask you to walk us through it"

They pick, not you. So you need two things: rehearsed scripts for the likely
picks, and a **method** for a file you have not rehearsed.

---

## 0. The method — works on any file

Whatever they open, say these four things in this order. It takes 60 seconds and
it sounds like someone who designed the file rather than someone reading it.

1. **What this file is responsible for, in one sentence.**
   *"This is the only place cost is attributed. Everything else reads the
   result."*
2. **What it does NOT know about.**
   *"It has no idea SQLite exists, and no React in it — that's why the terminal
   script can run it."*
3. **Top to bottom, in chunks, not lines.** Types → entry point → helpers.
   Never read code aloud; say what each chunk is *for*.
4. **Point at one decision and name the alternative.**
   *"This line is where I chose X over Y, because…"*

Then stop and ask: *"Want me to go deeper on any part of that?"* Letting them
steer is better than talking for four minutes.

**If you genuinely do not remember a line:** say so and read it. *"Let me read
that back — it's the guard for the case where… yes, that's the divide-by-zero
path."* Reading your own code in front of someone is normal. Bluffing is not.

---

## 1. Most likely pick: `src/lib/domain/cost-model.ts`

It is the heart of the exercise. Rehearse this until it is fluent.

### The one-liner

> "This is the only file that attributes cost. It takes plain rows — timesheet
> entries, salaries, prices — and returns a fully costed dataset. It has no
> knowledge of SQLite, React or Next, which is why `npm run reconcile` can run
> the same arithmetic from a terminal with no browser."

### Then walk the six beats

**Beat 1 — `buildCostModel` sets up.**

```ts
const billable = new Set(assumptions.billableCategories);
const overhead = Number.isFinite(assumptions.monthlyOverhead)
  ? Math.max(0, assumptions.monthlyOverhead)
  : 0;

const entriesByPeriod  = groupBy(entries,  (e) => periodId(e.year, e.month));
const salariesByPeriod = groupBy(salaries, (s) => periodId(s.year, s.month));

const periodIds = [...new Set([...entriesByPeriod.keys(), ...salariesByPeriod.keys()])].sort(...);
```

> "Billable categories come from settings, not from a constant, so they're
> editable in the UI. Overhead is clamped — a negative overhead is nonsense and
> I'd rather coerce than crash. Then rows are grouped by period. **The
> important line is the union**: I take the periods from the timesheet *and*
> from the salaries. A month with payroll but no timesheet still exists — that's
> exactly how unabsorbed cost gets detected. If I'd only iterated timesheet
> months, that salary would silently vanish from the company's cost."

`periodId` is `year * 100 + month`, so 2025-07 is `202507` — a sortable number
that works as a `Map` key. Cheap and it makes the sort trivial.

**Beat 2 — per-month rates.**

```ts
const rates = computeMonthlyRates({ year, month, entries: monthEntries, salaries: monthSalaries, billable, overhead });
```

> "That function is the brief's arithmetic for one month, and it keeps the
> working rather than only returning a rate — which is what makes the audit
> page possible. For each person it builds salary, total hours, the
> billable/non-billable split, the direct rate, and the value they push into
> the pool."

Inside it, the shape worth pointing at:

```ts
rate.directRate      = rate.totalHours > 0 ? rate.salary / rate.totalHours : 0;
rate.nonBillableValue = rate.nonBillableHours * rate.directRate;

if (rate.totalHours > 0) nonBillableCost += rate.nonBillableValue;
else                     unloggedSalaryCost += rate.salary;
```

> "Two routes into the pool. Someone who logged hours contributes the value of
> their non-billable time; someone who logged nothing contributes their whole
> salary. Both are tracked separately because the audit page shows them as
> separate columns — they're economically the same but they come from different
> places, and a finance person will want to see which."

**Beat 3 — the pool and the guard.**

```ts
const indirectPool = unloggedSalaryCost + nonBillableCost + overhead;
const indirectRate = billableHours > 0 ? indirectPool / billableHours : 0;
...
unabsorbedPool: billableHours > 0 ? 0 : indirectPool,
```

> "Pool divided by billable hours — guarded, because a month with no billable
> hours at all would be a divide by zero. Rather than inventing a number or
> hiding it, that pool is reported as *unabsorbed*: it shows on the dashboard,
> in the audit, and as its own line in the reconciliation. It's the only way the
> balance check can fail, so it deserves to be visible."

**Beat 4 — costing every row. This is the line to linger on.**

```ts
const isBillable   = billable.has(entry.category);
const directCost   = entry.hours * (directRate.get(entry.employeeNo) ?? 0);
const indirectCost = isBillable ? entry.hours * rates.indirectRate : 0;
costed.push({
  ...entry,
  isBillable, directCost, indirectCost,
  allocatedCost: isBillable ? directCost + indirectCost : 0,
  recognisedRevenue: 0,
});
```

> "`allocatedCost` is zero on non-billable rows, and that's the line that makes
> double-counting impossible to express. Their direct cost is already inside the
> pool, and the pool is already spread over billable hours — adding it again is
> precisely the double-count the brief warns about. Because every page just sums
> `allocatedCost`, no page can get this wrong. I know that matters because I
> shipped that exact bug on the Categories page and caught it with the
> reconciliation."
>
> "`?? 0` is the missing-salary case: someone with hours and no salary row costs
> zero and is reported as a gap. Guessing a salary would put invented money into
> the reconciliation."

**Beat 5 — revenue, and why it happens second.**

```ts
const projectHours = new Map<string, number>();
for (const entry of costed) {
  if (!entry.isBillable || !entry.refCode) continue;
  projectHours.set(entry.refCode, (projectHours.get(entry.refCode) ?? 0) + entry.hours);
}
...
entry.recognisedRevenue = price * (entry.hours / total);
```

> "Revenue is attributed in a second pass because it needs each project's total
> hours across the whole dataset — you can't know a row's share until you've
> seen every row. A project's price is one number for its whole life, so the
> question is which month earned it. I pro-rate by hours, so cost and revenue
> land in the same month; the shares always add back to the full price. The
> alternative was booking it all at the sale, which makes every later month of
> work a pure loss. The argument for my choice is that the brief already splits
> by hour share for the employee revenue share — I'm applying the same idea to a
> different axis."

**Beat 6 — the honesty layer.**

```ts
gaps: findGaps(costed, months, projects, projectHours),
reconciliation: reconcile(costed, months),
```

> "`findGaps` produces the list of things the data couldn't answer — people with
> hours and no salary, ref codes with no price, projects priced but never
> worked, months with cost and no billable hours — each with a magnitude so the
> list sorts by how much it matters. `reconcile` is the brief's self-check:
> expected cost is salaries plus overhead, and it must equal allocated plus
> unabsorbed. Tolerance is one fils, because anything under that is
> floating-point noise rather than a modelling error. It's on screen at the top
> of the dashboard, so nobody has to take the numbers on trust."

### The follow-ups they will ask here

- *Why total hours not billable hours in the direct rate?* — see
  `03-the-maths-baby-steps.md` §5. **Know this cold.**
- *How do you know it doesn't double-count?* — the four-line proof, §6 there.
- *Why is `projectHours` computed twice-ish / why walk the list again?* — be
  honest: *"`projectSummaries` walks the entry list more than once. At 562 rows
  nobody notices and the clarity is worth more than the passes. At 50,000 rows
  I'd group once and derive everything from that grouping — it's in NOTES.md."*

---

## 2. Second most likely: `src/lib/db/repository.ts`

### The one-liner

> "This is the only file that talks to SQLite, and it owns the re-upload rules —
> which is the part of the brief about a corrected month not duplicating or
> destroying the rest of the year."

### The beats

**`saveDataset` — one transaction.**

```ts
return db.transaction((): SaveOutcome => {
  const uploadId = insertUpload(result, filename);
  switch (result.kind) { ... }
})();
```

> "Everything an upload does is one transaction: the audit record and the rows
> land together or not at all. That's most of the reason I chose SQLite over
> JSON files — the re-upload rule *is* a transaction."

**The three rules.** Say them as three sentences with the *reason* attached:

```ts
// timesheet
const remove = db.prepare('DELETE FROM timesheet_entries WHERE year = ? AND month = ?');
for (const period of periods) remove.run(period.year, period.month);
```

> "Timesheet is replace-by-period: I delete the months *present in the file* and
> re-insert them. There's no natural row key — one person can legitimately log
> two rows in the same category in the same month — so row-level upsert isn't
> available. Replace-by-period is the only rule that's both idempotent and
> correct: uploading the same file twice is a no-op, and a file containing only
> March leaves the other eleven months untouched."

```ts
// salaries
ON CONFLICT(employee_no, year, month) DO UPDATE SET ...
```

> "Salaries do have a natural key — one person, one month — so it's an upsert.
> Blank cells were already dropped at parse time, so a partial sheet can't
> silently zero a month that was already right. People absent from the file keep
> their salaries."

```ts
// projects
ON CONFLICT(ref_code) DO UPDATE SET ...
```

> "Projects upsert on ref code. Projects absent from the file survive, and a ref
> code appearing twice in one file resolves to the later row with the collision
> reported."

**`reconcileEmployeeKeys` — the interesting one.**

```ts
for (const record of [...inputs.entries, ...inputs.salaries]) {
  if (record.employeeNo.startsWith('name:')) continue;
  numberByName.set(nameKey(record.employeeName), record.employeeNo);
}
```

> "If a sheet has no employee-number column, the parser gives that row a
> name-derived key like `name:ayeshakhan`. If the *other* sheet did have
> numbers, the same person would appear twice — once with hours and no salary,
> once with a salary and no hours — and the reconciliation would report a false
> gap. So on read I build a name→number map from the rows that do have numbers
> and rewrite the name-keyed ones."
>
> "The known limit: two people with the same name and no employee numbers would
> merge. I report that rather than solve it, because solving it properly means
> an identity table the agency would have to maintain."

**`loadModelInputs` — three SELECTs, then mapping.**

> "`snake_case` in SQL, `camelCase` in the domain, and the mapping happens here
> so the domain types never carry the database's naming."

---

## 3. Third: `src/lib/ingest/cells.ts`

The messy-data file. Short and demo-able.

### The one-liner

> "Cell-level cleaning. Everything that turns what a human typed into a
> spreadsheet into a value the model can use, isolated here so it's testable
> with plain arrays and has no Excel dependency."

### The beats

```ts
const BLANK_TOKENS = new Set(['', '-', '--', '–', '—', 'n/a', 'na', 'nil', 'null', '#n/a', '#value!']);
```

> "Every spelling of 'nothing here' the three sheets actually use, including
> three different dash characters and Excel's own error strings."

```ts
export function parseNumber(value: RawCell): number | null {
```

> "Numbers arrive as numbers, as `1,250.00`, as `AED 1,250`, as `(500)` for a
> negative. **The rule is that anything unrecognisable returns null rather than
> zero** — a bad cell becomes a visible issue, not a silent zero. That
> distinction matters: a zero salary and a missing salary are different facts."

```ts
export function parseMonth(value: RawCell): ParsedMonth | null {
```

> "The month formats the agency actually uses: `May '25`, `January 2026`, a bare
> `January`, a real date cell, `2025-05`, `05/2025`, `Jan-25`, and Excel serial
> numbers. `ParsedMonth.year` is nullable because a bare 'January' names a month
> with no year, and the caller decides what to do with that."

**The bug story — tell it here.**

```ts
// A word that is not a month name means this is something else — "Q1" must
// not become January, and "Total 12" must not become December.
let hasUnknownWord = false;
...
if (hasUnknownWord) return null;
```

> "This flag exists because of a real defect. I wrote the messy-workbook test to
> demonstrate the handling and it found that `Q1` was parsing as January — the
> numeric fallback saw the `1`. It filed 20 hours in the wrong month and threw
> the reconciliation out by about 97,000. The fix is: if the cell contains a
> word that isn't a month name, refuse the numeric fallback entirely. A test
> that finds a bug you didn't know you had is the test earning its keep."

```ts
function matchMonthName(token: string): number | null {
  if (token.length < 3) return null;
```

> "`sept` and `jan` resolve; `j` and `ju` are too ambiguous to guess. I'd rather
> report an unreadable month than guess between June and July."

Also worth pointing at:

```ts
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
```

> "Excel's day zero, with the 1900 leap-year bug accounted for — which is why
> the serial-number branch guards on `value > 60`."

---

## 4. Fourth: `src/app/page.tsx` (the dashboard)

If they pick a page, they are testing whether you understand the Next model.

### The one-liner

> "A server component. It runs on the server during the request, reads the
> database directly, and returns HTML. There's no API call and no client-side
> fetching anywhere in this file."

### The beats

```tsx
export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const model = getCostModel();
  if (model.entries.length === 0) return (<><PageHeader .../><NoDataState /></>);
```

> "`async` because server components can await. `searchParams` is a promise in
> Next 16 — the framework starts rendering before it resolves dynamic request
> data. Empty-state guard first: an empty dashboard should tell you what to do
> next, not show a wall of zeros."

```tsx
const years  = availableYears(model);
const filter = resolvePeriod(await searchParams, years);
const entries = filterEntries(model, filter);
const totals  = summarise(entries);
```

> "The model is built over **all** data and filtered only here, for display —
> because revenue pro-rating divides by a project's whole-life hours. Filtering
> at the database would silently change every project's revenue when you pick a
> month."

> "`resolvePeriod` is deliberately forgiving: an unparseable year falls back to
> the newest year with data, an out-of-range month is ignored. A hand-edited URL
> shouldn't break a dashboard."

Then the render: stat tiles, the reconciliation note, the gaps panel, the
project table sorted by margin, month-by-month, departments.

```tsx
footer={{
  ref: 'Total',
  hours: formatHoursPlain(projects.reduce((t, p) => t + p.hours, 0)),
  ...
}}
```

> "Totals in the footer, because a finance table without a total row is an
> unfinished table."

And the column definitions at the bottom:

> "Columns are data, not markup. Each has a `value` for the CSV and an optional
> `render` for the screen, so the export can never drift from what's displayed."

---

## 5. Fifth: `src/components/ui-kit/data-table.tsx`

If they pick a component, they are testing design sense rather than arithmetic.

### The one-liner

> "Every table in the app is this component. The point of it is that a column is
> declared once, as data, and drives both the rendering and the CSV export."

```ts
export interface Column<Row> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  value: (row: Row) => CsvValue;    // data
  render?: (row: Row) => ReactNode; // presentation, optional
}
```

```tsx
const matrix: CsvValue[][] = [
  columns.map((c) => c.header),
  ...rows.map((row) => columns.map((c) => c.value(row))),
];
```

> "Two functions per column: `value` is the data, `render` is the presentation.
> The CSV is built from `value`, so adding a column updates the export for free
> and the two can never disagree. That's the entire justification for the
> abstraction — without it, every page would hand-roll a table and hand-roll an
> export, and they'd drift the first time someone added a column."

> "`Column<Row>` is generic, so `Column<ProjectSummary>` type-checks
> `row.project.refCode` inside the definitions. And `bare` lets a table render
> without its card when it's nested inside another panel — that came from an
> actual layout problem on the department drill-down, not from speculation."

**If they ask what you'd change:** *"Sorting. It's the highest-value missing
feature — a director looking at eleven projects wants to sort by cost. I'd do it
URL-driven, like the period filter, so a sorted view stays shareable. It's in
NOTES.md as the first thing I'd build."*

---

## 6. If they pick something else

| File | Your one-liner |
| --- | --- |
| `domain/aggregate.ts` | "Every view the pages need, derived from costed entries. Pure array-in/array-out. Nothing here recalculates cost — it only sums `allocatedCost`, which is why pages can't disagree." |
| `domain/period.ts` | "Year/month handling. `periodId` packs a period into a sortable number for Map keys; `PeriodFilter` with nullable year and month expresses 'this month', 'this year', 'everything'." |
| `domain/types.ts` | "The vocabulary of the whole app. If a reviewer reads one file to understand the domain, it should be this one." |
| `ingest/header.ts` | "Finds the header row wherever it is — scores every row in the first 20 on how well its cells match expected captions, best row wins. That's how a sheet with two rows of preamble still parses." |
| `ingest/workbook.ts` | "ExcelJS into a plain grid. One job: make every parser below testable with a literal array instead of an .xlsx fixture." |
| `db/client.ts` | "Opens SQLite. The handle hangs off `globalThis` because Next replaces modules on hot reload and a module-level variable would leak a connection each time." |
| `db/schema.ts` | "Four tables, created idempotently on open. WAL so readers don't block the writer, and foreign keys on because SQLite defaults them off." |
| `lib/model.ts` | "Builds the CostModel once per request. `cache()` is React's request-scoped dedupe, so five tables on a page still read the database once." |
| `lib/format.ts` | "All formatting in one place, via `Intl`. Note `toneOf`: only losses are coloured — painting every healthy number green turns a table into a traffic light and hides the two rows that need attention." |
| `app/upload/actions.ts` | "The Server Action. Size check, parse, save, `revalidatePath`, and return an outcome per file so the UI can be specific about what each upload did." |
| `app/settings/actions.ts` | "Writes the assumptions. It re-validates overhead server-side because a Server Action is a public endpoint — client validation is UX, not security." |

---

## 7. Three sentences to have ready for *any* file

- *"The reason this is separate is…"* (a boundary you chose)
- *"The alternative here was…, and it costs…"* (a trade-off)
- *"The thing I'd change is…"* (self-awareness)

If you can say those three about a file, you have walked them through it —
regardless of whether you can recite every line.

---

Next: `05-interview-qa.md`.
