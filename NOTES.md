# Notes

## What I'd build next

**Sortable, filterable tables.** Everything is sorted sensibly by default, but a
director looking at eleven projects will want to sort by cost, then by hours.
It's the single highest-value thing missing, and it's a day's work done properly
(URL-driven sort, so it stays shareable like the period filter).

**Per-month overhead.** The brief says "a monthly overhead figure", so overhead
is one number applied to every month. Real overhead moves — a new office in
August changes things. The storage and the model already handle a per-month
value; only the settings UI assumes one figure.

**Utilisation targets.** Productivity is reported but not judged. "77% billable"
means nothing without the agency's target next to it. A target per designation,
set on the Assumptions page, would turn the productivity page from a report into
something actionable.

**A proper multi-year comparison.** Multi-year works — load 2023 and 2024 and the
year filter picks them up — but there is no side-by-side view. Comparing two
years is currently two browser tabs.

**Revenue recognition as a choice.** I pro-rate revenue by hours and document it.
A finance team may want percentage-of-completion or milestone-based recognition
instead. That belongs on the Assumptions page as a named policy, not baked in.

## What I cut, and why

**A cost-audit page.** The month-by-month working is worth showing, but a page
of it reads like a ledger and answers a question nobody asked on a Monday
morning. `npm run reconcile` prints the same working in the terminal, which is
where I actually wanted it while building.

**Charts beyond the two that earn their place.** There's a bar chart for where
time goes and a diverging bar for margin, both directly labelled. Everything else
is a table, because the brief asks for legible tables and eleven projects don't
need a scatter plot. A trend line over 36 months would be worth it; over 12 it
isn't.

**Authentication and multi-tenancy.** It's a local tool for one agency, as
specified. Adding auth would have cost hours and answered no question in the
brief.

**A migration framework.** The schema is created idempotently on open. For a tool
at this size that's the right amount of machinery; the moment a second person
runs it against a database they care about, it isn't.

**Streaming upload for large files.** Files are read fully into memory, capped at
20 MB. A year of this agency's timesheet is 36 KB. At forty people this will not
become a problem, and solving it now would be solving a problem nobody has.

**Editing data in the UI.** The spreadsheets remain the source of truth and the
app is a read model over them. Letting someone patch a salary in the dashboard
would create a second source of truth and a reconciliation problem worse than the
one this tool exists to solve.

## What I'm not happy with

**`projectSummaries` walks the entry list more than once.** At 562 rows nobody
will ever notice, and the clarity is worth more than the passes. At 50,000 rows
it should group once and derive everything from that.

**Revenue on the dashboard needs a sentence of explanation**, and I've written
that sentence under the heading. Any figure that needs explaining is a small
design failure; I think the alternative — revenue landing entirely in the month
of sale — is a bigger one, but I'm not certain a CFO would agree on first look.

**No end-to-end browser test.** The cost model, the parsers and the re-upload
rules are covered by 43 tests. The upload form itself I verified by hand and by
testing the functions underneath it, not with Playwright driving a browser. It's
the gap in the test suite I'd close first.

**Employee identity is matched on employee number, falling back to a normalised
name.** Two people with the same name and no employee numbers would merge. I
report the gap rather than solve it, because solving it properly means an
identity table the agency would have to maintain.

## Time

Roughly eleven hours: two on reading the data and proving the cost model
reconciles against the real workbooks before writing any UI, three on ingestion
and persistence, five on the pages, and the rest on edge cases, tests and this
note.

The self-check drove the order deliberately — `npm run reconcile` printed the
correct 2,400,000 before a single component existed, so every page since has been
a view over numbers that were already known to be right.
