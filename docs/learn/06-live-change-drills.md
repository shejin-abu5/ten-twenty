# Live change drills

> "…and change something live"

This is the part you cannot fake and the part you can absolutely prepare. **Do
these with your hands, not your eyes.** Do each one, watch it work, then
`git checkout` the file and do it again until it takes under two minutes.

```bash
npm run dev          # leave this running in one terminal
npm test             # a second terminal, when a drill says so
git diff             # see what you changed
git checkout -- .    # undo everything and start again
```

**The narration rule:** never go silent. Say where you are going *before* you
open the file — *"that table's columns are at the bottom of the page file"* —
and say what you expect to happen *before* you save. Someone who narrates looks
like they know the codebase even when they pause to think.

---

## Drill 1 — Add a column to a table *(the most likely request)*

**Ask:** "Can you add cost per billable hour to the productivity table?"

**Where:** `src/app/productivity/page.tsx`, the `COLUMNS` array at the bottom.

**Say:** "Columns are declared as data at the bottom of the page — each one has
a `value` for the CSV and an optional `render` for the screen — so I'll add one
entry and the export updates itself."

**Step 1.** Add `formatRate` to the import from `@/lib/format`:

```tsx
import {
  formatHoursPlain,
  formatMoney,
  formatPercent,
  formatRate,
  percentValue,
  round,
} from '@/lib/format';
```

**Step 2.** Insert into `COLUMNS`, right after the `cost` entry:

```tsx
  {
    key: 'ratePerHour',
    header: 'Cost / billable hour',
    align: 'right',
    value: (row) => (row.billableHours > 0 ? round(row.cost / row.billableHours) : null),
    render: (row) =>
      formatRate(row.billableHours > 0 ? row.cost / row.billableHours : null),
  },
```

**Step 3.** Save. The page reloads with the column. Click the CSV button — the
column is in the file too.

**Say while it reloads:** "Note the guard — someone with no billable hours would
be a divide by zero, so that returns null, and `formatRate` renders null as an
em dash rather than a misleading 0.00. That's the same rule the rest of the app
follows: a missing value and a zero are different facts."

**Bonus if they like it:** the footer is keyed by column key, so adding
`ratePerHour: formatRate(totals.billableHours > 0 ? totals.cost / totals.billableHours : null)`
to the `footer` object gives the total row too.

---

## Drill 2 — Change an assumption with no code at all *(rehearse this one most)*

**Ask:** anything about configurability, billable categories, or "what if we
decided hosting wasn't billable?"

This is the best fifteen seconds in the whole demo, because it shows
configurability *and* the reconciliation at once.

1. Go to **Assumptions**.
2. Untick **Hosting** (644 hours).
3. Save.
4. Go to the **Dashboard**.

**Say:** "Hosting's 644 hours just moved from billable to internal. The indirect
pool got bigger, so every month's indirect rate went up, every project's cost
shifted, and the hosting project now earns no revenue. **And total cost is still
exactly 2,400,000, still balanced.** Moving a category changes *where* the cost
lands. It can never change the total, because the total is payroll."

Then type `10000` into monthly overhead, save, and go back:

"Now total cost is 2,520,000 — payroll plus twelve months of overhead — and it
still balances, because expected cost is defined as salaries plus overhead.
Every margin fell. Revenue didn't move."

**Put it back afterwards:** re-tick Hosting, set overhead to 0.

---

## Drill 3 — Re-sort a table *(a ten-second change)*

**Ask:** "Can you show the most expensive projects first instead?"

**Where:** `src/app/page.tsx`, the `rows` prop of the Projects `DataTable`.

**From:**

```tsx
rows={[...projects].sort((a, b) => (a.margin ?? Infinity) - (b.margin ?? Infinity))}
```

**To:**

```tsx
rows={[...projects].sort((a, b) => b.cost - a.cost)}
```

**Say:** "`[...projects]` first, because `sort` mutates — I don't want to reorder
the array the rest of the page is using. The `?? Infinity` in the original is
there so a project with no price, and therefore no margin, sorts last instead of
polluting the top of a worst-first list."

**Then volunteer the real answer:** "Doing it properly means sorting from the
URL like the period filter, so a sorted view is still a link you can send
someone. That's the first item in NOTES.md — about a day's work."

---

## Drill 4 — Add a stat tile

**Ask:** "Can you show how many projects are loss-making?"

**Where:** `src/app/page.tsx`, inside `<StatGrid>`.

```tsx
<StatCard
  label="Loss-making"
  value={String(projects.filter((p) => (p.margin ?? 0) < 0).length)}
  hint="Projects where cost exceeded revenue"
  tone="text-negative"
/>
```

**Say:** "`StatGrid` is a five-column grid at XL, so a sixth tile wraps to the
next row — if this were permanent I'd either drop a tile or change the grid.
`tone` takes a class name; the palette has `text-negative` and `text-positive`
as tokens, so colours aren't hard-coded per page."

---

## Drill 5 — Surface a model number the UI doesn't show yet *(the hard one)*

**Ask:** "Can you show each month's indirect rate on the dashboard?"

This is the drill worth practising twice, because it touches the model, not just
the view — and it shows you know why `projectColumns(query)` is a *function*
while `MONTH_COLUMNS` is a const.

**Where:** `src/app/page.tsx`.

**Say first:** "The rate already exists — `model.months` carries per-month rates
from the cost model. The month table's rows are `MonthlyPoint`s, which don't
carry it, so I'll index the rates by period and close over that. That means
turning `MONTH_COLUMNS` from a constant into a function, the same shape as
`projectColumns`."

**Step 1.** In the component body, after `const months = monthlyPoints(entries);`:

```tsx
const indirectRates = new Map(model.months.map((m) => [m.year * 100 + m.month, m.indirectRate]));
```

**Step 2.** Change `columns={MONTH_COLUMNS}` to `columns={monthColumns(indirectRates)}`.

**Step 3.** Change the declaration at the bottom from

```tsx
const MONTH_COLUMNS: Column<MonthlyPoint>[] = [
```

to

```tsx
function monthColumns(rates: Map<number, number>): Column<MonthlyPoint>[] {
  return [
```

…and close it with `];` → `  ];\n}`. Then add the new column before `margin`:

```tsx
    {
      key: 'indirect',
      header: 'Indirect rate',
      align: 'right',
      value: (row) => round(rates.get(row.year * 100 + row.month) ?? 0),
      render: (row) => formatRate(rates.get(row.year * 100 + row.month)),
    },
```

**Step 4.** Add `formatRate` to the `@/lib/format` import.

**Say:** "`year * 100 + month` is the same period key the cost model uses —
`periodId` in `domain/period.ts` — a sortable integer that works as a Map key. I
could import `periodId` here instead of inlining it, and for anything permanent
I would."

**Expected output:** rates between 48.44 and 66.87 across the year, November
lowest because it had the most billable hours.

---

## Drill 6 — Add server-side validation

**Ask:** "What if someone types a ridiculous overhead?"

**Where:** `src/app/settings/actions.ts`.

**From:**

```ts
if (!Number.isFinite(monthlyOverhead) || monthlyOverhead < 0) {
  return { status: 'error', message: 'Monthly overhead must be a number of zero or more.' };
}
```

**To:**

```ts
const MAX_OVERHEAD = 10_000_000;

if (!Number.isFinite(monthlyOverhead) || monthlyOverhead < 0) {
  return { status: 'error', message: 'Monthly overhead must be a number of zero or more.' };
}
if (monthlyOverhead > MAX_OVERHEAD) {
  return {
    status: 'error',
    message: `Monthly overhead above ${MAX_OVERHEAD.toLocaleString('en-AE')} looks like a typo. Check the figure.`,
  };
}
```

(Put the `const` at module scope, above the function.)

**Say:** "This is a Server Action, which means it's a public HTTP endpoint —
anyone can post to it, so the check has to live here and not only in the form.
The input is validated before anything is written, and the error comes back
through `useActionState` and renders in the form. Client-side validation is UX;
this is the real thing."

Test it: type `99999999` on the Assumptions page and save.

---

## Drill 7 — Add a whole new page

**Ask:** "Could you break this down by client?"

Timesheet rows already carry a `company` field that nothing displays, so this is
a genuine feature, not a rename.

**Step 1 — the aggregate.** In `src/lib/domain/aggregate.ts`, next to
`departmentBreakdown`:

```ts
export interface ClientBreakdown {
  client: string;
  hours: number;
  cost: number;
  revenue: number;
  margin: number | null;
}

export function clientBreakdown(entries: CostedEntry[]): ClientBreakdown[] {
  const map = new Map<string, ClientBreakdown>();

  for (const entry of entries) {
    const key = entry.company ?? 'Unassigned';
    let row = map.get(key);
    if (!row) {
      row = { client: key, hours: 0, cost: 0, revenue: 0, margin: null };
      map.set(key, row);
    }
    row.hours += entry.hours;
    row.cost += entry.allocatedCost;
    row.revenue += entry.recognisedRevenue;
  }

  return [...map.values()]
    .map((row) => ({ ...row, margin: ratio(row.revenue - row.cost, row.revenue) }))
    .sort((a, b) => b.hours - a.hours);
}
```

**Say:** "Same shape as every other aggregate: entries in, rows out, no
recalculation — it only sums `allocatedCost` and `recognisedRevenue`, which is
why it can't disagree with the dashboard. `ratio` is the shared helper that
returns null rather than dividing by zero."

**Step 2 — the page.** New file `src/app/clients/page.tsx`:

```tsx
import { PeriodFilter } from '@/components/filters/period-filter';
import { DataTable, type Column } from '@/components/ui-kit/data-table';
import { NoDataState } from '@/components/ui-kit/empty-state';
import { PageHeader } from '@/components/ui-kit/page-header';
import {
  availableMonths,
  availableYears,
  clientBreakdown,
  filterEntries,
  type ClientBreakdown,
} from '@/lib/domain/aggregate';
import { describeFilter } from '@/lib/domain/period';
import { formatHoursPlain, formatMoney, formatPercent, percentValue, round, toneOf } from '@/lib/format';
import { getCostModel } from '@/lib/model';
import { resolvePeriod, type SearchParams } from '@/lib/period-params';

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const model = getCostModel();
  if (model.entries.length === 0) {
    return (
      <>
        <PageHeader title="Clients" />
        <NoDataState />
      </>
    );
  }

  const years = availableYears(model);
  const filter = resolvePeriod(await searchParams, years);
  const rows = clientBreakdown(filterEntries(model, filter));

  return (
    <>
      <PageHeader
        eyebrow={describeFilter(filter)}
        title="Clients"
        description="Hours, cost and recognised revenue by client."
        actions={
          <PeriodFilter
            year={filter.year}
            month={filter.month}
            years={years}
            months={availableMonths(model, filter.year)}
          />
        }
      />

      <DataTable
        title="All clients"
        columns={COLUMNS}
        rows={rows}
        rowKey={(row) => row.client}
        exportFilename={`clients-${filter.year ?? 'all'}.csv`}
      />
    </>
  );
}

const COLUMNS: Column<ClientBreakdown>[] = [
  { key: 'client', header: 'Client', value: (row) => row.client },
  { key: 'hours', header: 'Hours', align: 'right', value: (row) => round(row.hours), render: (row) => formatHoursPlain(row.hours) },
  { key: 'cost', header: 'Cost', align: 'right', value: (row) => round(row.cost), render: (row) => formatMoney(row.cost) },
  { key: 'revenue', header: 'Revenue', align: 'right', value: (row) => round(row.revenue), render: (row) => formatMoney(row.revenue) },
  {
    key: 'margin',
    header: 'Margin',
    align: 'right',
    value: (row) => percentValue(row.margin),
    render: (row) => <span className={toneOf(row.margin)}>{formatPercent(row.margin)}</span>,
  },
];
```

**Step 3 — the nav.** In `src/components/layout/nav.tsx`, add to the
"People and time" section's `items`:

```tsx
{ href: '/clients', label: 'Clients', icon: Building2 },
```

**Say:** "A folder under `src/app` with a `page.tsx` in it *is* the route —
there's no router config to touch. The page is a server component, so it reads
the model directly. And the pattern is identical to every other page: get the
model, resolve the period from the URL, filter, aggregate, render a table."

Visit `http://localhost:3000/clients`.

---

## Drill 8 — Add a test

**Ask:** "Can you show me how you'd test that?" or "prove that still balances."

**Where:** `tests/cost-model.test.ts`. The file already has `entry()` and
`salary()` helpers, so a new case is about eight lines. This is the two-person
example from `03-the-maths-baby-steps.md`, written as a test:

```ts
describe('the worked example', () => {
  it('charges the whole payroll to the project and nothing more', () => {
    const model = buildCostModel({
      entries: [
        entry({ employeeNo: 'AMINA', hours: 80 }),
        entry({ employeeNo: 'AMINA', hours: 20, category: 'FC - Meetings', refCode: null }),
      ],
      salaries: [salary('AMINA', 10_000), salary('BILAL', 5_000)],
      projects: [
        { refCode: 'P1', name: 'P1', price: 20_000, salesYear: 2025, salesMonth: 1, category: null, status: null },
      ],
      assumptions: BILLABLE,
    });

    expect(model.months[0].indirectPool).toBe(7_000);
    expect(model.months[0].indirectRate).toBe(87.5);
    expect(model.reconciliation.allocatedCost).toBeCloseTo(15_000, 2);
    expect(model.reconciliation.balanced).toBe(true);
  });
});
```

Run it:

```bash
npx vitest run tests/cost-model.test.ts
```

**Say:** "`toBeCloseTo` on the money, because floating-point division and
re-multiplication won't give you a bit-exact 15,000 — the model itself uses a
one-fils tolerance for the same reason. The pool and the rate are exact, so
those can be `toBe`."

---

## The checks to run before you say "done"

| Command | When |
| --- | --- |
| *(nothing)* | The dev server hot-reloads; the page tells you immediately |
| `npm run typecheck` | After touching types, an aggregate, or the domain layer |
| `npm test` | After touching anything in `src/lib/domain/` or `src/lib/ingest/` |
| `npm run reconcile` | After touching the cost model — the totals must still balance |

**If something breaks on screen**, Next shows the error with the file and line.
Read it out loud rather than scrolling in silence — *"it's saying `formatRate`
isn't defined, so I've missed the import"* — and fix it. Recovering from a small
mistake calmly in front of someone is a *positive* signal, not a negative one.

---

## If you freeze

Three sentences that buy you time without sounding lost:

1. "Let me find where that lives first" — then `Ctrl+P` (or `Ctrl+Shift+F`) and
   search a string you can see on screen. The visible text is always in the file
   you need.
2. "There are three places this could go — the column definition, the aggregate,
   or the model. It's [X], because…"
3. "I'll do the simple version now and tell you what the proper version looks
   like." Then do exactly that. It is the right engineering answer *and* the
   right interview answer.

---

## The finding trick

Everything on screen is findable by searching for its own text.

| See this on screen | Search for | Lands in |
| --- | --- | --- |
| "Billable %" column header | `Billable %` | the page's columns array |
| "Productivity" in the sidebar | `Productivity` | `components/layout/nav.tsx` |
| "reconciles to payroll" note | `reconcil` | `ui-kit/data-health.tsx` |
| A money figure's formatting | `formatMoney` | `lib/format.ts` |
| The upload result cards | `Rows skipped` | `app/upload/upload-form.tsx` |
| The maths | `indirectRate` | `lib/domain/cost-model.ts` |

---

Next: `07-cheatsheet.md` — the page to read ten minutes before the call.
