# Next.js, starting from "I know a bit of Node"

Everything here is explained against code that is actually in this repo. When
you finish, open the files named and check — they will look familiar.

---

## 0. The 30-second version

You already know this shape:

```js
// plain Node + Express
const express = require('express');
const app = express();

app.get('/projects', (req, res) => {
  const rows = db.query('SELECT * FROM projects');
  res.send(renderSomeHtml(rows));       // or res.json(rows)
});

app.listen(3000);
```

Next.js is that, with four chores done for you:

1. **You never write `app.get(...)`.** A file at `src/app/projects/page.tsx`
   *is* the `/projects` route. Folder = URL.
2. **You never write `renderSomeHtml`.** You return HTML-shaped JavaScript
   (JSX) and React turns it into HTML.
3. **You never write a separate frontend.** The same project holds the server
   code and the browser code, and Next decides which is which.
4. **You never write `fetch('/api/...')` for your own data.** A page can read
   the database directly, because the page function runs on the server.

That last one is the biggest shift, and it is the one this app leans on hardest.

---

## 1. React in five minutes (you need this before Next)

A **component** is a function that returns markup. That's the whole idea.

```tsx
function Hello({ name }) {
  return <p>Hello {name}</p>;
}
```

- `{ name }` is the argument. In React the argument object is called **props**.
- The `<p>Hello {name}</p>` is **JSX** — HTML-looking syntax that a build step
  turns into ordinary function calls. Anything inside `{ }` is real JavaScript.
- You use it like a tag: `<Hello name="Shejin" />`.

Real example from this repo, `src/components/ui-kit/page-header.tsx` — the file
you already have open:

```tsx
export function PageHeader({ title, description, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="...">{eyebrow}</p> : null}
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="...">{description}</p> : null}
      </div>
      {actions ? <div className="...">{actions}</div> : null}
    </header>
  );
}
```

Four things to notice, because they appear in every file here:

| You see | It means |
| --- | --- |
| `className=` | JSX's word for HTML's `class` (because `class` is a reserved word in JS) |
| `{cond ? <X/> : null}` | "if" — JSX has no `if` statement, so you use a ternary |
| `{list.map(x => <Row key={x.id} />)}` | "for each" — a loop returning an array of elements |
| `key={...}` | required on lists, so React can tell rows apart between renders |

Called from `src/app/page.tsx`:

```tsx
<PageHeader
  eyebrow={describeFilter(filter)}
  title="Dashboard"
  description="Revenue is each project's price spread across the hours worked on it..."
  actions={<PeriodFilter year={filter.year} month={filter.month} years={years} months={...} />}
/>
```

`actions` is a prop whose value is *another component*. That is normal — in
React, markup is just a value you can pass around.

**Those long `className` strings are Tailwind.** `mb-6` = margin-bottom 6 units,
`flex` = `display:flex`, `text-sm` = small text. It is CSS written as shorthand
class names. You do not need to defend Tailwind in depth; it is a styling
convention, not logic.

---

## 2. The one idea that explains this entire app: two kinds of component

This is **the** Next.js concept. If you learn nothing else, learn this.

### Server Components — the default

Every `.tsx` file here is a Server Component **unless it says otherwise**. A
Server Component:

- runs **only on the server**, during the request;
- can be `async` and can `await`;
- can talk to SQLite, the filesystem, secrets — anything Node can do;
- is **never sent to the browser**. The browser receives its *output*, not its
  code;
- **cannot** have `onClick`, `useState`, or any browser interactivity.

That is why `src/app/page.tsx` can start like this and it simply works:

```tsx
export default async function DashboardPage({ searchParams }) {
  const model = getCostModel();          // reads SQLite. On the server. Directly.
  ...
}
```

In Express terms: the page function *is* the route handler. No API call, no
`fetch`, no loading spinner, no JSON round-trip — because the code that needs
the data and the code that has the database are the same function.

### Client Components — opt in with `'use client'`

Put `'use client'` as the first line of a file and it becomes a Client
Component. It is compiled, shipped to the browser, and runs there. It can use
`useState`, `onClick`, `useRouter` — anything interactive. It **cannot** touch
SQLite, because it is running in someone's browser.

**In this whole app there are exactly five of them:**

```
src/components/layout/nav.tsx               — needs usePathname() to highlight the current link
src/components/filters/period-filter.tsx    — needs onValueChange + router.push()
src/components/ui-kit/export-csv-button.tsx — needs onClick + Blob/document to download a file
src/app/upload/upload-form.tsx              — needs file inputs, useActionState, a confirm dialog
src/app/settings/assumptions-form.tsx       — needs useActionState for the save result
```

Every one is there because of a specific browser-only need. That is the rule to
state in the interview: **server by default; `'use client'` only where the
browser is genuinely required, and only on the smallest component that needs
it.**

Verify it yourself:

```bash
grep -rl "use client" src/
```

### How they combine

A Server Component can render a Client Component and pass it plain data:

```tsx
// src/app/page.tsx — a server component
<PeriodFilter year={filter.year} month={filter.month} years={years} months={...} />
```

`PeriodFilter` is a client component. `year`, `months` and so on are serialised
into the HTML payload and hydrated in the browser. The restriction: **you can
pass data across that boundary, not functions.** (Server Actions, in §6, are the
deliberate exception.)

### If someone asks "why does this matter?"

Because of what is *not* in this app: no `/api` routes, no `useEffect` fetching,
no client-side loading states, no duplicated types between server and client, no
JSON serialisation layer. Roughly 40% of a traditional React + Express app is
plumbing that server components delete.

---

## 3. Routing is folders

`src/app/` is the router. A folder is a URL segment; a `page.tsx` inside it is
the page.

```
src/app/page.tsx                      ->  /
src/app/projects/page.tsx             ->  /projects
src/app/projects/[refCode]/page.tsx   ->  /projects/Q2025001a
src/app/departments/[name]/page.tsx   ->  /departments/Design
src/app/upload/page.tsx               ->  /upload
src/app/settings/page.tsx             ->  /settings
```

Square brackets = **dynamic segment**. Whatever sits in that URL position
arrives as a parameter.

Files that are *not* `page.tsx` are not routes — they are modules that happen to
live next to the page that uses them. `src/app/upload/actions.ts`,
`upload-form.tsx` and `types.ts` are not URLs. That is deliberate colocation:
everything the upload page needs sits in the upload folder.

### `layout.tsx` — the frame around every page

`src/app/layout.tsx` wraps every route. It renders `<html>` and `<body>`, loads
the fonts and the CSS, and puts the sidebar around whatever page you are on:

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(sans.variable, mono.variable)}>
      <body className="font-sans antialiased">
        <AppShell>{children}</AppShell>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
```

`children` is the page. When you navigate from `/` to `/projects`, the layout
does **not** re-render — only `children` swaps. That is why the sidebar never
flashes.

---

## 4. The two props every page here receives

```tsx
// src/app/projects/[refCode]/page.tsx
export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ refCode: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ refCode }, query] = await Promise.all([params, searchParams]);
```

- **`params`** — the dynamic segments. For `/projects/Q2025001a` it is
  `{ refCode: 'Q2025001a' }`.
- **`searchParams`** — the query string. For `/?year=2025&month=3` it is
  `{ year: '2025', month: '3' }`.

**Both are Promises and must be awaited.** This is a Next 15/16 breaking change
and a very likely interview question. The reason: Next wants to begin rendering
the static parts of a page before it knows the URL's dynamic parts, so those
arrive asynchronously. It is noted in the code:

```ts
// src/lib/period-params.ts
/** Next 16 hands route search params in as a promise. */
export type SearchParams = Record<string, string | string[] | undefined>;
```

**Why the period filter lives in the URL and not in React state** — worth
volunteering:

```ts
// src/components/filters/period-filter.tsx
/**
 * Period lives in the URL rather than in component state, so a filtered view is
 * a link: it survives a refresh, and it can be pasted into an email.
 */
```

A filtered view *is* a URL. Refresh keeps it. Back button works. You can send
`/?year=2025&month=3` to the finance director. React state gives you none of
that.

---

## 5. How a page request actually flows

Trace this once and Next stops being mysterious. A user opens
`http://localhost:3000/?year=2025&month=3`:

```
1.  Browser  ->  GET /?year=2025&month=3
2.  Next matches src/app/page.tsx
3.  Next runs layout.tsx, then DashboardPage(props) — on the server, in Node
4.  DashboardPage calls getCostModel()          src/lib/model.ts
5.    -> loadModelInputs()                      src/lib/db/repository.ts  (3 SELECTs)
6.    -> readAssumptions()                      src/lib/db/settings.ts
7.    -> buildCostModel(...)                    src/lib/domain/cost-model.ts  (the maths)
8.  resolvePeriod(await searchParams, years)  -> { year: 2025, month: 3 }
9.  filterEntries / summarise / projectSummaries ...  src/lib/domain/aggregate.ts
10. The component returns JSX; React renders it to HTML on the server
11. HTML streams to the browser, plus JS for the 5 client components only
12. Browser paints. PeriodFilter and Nav hydrate, so they become clickable
```

Steps 4–9 are *your* code and have nothing to do with Next. That separation is
the architectural point of the whole submission: `npm run reconcile` runs steps
4–9 from a terminal script with no browser and no Next involved at all.

---

## 6. Server Actions — the reason there is no API layer

Normally a form submit means: write an API route, `fetch()` it from the browser,
parse JSON, handle errors. Next lets you skip all of that.

Mark a function `'use server'` and you may call it from the browser directly.
Next replaces the function body with a network call under the hood.

```ts
// src/app/settings/actions.ts
'use server';

export async function saveAssumptions(
  _previous: AssumptionsFormState,
  formData: FormData,
): Promise<AssumptionsFormState> {
  const billableCategories = formData.getAll('billable').map(String);
  const rawOverhead = String(formData.get('overhead') ?? '0').replace(/[,\s]/g, '');
  const monthlyOverhead = Number(rawOverhead);

  if (!Number.isFinite(monthlyOverhead) || monthlyOverhead < 0) {
    return { status: 'error', message: 'Monthly overhead must be a number of zero or more.' };
  }

  writeAssumptions({ billableCategories, monthlyOverhead });
  revalidatePath('/', 'layout');

  return { status: 'saved', message: '...' };
}
```

And the client side, `src/app/settings/assumptions-form.tsx`:

```tsx
'use client';
const [state, action, pending] = useActionState(saveAssumptions, INITIAL);

return <form action={action}>...</form>;
```

`useActionState` gives you three things:

- `state` — whatever the action returned last time, so you can show the message
- `action` — hand this to `<form action={...}>`
- `pending` — `true` while it runs, for disabling the button and showing a
  spinner

**A security point worth saying out loud:** a Server Action is a public HTTP
endpoint. Anyone can post to it. That is why the action re-validates its input
(`!Number.isFinite(monthlyOverhead) || monthlyOverhead < 0`) rather than
trusting the form. Client validation is UX; server validation is the real thing.

### `revalidatePath` — the line that makes it feel live

After writing to the database, every page showing the old numbers is stale.

```ts
revalidatePath('/', 'layout');
```

That means: "throw away the cached render for `/` and everything under that
layout — i.e. every page." The next render re-reads SQLite. That single line is
why saving on the Assumptions page instantly changes the Dashboard, the Audit
page and the project pages, with no client-side state management anywhere.

The same call sits in `src/app/upload/actions.ts` after every successful upload
and after `clearData()`.

---

## 7. Caching — the three lines that control it

Next caches aggressively by default. This app deliberately turns the relevant
parts off, and each decision is one line.

**a) `src/app/layout.tsx`**

```ts
// Every page reads the SQLite database at request time, so nothing here is
// prerenderable at build time.
export const dynamic = 'force-dynamic';
```

Without this, Next would try to render pages at *build* time and serve a frozen
snapshot. The database does not exist at build time, and the data changes when
someone uploads. So: render every request, fresh.

**b) `src/lib/model.ts`**

```ts
export const getCostModel = cache((): CostModel => {
  const inputs = loadModelInputs();
  return buildCostModel({ ...inputs, assumptions: readAssumptions() });
});
```

`cache()` is React's **per-request** memoiser. The dashboard calls
`getCostModel()`, and so do components beneath it — without `cache` that would
be several database reads and several runs of the cost model *for one page*.
With it: once per request, shared. Next request, fresh again.

Say this precisely in the interview: *"`cache` is request-scoped, not a
persistent cache — which is why stale data is impossible."*

**c) `revalidatePath`** — see §6.

---

## 8. The `server-only` guard

```ts
// src/lib/model.ts
import 'server-only';
```

That package does nothing at runtime. It exists to **break the build** if this
module is ever imported into a Client Component. It is a compile-time fence
around the database code, so a future change cannot accidentally try to ship
better-sqlite3 to a browser. Cheap insurance, and a nice detail to point out.

---

## 9. Config you should be able to explain

`next.config.ts`:

```ts
const nextConfig: NextConfig = {
  agentRules: false,
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    serverActions: { bodySizeLimit: '25mb' },
  },
};
```

- **`serverExternalPackages: ['better-sqlite3']`** — better-sqlite3 is a
  *native addon* (a compiled `.node` binary, not JavaScript). Next's bundler
  cannot bundle a binary, so this says "leave it alone, `require()` it at
  runtime." Without it the server build breaks. A good concrete answer to "did
  you hit anything tricky?"
- **`bodySizeLimit: '25mb'`** — Server Actions default to a 1 MB request body.
  Spreadsheets go through a Server Action, so the cap is raised. The app also
  enforces its own 20 MB limit in `upload/actions.ts`, so the user gets a
  friendly message instead of a framework error.
- **`agentRules: false`** — stops Next auto-writing `AGENTS.md` into the repo
  root on every `next dev`.

`.npmrc`:

```
ignore-scripts=true
```

better-sqlite3 ships prebuilt binaries, but npm sees its `binding.gyp` and tries
to compile it anyway, which fails on any machine without Python and a C++
toolchain. Skipping install scripts makes `npm install` work on a clean laptop.
That was a real fix — commit `c13a910 fix: make a clean npm install work without
a C++ toolchain`.

`tsconfig.json`:

```json
"paths": { "@/*": ["./src/*"] }
```

That is why imports read `@/lib/domain/aggregate` rather than
`../../../lib/domain/aggregate`.

---

## 10. The commands, and what each one really does

| Command | What happens |
| --- | --- |
| `npm run dev` | Dev server on :3000. Compiles on demand, hot-reloads on save. |
| `npm run build` | Production compile plus typecheck. |
| `npm start` | Serves the built output. |
| `npm test` | Vitest, 53 tests. Node only — no browser, no Next. |
| `npm run seed` | `tsx scripts/seed.ts` — parses `sample-data/` into `data/margin.db`. |
| `npm run reconcile` | Prints the year's totals and the self-check in the terminal. |
| `npm run db:reset` | Empties every table. |
| `npm run typecheck` | `tsc --noEmit` — types only, no output. |

`tsx` means "run a TypeScript file directly with Node". The scripts in
`scripts/` are plain Node programs importing the same `src/lib` code the app
uses — which is only possible *because* the domain layer contains no React and
no Next.

---

## 11. Beginner traps, and the honest answer to each

| Confusion | The answer |
| --- | --- |
| "Where is the server?" | Every file without `'use client'` *is* server code. The page function is the route handler. |
| "Why is `searchParams` a promise?" | Next 15+ made dynamic request data async so rendering can start earlier. Always `await` it. |
| "Can I use `useState` here?" | Only in a `'use client'` file. Server components have no state — they run once and end. |
| "Where is the `/api` folder?" | There isn't one. Reads happen in server components; writes happen in Server Actions. |
| "Why does saving update other pages?" | `revalidatePath('/', 'layout')` invalidates the whole tree. |
| "Is `cache()` a real cache?" | No — it dedupes within a single request only. |
| "Why `key=` on every mapped row?" | React needs a stable identity per row to diff efficiently. |
| "Why can't I pass a function to a client component?" | The boundary is serialised. Server Actions are the sanctioned exception. |
| "Does `'use client'` mean it only runs in the browser?" | No. It is still server-rendered for the first paint, then hydrated and run in the browser. It means "this code is **also** shipped to the browser." |

---

## 12. Eight Next.js answers to have ready

**Q: Why Next.js rather than Express + React?**
"One codebase instead of two, and server components mean the page reads SQLite
directly, so there is no API layer to build, version and keep in sync. For a
local tool for one agency, an API would be indirection with no consumer."

**Q: Server components vs client components?**
"Server is the default: runs on the server during the request, can be async, can
touch the database, never ships to the browser. `'use client'` opts a file into
being shipped and run in the browser, which you need for state and event
handlers. I have five client components and each exists for a specific browser
capability — a router push, an `onClick`, a file input."

**Q: How does data get in?**
"A Server Action. `src/app/upload/actions.ts` is marked `'use server'`; the form
calls it directly, it parses the workbook and writes to SQLite in a transaction,
then calls `revalidatePath` so every page re-renders with the new data. No API
route."

**Q: How do you handle caching?**
"Three deliberate decisions. `force-dynamic` in the root layout, because every
page reads a database at request time. React's `cache()` around `getCostModel`,
so one request builds the model once rather than once per component. And
`revalidatePath` after every write."

**Q: Why is the filter in the URL?**
"So a filtered view is a shareable link that survives a refresh and the back
button. `resolvePeriod` reads it and `periodQuery` rebuilds it for links, so
drilling into a project keeps your period."

**Q: What happens on first load with no data?**
"`model.entries.length === 0` renders `NoDataState` with a link to the Data
page. Every page has that guard, because an empty dashboard should tell you what
to do next rather than show a wall of zeros."

**Q: How would you deploy this?**
"As it stands it is local-only by design — SQLite on the local filesystem — so
it wants a machine with a persistent disk: a small VM, or a container with a
volume, running `npm run build && npm start`. It would *not* run unchanged on a
serverless platform, because the filesystem is not durable there. That would
mean swapping the `db/` layer for Postgres, which is contained to `client.ts`
and `repository.ts` because nothing above them knows SQLite exists."

**Q: What was the hardest Next-specific thing?**
"better-sqlite3 is a native addon, so it has to be excluded from the bundler
with `serverExternalPackages` or the `.node` binary never reaches the server
build. And the dev server replaces modules on hot reload, which would leak a new
SQLite handle every time — so the connection hangs off `globalThis` in
`src/lib/db/client.ts`."

---

Next: `02-project-tour.md` — the folders, and two full journeys through them.
