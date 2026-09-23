# Learn this codebase from zero

Private study folder. It lives under `docs/`, which `.gitignore` already
excludes (`.gitignore:48 → /docs`), so nothing in here is committed or pushed.
No file in `src/` was touched to produce these notes.

You said: *"I don't know Next.js and I know only some basics of Node."* These
notes assume exactly that and nothing more.

---

## Read in this order

| # | File | What you get | Time |
| --- | --- | --- | --- |
| 1 | `01-nextjs-from-node.md` | Next.js explained from plain Node. The 8 ideas the whole app uses. | 45 min |
| 2 | `02-project-tour.md` | Every folder, and two journeys traced end to end: a page load and an upload. | 40 min |
| 3 | `03-the-maths-baby-steps.md` | The cost model with 2 people and round numbers, then the real ones. | 45 min |
| 4 | `04-file-walkthroughs.md` | Word-for-word scripts for the 5 files they are most likely to open. | 60 min |
| 5 | `05-interview-qa.md` | ~70 questions with answers you can say out loud. | 90 min |
| 6 | `06-live-change-drills.md` | 8 changes to practise typing, with exact code. **Do these, don't read them.** | 90 min |
| 7 | `07-cheatsheet.md` | One page. Glance at it 10 minutes before the call. | 5 min |

Total: about a working day. If you only have two hours: file 3, then file 7,
then do drills 1, 2 and 3 in file 6.

---

## What "you own every line" actually means

The brief says:

> The one condition is that you own every line: in the follow-up call we will
> pick a file and ask you to walk us through it, explain a trade-off, and change
> something live.

Read that carefully. They are not asking *"did you type every character."* They
are testing three things:

1. **Can you explain it?** — do you know *why* each piece is the way it is.
2. **Can you defend a decision?** — do you know what the alternative was and
   what it would have cost.
3. **Can you change it?** — can you move around the code at speed, under
   pressure, with someone watching.

A developer who used a library, a template, Stack Overflow or an AI assistant
and *understands and can modify the result* passes this. A developer who wrote
every character themselves and cannot explain the indirect rate fails it.

So: **your job between now and the call is to make the second and third things
true.** That is what this folder is for.

**If they ask you directly whether you used AI tooling, say yes and say how you
checked it.** That answer works. "I used it the way I'd use a senior colleague:
to move fast, then I verified the arithmetic myself with `npm run reconcile` and
the test suite before trusting any of it." Every serious engineering team in
2026 uses these tools; what they are screening for is whether you can be trusted
with the output. Bluffing is the only answer that actually fails, because the
live-change portion of the call exposes it in 90 seconds.

---

## The single most useful thing you can do

Run the app and click every page while reading `02-project-tour.md`.

```bash
npm install
npm run seed
npm run dev        # http://localhost:3000
```

Then, in a second terminal:

```bash
npm run reconcile  # the numbers, proven, without a browser
npm test           # 53 tests
```

Reading code you have never seen run is three times harder than reading code
while watching it work. Have the app open the whole time.
