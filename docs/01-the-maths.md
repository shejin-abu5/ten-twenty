# The maths — explained properly

This is the part worth 30% of the grade, and the part you will be asked to
explain. Understand this document and you can defend every number in the app.

---

## The problem it solves

You want to know what a project cost. The obvious answer — add up everyone's
salary for the hours they put in — is wrong, because it ignores everyone who
never touches a client project (the ops lead, the account manager) and it ignores
the half of a designer's month spent in meetings, on leave, and learning. Those
hours are real money. If you don't push them onto projects, your projects look
more profitable than they are.

So there are two rates:

- a **direct rate** — what this person's hour actually costs, and
- an **indirect rate** — everyone's share of the time nobody billed.

---

## Step 1 — the direct rate

> that month's salary ÷ that month's **total** logged hours

Note **total**, not billable. Ayesha is paid 18,000 in January and logs 176 hours
in total (135.9 on the Meridian project, 8 on leave, 25 in meetings, 7.1
learning). Her direct rate is `18000 ÷ 176 = 102.27/hour`.

**This is the subtle bit.** Dividing by total hours means the rate is "what an
hour of Ayesha costs", and all 176 of her hours are valued at it. Her 135.9
billable hours carry `135.9 × 102.27 = 13,899` of direct cost; her other 40.1
hours carry `40.1 × 102.27 = 4,101`. Those add to exactly 18,000 — her whole
salary, no more and no less.

If you divided by *billable* hours instead, her rate would be higher and the
non-billable time would have to be thrown away — and you would then have no
honest way to account for it.

## Step 2 — the indirect pool

> salaries of people who logged **no** hours
> \+ everyone else's **non-billable** time, valued at their own direct rate
> \+ monthly overhead

The pool is everything the agency paid for that did not directly produce billable
work. Three sources:

1. **Support staff.** Someone on payroll who logged nothing at all that month.
   Their whole salary goes in. (In the supplied data nobody is in this bucket —
   even management logs hours — but the model handles it, and there is a test.)
2. **Non-billable time.** Ayesha's 4,101 from above, plus everyone else's.
3. **Overhead.** Whatever you type on the Assumptions page.

## Step 3 — the indirect rate

> indirect pool ÷ **billable** hours that month

Now **billable**, because the pool must be carried by the hours that actually go
on an invoice. For January: pool ÷ 1,283.5 billable hours = **56.57/hour**.

## Step 4 — the cost of an hour on a project

> hours × (direct rate + indirect rate)

Ayesha's 135.9 Meridian hours in January cost
`135.9 × (102.27 + 56.57) = 21,586`.

---

## Why it balances — the proof

This is the answer to "how do you know it doesn't double-count?" Learn the shape
of this argument; it is four lines.

Take one month. Total cost charged to projects is the sum over billable rows of
`hours × (direct + indirect)`. Split that in two:

```
  Σ (billable hours × direct rate)          ... call this A
+ Σ (billable hours × indirect rate)        ... call this B
```

B is easy. Every billable row uses the *same* indirect rate, so

```
B = (total billable hours) × (pool ÷ total billable hours) = pool
```

The billable hours cancel. B is exactly the pool. Substitute the pool's
definition:

```
A + B = Σ(billable × direct) + Σ(non-billable × direct) + unlogged salaries + overhead
      = Σ(total hours × direct)            + unlogged salaries + overhead
```

And `total hours × direct rate` is, by the definition in step 1, just that
person's salary. So:

```
      = (salaries of people who logged hours)
      + (salaries of people who didn't)
      + overhead
      = the month's entire payroll + overhead
```

**Every dirham of payroll lands on exactly one project hour, and no dirham lands
twice.** With overhead at zero, total cost = total salaries. That is not a
coincidence you have to verify; it's an algebraic identity of the model.

### Where it could have gone wrong

The trap is treating a non-billable row as having a cost of its own. Its direct
cost is *already inside the pool*, and the pool is *already spread across
billable hours*. Counting it again double-counts.

That's why in the code every costed entry carries:

```ts
allocatedCost: isBillable ? directCost + indirectCost : 0
```

Non-billable rows carry **zero**. Sum the `allocatedCost` column anywhere in the
app — one project, one department, the whole year — and you can never
double-count, because the double-count is impossible to express.

This is also the bug I actually shipped and then caught. The Categories page
originally had one "Cost" column that used allocated cost for billable rows and
direct cost for internal rows. Each cell was defensible; the **total** was
3,309,257 against a true cost of 2,400,000. Two columns now: *Charged to
projects* (sums to 2,400,000) and *Absorbed* (reported separately, never added).
`tests/sample-data.test.ts` locks that in.

---

## Revenue — the one place I had to make a judgement

The brief defines cost month by month but gives a project one price for its whole
life. So: which month earned the revenue?

- **Option A — all of it in the month of sale.** Meridian sold in January books
  560,000 in January and nothing after. Every subsequent month of work on it is a
  pure loss. Monthly margin becomes noise.
- **Option B — pro-rate by hours.** A month earns
  `price × (hours that month ÷ total project hours)`. Cost and revenue then land
  in the same months, and the shares always add back to exactly the full price.

I chose B, and said so in the README. The strongest argument for it: the brief
*already* uses hour-share splitting for `employee revenue share = price ×
(employee hours ÷ total project hours)`. Doing the same thing across months is
the same idea applied to a different axis, not a new invention.

**Important:** the hour-share denominator is the project's hours across *all*
loaded data, not the filtered period. So the model is always built over
everything and filtered only for display. Get this backwards and a month filter
silently changes each project's revenue.

Project detail pages deliberately show **whole-life** figures against the
whole-life price, because "did we make money on it" only has an answer over the
project's whole life.

---

## The edge cases and what each one does

| Situation | What happens | Why |
| --- | --- | --- |
| Hours but no salary row | Direct rate 0, costs nothing, listed as a gap | Guessing a salary puts invented money into the reconciliation |
| Salary but zero hours | Whole salary into the pool | That is literally what the brief's "support staff" clause means |
| Month with cost but **no billable hours at all** | Indirect rate would be ÷0. Pool is reported as *unabsorbed*, not spread | Honest: that cost genuinely reached no project |
| Ref code with hours but no price | Revenue 0, flagged as a gap | Cost is still real and still counted |
| Project priced but never worked | Flagged, magnitude = the price | It's a signal: sold work nobody started |
| Billable row with no ref code | Costed, but attributable to no project; flagged | Cost must not vanish just because the code is missing |

The unabsorbed case is the only way the balance check can fail, which is why
`Reconciliation` reports it as its own line rather than folding it in.

---

## Numbers to have ready

If asked to compute something live, these are the January figures:

- Salaries: 197,000 · total hours 1,634.6 · billable 1,283.5
- Indirect rate: **56.57/hour**
- Ayesha's direct rate: 18,000 ÷ 176 = **102.27/hour**

And the year: 2,400,000 cost against 5,012,000 revenue = **52.1%** margin, with
enhancements and hosting both deeply negative.

---

## "Why does someone have a direct rate of AED 854 per hour?"

Open the Cost audit for January and you'll see Hana Yousef at **854.70/h** and
Omar Zayed at **704.23/h**, against everyone else's 68–125. This looks wrong. It
isn't, and you should be ready to explain it, because it is the most
eye-catching number on the audit page.

Hana is paid 20,000 in January and logged **23.4 hours**, all of it internal —
meetings, leave, admin. `20,000 ÷ 23.4 = 854.70`.

The direct rate is not "what an hour of Hana is worth on the market". It is an
accounting device whose only job is to make `total hours × direct rate` equal her
salary exactly. And it does: `23.4 × 854.70 = 20,000`. Because every one of those
hours is non-billable, all 20,000 lands in the indirect pool — which is precisely
the right answer. The account manager's salary is a cost of doing business that
client projects must carry, and it reaches them through the indirect rate.

The two ways this could have been got wrong:

- **Divide by billable hours instead.** Hana has zero. Division by zero, or her
  salary silently disappearing from the company's cost.
- **Cap the rate at something "sensible".** Then `hours × rate` no longer equals
  her salary, the pool is short, and the reconciliation fails.

The model treats "logged a few internal hours" and "logged nothing at all" as the
same economic situation — the whole salary goes into the pool — and arrives there
by two different routes (`nonBillableCost` for Hana, `unloggedSalaryCost` for
someone with no rows at all). Both are visible as separate columns in the audit,
which is why the January row shows 0 unlogged salaries and 72,613 of internal
time.

A good line to use: *"the rate looks odd because she only logged 23 hours; what
matters is that 23.4 × 854.70 is exactly her 20,000 salary, and all of it goes
into the pool. If I capped that rate, the company's total cost would no longer
equal payroll."*
