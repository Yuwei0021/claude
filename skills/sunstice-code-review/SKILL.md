---
name: sunstice-code-review
description: Review changes in a service (Java or React) against origin/develop via the code-reviewer agent, and write a report under reviews/. Works standalone — your own work, or someone else's branch you have checked out — with or without an Azure DevOps work item for functional alignment.
---

# `/sunstice-code-review` — Service-Scoped Code Review

You orchestrate; the **code-reviewer** subagents review. Your job: resolve the review surface, compute the report paths, dispatch the reviewers, handle the follow-up.

**This skill stands alone** — no design, task file, or work item needed. Establish which entry point you are in before step 1: it decides the follow-up in step 6.

| Situation                                       | How to run it                                                                                                                                               |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewing **your own** work before opening a PR | `/sunstice-code-review <service>` — the usual case                                                                                                          |
| Reviewing **someone else's** branch or PR       | Fetch and check out their branch in `services/<service>` **first**. The reviewer diffs `<comparison-branch>...HEAD`, so it reviews whatever is checked out. |
| Reviewing with **functional context**           | Run `/sunstice-gather-workitem <ID>` first — even for a work item that is not yours — then this skill.                                                      |

A work item is optional in every case. Without one, the reviewer says nothing about criteria and the technical review is unaffected.

## 1. Resolve the services and the review surface

Map any service name not starting with `services/` to `services/<service-name>` and verify the directory exists. If not, stop and ask.

Resolve the surface **once, here** — every reviewer gets these facts instead of re-deriving them. One round of git work rather than one per reviewer, and it closes a real failure mode: two reviewers resolving different bases, filing findings scoped to different changes. Inside `services/<service-name>`:

```
git fetch origin
git merge-base <comparison-branch> HEAD
git diff <comparison-branch>...HEAD --stat -M
git status --short
```

Carry into every reviewer prompt: comparison branch, merge-base, the `--stat` file list, uncommitted and untracked counts, and the line `Origin refs are current; do not fetch.` Pass **facts only, never diff content** — each reviewer pulls the hunks it needs.

The working tree is part of the surface: work here is committed by hand, so a freshly implemented service usually has its change uncommitted, and untracked files appear in no diff. If the tree is dirty, say so in one line before dispatching. Never commit or stash to tidy it — what is on disk is what gets reviewed.

## 2. Work item context (optional)

Only when the user names an Azure DevOps work item:

- Find `features/feature-{ID}-{short-title}/workitem-{ID}-context.md`, or scan `features/` for a `feature-{ID}-*` directory containing it.
- ID given but no file: tell the user to run `/sunstice-gather-workitem` first.
- Extract the **Summary** and the **acceptance criteria** only — no comment threads, no attachments. Update the chat session name to the work item title.

## 3. Compute the report paths

Compute them here so the subagents do not scan `features/`.

**The filename carries the service name and the Focus.** Reviews run in parallel; a path identifying only the work item makes them all write to one file and the last write wins.

- **With a work item**: `reviews/review-{ID}-{short-title}/review-{ID}-{service-name}-correctness.md` and `…-conventions.md` — `{short-title}` is a kebab-case slug of the work item title.
- **Without one**: `reviews/review-{service-name}/review-{timestamp}-correctness.md` and `…-conventions.md`, `{timestamp}` from `date +%Y%m%d`.

Check no two dispatched reviewers resolve to the same path before launching.

## 4. Dispatch the reviewers

**Split or not, decided by the file count from step 1:**

- **More than 5 changed files, or more than one `packages/*` directory** — split by Focus.
- **5 or fewer in a single package** — one reviewer on **opus**, no `Focus` line, owning everything, writing to the `-correctness.md` path. Say in one line that you did not split.

The split exists so each reviewer can read a big diff closely. On a three-file change there is nothing to divide, and it pays for the same diff twice.

When splitting, dispatch both reviewers per service — `Correctness` on **opus**, `Conventions` on **sonnet**. Convention and test-style work is pattern-matching against `AGENTS.md` and the surrounding code; simulating a half-applied write is not, so the opus budget goes where the reasoning is. They do not talk to each other, and that is the point: two reviewers with one job each find more than one reviewer doing both.

```
Perform a code review for service: "<service-name>" (path: "services/<service-name>").
Focus: Correctness | Conventions
Save the report at: "<report-path>-<focus>.md".
<review surface facts from step 1>
```

With a work item, append its Summary and acceptance criteria under a `Context:` heading.

**The prompt is an allowlist.** Service name and path, report path, review-surface facts, and — when one exists — the work item Summary and acceptance criteria. Nothing else, even when this session designed and implemented the change. Never pass the feature decision record, task files, `fixes/*` diagnoses, your implementation notes, or any "we decided X because Y". Handing over the rationale turns the review into a consistency check against the design instead of a check against the code.

**Launch every reviewer in one message** so they run in parallel — services are independent repositories, and the two Focus reviewers of one service write to different paths.

## 5. Present the result

- **The review surface first** — comparison branch, and whether uncommitted and untracked changes were covered. If it does not match step 1, that is the headline: every finding under it is scoped to the wrong change.
- Finding counts by severity, a clickable link to each report file, one short line per Critical finding. Do not re-read the reports in full.
- Report a clean review as a clean result: say what was checked and stop. A short report backed by named checks is the good outcome, not a failed one.

## 6. Follow-up — depends on whose code it is

### Someone else's branch

**Offer nothing.** Fixing a colleague's branch creates changes they did not ask for, on work they own, that collide with their next commit.

Reshape the findings instead: per finding, a comment ready to paste onto the PR — the `file:line`, one sentence on the problem, the concrete suggestion. Grouped by severity, each short enough to read in a review thread. Root `AGENTS.md` plain-English rule applies. Then stop; posting is the user's call.

### Your own work — apply findings (optional)

Selection spans both reports of a service. IDs are unique per report, so name the report alongside the ID whenever both are in play.

Ask via AskUserQuestion:

- **Critical only** (recommended)
- **Critical + Recommended**
- **Let me pick** — user supplies finding IDs
- **No, review only**

If the user opts in, **classify every selected finding first.** A finding is **behaviour-changing** when its fix alters what a caller can observe: response shape, HTTP status, whether an error propagates or is swallowed, a persisted value, a published contract. Everything else is internal.

- **Internal** — apply without asking.
- **Behaviour-changing** — state the current and resulting behaviour, one line each, and get confirmation first. Do this even when the finding proposes the fix: a finding names a problem, it does not authorise a contract change. When it offers options, ask which; do not choose for the user.

A review that quietly changes an API is worse than the defect it fixed, because the defect was at least visible in the report.

Then invoke the **developer** subagent in review-fix mode, one per service, in parallel:

```
Review-fix mode for service: "<service-name>" (path: "services/<service-name>").
Apply the following findings from the review report at "<report-path>": <CR-1, CR-3, ...>.
```

Parameters only — the developer agent reads the report itself, and `developer.agent.md` under "Review-Fix Mode" governs how findings are applied. Never paste the report into the prompt.

When it returns, summarize which findings were applied, which were skipped and why, and the build and test result. If the build or tests fail, report the failure — do not retry with broader changes.

**If a Critical finding was applied, re-review the touched files without asking.** A Critical fix changes a failure path or a write order, which is exactly the kind of change that introduces the next one, and it was written by an agent rather than read by a person. Dispatch one **code-reviewer** on **opus**, no `Focus` line, with the review-surface facts re-resolved and the file list narrowed to the files the developer changed. Report at `<report-path>-recheck.md`.

Say plainly whether the re-review is clean. If it files a new Critical, present it and stop — do not enter a third round on your own. Two agent passes over the same code with no human between them is how a review turns into a rewrite.

Skip the re-review when only `Recommended` or `Minor` findings were applied: say you skipped it and why.
