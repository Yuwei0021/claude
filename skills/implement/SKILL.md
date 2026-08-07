---
name: implement
description: Resolve the current feature, check the task files are still implementable, and run the developer agent per service in parallel at the model each task file asks for.
---

# `/implement` — Run implementation per service in parallel

Resolve the current feature, verify its task files still hold, and invoke the developer agent per service.

The design phase already did the thinking and paid for the exploration. This phase is execution: a developer agent that has to re-explore its service to understand its task is a sign the handoff failed, not a sign the agent is being thorough.

## 1. Resolve feature

- If the user provides an ID, use it.
- Else, parse from the Git branch name (`workitem-{id}-{slug}` or `feature-{id}-{slug}`).
- Else, scan `features/feature-*/` folders; if exactly one exists, use it. If multiple, ask the user.
- Feature file: `features/feature-{ID}-{title}/feature-{ID}-{title}.md`.
- If not found, fail: _"No feature file found; run `/design` first or specify a feature ID."_

## 2. Discover task files

- Look in `features/feature-{ID}-{title}/tasks/*.md`.
- Service name = filename without `.md` (e.g. `ui-bloom.md` → `ui-bloom`).
- If none exist, fail: _"No task files found for this feature."_

## 3. Check the task files are still implementable

Cheap, mechanical, and it runs **before** any agent is dispatched — a broken handoff caught here costs nothing, and caught by a developer agent mid-run costs a whole implementation attempt.

For each task file, extract every repository path it names and check it:

- A path marked **new** (to be created) is fine whether or not it exists.
- A path presented as **existing** — a class to modify, a pattern to follow, a config to extend — **must exist**. If it does not, the design was written against code that has since moved, or the path is wrong.

If any existing-path check fails, **stop before dispatching anything** and report which task file names which missing path. Ask whether to re-run `/design` for that service or to correct the path. Do not dispatch the other services "in the meantime" — if one task file was written against stale code, the others likely were too.

Also confirm the feature file carries a **Cross-service contracts** section if more than one task file exists. Without a frozen seam, parallel services will code against different assumptions about the same interface.

## 4. Pick the model per service

Each task file declares what it needs, set by the designer who explored that service and knows where the hard part is:

```markdown
Model: sonnet
Complexity: normal
```

- Use the model the task file names.
- `Model: opus` — dispatch on Opus. Reserved for genuinely hard work: intricate concurrency, a non-obvious algorithm, or a change whose blast radius the design could not fully bound.
- No `Model:` line, or an unrecognized value — default to **sonnet** and say so in your summary, so a missing line is visible rather than silent.

Do not override a task file's choice on your own judgment. If you think it is wrong, say so and ask.

## 5. Run in parallel

For each service with a task file, invoke the **developer** agent in background mode at the model chosen above, scoped to `@services/{service}`:

```
Implement the coding plan in {taskFilePath} for feature {ID}.
Use only code under services/{service}.
The cross-service contracts in {featureFilePath} are frozen — implement against them exactly,
and do not change a shared interface without stopping first.
```

All invocations run concurrently. Each developer agent reads its own service's `AGENTS.md` for stack, conventions, and the build and test commands it must run before declaring done.

## 6. Report

When the agents return, summarize per service: what was implemented, the build and test result, the model used, and — most importantly — **any deltas a developer agent reported** because a premise in its task file turned out to be false. A reported delta means the design and the code disagreed; surface it rather than burying it in a success summary, and update the task file so the record matches what was actually built.
