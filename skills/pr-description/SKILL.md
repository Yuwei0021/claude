---
name: pr-description
description: Write one PR description per touched service for a feature or fix, from the branch diff and the feature decision record. Four fixed sections, hard 2500-character limit per file, saved under the feature folder ready to paste into Azure DevOps.
---

# `/pr-description` — One PR Description per Service

Produces a ready-to-paste PR description for **each** service touched by a feature or fix. Descriptions are written for the reviewer: why the change exists, what it commits to, and where to start reading.

## 1. Resolve scope

- Take the feature/fix ID from the user input, or infer it from the current branch name in the touched services.
- Locate the decision record: `features/feature-{ID}-*/feature-{ID}-*.md` (or `fixes/fix-{ID}-*/`). It is the source for intent, contracts and rejected alternatives. If none exists, work from the diff alone and say so.
- List the touched services: for each `services/*` repo whose branch matches the ID, run `git diff --stat origin/develop...HEAD` (fall back to `origin/master` if `develop` is absent). Skip repos with no diff.
- Note any uncommitted work with `git status --short` — a description written from the committed diff alone would misdescribe the PR. Say so in one line and include the uncommitted change in the reading.

Read the actual diff of the substantive files before writing. Do not describe a change from the decision record alone: the record says what was intended, the diff says what shipped.

## 2. Write one file per service

Path: `features/feature-{ID}-*/pr-descriptions/{service-name}.md` (or `fixes/fix-{ID}-*/pr-descriptions/`).

Normal prose — this is persisted, outward-facing text, so no caveman compression regardless of session style.

Structure, exactly these four `##` sections, preceded by one unnumbered header line:

```
US {ID} (Feature {parent}). Merge **after** `<service>`, before `<service>`.

## Why
## Architecture & design
## Behavior
## Review guide
```

Each section has a character budget. Budgets total ~2300 of the 2500 limit, so a description written to budget passes the check on the first try. Write to the budget, do not write freely and shrink afterwards.

| Section | Budget | Content |
|---|---|---|
| Header line | 120 | Work item, parent, and the merge/deploy order across the companion PRs. Order is set by who owns the contract: the provider merges first. |
| **Why** | 400 | The problem in the terms this service sees it. Two or three sentences. |
| **Architecture & design** | 700 | The shape that changed (endpoints, schema, component) and the decisions behind it. Include a rejected alternative only where a reviewer would otherwise propose it. |
| **Behavior** | 500 | The observable rules a reviewer can check against acceptance criteria. Numbered list when the rules are independent. |
| **Review guide** | 600 | Reading order (which file first, and why), what to challenge, known-and-not-closed limitations, tests, and migration/deployment notes. |

A section may borrow from another's budget — a change whose whole story is one config key needs little architecture and more caveats. The total is what is enforced.

## 3. Rules

- **Hard limit 2500 characters per file.** Write to the section budgets above, then verify **all files in one call**: `wc -m features/feature-{ID}-*/pr-descriptions/*.md`.
- **If a file is over, delete whole units — never shave words.** Rewording a sentence to save 20 characters costs a full read-edit-check cycle and buys almost nothing; one deleted paragraph ends it. In order: a repeated rationale, then a rejected alternative, then the least load-bearing paragraph entirely. Never a behavioral rule or a caveat. Cut enough to land at or under **2300**, not at 2499 — a file that squeaks in at 2498 will need another pass the next time anything is added.
- **Two trim passes maximum.** Still over after two? The draft is structurally too long — rewrite the offending section against its budget rather than continuing to nibble.
- **Never invent test results.** Name the suites that changed; state pass counts only if a run in this session produced them.
- Mark pre-existing weaknesses as pre-existing, and deliberate omissions as deliberate. A reviewer must be able to tell a shortcut from an oversight.
- State migration reality explicitly, including "no migration" and any manual dev-data step.
- Every claim must be checkable in the diff. Drop anything you cannot point at.

## 4. Report

List the files with their character counts, and state the merge order in one line. Do not paste the descriptions into chat — the user copies from the files.
