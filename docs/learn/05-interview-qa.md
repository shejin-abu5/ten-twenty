# Questions they may ask, and answers you can say out loud

Answers are written the way you would *speak* them, not the way you would write
them. Say them aloud at least once — reading silently does not build recall.

Sections:
**A** the maths · **B** the data · **C** architecture · **D** Next.js/React ·
**E** trade-offs · **F** testing & quality · **G** product & judgement ·
**H** pressure and "do you really own this" · **I** questions to ask them.

---

## A. The maths (most likely area, by far)

**A1. Walk me through how you cost a project.**
"Two rates, per month. The direct rate is a person's salary divided by their
*total* logged hours, so all their hours are valued at what an hour of them
costs. The indirect rate is a pool divided by that month's billable hours, where
the pool is the salaries of people who logged nothing, plus everyone else's
non-billable time at their own direct rate, plus monthly overhead. A billable
hour then costs `hours x (direct + indirect)`. Non-billable rows carry zero
allocated cost, because their value is already inside the pool."

**A2. Why divide the direct rate by total hours, not billable hours?**
"So `total hours x direct rate` equals the salary exactly. Someone paid 10,000
over 100 hours is 100/hour; 80 billable hours carry 8,000 and 20 non-billable
hours carry 2,000, which add back to precisely their salary. Divide by billable
hours instead and the non-billable time has no cost at all, so there's no honest
way to account for meetings and leave. It's what makes the reconciliation an
identity rather than a coincidence."

**A3. But the indirect rate uses billable hours. Isn't that inconsistent?**
"They answer different questions. The direct rate values a *person's* hour, so
the denominator is all their hours. The indirect rate spreads a pool of money
across the hours that can actually carry it to a client, so the denominator is
billable hours. Using total hours there would leave part of the pool sitting on
rows that reach no project."

**A4. How do you know you're not double-counting?**
"It's provable in four lines. Every billable row uses the same indirect rate, so
summing `billable hours x indirect rate` gives back exactly the pool — the hours
cancel. Add the direct side and you get total hours times direct rate, which by
definition is everyone's salary. So allocated cost equals payroll plus overhead,
always. And structurally, non-billable rows carry `allocatedCost: 0`, so summing
that column anywhere in the app cannot double-count. The check is on screen and
in `npm run reconcile`: 2,400,000 expected, 2,400,000 allocated, difference
0.00."

**A5. What if a month has salaries but nobody logged billable hours?**
"The indirect rate would be a division by zero, so it's guarded. That pool is
reported as *unabsorbed* — on the dashboard, in the audit, and as its own line
in the reconciliation. It's the only way the balance check can fail, which is
exactly why it's a separate line rather than folded in. The honest statement is
that the money reached no project."

**A6. Someone has a direct rate of 854 AED/hour. Is that a bug?**
"No. She's paid 20,000 and logged 23.4 hours, all internal. The direct rate
isn't a market rate; it's an accounting device that makes `hours x rate` equal
her salary — and 23.4 x 854.70 is exactly 20,000. Because it's all
non-billable, the whole 20,000 lands in the pool, which is right: an account
manager's salary is a cost client projects must carry. If I capped the rate, the
pool would be short and total cost would stop equalling payroll."

**A7. How do you recognise revenue?**
"Pro-rata by hours: a month earns `price x (hours that month / the project's
total hours)`. The brief gives one price for a project's whole life but costs
arrive monthly, so I had to choose. Booking it all at the sale makes every later
month of work a pure loss and monthly margin becomes noise. Pro-rating puts cost
and revenue in the same month and the shares always add back to the full price.
The supporting argument is that the brief already splits by hour-share for the
employee revenue share — I applied the same idea across months."

**A8. What would a CFO say about that?**
"That it isn't how cash arrives, and they'd be right. It's an allocation for
management reporting, not a cash statement, and I say so on the dashboard. If
their policy is percentage-of-completion or milestone-based, that belongs on the
Assumptions page as a named policy rather than baked into the model — that's in
NOTES.md as work I'd do next."

**A9. Why do project pages show whole-life numbers instead of the filtered
period?**
"Because 'did we make money on it' only has an answer over a project's whole
life. A March-only view of a project sold in January would be meaningless
against the full price. The period filter still applies to the tables inside the
page, but the headline compares whole-life cost to the whole-life price."

**A10. Does filtering to one month change a project's revenue?**
"No, and that was the trap. Revenue's denominator is the project's hours across
all loaded data, so the model is always built over everything and filtered only
for display. If I'd filtered at the database, picking a month would silently
re-base every project's revenue."

**A11. Overhead goes from 0 to 10,000 a month. What changes?**
"Total cost goes up by 120,000 for the year, to 2,520,000, and the
reconciliation still balances because expected cost is salaries *plus*
overhead. Each month's indirect rate rises, so every project's cost rises by its
share of billable hours and every margin falls. Revenue is untouched. You can
watch it happen — it's a number on the Assumptions page."

**A12. What's productivity here?**
"Billable hours divided by total hours logged, per person and in aggregate.
77.0% agency-wide for the year. Leave, meetings, learning and idle all count
against it. The page also flags people who never touch client work, because
that's the actionable end of it."

**A13. Is 77% good?**
"I genuinely don't know, and that's a gap I'd name. Productivity is reported but
not judged — '77% billable' means nothing without the agency's target beside it.
A target per designation, set on the Assumptions page, would turn that page from
a report into something actionable. It's the second item in NOTES.md."

**A14. Someone logged hours but has no salary row. What happens?**
"They cost zero, and it's reported as a gap on every page with the number of
hours affected. The alternative — guessing a salary from their designation —
would put invented money into a reconciliation whose whole value is that nothing
in it is invented."

**A15. Can I change what counts as billable?**
"Yes, on the Assumptions page, no code. The brief names Projects, Enhancements
and Hosting, and those are the defaults, but they're stored in settings. Untick
Hosting and its 644 hours move into the indirect pool, the indirect rate rises,
every project's cost shifts — and total cost stays exactly 2,400,000. Moving a
category changes *where* cost lands, never the total."

**A16. What are the headline findings?**
"Enhancements and hosting lose money. Three of eleven jobs are underwater and
all three are the small ones — E2025050a is a 92,000 enhancement that absorbed
1,225 hours, a −112% margin. The big development projects carry the agency:
Q2025027f at 83.9%, Q2025041h at 76.8%. That's the thing leadership couldn't see
before and can see in one glance now."

---

## B. The data and ingestion

**B1. How do you handle a header that isn't in row 1?**
"`locateHeader` scores every row in the first twenty on how well its cells match
the expected column captions — exact match scores highest, then prefix, then
contains — and the best-scoring row wins. So a title row and a blank row above
the header don't matter. If a required column is missing it throws an
`IngestError` that says which column and how many rows it checked, rather than
'parse failed'."

**B2. What if I upload the wrong file in the wrong slot?**
"It's caught, because the columns are sniffed. The error says what the file
actually looks like rather than failing abstractly. There's a messy-data fixture
for exactly that."

**B3. How do you parse the months? The sheets are inconsistent.**
"`parseMonth` handles `May '25`, `January 2026`, a bare `January`, a real date
cell, `2025-05`, `05/2025`, `Jan-25` and Excel serial numbers. Two-digit years
expand to 20xx. A month name shorter than three letters is refused — `j` could
be June or July and I'd rather report an unreadable cell than guess."

**B4. What does a `-` in a cell mean?**
"'Not provided', not 'zero'. It parses to null and is skipped, which matters
most for salaries: if a blank meant zero, re-uploading a partial sheet would
silently wipe a month that was already correct."

**B5. What happens to a cell you can't parse?**
"It returns null and an issue is recorded with the row number, the column, and
a message. Nothing is coerced to zero silently. The upload screen shows every
issue grouped as errors and warnings, and it's all stored on the upload record
so you can look back at what a file did weeks later."

**B6. Describe the re-upload rules.**
"Per file type. Timesheet: the months present in the file are deleted and
rewritten, so a file containing only March replaces March and leaves the other
eleven alone; uploading the same file twice is a no-op, not a doubling.
Salaries: upserted per person per month, and blanks were already dropped so they
don't overwrite. Projects: upserted per ref code, so projects absent from the
file survive."

**B7. Why delete-and-insert for timesheets instead of upsert?**
"There's no natural row key. One person can legitimately log two rows in the
same category in the same month — same person, same task, two entries. Any key I
invented would either merge legitimate rows or duplicate on re-upload.
Replace-by-period is the only rule that's both idempotent and correct."

**B8. What if the same ref code appears twice in one price file?**
"The later row wins and the collision is reported as an issue. Silently taking
one of them would be the wrong kind of quiet."

**B9. Two people with the same name?**
"Employee number is the join key. If a sheet has no employee-number column, rows
get a name-derived key and `reconcileEmployeeKeys` stitches them to the numbered
records on read, so one person never appears twice. The known limit is two
people with the same name *and* no employee numbers — they'd merge. I report
that rather than solve it, because solving it properly means an identity table
the agency would have to maintain."

**B10. How big a file can it take?**
"20 MB, enforced in the action with a friendly message, and the Server Action
body limit is raised to 25 MB to sit above it. A year of this agency's timesheet
is 36 KB. Files are read fully into memory — streaming would be solving a
problem nobody has at forty people, and that's in NOTES.md as a deliberate cut."

**B11. Show me the messy data handling.**
"`sample-data/messy/` has a deliberately broken copy of one month — a header
buried under two rows of preamble, four spellings of March, `-` for empties, a
salary typed as `12,500`, a row with no employee, an unreadable `Q1`, a missing
category, a ref code with no price, a priced project with no hours, a person
with hours and no salary, a duplicate ref code, and two months of payroll with
no timesheet behind them. Upload them and everything is either absorbed or
reported; nothing crashes. `tests/messy-workbook.test.ts` is the contract for
exactly what happens to each one."

**B12. Why ExcelJS and not SheetJS?**
"SheetJS is the better parser and the industry default. Its npm build carries
two advisories with no fix available on npm — the patched build is only on the
vendor's CDN. For a submission someone may run `npm audit` against, I took the
slightly weaker parser with a clean audit, and wrapped it behind `workbook.ts`
so swapping back is a one-file change."

---

## C. Architecture

**C1. Walk me through the structure.**
"Four layers, each knowing only about the one above. Ingestion turns a workbook
into typed rows and issues; it knows nothing about cost or SQL. Persistence
stores rows and owns the re-upload rules; it knows nothing about cost.
Calculation is pure functions — rows in, costed rows out — and knows nothing
about React, Next or SQLite. The UI is a projection of one CostModel built once
per request. The proof that the separation is real is `npm run reconcile`: it
runs the calculation layer from a terminal with no browser involved."

**C2. Why no API layer?**
"Server components read the database directly, and Server Actions handle writes.
An API would be indirection with no consumer — there's no second client. And if
one appears, the calculation layer is already pure and framework-free, so the
API would be a thin wrapper over functions that already exist."

**C3. Why SQLite?**
"It persists across restarts with no service to run, which matters for a local
tool someone installs once. And the re-upload rule *is* a transaction — delete
the months in the file, insert the new rows, all or nothing. JSON files would
have worked at this size and removed a native dependency, but I'd have
hand-rolled atomicity and 'our data grew' would mean a rewrite."

**C4. How would you move to Postgres?**
"Only `src/lib/db/` changes — `client.ts` and `repository.ts`. Nothing above
them knows SQLite exists; the domain layer receives plain arrays. The SQL is
mostly portable; the upserts would become `ON CONFLICT ... DO UPDATE` in
Postgres syntax, which is nearly identical."

**C5. Performance at scale?**
"562 rows now; the whole model builds in milliseconds. The first thing to break
would be building the whole model per request — at 50,000 rows I'd push the
period filter into SQL and cache the per-month rates, and `projectSummaries`
walks the entry list more than once, which I'd replace with a single grouping
pass. That's in NOTES.md. At the current size the clarity is worth more than the
passes, and I'd rather say that than pre-optimise."

**C6. Why is `getCostModel` wrapped in `cache()`?**
"React's `cache` is request-scoped dedupe. A page with five tables calls it five
times; without `cache` that's five database reads and five runs of the cost
model for one page. It is *not* a persistent cache, so stale data isn't
possible — the next request rebuilds from scratch."

**C7. What's `import 'server-only'` for?**
"It does nothing at runtime — it breaks the build if that module is ever
imported into a client component. A compile-time fence around the database code
so nobody accidentally tries to ship SQLite to a browser."

**C8. Why does the SQLite handle live on `globalThis`?**
"Next replaces modules on every hot reload in development. A module-level
variable would leak a new connection each time you save a file. Hanging it off
`globalThis` means one handle survives reloads."

**C9. What are your tables?**
"Four: `timesheet_entries`, `salaries` keyed on employee/year/month, `projects`
keyed on ref code, and `uploads` which records every parse with its filename,
sheet, detected header row, counts and full issue list. Plus a `settings`
key-value table for the assumptions. Indexes on period, ref code and employee.
WAL journal mode, foreign keys on."

**C10. Where are your migrations?**
"There aren't any — the schema is created idempotently on open. For a local tool
at this size that's the right amount of machinery. The moment a second person
runs it against a database they care about, it isn't, and that's stated in
NOTES.md rather than hidden."

---

## D. Next.js and React

**D1. Why Next.js?**
"One codebase instead of two, and server components let a page read SQLite
directly, so there's no API layer to build, version and keep in sync. For a
local tool with one consumer, that removes a whole category of code."

**D2. Server vs client components — how did you decide?**
"Server by default. `'use client'` only where the browser is genuinely needed,
and only on the smallest component that needs it. There are five: the nav needs
`usePathname`, the period filter needs `router.push`, the CSV button needs
`onClick` and `Blob`, and the two forms need `useActionState`. Everything else
renders on the server and ships no JavaScript."

**D3. How does an upload work end to end?**
"The form is a client component whose `action` is a Server Action. The action
runs on the server: size check, parse the workbook, save inside one transaction,
`revalidatePath('/', 'layout')`, and return an outcome object per file. The form
renders those outcomes as cards with the issue detail. No API route, no fetch,
no JSON hand-rolling."

**D4. What does `revalidatePath` do?**
"Invalidates the cached render for that path and everything under the layout, so
the next render re-reads the database. It's why saving an assumption instantly
changes the dashboard, the audit page and every project page with no client
state management at all."

**D5. Why `force-dynamic`?**
"Every page reads SQLite at request time, so nothing is prerenderable at build
time — the database doesn't exist then, and the data changes when someone
uploads. It's one line in the root layout with a comment saying exactly that."

**D6. Why is `searchParams` awaited?**
"It's a promise in Next 15 and 16. The framework can start rendering the static
shell before dynamic request data resolves, so `params` and `searchParams`
arrive asynchronously. On the project page I await both in one
`Promise.all`."

**D7. Why is the period filter in the URL?**
"So a filtered view is a link. It survives refresh, the back button works, and
you can paste `/?year=2025&month=3` into an email. React state gives you none of
that. `resolvePeriod` reads it, `periodQuery` rebuilds it so drilling into a
project keeps your period."

**D8. Is a Server Action secure?**
"It's a public HTTP endpoint, so it has to validate its own input — client-side
validation is UX only. The assumptions action re-checks that overhead is a
finite number of zero or more before writing, and the upload action enforces its
own size limit rather than trusting the form."

**D9. What's `useActionState`?**
"It binds a Server Action to a form and gives you the last returned state, the
action to pass to `<form action=...>`, and a pending boolean for disabling
buttons and showing a spinner. It's how the upload page shows per-file outcomes
without any custom state management."

**D10. Any Next-specific problems?**
"Two. better-sqlite3 is a native addon so it has to be listed in
`serverExternalPackages` — the bundler can't bundle a `.node` binary and the
server build breaks without it. And the dev server's hot reload would leak a
SQLite handle per save, which is why the connection hangs off `globalThis`."

**D11. How would you deploy it?**
"It's local-only by design — SQLite on the local filesystem — so it wants a
machine with a persistent disk: a small VM or a container with a volume, running
`npm run build && npm start`. It wouldn't survive a serverless platform
unchanged, because the filesystem isn't durable there. That'd mean Postgres,
which is contained to two files."

**D12. Why shadcn/ui?**
"It's copy-in components rather than a dependency, so they're in my repo and I
can change them. I kept them in `components/ui/` and put my own vocabulary —
StatCard, DataTable, GapsPanel — in `components/ui-kit/`, so a shadcn update
never fights my components."

---

## E. Trade-offs — have three ready, deliver them the same way

Format every trade-off answer the same way: **what I chose → what the
alternative was → what my choice costs → why it still wins here.** That last
part is what separates a decision from a preference.

**E1. Revenue pro-rated by hours vs. booked at sale.** *(the strongest one —
lead with it)*
"Chose pro-rata by hours. The alternative books the full price in the month of
sale, which is simpler and matches cash. The cost of my choice is that it's an
allocation, not a cash figure, and it needs a sentence of explanation on the
dashboard — which is a small design failure I'll own. It wins because otherwise
every month after the sale is a pure loss and monthly margin is meaningless, and
because the brief already uses hour-share splitting for the employee revenue
share."

**E2. SQLite vs. JSON files.**
"Chose SQLite. JSON would have worked at this size and removed a native
dependency — which did cost me something real, an `.npmrc` fix so installs work
without a C++ toolchain. It wins because the re-upload rule is literally a
transaction, and because growth doesn't mean a rewrite."

**E3. ExcelJS vs. SheetJS.**
"Chose ExcelJS. SheetJS is the better parser and the default choice; its npm
build has two advisories with no npm-side fix. The cost is a slightly weaker
parser. It wins for a submission someone may audit, and it's wrapped behind one
file so swapping back is a one-file change."

**E4. Server components reading SQLite directly, no API.**
"Less indirection, no loading states, less code. The cost is that putting a
mobile client on it later needs an API — but the calculation layer is already
pure, so that API is a wrapper over existing functions rather than a rewrite."

**E5. Replace-by-period vs. row-level upsert for timesheets.**
"There's no natural row key, so replace-by-period is the only rule that's both
idempotent and correct. The cost is that a file must contain a complete month —
a partial March would delete the rows it doesn't contain. That's the right
default for a corrected-month workflow, and the upload screen states exactly
which months were replaced."

**E6. A table component vs. bespoke tables per page.**
"One `DataTable` where a column declares a `value` and an optional `render`. The
cost is a layer of indirection on every page. It wins because the CSV export is
generated from the same column definitions, so what you export can never drift
from what you see."

**E7. Configurable assumptions vs. constants.**
"Billable categories and overhead live in the database and are editable in the
UI. The cost is a settings table and a form. It wins because the brief's
categories are an assumption, not a fact — and a finance tool where changing an
assumption means editing code is a tool finance can't use."

**E8. Two charts, not ten.**
"A bar chart for where time goes and a diverging bar for margin, both directly
labelled. Everything else is a table, because the brief asks for legible tables
and eleven projects don't need a scatter plot. A trend line over 36 months would
earn its place; over 12 it doesn't."

---

## F. Testing and quality

**F1. What do you test?**
"53 tests in five files: the cost model including the brief's self-check and the
awkward months, the cell and header parsers, the re-upload rules proving a
corrected month leaves the rest of the year intact, and both sample workbooks
end to end — the clean one and the deliberately messy one."

**F2. What's the most valuable test?**
"The full-year reconciliation against the real workbook: parse all three files,
build the model, assert total cost equals total salaries to the fils. It's a
single assertion that would catch almost any arithmetic regression. Second is
the re-upload test, because 'uploading March twice doesn't double March' is easy
to believe and easy to get wrong."

**F3. What isn't tested?**
"There's no end-to-end browser test. The model, the parsers and the re-upload
rules are covered; the upload form itself I verified by hand and by testing the
functions underneath it. That's the first gap I'd close — Playwright driving the
three file inputs and asserting the outcome cards."

**F4. Did a test ever find a real bug?**
"Yes, twice. The messy-workbook test found that `Q1` was parsing as January —
20 hours filed in the wrong month, about 97,000 out on the reconciliation. And
the reconciliation assertion caught a double-count I'd shipped on the Categories
page, where one Cost column mixed allocated and direct cost and totalled
3,309,257 against a true 2,400,000."

**F5. How do you know the whole thing is right, not just the units?**
"The self-check the brief asks for, run three ways: as a test, as
`npm run reconcile` in the terminal, and on screen at the top of the dashboard.
Expected cost is salaries plus overhead; allocated plus unabsorbed must equal
it; tolerance is one fils. Nobody has to take the numbers on trust."

**F6. How did you order the work?**
"Correctness first, deliberately. The self-check printed 2,400,000 before a
single component existed — first in a throwaway script against the raw
workbooks, then as a test, then through the real database. Every page since is a
view over numbers already known to be right, so I never spent time debugging a
dashboard that looked plausible and was wrong. The git history shows that
order."

---

## G. Product and judgement

**G1. Who is this for, and what do they do with it?**
"A director or finance lead who currently has three spreadsheets and no answer.
They open it and in one glance see total margin, the reconciliation, and every
project ranked worst-first — so the loss-makers are the first thing on screen,
not something you have to go looking for."

**G2. What would you build next?**
"Sortable, filterable tables — highest value, about a day done properly,
URL-driven so a sorted view stays shareable. Then utilisation targets, so
productivity is judged rather than just reported. Then per-month overhead,
because real overhead moves. Then a side-by-side year comparison."

**G3. What are you least happy with?**
"The audit page is dense — it shows the working for every month and every
person, which is correct but reads like a ledger. Someone asking 'why is this
project's cost so high' has to know which month to open. A 'why does this number
look like this' path from a project row into the audit would be better than a
page you navigate to."

**G4. What did you cut, and why?**
"Authentication and multi-tenancy — it's a local tool for one agency as
specified, and auth would have answered no question in the brief. Streaming
uploads — a year of timesheet is 36 KB. A migration framework. And editing data
in the UI, which I cut on principle: the spreadsheets stay the source of truth,
and patching a salary in the dashboard would create a second source of truth and
a worse reconciliation problem than the one this tool exists to solve."

**G5. How long did it take?**
"About eleven hours. Two on reading the data and proving the cost model
reconciles against the real workbooks before writing any UI, three on ingestion
and persistence, five on the pages, the rest on the messy fixtures, tests and
the notes."

**G6. What's the thing you're proudest of?**
"That the reconciliation is a property of the model rather than something I
verify. Non-billable rows carry zero allocated cost, so double-counting isn't
something I avoided — it's something the code can't express. Everything else
follows from that."

**G7. What would you do differently with another week?**
"Close the end-to-end test gap, add sorting, and spend a day with whoever fills
in these spreadsheets. Half the ingestion complexity exists because the sheets
are inconsistent; some of that is better fixed upstream with a template than
absorbed downstream forever."

**G8. If the agency grew to 200 people?**
"Three things break in order: building the whole model per request, the
single-pass aggregations, and one overhead figure for every month. All three are
known and written down. The architecture holds — the domain layer doesn't care
where rows come from."

---

## H. Pressure questions, and "do you really own this?"

These are the ones that decide the call. Answer calmly and without defensiveness.

**H1. Did you use AI to write this?**
Answer honestly, then pivot to verification. "Yes — the way I'd use a senior
colleague: to move faster. What I don't outsource is whether it's right. I
proved the cost model reconciled against the real workbooks before building any
UI, I wrote the messy fixtures myself to attack the parsers, and two real bugs
came out of that — the `Q1` month parse and a double-count on the Categories
page. Ask me to change anything in here and I'll do it in front of you."
*Do not oversell, do not apologise, and do not claim you typed every character
if you did not. The live change is the real test and you are about to pass it.*

**H2. Explain this line. (points at something unfamiliar)**
"Let me read it back." Then read it and reason aloud: what goes in, what comes
out, what breaks if it's removed. Reasoning correctly in real time is worth more
than instant recall — that is literally the skill they are hiring.

**H3. This looks over-engineered for a one-week exercise.**
"Fair challenge. The part I'd defend is the four-layer split, because it's what
makes the numbers provable from a terminal and it took no extra time. The part
I'd concede is the audit page, which is more machinery than a reviewer needs —
though the brief asked to show the cost rates, and once I'd built the model
keeping the working was nearly free."

**H4. There's a bug: [something you can't immediately explain].**
"Let's look. What were you doing when you saw it?" Reproduce, form a hypothesis
out loud, check it in the code. Never guess with confidence. "I'd check X first
because that's the only place that value is set" is the right register.

**H5. Why should we trust these numbers?**
"You shouldn't have to — that's the design. The self-check is at the top of the
dashboard, the audit page shows every rate and how it was derived, every gap in
the data is listed rather than hidden, and `npm run reconcile` prints the whole
thing in a terminal in two seconds. If it ever stops balancing, the app says so
in red."

**H6. What's the weakest part of this submission?**
"No end-to-end test on the upload form, and the audit page's density. And I'll
add one more: the same-name-without-employee-number merge is a real hole. It's
documented and not fixed, because fixing it properly needs an identity table the
agency would maintain, and inventing one seemed worse than naming the limit."

**H7. Change X right now.**
See `06-live-change-drills.md`. Narrate while you navigate: *"That's in
`aggregate.ts` — the columns for that table are at the bottom of the page
file."* Make the edit, save, and let the page reload. If there's a test that
covers it, run it. Do not go quiet for 60 seconds.

**H8. You've got 10 minutes to make this better. What do you do?**
"Sort the project table by cost descending instead of margin, because the
conversation in the room is always 'where did the money go'. That's a one-line
change to the `rows` prop. If I had thirty minutes instead, I'd make sorting
URL-driven so the sorted view is shareable."

---

## I. Questions to ask them

Have three. Ask at least two — it converts an interrogation into a conversation.

1. "Where does this kind of allocation actually get argued about in your
   business — is it revenue recognition, or is it what counts as billable?"
2. "If you shipped this to the finance team on Monday, what's the first thing
   they'd ask for that isn't here?"
3. "How does the team feel about server components — is this stack where you're
   heading, or is there a service boundary I'd be building against?"
4. "What does the first three months look like for whoever takes this role?"

---

## The five things to say even if nobody asks

1. **"It balances, and the check is on screen."** 2,400,000 expected, 2,400,000
   allocated, difference 0.00.
2. **"Enhancements and hosting lose money"** — the finding, not the feature.
3. **"I shipped a double-count and caught it with the reconciliation"** — the
   failure mode the brief warns about, found and fixed.
4. **"Assumptions are editable without code"** — untick Hosting and the total
   doesn't move.
5. **"Here's what I'd do next and what I'm not happy with"** — NOTES.md exists
   for this, so use it.

---

Next: `06-live-change-drills.md`. **Do not just read that one.**
