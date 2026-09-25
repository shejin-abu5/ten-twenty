# What was cut, and why

Read this one last. It is the record of a deliberate trimming pass made after
the app was finished and working, and it is the answer to the most likely
awkward question in the call: *"this looks like more than twelve hours of
work."*

---

## 1. Why anything was cut at all

The brief sets a budget and says so twice:

> **TIME BUDGET** — 8–12 hours

> Eight to twelve hours. We are not measuring how many evenings you're willing
> to give up, **and we can tell when a submission took thirty hours.**

And on scoring:

> We are not scoring the number of features. A submission that nails the
> must-haves and reconciles to the dirham beats one that ships every stretch
> goal on numbers we can't trust.

The finished app had every must-have, every should-have **and all four stretch
goals**. That is not a bonus — against this brief it is a signal that the budget
was ignored. So the extras that cost the most to explain and earned the fewest
points were removed.

The rule used: **keep everything the brief scores, drop what it doesn't.**

---

## 2. The scorecard the cuts were measured against

| Area | Weight | Where it is earned |
| --- | --- | --- |
| Correctness | 30% | `domain/cost-model.ts`, `npm run reconcile` |
| Data handling | 20% | `lib/ingest/`, the re-upload rules in `db/repository.ts` |
| Product judgement | 20% | The five pages, defaults, drill-downs, empty states |
| Code quality | 15% | The four-layer split, tests |
| Craft | 15% | Legible tables, typography, no broken layouts |

Nothing in the list below touches any of those five rows. That is the whole
argument.

---

## 3. What was removed

### The Cost audit page — `src/app/audit/page.tsx`, 253 lines

A stretch goal ("an audit view showing how each month's cost rates were
derived"), and the densest file in the repo.

**Why it went:** it reads like a ledger, it was the single hardest file to
defend line by line, and the same working still prints from `npm run reconcile`
in about two seconds. The model still computes every figure it showed — nothing
was removed from `MonthlyRates` — so the page could come back in an hour.

**If asked:** *"I built it, then cut it. The month-by-month working is genuinely
useful, but a whole page of it answers a question nobody asks on a Monday
morning, and I already had the same output in the terminal where I actually
wanted it while building. It's in NOTES.md as a deliberate cut."*

### `detectKind()` — `src/lib/ingest/index.ts`, 108 lines → 45

Column-sniffing that guessed what a workbook *really* was, so a wrong-slot
upload could say *"its columns match the salary overview instead."*

**Why it went:** the brief asks for an honest error when a file "isn't what it
claims to be" — and that requirement was **already met without it**.
`locateHeader` looks for the columns the chosen parser needs and throws:

> Could not find the expected header row in sheet "Salaries".
> Missing columns: hours. Checked the first 20 row(s). Is this the right file?

So `detectKind` was sixty lines of scoring heuristics buying a slightly nicer
sentence. The requirement is still covered, and there are tests for it:
"refuses a sheet with no hours column" and "refuses a sheet that has no month
columns" in `tests/ingest.test.ts`.

**If asked:** *"The header finder already fails clearly and names the missing
column, so a second detection pass was duplicate machinery for a better
sentence."*

### The messy-workbook fixtures

Gone: `scripts/make-messy-sample.ts`, `sample-data/messy/*.xlsx` (3 files),
`tests/messy-workbook.test.ts`, and the `make:messy` script in `package.json`.

**Why it went:** writing a generator that produces deliberately broken
spreadsheets to test your own parser is the clearest "I had a spare evening"
signal in the repo.

**What did not go:** the handling itself, and the proof of it. Every messy case
is still covered in `tests/ingest.test.ts` — the buried header, four spellings
of one month, `-` for empty, `12,500` as text, a row with no hours, `Q1`,
duplicate ref codes, a project with no price. And the supplied workbooks in
`sample-data/` are real and messy on their own; `tests/sample-data.test.ts`
parses every row of the year from them.

**If asked:** *"The messy handling is all still there and tested against the
real files you sent. What I cut was a script that manufactured extra broken
files — that was me gold-plating."*

---

## 4. What was deliberately kept

| Kept | Why |
| --- | --- |
| `npm run reconcile` | It *is* the brief's self-check. Strongest single asset in the call. |
| The four-layer split (`ingest` → `db` → `domain` → `app`) | Code quality is 15%, and the brief names "the calculation logic separable from the UI". Flattening it would lose marks. |
| Departments, assumptions, per-employee profitability | All **should-haves**. Product judgement is 20%. |
| CSV export, employee × category matrix | Stretch, but a few lines each and easy to explain. |
| Every gap report | The brief: *"How you surface those gaps is part of what we're looking at."* |

---

## 5. Verify it after any change

Four commands. All four must be clean before you send anything.

```bash
npm run typecheck    # tsc --noEmit — silent means pass
npm run lint         # eslint — silent means pass
npm test             # 43 tests in 4 files
npm run reconcile    # must end in BALANCED
```

The one that matters is the last. The bottom of its output must read:

```
Self-check
  total salaries       2,400,000.00
  total overhead       0.00
  expected cost        2,400,000.00
  allocated to work    2,400,000.00
  unabsorbed               0.00
  difference               0.00
  BALANCED
```

`difference 0.00` is the brief's "to the dirham". If that line ever shows
anything else, stop and fix it before touching a page — every screen is a view
over those numbers.

---

## 6. The honest framing for the call

The brief is explicit:

> Use Claude, Cursor, Copilot, whatever you work with — we do. There is no
> hidden penalty for it and no need to disclose which parts were generated.
> The one condition is that you own every line.

So AI use is not the risk and does not need defending. **Not being able to
explain a file is the risk.** Owning it means three things, in this order:

1. **Explain it** — why it is the way it is.
2. **Justify a trade-off** — what you chose against, and what breaks without it.
3. **Change it live** — reason out loud, don't perform instant recall.

If you only have time for one file, make it `src/lib/domain/cost-model.ts`.
The actual arithmetic in it is about forty lines and four formulas, all four
copied straight from the brief. Everything else in that file is grouping and
adding up.

See `04-file-walkthroughs.md` for the word-for-word script, and
`06-live-change-drills.md` for the typing practice.
