# The maths, in baby steps

This is worth about 30% of the grade and it is the part you will definitely be
asked about. Work through §1–§4 with a pen. If you can reproduce the small
example from memory, you can defend every number in the app.

---

## 1. The problem, before any formula

You want to know what a project cost.

The obvious answer is: add up the salary-cost of the hours people spent on it.
**That answer is wrong**, for two reasons:

1. **Some people never touch a client project.** The office manager, the
   accountant, the person who runs recruitment. They are paid real money every
   month. If you do not charge them to projects, projects look more profitable
   than they are.
2. **Nobody bills 100% of their time.** A designer's month includes meetings,
   leave, training, admin, idle time. That time is paid for. It is real cost.

So the agency's payroll splits into two piles:

- **Direct**: hours that went onto a client project.
- **Indirect**: everything else — the "overhead of being an agency".

The model's job is to push *all* of the indirect pile onto the direct hours, so
that every dirham of payroll ends up charged to exactly one project hour, and no
dirham is charged twice.

Hence two rates:

- a **direct rate** — what an hour of *this person* costs;
- an **indirect rate** — every billable hour's share of the unbilled pile.

---

## 2. The whole model in a tiny example — memorise this one

Two people. One month. Overhead zero. Round numbers.

| Person | Salary | Hours logged | On what |
| --- | --- | --- | --- |
| **Amina**, designer | 10,000 | 100 h | 80 h on Project A, 20 h in meetings |
| **Bilal**, office manager | 5,000 | 0 h | logs nothing |

Total payroll: **15,000**. Hold on to that number — it is the answer the model
must reproduce.

### Step 1 — direct rate = salary ÷ **total** hours

```
Amina: 10,000 / 100 h = 100 per hour
Bilal:  no hours logged -> no direct rate at all
```

Note **total** hours, not billable hours. This is the subtle bit and it is the
most likely single question. See §5.

### Step 2 — build the indirect pool

Three ingredients:

```
  salaries of people who logged nothing      Bilal          5,000
+ non-billable hours x their own direct rate 20 h x 100  =  2,000
+ monthly overhead                                            0
                                             POOL      =   7,000
```

### Step 3 — indirect rate = pool ÷ **billable** hours

```
7,000 / 80 billable hours = 87.50 per hour
```

Now **billable** hours, because the pool has to be carried by the hours that
actually go on an invoice.

### Step 4 — cost an hour of project work

```
cost = hours x (direct rate + indirect rate)

Project A = 80 h x (100 + 87.50) = 80 x 187.50 = 15,000
```

### The check

Total cost charged to projects = **15,000**.
Total payroll = **15,000**.

**Equal.** Not approximately — exactly. And that is not luck; §6 proves it must
always be true.

### And the margin

If Project A was sold for 20,000:

```
profit = 20,000 - 15,000 = 5,000
margin = 5,000 / 20,000 = 25%
```

### Productivity

```
productivity = billable hours / total hours = 80 / 100 = 80%   (Amina)
```

---

## 3. The same example, three variations

Run these yourself on paper. Each one is a question they might ask.

### (a) Add overhead of 3,000

```
pool          = 5,000 + 2,000 + 3,000 = 10,000
indirect rate = 10,000 / 80 = 125
Project A     = 80 x (100 + 125) = 18,000
check:          15,000 payroll + 3,000 overhead = 18,000   OK
```

Overhead reaches projects through the indirect rate. Nothing else changes.

### (b) Add a second biller, and see revenue split

Add **Chen**, developer, salary 8,000, logs 80 h all on Project A.

```
Chen direct rate = 8,000 / 80 = 100
pool             = 5,000 + 2,000 + 0 = 7,000      (unchanged)
billable hours   = 80 + 80 = 160
indirect rate    = 7,000 / 160 = 43.75

Amina on A = 80 x (100 + 43.75) = 11,500
Chen  on A = 80 x (100 + 43.75) = 11,500
total cost                      = 23,000
payroll     = 10,000 + 5,000 + 8,000 = 23,000     OK
```

Revenue share, at a price of 20,000:

```
employee revenue share = price x (their hours / total project hours)

Amina = 20,000 x (80/160) = 10,000   -> profit 10,000 - 11,500 = -1,500
Chen  = 20,000 x (80/160) = 10,000   -> profit 10,000 - 11,500 = -1,500

project margin = (20,000 - 23,000) / 20,000 = -15%
```

Notice: more billable hours **lowered** each hour's indirect rate (the pool is
spread thinner), but **raised** total cost, because there is more direct salary
in the project. Both effects are correct.

### (c) Amina takes the whole month off (no billable hours at all)

```
billable hours = 0
indirect rate  = pool / 0  -> division by zero
```

The model refuses to invent a number:

```ts
// src/lib/domain/cost-model.ts
const indirectRate = billableHours > 0 ? indirectPool / billableHours : 0;
...
unabsorbedPool: billableHours > 0 ? 0 : indirectPool,
```

That month's cost is reported as **unabsorbed** — shown on the dashboard, in the
audit page, and as its own line in the reconciliation. The honest answer: that
money genuinely reached no project, so the app says so rather than hiding it or
smearing it somewhere it does not belong.

---

## 4. The five formulas, exactly as the brief states them

```
direct cost rate/hour   = that month's salary / that month's total logged hours
indirect cost pool      = salaries of people who logged nothing
                        + everyone else's non-billable time at their direct rate
                        + monthly overhead
indirect cost rate/hour = indirect pool / billable hours that month
employee cost           = hours x (direct rate + indirect rate)
employee revenue share  = price x (employee hours / total project hours)
project profitability   = (price - total cost) / price
productivity            = billable hours / total hours
```

All of it lives in **one file**: `src/lib/domain/cost-model.ts`. Two functions
matter:

- `computeMonthlyRates(...)` — one month's arithmetic, keeping the working.
- `buildCostModel(...)` — loops the months, costs every row, attributes revenue,
  finds gaps, reconciles.

---

## 5. The question you are most likely to be asked

> **"Why is the direct rate divided by *total* hours rather than *billable*
> hours?"**

Say this:

> "So that `total hours x direct rate` equals the salary exactly. Amina's
> 10,000 divided over 100 hours is 100/hour; her 80 billable hours carry 8,000
> of direct cost and her 20 non-billable hours carry 2,000 — which add back to
> precisely her salary, nothing lost and nothing invented. If I divided by
> billable hours instead, her rate would be 125, her billable hours would carry
> the whole 10,000, and the 20 non-billable hours would have no cost at all —
> so I would have no honest way to account for meeting and leave time. Dividing
> by total hours is what makes the reconciliation an identity rather than a
> coincidence."

And the follow-up, because they will push:

> **"But then the indirect rate uses billable hours. Isn't that inconsistent?"**

> "They answer different questions. The direct rate values *a person's* hour, so
> the denominator is all of their hours. The indirect rate spreads a pool of
> money across the hours that can actually carry it to a client, so the
> denominator is billable hours only. Using total hours there would leave part
> of the pool sitting on non-billable rows, which reach no project — and the
> books would not balance."

---

## 6. Why it balances — the four-line proof

This is the answer to *"how do you know you're not double-counting?"* Learn the
**shape**; you do not need to recite it verbatim.

Take one month. The cost charged to projects is the sum, over billable rows, of
`hours x (direct + indirect)`. Split it in two:

```
  SUM(billable hours x direct rate)      ... call this A
+ SUM(billable hours x indirect rate)    ... call this B
```

**B is easy.** Every billable row uses the *same* indirect rate, so:

```
B = (total billable hours) x (pool / total billable hours) = pool
```

The billable hours cancel. **B is exactly the pool.** Now substitute what the
pool is made of:

```
A + B = SUM(billable x direct) + SUM(non-billable x direct) + unlogged salaries + overhead
      = SUM(total hours x direct)                           + unlogged salaries + overhead
```

And `total hours x direct rate` is, by the definition in step 1, just that
person's salary:

```
      = salaries of people who logged hours
      + salaries of people who didn't
      + overhead
      = the month's entire payroll + overhead
```

**Every dirham of payroll lands on exactly one project hour, and no dirham lands
twice.** With overhead at zero, total cost = total salaries. That is an
algebraic identity of the model, not a result you have to check.

### Where it could have gone wrong

The trap is treating a non-billable row as having a cost of its own. Its direct
cost is **already inside the pool**, and the pool is **already spread across
billable hours**. Counting it again double-counts.

That is why every costed row carries:

```ts
// src/lib/domain/cost-model.ts
allocatedCost: isBillable ? directCost + indirectCost : 0,
```

Non-billable rows carry **zero**. Sum the `allocatedCost` column anywhere in the
app — one project, one department, one category, the whole year — and you cannot
double-count, because the double-count is not expressible.

---

## 7. Revenue — the one place a judgement was needed

The brief gives cost month by month, but a project has **one price for its whole
life**. So which month earned it?

**Option A — book it all in the month of sale.** Simple, matches cash. But a
project sold in January books 560,000 in January and nothing after, so every
later month of work on it is a pure loss. Monthly margin becomes noise.

**Option B — pro-rate by hours.** A month earns
`price x (hours that month / total project hours)`. Cost and revenue land in the
same months, and the shares always add back to exactly the full price.

**This app chose B**, and says so in the README. The strongest argument:

> "The brief *already* splits by hour-share for employee revenue share —
> `price x (employee hours / total project hours)`. Doing the same across months
> is the same idea applied to a different axis, not a new invention."

### The subtlety you must not get wrong

The denominator is the project's hours across **all** loaded data, not the
filtered period. That is why the model is always built over everything and
filtered only for display:

```tsx
// src/app/page.tsx
const model = getCostModel();                  // everything
const entries = filterEntries(model, filter);  // display only
```

Get it backwards and a month filter would silently change each project's
revenue.

**And** project detail pages deliberately show **whole-life** figures against the
whole-life price, because *"did we make money on it"* only has an answer over a
project's whole life.

---

## 8. Every edge case, and the reasoning

| Situation | What happens | Why |
| --- | --- | --- |
| Hours logged but no salary row | Direct rate 0, costs nothing, listed as a gap | Guessing a salary would put invented money into the reconciliation |
| Salary but zero hours | Whole salary goes into the pool | That is exactly the brief's "support staff" clause |
| Month with cost but **no billable hours** | Pool reported as *unabsorbed*, not spread | Dividing by zero is not an answer; that cost genuinely reached no project |
| Ref code has hours but no price | Revenue 0, flagged as a gap | The cost is still real and still counted |
| Project priced but never worked | Flagged, magnitude = the price | A signal: sold work nobody started |
| Billable row with no ref code | Costed, attributable to no project, flagged | Cost must not vanish because a code is missing |
| Blank or `-` salary cell | Treated as "not provided", skipped on import | So re-uploading a partial sheet cannot silently zero a correct month |

The unabsorbed case is the **only** way the balance check can fail, which is why
`Reconciliation` reports it as its own line rather than folding it in:

```ts
const difference = expectedCost - (allocatedCost + unabsorbedCost);
balanced: Math.abs(difference) < 0.01   // one fils: floating-point noise, not a modelling error
```

---

## 9. The real numbers — verified today by `npm run reconcile`

### The year

| Figure | Value |
| --- | --- |
| Timesheet rows | 562 |
| Total hours | 19,815.2 |
| Billable hours | 15,265.6 |
| Productivity | 77.0% |
| Total salaries | AED 2,400,000 |
| Total cost (overhead 0) | AED 2,400,000 — **balanced, difference 0.00** |
| Revenue recognised | AED 5,012,000 |
| Overall margin | 52.1% |

### Every project

| Ref | Hours | Price | Cost | Margin |
| --- | ---: | ---: | ---: | ---: |
| Q2025004c | 1,808.7 | 900,000 | 294,322 | 67.3% |
| Q2025027f | 989.5 | 980,000 | 157,380 | **83.9%** (best) |
| Q2025041h | 1,096.8 | 760,000 | 176,503 | 76.8% |
| Q2025014d | 1,304.3 | 690,000 | 203,009 | 70.6% |
| Q2025033g | 1,148.3 | 300,000 | 177,242 | 40.9% |
| Q2025001a | 3,025.2 | 560,000 | 468,776 | 16.3% |
| Q2025009b | 1,842.6 | 330,000 | 283,113 | 14.2% |
| Q2025021e | 1,325.5 | 250,000 | 218,659 | 12.5% |
| E2025055b | 855.3 | 104,000 | 129,854 | −24.9% |
| H2025060c | 644.2 | 46,000 | 96,080 | −108.9% |
| E2025050a | 1,225.2 | 92,000 | 195,062 | **−112.0%** (worst) |

**The insight to say out loud, unprompted:**

> "Enhancements and hosting lose money. Three of the eleven jobs are underwater
> and all three are the small ones — a 92,000 enhancement absorbed 1,225 hours.
> The big development projects carry the agency. That is the thing leadership
> could not see before and can see in one glance now."

### January, if they ask you to compute something live

```
salaries      197,000
total hours   1,634.6
billable      1,283.5
indirect rate 56.57 / hour        (pool ~72,613 / 1,283.5)
unlogged salaries  0              (everyone logs something)

Ayesha:  18,000 / 176 h = 102.27 / hour direct
         135.9 billable h on Meridian
         cost = 135.9 x (102.27 + 56.57) = 135.9 x 158.84 = 21,586
```

Monthly indirect rates across the year run **48.44 to 66.87** — the variation is
just how much internal time each month carried. Salary steps from 197,000 to
203,000 in July (a raise in the source data).

---

## 10. "Why does someone have a direct rate of AED 854 per hour?"

Open the Cost audit for January and Hana Yousef shows **854.70/h** against
everyone else's 68–125. It looks wrong. It is not, and this is the most
eye-catching number in the app, so prepare it.

Hana is paid 20,000 and logged **23.4 hours**, all internal — meetings, leave,
admin. `20,000 / 23.4 = 854.70`.

> "The direct rate is not what an hour of Hana is worth on the market. It is an
> accounting device whose only job is to make `total hours x direct rate` equal
> her salary exactly — and it does: 23.4 x 854.70 = 20,000. Because every one of
> those hours is non-billable, all 20,000 lands in the indirect pool, which is
> the right answer: the account manager's salary is a cost of doing business
> that client projects must carry, and it reaches them through the indirect
> rate. If I capped that rate at something 'sensible', the pool would be short
> and total cost would no longer equal payroll."

The two wrong alternatives, if they push:

- **Divide by billable hours instead** — Hana has zero. Division by zero, or her
  salary silently disappearing from the company's cost.
- **Cap the rate** — then `hours x rate` no longer equals her salary, the pool is
  short, and the reconciliation fails.

The model treats "logged a few internal hours" and "logged nothing at all" as the
same economic situation — the whole salary goes into the pool — arriving there by
two different routes (`nonBillableCost` for Hana, `unloggedSalaryCost` for
someone with no rows at all). Both are separate columns on the audit page, which
is why January shows 0 unlogged salaries and ~72,613 of internal time.

---

## 11. The bug that was shipped and caught — tell this story

It is the single most persuasive thing you can volunteer, because it is *exactly*
the failure mode the brief warns about.

The Categories page originally had one "Cost" column that used allocated cost for
billable rows and direct cost for internal rows. Every individual cell was
defensible. The **total** came to 3,309,257 against a true cost of 2,400,000 — a
double-count of the non-billable time, which was already inside the pool.

The fix was to split it into two columns that are never added together:

```ts
// src/lib/domain/aggregate.ts — CategoryBreakdown
/**
 * What this category charged to projects. Billable rows only, so this column
 * sums to the company's total cost.
 */
chargedCost: number;
/**
 * Salary value of internal time. It is already inside chargedCost by way of
 * the indirect rate, so the two columns are deliberately never added together.
 */
absorbedCost: number;
```

And `tests/sample-data.test.ts` now asserts the charged column sums to total
cost, so it cannot come back.

**Second story, equally good:** the messy-workbook test was written to
demonstrate a feature and instead found a real defect — `"Q1"` was parsing as
January, filing 20 hours in the wrong month and throwing the reconciliation out
by about 97,000. The fix is the `hasUnknownWord` flag in
`src/lib/ingest/cells.ts`: a numeric fallback is refused when the cell contains
a word that is not a month name, so `"Q1"` and `"Total 12"` are rejected instead
of guessed.

---

## 12. Self-test — answer these without looking

1. Why total hours in the direct rate but billable hours in the indirect rate?
2. What three things go into the indirect pool?
3. What is `allocatedCost` for a non-billable row, and why?
4. What happens in a month with salaries but no billable hours?
5. Why is the model built over all data and filtered only for display?
6. What does a project page show — period figures or whole-life figures? Why?
7. If overhead goes from 0 to 120,000 for the year, what happens to total cost,
   and to each project's margin?
8. Someone's direct rate is 854/hour. Defend it in two sentences.
9. Where would you look to prove the numbers without opening a browser?
10. What was the double-count you shipped, and how does the code prevent it now?

*(7: total cost becomes 2,520,000 — payroll + overhead. Every project's cost
rises by its share of the extra pool, so every margin falls. Total revenue is
unchanged.)*

---

Next: `04-file-walkthroughs.md` — what to actually say when they open a file.
