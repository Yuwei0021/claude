---
name: sunstice-design
description: Design a cross-service feature from a gathered work item context file — restate the business rules for the user to validate, produce a short decision-record feature file, and after confirmation write the per-service implementation task files.
---

# `/sunstice-design` — Plan from gathered work item context

Turn the context file produced by `gather-workitem` into a cross-service design and per-service task files under `features/feature-{ID}-{short-title}/`.

Two documents come out, with **different readers**:

| Document | Reader | Contains |
| --- | --- | --- |
| `feature-{ID}-{short-title}.md` | **the human**, who approves or rejects it | decisions, and only decisions |
| `tasks/{service}.md` | the developer agent | the full implementation spec |

Never write implementation spec into the feature file. It is the single biggest reason these documents become unreadable.

Root `AGENTS.md` plain-English rule applies to both documents. The feature file is what the user reads to approve or reject, so a sentence they have to read twice is a defect in the design record.

**The feature folder holds a closed set of files** — work item context, feature decision record, `tasks/{service}.md`. Nothing else. Review reports go to `reviews/`; scripts, data dumps and scratch output go outside `features/`.

## 1. Locate the work item context file

- Find `features/feature-{ID}-{short-title}/workitem-{ID}-context.md`, or scan `features/` for a `feature-{ID}-*` directory containing one.
- Missing: tell the user to run `gather-workitem` first.
- Read the **Summary** section first. Read the full sections (comments, attachments) only if the Summary leaves scope or acceptance criteria ambiguous. Never read saved attachment files (logs, exports) into the main context — delegate to an `Explore` subagent and use its conclusion.

## 2. Resolve the required services

- Determine which services the work item touches. The **Service index** in root `AGENTS.md` is the source of truth for valid names. Read `.agents/service-map.md` only when you need a port, base path, or datastore.
- If `services/{service-name}` is missing but the service is in the index, stop and ask the user to add it under `services/` (clone or symlink) before designing. Do not design against a service you cannot read.
- In neither: stop and ask the user to confirm the intended name.

## 3. Explore — keeping token use low

This pass grounds the design **and** supplies the evidence for step 4. Brief the explorers for both: for each acceptance criterion touching their service, ask what **the code does today**, what rules the code already enforces that the item never mentions, and anything the criterion names that does not exist. One pass, both answers.

- Delegate to `Explore` subagents, one per service, run concurrently, with `model: haiku` — locating code is mechanical.
- Keep only their conclusions in the main context. Read directly only the handful of files the design actually modifies or extends.
- The design reasoning stays in this session on the strongest model.

## 4. Restate the business rules — and get them validated

**The work item is a claim about the world, not a description of it.** A PO writes what they were thinking about that day; what they forgot is invisible in the text and only shows up when someone who knows the domain reads a restatement back. That person is the user, not you.

Present **your own understanding** of the business rules and wait for the user to validate it. Never paste or lightly reword the work item — a copy proves nothing, and if you misread the item the copy hides it. Write what you believe the system must do, in your words, grounded in what step 3 found in the code.

Try to cover **everything**. A rule you leave out is a rule nobody validates.

Number every rule `BR-1`, `BR-2`, … so the user can reply "BR-4 is wrong". Group them in three, because the gaps are the point:

```markdown
## Business rules as I understand them — please validate

### Stated — written in the work item

- **BR-1** — A deployed template can be edited only through a new version; the deployed one stays frozen.

### Implied — the code already enforces this, or the feature cannot work without it

- **BR-5** — A template group has at most one SCHEDULED version at a time.
  _(`TemplateDeploymentService.deploy()` already rejects a second one — the item never says this.)_

### Silent — the item gives no answer and I would otherwise have to choose

- **BR-9** — What happens to templates already ACTIVE when this ships? They have no `templateGroupId`.
- **BR-10** — Two users editing the same draft: last-write-wins, or reject the second?
- **BR-11** — On a deploy failure midway, is the operation retryable, or left half-applied?
```

Annotate any rule where the code disagrees with the item:

- _the item asks for X, but `TemplateDeploymentService.deploy()` has enforced the opposite since `<commit>` — which wins?_
- _the item names a `versionLabel` field; no such field exists — new field, or does it mean `versionNumber`?_
- _this already works today — in scope as a regression guard, or forgotten?_

**Stop here and wait.** Do not design, do not write the feature file, do not "start on the parts that are clear". Do not resolve a Silent rule by picking the reading that makes the design easier — that is the choice the user is there to make. When the user corrects or adds rules, restate the corrected list back if the change is substantial, then continue.

The validated list is the input to everything downstream: the Decisions table, the acceptance-criteria walk, and the task files all trace back to these `BR-n` identifiers.

## 5. Write the feature file — a decision record, capped

Write `features/feature-{ID}-{short-title}/feature-{ID}-{short-title}.md`.

**Hard rule: if a line does not help the reader accept or reject a decision, it belongs in a task file.**
**Hard cap: ~120 lines.** If it does not fit, the design is carrying implementation spec.

Required sections, in order:

| Section | Contents |
| --- | --- |
| **Goal** | 5 lines max: what changes for the user, and why now. |
| **Business rules** | The validated `BR-n` list from step 4, final corrected form. The contract the design answers to. |
| **Open questions** | Anything from step 4 the user left unresolved. Empty section if none — never omit the heading. |
| **Invariant** | **One line**: the single property the whole design rests on, the thing that must stay true no matter the order of operations. A design that cannot name one is usually just a list of cases, and step 7 attacks this line first. |
| **Decisions** | Table: `Decision \| Why \| Alternative rejected`. The most important part of the document. One row per choice a reasonable engineer could have made differently. |
| **Flow** | One Mermaid sequence diagram of the cross-service interaction. One — not per-service diagrams. |
| **Cross-service contracts** | **Mandatory when more than one service is in scope.** See below. |
| **Existing data & migration** | **Mandatory.** See below. |
| **Acceptance criteria — end-to-end walk** | **Mandatory.** See below. |
| **UI states** | Only when `ui-bloom` is in scope. See below. |
| **Per-service scope** | One line per service: what it owns in this feature. Not how. |
| **Out of scope** | Considered and deliberately excluded. |
| **Risks** | Accepted gaps, with why they are acceptable. |

### Cross-service contracts (mandatory when more than one service is in scope)

`/sunstice-implement` runs one developer agent **per service, in parallel**. If ui-bloom's task file assumes an endpoint that `micro-service-enterprise-process` is creating in the same wave, ui-bloom codes against something that does not exist, both agents report success, and the failure appears only when the two halves meet.

Parallel implementation is sound only when the interface is frozen _before_ either side starts. For every boundary this feature creates or changes:

| | Specify |
| --- | --- |
| **Endpoint** | method + full path, in the workspace's camelCase convention |
| **Request** | field names and types — the actual shape, not a description of it |
| **Response** | success shape, and the status code for each outcome |
| **Errors** | what the consumer receives on a rejected request, and on a partial failure |
| **Owner** | which service implements it; every other service consumes it as written |

Both task files reference this section rather than restating it. Mark it **frozen**: a developer agent that wants to change a shared interface must stop and report, not adapt its own side.

A boundary that cannot be pinned down yet is not a detail for implementation — it is an open question for step 4.

### Existing data & migration (mandatory)

Production already has data. Designs covering only the new happy path are the largest source of `Critical` review findings in this workspace — a unique index never dropped, a new field never backfilled. Both were invisible in review of the _new_ code and fatal in any existing environment.

State explicitly, even when the answer is "nothing":

- What happens to **rows that already exist** and lack the new fields?
- Which **indexes/constraints already exist** that the new shape violates? Who drops them, and when?
- Is a **backfill** needed? Where does it run, and is it idempotent?
- Does the change work on a **fresh** environment _and_ an **upgraded** one?

### Acceptance criteria — end-to-end walk (mandatory)

Not a mapping of AC → component: a mapping passes while the feature is still broken. For each AC, write the **user-visible sequence through states**:

> AC3 "expansion persists during the session" → user expands node → navigates away → returns → **state must survive the Dashboard unmounting** → therefore the state lives in the Redux store, not component state.

If you cannot write the sequence without guessing, the design is not finished.

### UI states (mandatory when `ui-bloom` is in scope)

The UI defects that reach review here are **state** defects, not layout defects: a Save button disabled on a freshly seeded draft, expansion state lost on unmount. Layout mockups do not catch those. A state table does.

Per affected screen, enumerate every state and name the owner:

| State | What renders | Which component owns it | AC |
| --- | --- | --- | --- |
| empty | … | … | — |
| loading | … | … | — |
| error | … | … | — |
| disabled because _X_ | … | … | AC2 |
| freshly created / seeded | … | … | AC4 |
| after save | … | … | AC4 |
| after remount / revisit | … | … | AC3 |

Cover at minimum: empty, loading, error, each distinct disabled reason, freshly-created, after-save, after-remount. A state with no owner is a state the code will get wrong.

**When the user supplies a screenshot or mockup**, it is a design input, not decoration. Say whether you got a rough sketch or a near-final screen, because it changes what you may infer.

- Treat everything visible as **intended**: layout, control placement, labels, columns, grouping, empty-state wording, which controls appear disabled. Do not silently redesign it because another arrangement is easier to build.
- A screenshot is **one** state, usually the populated happy path. Add it to the table as the pinned state, enumerate the rest yourself, and note in Decisions which states it did not show.
- Reconcile it with the work item and the code exploration. Where it contradicts an AC, or shows a field or action that does not exist in the service, that is a Silent rule for step 4 — ask, do not pick.
- Where it is incomplete or ambiguous (cropped region, illegible label, no error/empty variant), name the gap rather than inventing the missing part.
- Map what it shows onto real Bloom components and design tokens. Record in Decisions anywhere you deviate from it and why. A screenshot from another product is a reference for intent, not a spec for markup.

**Optional, for genuinely new layouts**: build a self-contained HTML mockup with the real Bloom design tokens and publish it as an Artifact before the `ui-bloom` task file is written. Skip it for changes to existing screens — the state table is the higher-value artifact.

## 6. Present and wait for confirmation

Present the feature file and ask for explicit confirmation. If the user does not confirm, stop and wait. Do not create task files, branches, or code.

## 7. After confirmation — attack the design before writing anything

The design is now final and about to become code. This is the last moment a defect is free to fix, and the version the user just confirmed — including whatever they changed while reviewing it — is the version that must be checked. Those conversational edits are the least-examined part of the whole design.

Invoke the **design-adversary** agent, one per feature:

```
Attack the confirmed design at "features/feature-{ID}-{short-title}/feature-{ID}-{short-title}.md".
Services in scope: {service-a}, {service-b}.
```

Do not summarize the design for it and do not defend the design to it. It reads the artifact and the code itself — that independence is the point, since you wrote the design.

When it returns:

- Present its findings to the user, grouped by severity, a few lines each. Do **not** silently fix them.
- For each `Critical` and `Gap`, say whether you agree and why. You may disagree — the adversary works from the artifact and can miss intent — but say so rather than quietly dropping the finding.
- If anything changes the design, update the feature file (Decisions table, not an appendix) and re-confirm with the user before continuing.
- If nothing survives, say so in one line. Do not pad.

Then write the task files.

## 8. Write the per-service task files

Write `features/feature-{ID}-{short-title}/tasks/{service-name}.md`, one per service. **This is where the implementation spec lives.**

Start every task file with a header `/sunstice-implement` reads:

```markdown
Service: micro-service-enterprise-process
Model: sonnet
Complexity: normal
```

Set `Model:` deliberately — you just explored this service and know where the hard part is. `sonnet` is the default and right for most work. Choose `opus` only for genuinely hard implementation: intricate concurrency, a non-obvious algorithm, or a change whose full effect you could not pin down during design. One service on `opus` and the rest on `sonnet` is a normal, good outcome; everything on `opus` wastes the work this phase just did.

Make each file **complete on its own for the developer agent** — a developer that has to explore the service again wastes the tokens this phase already spent. Include:

- **What is already verified** — the facts exploration established, so the developer does not re-derive them.
- **Every existing path it names must exist right now.** `/sunstice-implement` checks this mechanically before dispatching; a task file pointing at a class that is not there stops the whole run. Mark anything to be created as new.
- **Ordered work items**, each naming the exact files, classes, endpoints, and existing patterns to follow.
- **A file checklist** — every path to create or modify.
- **Test expectations** — which unit/component tests must exist and what they must prove.
- **Definition of done**, including the service's build and test commands from its `AGENTS.md`.

**Never put literal implementation code in a task file.** Name the files, classes, patterns, and expected behavior — not the bodies. Code in a spec means the design phase did the implementation at design-phase cost, and it falls out of date with the repo before anyone runs it.

## 9. Amendments — fold them in, never append

When the PO changes the rules after the feature file is written:

- **Fold the change into the Decisions table** with the date, and strike through the superseded row. Never append a `## Amendment` or `## Resolved during implementation` section — an appendix means a developer reading the Decisions table gets an answer that is now wrong.
- **Name the task files the amendment invalidates**, and update them in the same pass.
- If the amendment lands after implementation started, say which completed work it undoes.

The feature file is a decision record, not a running log. Implementation notes belong in the task file.
