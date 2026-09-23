# Cheatsheet — read this ten minutes before the call

---

## The formulas

```
direct rate     = that month's salary / that month's TOTAL logged hours
indirect pool   = salaries of people who logged nothing
                + everyone else's non-billable hours x their direct rate
                + monthly overhead
indirect rate   = pool / that month's BILLABLE hours
cost of an hour = hours x (direct rate + indirect rate)
revenue share   = price x (hours / total project hours)
profitability   = (price - cost) / price
productivity    = billable hours / total hours
```

**Total, then billable.** Total in the direct rate so `hours x rate` = salary
exactly. Billable in the indirect rate so the pool is carried by hours that
reach a client.

---

## The 60-second worked example

| | Salary | Hours |
| --- | ---: | --- |
| Amina | 10,000 | 100 h — 80 on Project A, 20 in meetings |
| Bilal | 5,000 | none |

```
direct (Amina)  10,000 / 100 = 100/h
pool            5,000 (Bilal) + 20 x 100 (meetings) + 0 = 7,000
indirect        7,000 / 80    = 87.50/h
Project A cost  80 x (100 + 87.50) = 15,000
payroll                             = 15,000     <- equal, by construction
```

---

## The proof, in four lines

```
billable hours x indirect rate = billable hours x (pool / billable hours) = pool
so  cost = SUM(billable x direct) + pool
         = SUM(billable x direct) + SUM(non-billable x direct) + unlogged + overhead
         = SUM(total hours x direct) + unlogged + overhead
         = payroll + overhead
```

Non-billable rows carry `allocatedCost: 0` — the double-count is not expressible.

---

## The numbers

| | |
| --- | --- |
| Timesheet rows | 562 |
| Total hours | 19,815.2 · billable 15,265.6 |
| Productivity | **77.0%** |
| Salaries = cost | **AED 2,400,000** — balanced, difference **0.00** |
| Revenue | AED 5,012,000 |
| Margin | **52.1%** |
| Best | Q2025027f — 83.9% |
| Worst | E2025050a — **−112.0%** (92,000 price, 1,225 hours) |
| Also underwater | H2025060c −108.9%, E2025055b −24.9% |
| Indirect rate range | 48.44 – 66.87 /h (Jan: 56.57) |
| January | salaries 197,000 · 1,634.6 h · 1,283.5 billable |
| Ayesha, Jan | 18,000 / 176 h = 102.27/h |
| Hana, Jan | 20,000 / 23.4 h = 854.70/h — an accounting device, not a market rate |

---

## The headline to volunteer

> "Enhancements and hosting lose money. Three of the eleven jobs are underwater
> and all three are the small ones — a 92,000 enhancement absorbed 1,225 hours.
> The big development projects carry the agency. That's what leadership couldn't
> see before."

---

## Where everything is

```
THE MATHS        src/lib/domain/cost-model.ts      <- most likely file
THE VIEWS        src/lib/domain/aggregate.ts
MESSY DATA       src/lib/ingest/cells.ts
HEADER FINDING   src/lib/ingest/header.ts
RE-UPLOAD RULES  src/lib/db/repository.ts
SCHEMA           src/lib/db/schema.ts
MODEL PER REQ    src/lib/model.ts
DASHBOARD        src/app/page.tsx
UPLOAD ACTION    src/app/upload/actions.ts
SETTINGS ACTION  src/app/settings/actions.ts
THE TABLE        src/components/ui-kit/data-table.tsx
FORMATTING       src/lib/format.ts
```

Five client components only: `nav`, `period-filter`, `export-csv-button`,
`upload-form`, `assumptions-form`. Everything else is a server component.

---

## Next.js, in six lines

- Folder under `src/app` + `page.tsx` = a route. `[refCode]` = dynamic segment.
- Server components are the default: run on the server, can be `async`, read
  SQLite directly, never ship to the browser.
- `'use client'` = shipped to the browser. Needed for state and event handlers.
- `params` and `searchParams` are **promises** — `await` them (Next 15/16).
- Writes go through **Server Actions** (`'use server'`), not API routes. A
  Server Action is a public endpoint, so it validates its own input.
- `revalidatePath('/', 'layout')` after a write; `cache()` dedupes the model
  **within one request**; `force-dynamic` because every page reads a database.

---

## The three re-upload rules

| Timesheet | delete + insert the months present in the file — no natural row key |
| --- | --- |
| **Salaries** | upsert on (employee, year, month) — blanks already dropped |
| **Projects** | upsert on ref code — absent projects survive |

---

## Three trade-offs, ready to go

1. **Revenue pro-rated by hours**, not booked at sale — otherwise every month
   after the sale is a pure loss. Cost: it's an allocation, not cash.
2. **SQLite**, not JSON — the re-upload rule *is* a transaction. Cost: a native
   dependency, which needed an `.npmrc` fix.
3. **ExcelJS**, not SheetJS — SheetJS's npm build has two unfixed advisories.
   Cost: a slightly weaker parser, wrapped behind one file so it's swappable.

---

## Two stories to tell

- **The double-count I shipped and caught.** Categories page mixed allocated and
  direct cost in one column; total came to 3,309,257 against a true 2,400,000.
  Split into *Charged* and *Absorbed*, never added, with a test.
- **The `Q1` bug a test found.** `"Q1"` parsed as January, 20 hours in the wrong
  month, 97,000 out. Fixed by refusing the numeric fallback when an unrecognised
  word is present.

---

## The 15-second demo

Assumptions → untick **Hosting** → Save → Dashboard.
*"Costs moved. Total didn't. Still 2,400,000, still balanced."*
Then put it back.

---

## Two-minute demo script

1. Dashboard — "2.4m cost, 5.0m revenue, 52% margin, and the note at the top
   says it reconciles to payroll to the dirham."
2. Worst-margin card — "enhancements and hosting lose money."
3. Click E2025050a — "1,225 hours on a 92,000 job, and here's every person on
   it."
4. Productivity — "77% agency-wide, and here's who never touches client work."
5. Assumptions — untick Hosting, save, back to the dashboard.
6. Data page — upload `sample-data/messy/` and let it report its gaps.

---

## If you get stuck

- **Don't know a line:** "Let me read that back" — then reason aloud.
- **Can't find something:** search the visible text on screen.
- **Asked about AI:** say yes, then say how you verified it, then offer to
  change something live.
- **Asked for something big:** "I'll do the simple version now and tell you what
  the proper version looks like."
- **Never go silent.** Narrate where you're going before you open the file.

---

## The three things you must be able to do

1. Explain why the direct rate divides by **total** hours.
2. Explain why non-billable rows carry **zero** allocated cost.
3. Add a column to a table, live, in under two minutes.
