---
name: sunstice-bug-fix
description: Diagnose and fix a bug — reproduce it, find the root cause with evidence, check which other callers share it, get the diagnosis confirmed, then apply the smallest fix plus a regression test. Use instead of design/implement when something is broken rather than missing.
model: opus
---

# `/sunstice-bug-fix` — Diagnose first, then fix small

A feature is a decision problem: you choose what to build, and the risk is leaving something out. **A bug is a discovery problem**: you find out why something is wrong, and the risk is fixing the symptom, or fixing the one call path in the ticket while its siblings stay broken.

So the gate here is not a design you approve — it is a **diagnosis** you approve, before any code is written. A wrong root cause wastes the whole fix.

Do not use `/sunstice-design` or `/sunstice-implement` for this. Do not produce a feature file, a decisions table, an invariant, or a UI state table — none of them help on a bug.

## 1. Get the context

- If the user names an Azure DevOps work item, run `gather-workitem` first (or read an existing `workitem-{ID}-context.md`) — bug reports keep the detail that matters in comments and attached logs.
- If there is no work item, take the report from the user. Ask for the failing input, the environment, and what they expected instead — a bug report without those three is not yet reproducible.
- Determine the owning service from root `AGENTS.md`, and read `services/{service}/AGENTS.md`.

## 2. Reproduce

State the exact failing input or state, the observed behavior, and the expected behavior. Where a test can demonstrate it, write the failing test now — it becomes the regression test in step 6.

**If you cannot reproduce it, say so and stop.** A fix for a bug you cannot trigger is a guess, and you will have no way to show the fix worked. Ask for what you need: the failing payload, the log, the environment, the sequence of actions.

## 3. Find the root cause — with evidence

Not "the null check is missing" but _why the value is null_. Trace it back to where the wrong state is actually produced.

Every claim cites `file:line` you have read. Say how far back the bug goes if the history makes it clear (`git log -S`, `git blame`), because that tells the user which environments are affected.

Symptom and cause are often several layers apart. The place the exception is thrown is rarely the place the bug is.

## 4. Check every caller — the step that separates a fix from a patch

Grep **every caller** of the code you are about to change.

- Do the siblings share the bug? Then the ticket described one instance of it, and a fix at that one call site leaves the rest broken.
- Does the change hold for all of them, or only for the path in the ticket?

A guard added in one caller while its siblings keep the old assumption is not a fix. Fixing it once where all callers route through is both the correct fix and — usually — the smaller diff.

**If the true root-cause fix turns out to be architectural** — it needs a new interface, a data model change, or a redesign of how the services interact — **stop here.** That is a design problem, not a bug. Report what you found and send the user to `/sunstice-design`. Discovering this at step 4 is cheap; discovering it halfway through a "quick fix" is not.

## 5. ⛔ Confirm the diagnosis

Write `fixes/fix-{ID}-{short-title}/fix-{ID}-{short-title}.md` — short, around 30 lines.

Write for a reader whose first language is not English: short sentences, common words, active voice. No idioms and no metaphors — say the literal thing. Real technical terms stay (index, migration, race condition, optimistic lock, merge-base); rare general-purpose words do not. This file is the gate the user approves, so it has to be readable at first pass.



```markdown
# Fix {ID} — {title}

## Reproduce

Input / state, observed, expected.

## Root cause

Where the wrong state is produced, with `file:line` evidence. How far back it goes.

## Callers

Which callers were checked, which share the bug, which do not.

## Proposed fix

The smallest change that fixes the cause. One paragraph.

## Regression test

Which test, where, and what it asserts.
```

Present it and **wait**. This is the only gate. Do not start fixing "the obvious part" while waiting — if the diagnosis is wrong, that work is wasted and the wrong code is already in the tree.

## 6. Fix — smallest change that fixes the cause

Invoke the **developer** agent in bug-fix mode, scoped to the owning service:

```
Bug-fix mode for service: "<service-name>" (path: "services/<service-name>").
Apply the fix described in "fixes/fix-{ID}-{short-title}/fix-{ID}-{short-title}.md".
Fix the root cause it names, at the smallest scope that actually fixes it.
Add the regression test it names: prove it FAILS before your fix and PASSES after.
```

Use `sonnet` unless the fix is genuinely intricate — the diagnosis was the hard part and it is already done.

### Scope is the constraint here

The developer agent carries the scope rules — no refactoring, no "while I was in here" improvements, other problems reported rather than fixed. They are in `developer.agent.md` under "Bug-Fix Mode", and that is the copy that is in force when the code is written. Do not restate them in the invocation prompt.

What you own here is the reaction: if the developer reports that the fix cannot be kept small, then step 4 missed something. It means this is a design problem, not a bug. Stop and send the user to `/sunstice-design` rather than approving a larger diff.

**None of this relaxes the definition of done.** The build passes, the tests pass, and the regression test clearly fails before the fix and passes after it. A bug fix ships to production exactly like a feature does.

## 7. Report

- The root cause in one or two sentences.
- The fix, and the files it touched — if that list is long, say why.
- The regression test, and confirmation it failed before and passes after.
- Anything else the developer found and deliberately did **not** fix.
- Whether sibling callers shared the bug, and whether they were fixed in the same change or need their own.

Then stop. Committing and opening the PR are manual.
