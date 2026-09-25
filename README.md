# Margin Dashboard

Turns the agency's three spreadsheets into a tool that answers one question:
**did we actually make money on that project?**

Local-only. No cloud account, no API key, no paid service.

---

## Running it

Requires Node 20.9 or newer (developed on Node 22).

```bash
npm install
npm run seed     # loads the sample year so the dashboard opens populated
npm run dev      # http://localhost:3000
```

That's it. `npm run seed` writes `data/margin.db`, a local SQLite file, and the
dashboard opens on 2025 with every page already populated. If you would rather
load the data through the UI, skip the seed and press **Load sample year** on the
Data page.

### Other commands

| Command | What it does |
| --- | --- |
| `npm run reconcile` | Prints the year's totals and runs the brief's self-check in the terminal |
| `npm test` | Tests for the cost model, the parsers, re-upload behaviour, and the sample workbooks |
| `npm run seed -- --reset` | Wipes the database first, then reloads the sample year |
| `npm run db:reset` | Empties every table |
| `npm run typecheck` / `npm run lint` | Both clean |

### Checking the numbers without opening the app

```
$ npm run reconcile

Self-check
  total salaries       2,400,000.00
  total overhead       0.00
  expected cost        2,400,000.00
  allocated to work    2,400,000.00
  unabsorbed           0.00
  difference           0.00
  BALANCED
```

The same check is on screen at the top of the dashboard, so nobody has to take
the numbers on trust.

---

## What's in it

| Page | What it answers |
| --- | --- |
| **Dashboard** | Hours, billable hours, cost, revenue and margin for a period, with every project ranked by margin |
| **Projects** | All projects; click one for price, hours by department, cost, profit, margin and a per-person contribution table |
| **Productivity** | Billable ÷ total hours per person, filterable by month and year |
| **Categories** | Where the time goes, plus the person × category pivot finance builds by hand |
| **Departments** | Hours and cost per department; click one for the people inside it |
| **Data** | Upload the three files, see what each upload changed, and the parse history |
| **Assumptions** | Which categories are billable, and the monthly overhead — no code editing |

Every table exports to CSV from the button in its header. The period filter lives
in the URL, so a filtered view is a link you can paste into an email.

---

## The maths

Implemented exactly as the brief specifies, in `src/lib/domain/cost-model.ts`.

```
direct cost rate/hour   = that month's salary ÷ that month's total logged hours
indirect cost pool      = salaries of people who logged nothing
                        + everyone else's non-billable time at their direct rate
                        + monthly overhead
indirect cost rate/hour = indirect pool ÷ billable hours that month
employee cost           = hours × (direct rate + indirect rate)
employee revenue share  = price × (employee hours ÷ total project hours)
project profitability   = (price − total cost) ÷ price
productivity            = billable hours ÷ total hours
```

**Why it balances.** Summing the cost charged to a month's billable hours gives

```
Σ billable hours × direct  +  billable hours × (pool ÷ billable hours)
= Σ billable hours × direct  +  pool
= Σ billable hours × direct  +  Σ non-billable hours × direct  +  unlogged salaries  +  overhead
= Σ total hours × direct     +  unlogged salaries  +  overhead
= salaries of people who logged hours + salaries of people who didn't + overhead
= that month's payroll + overhead
```

So the reconciliation is a property of the model, not a coincidence — which is
why non-billable time carries `allocatedCost = 0`. Its cost is already inside the
pool that billable hours absorb, and adding it again is precisely the
double-count the brief warns about.

---

## Assumptions

The brief left these open. Each is a decision, not a default.

**Revenue is recognised pro-rata by hours.** A project price is one number for
the whole contract, but cost lands month by month. Charging the full price to the
month of sale would make every other month look like a pure loss. So a month
earns `price × (hours that month ÷ total project hours)` — the same hour-share
split the brief already uses for an employee's revenue share. The shares always
add back to the full price. Project pages show whole-life figures against the
whole-life price, which is the only way "did we make money on it" has an answer.

**Billable means the three categories the brief names** — `Projects`,
`Enhancements`, `Hosting` — and this is editable on the Assumptions page without
touching code. Moving a category between billable and internal changes *where*
cost lands, never the total.

**A person with hours but no salary row costs zero**, and is listed as a gap on
every page. The alternative — guessing a salary — would put invented money into
the reconciliation.

**A blank or `-` salary cell means "not provided", not "paid nothing."** It is
skipped on import, so re-uploading a partial sheet cannot silently zero a month
that was already correct.

**Employee number is the join key.** If a sheet has no employee-number column, a
normalised name is used instead, and the two are stitched together on read so one
person never appears twice.

**A month with cost but no billable hours** has nothing to spread its pool
across. Rather than hide it or divide by zero, that amount is reported as
unabsorbed on the dashboard, and is excluded from the balance check as a
separate line.

**Overhead is one figure applied to every loaded month.** The brief says "a
monthly overhead figure", so it is one number, not twelve.

---

## Re-upload behaviour

The brief asks that a corrected month not duplicate or destroy the rest of the
year. The rules are per file type, and shown on the Data page:

- **Timesheet** — the months *present in the file* are deleted and rewritten.
  A file containing only March replaces March; the other eleven months are
  untouched. Uploading the same file twice is a no-op, not a doubling.
- **Salaries** — upserted per person per month. Blank cells were dropped at parse
  time, so they leave stored figures alone. People absent from the file keep
  their salaries.
- **Project prices** — upserted per ref code. Projects absent from the file keep
  their price. A ref code appearing twice in one file resolves to the later row,
  and the collision is reported.

Each upload is recorded with its filename, sheet, detected header row, row count
and every issue found, so it is always possible to see what a file did.

---


## How it's put together

```
src/
  lib/
    domain/        the calculation layer — pure functions, no React, no database
      cost-model.ts    rates, the indirect pool, costed entries, gaps, reconciliation
      aggregate.ts     every view the pages need, derived from costed entries
      period.ts        year/month handling
    ingest/        spreadsheet → typed rows + a list of issues
      workbook.ts      ExcelJS → a plain grid, so parsers are testable with arrays
      header.ts        scores each row to find the header wherever it is
      cells.ts         "-" → null, "AED 1,250" → 1250, "May '25" → 2025-05
      timesheet.ts salaries.ts projects.ts
    db/            SQLite: schema, repository, settings
  components/      app shell, filters, and a small table/stat kit over shadcn/ui
  app/             one route per page; all data read in server components
```

The calculation layer is the part that matters and it is deliberately isolated:
it takes plain rows in and gives costed rows out, with no knowledge of SQLite,
React or Next. Everything on screen is a projection of one `CostModel` built once
per request, which is what makes double-counting structurally hard rather than
merely avoided.

**Stack.** Next.js 16 (App Router, server components), TypeScript, Tailwind v4,
shadcn/ui, SQLite via better-sqlite3, ExcelJS, Vitest.

**Why SQLite.** It persists across restarts with no service to run, and the
re-upload rules are naturally expressed as a transaction — delete the months in
the file, insert the new rows, all or nothing.

**Why ExcelJS rather than SheetJS.** SheetJS is the better parser, but the build
published to npm has two unfixable advisories against it. ExcelJS reads all three
workbooks, rejects non-workbooks cleanly, and keeps `npm audit` quiet on anything
that matters here.

---

## What I'd do differently

See `NOTES.md` for what I'd build next, what I cut, and what I'm not happy with.
