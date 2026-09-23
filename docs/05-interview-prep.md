# Preparing for the follow-up call

The brief says plainly:

> in the follow-up call we will pick a file and ask you to walk us through it,
> explain a trade-off, and change something live.

So: three things. A walkthrough, a trade-off, a live change.

---

## 1. The file they will most likely pick

**`src/lib/domain/cost-model.ts`.** It's the heart of the exercise. Be able to
walk it top to bottom:

1. `buildCostModel` groups entries and salaries by period, and takes the union of
   both sets of periods — a month with salaries but no timesheet still exists,
   and that's how unabsorbed cost gets detected.
2. For each month, `computeMonthlyRates` builds a per-person record: salary,
   total hours, billable/non-billable split, direct rate, and the value that
   person pushes into the pool.
3. The pool is assembled from the three sources, and the indirect rate is pool ÷
   billable hours — guarded so a month with no billable hours reports
   `unabsorbedPool` instead of dividing by zero.
4. Every entry is costed. Billable rows get direct + indirect; non-billable rows
   get `allocatedCost: 0`, which is the line that makes double-counting
   impossible to express.
5. Revenue is attributed after costing, because it needs each project's total
   hours across the whole dataset.
6. `findGaps` and `reconcile` produce the honesty layer.

The second most likely pick is `src/lib/ingest/cells.ts` (the messy-data
handling) or `src/lib/db/repository.ts` (the re-upload rules). Read
`02-ingestion.md` and `03-persistence-and-reupload.md` for those.

**If asked "why is the direct rate divided by total hours, not billable hours?"**
— because then `total hours × direct rate` equals the salary exactly, so the
salary is fully accounted for and nothing is left over. Dividing by billable
hours would leave the non-billable time with no home.

---

## 2. Trade-offs worth having ready

Pick whichever matches what they ask about. Each has a real cost, honestly
stated.

**Revenue pro-rated by hours vs. booked at the sale.** The strongest one, because
the brief didn't specify it. Pro-rating puts cost and revenue in the same month
so monthly margin means something; booking at sale is simpler and matches how
cash actually arrives. Pro-rating also introduces a subtlety I had to be careful
with: the denominator is whole-project hours, so the model must always be built
over all data and filtered only for display. Argument for my choice: the brief
already splits by hour-share for employee revenue share.

**SQLite vs. JSON files.** JSON would have worked at this size and removed a
native dependency. SQLite wins because the re-upload rule *is* a transaction —
delete the months in the file, insert the new rows, all or nothing — and because
"our data grew" shouldn't mean a rewrite.

**ExcelJS vs. SheetJS.** SheetJS is the better parser and the industry default.
Its npm build carries two advisories with no fix available on npm (the patched
build is only on the vendor's CDN). For a submission someone may run `npm audit`
against, I took the slightly weaker parser with a clean audit, and wrapped it
behind `workbook.ts` so swapping back is a one-file change. Say this one
confidently — it shows you checked rather than reached for the default.

**Server components reading SQLite directly, no API layer.** Less indirection,
no loading states, less code. The cost is that it's harder to put a mobile client
on it later — but the calculation layer is already pure and framework-free, so
an API would be a thin wrapper over functions that already exist.

**Replace-by-period vs. row-level upsert for timesheets.** There is no natural
row key — one person can legitimately log two rows in the same category in the
same month — so replace-by-period is the only rule that's both idempotent and
correct.

---

## 3. Live changes they might ask for — and how to do them fast

Know where each of these lives so you're not searching during the call.

| "Can you…" | Where | Roughly |
| --- | --- | --- |
| add a column to a table | that page's `COLUMNS` array | add `{ key, header, align, value, render }` — the CSV export updates itself |
| change what counts as billable | the **Assumptions page**, no code at all | tick a category, save, every page updates |
| add a monthly overhead | same page | type a number; watch the reconciliation note change |
| sort projects differently | the `rows` prop on the dashboard's `DataTable` | one `.sort()` |
| add a new page | copy `src/app/departments/page.tsx` | it's the simplest full example: model → filter → aggregate → table |
| add a new aggregate | `src/lib/domain/aggregate.ts` | follow `projectRollup`, ~20 lines |
| show cost per hour somewhere | `formatRate` already exists | |

**Rehearse this one**: open Assumptions, untick `Hosting`, save, then go to the
dashboard. Hosting's 644 hours move from billable to internal, the indirect rate
rises, project costs shift — **and the total cost stays exactly 2,400,000.** It
demonstrates the configurability *and* the reconciliation in one move, in about
fifteen seconds. If you only prepare one live demo, prepare that.

---

## 4. Things to volunteer

Interviewers respond well to a candidate who names their own weak points before
being asked.

- **The double-count I shipped and caught.** The Categories page had one "Cost"
  column mixing two measures; the total came to 3,309,257 against a true
  2,400,000. Splitting it into *Charged* and *Absorbed* fixed it, and there's now
  a test asserting the charged column sums to total cost. This is a *good* story
  — it's precisely the failure mode the brief warns about, found and fixed.
- **The `Q1` parser bug.** The messy-workbook test was written to demonstrate a
  feature and instead found a real defect: `"Q1"` parsed as January, which filed
  20 hours in the wrong month and threw the reconciliation out by 97,000. Fixed
  by refusing the numeric fallback when an unrecognised word is present.
- **No end-to-end browser test.** 53 tests cover the model, parsers and
  re-upload. The upload form itself was verified by hand and by testing the
  functions beneath it. It's the first gap I'd close.
- **The same-name-no-employee-number merge.** Known, documented, not fixed,
  because fixing it properly needs an identity table the agency would maintain.

## 5. Two-minute demo script

1. Open the dashboard. "2,400,000 of cost against 5,012,000 of revenue, 52%
   margin — and the note at the top says it reconciles to payroll to the dirham."
2. Point at the worst-margin card. "Enhancements and hosting lose money. All
   three loss-making jobs are the small ones; the big development projects carry
   the agency. That's the thing nobody could see before."
3. Click into E2025050a. "1,225 hours on a 92,000 job. Here's every person on it
   and what each one earned or lost."
4. Productivity page. "77% agency-wide, and here are the people who never touch
   client work."
5. Assumptions. Untick Hosting, save, return to the dashboard. "Costs moved,
   total didn't."
6. Data page. Upload `sample-data/messy/` and let it report its gaps.

## 6. Commands, if they ask you to run something

```bash
npm run reconcile   # prints the year's totals and the self-check
npm test            # 53 tests
npm run seed -- --reset
```
