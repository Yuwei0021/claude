---
name: sunstice-code-review
description: Review changes in a service (Java or React) against origin/develop via the code-reviewer agent, and write a report under reviews/. Works standalone — your own work, or someone else's branch you have checked out — with or without an Azure DevOps work item for functional alignment.
model: opus
---

# `/sunstice-code-review` — Service-Scoped Code Review

Use this skill to orchestrate a comprehensive code review of changes in one or more services under `services/`. The **code-reviewer** subagent does the actual review; this skill only resolves scope, computes the report path, invokes the subagent, and handles the follow-up.

**This skill stands alone.** It is not a stage of the feature pipeline and does not require a design, a task file, or a work item. Three entry points are all normal:

| Situation                                       | How to run it                                                                                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Reviewing **your own** work before opening a PR | `/sunstice-code-review <service>` — the usual case                                                                                                                                                  |
| Reviewing **someone else's** branch or PR       | Fetch and check out their branch in `services/<service>` **first**, then `/sunstice-code-review <service>`. The reviewer diffs `<comparison-branch>...HEAD`, so it reviews whatever is checked out. |
| Reviewing with **functional context**           | Run `/sunstice-gather-workitem <ID>` first — even for a work item that is not yours — then `/sunstice-code-review`. The reviewer will check the changes against the acceptance criteria.                     |

A work item is **optional in every case**. Without one, functional alignment is simply marked Not Applicable and the technical review is unaffected.

Establish which of the three you are in before step 1 — it changes the follow-up in step 6.

## 1. Resolve Local Service(s) to Review

- Identify the target service(s) from the user input (e.g., `services/micro-service-master-data` or `micro-service-master-data`, `services/ui-bloom` or `ui-bloom`).
- Map any service name that does not start with `services/` to `services/<service-name>`.
- Verify the directory exists under `services/`. If it is invalid, stop and ask the user for clarification.

Then establish the **review surface** for each service — run `git status --short` inside `services/<service-name>` and note whether there are uncommitted or untracked changes.

This matters because the committed diff is not the whole change. Work in this workspace is committed by hand, so a service that was just implemented usually has its change sitting in the working tree, and a branch-vs-branch diff would review none of it. Untracked files never appear in any diff at all.

- If the working tree is dirty, say so in one line before dispatching (which service, how many uncommitted and untracked files). The review still proceeds — the reviewer covers committed, uncommitted, and untracked changes as one surface.
- Do not commit or stash anything to tidy the surface. What is on disk is what gets reviewed.

## 2. Locate Work Item Context File (Optional)

Only perform this step if the user provides or references an Azure DevOps work item:

- Find the work item context file at `features/feature-{ID}-{short-title}/workitem-{ID}-context.md` (or scan `features/` for a subdirectory named `feature-{ID}-*` containing a `workitem-{ID}-context.md` file).
- If a work item ID/reference was provided but the file is not found, advise the user to run the `gather-workitem` skill first.
- If found, extract only what the reviewer needs for functional alignment: the **Summary** section plus the **acceptance criteria**. Do not forward full comment threads or attachment contents to the subagent. Update the chat session name to match the work item/feature title.

## 3. Compute the Report Path

Compute the path here so the subagent does not have to re-derive it by scanning `features/`.

**One report per service, always — the filename must carry the service name.** Reviews of several services run in parallel; a path that identifies only the work item makes them all write to the same file and the last writer wins.

- **With a work item**: `reviews/review-{ID}-{short-title}/review-{ID}-{service-name}.md`, where `{ID}` is the resolved work item ID and `{short-title}` is a kebab-case slug of its title (e.g. `reviews/review-56138-link-panel-process-template/review-56138-ui-bloom.md`).
- **Without a work item**: `reviews/review-{service-name}/review-{timestamp}.md`, with `{timestamp}` from `date +%Y%m%d` (e.g. `reviews/review-micro-service-master-data/review-20260703.md`).

Before dispatching, check that no two targeted services resolve to the same path. If they do, the formula was applied wrong — fix it rather than letting the subagents race.

## 4. Invoke the Code Reviewer Subagent

Invoke the **code-reviewer** subagent:

```
Perform a code review for service: "<service-name>" (path: "services/<service-name>").
Save the report at: "<computed-report-path>".
```

If work item details are available, append:

```
Verify functional alignment with the provided work item details.

Context:
<work item Summary and acceptance criteria — not the full context file>
```

**The invocation prompt is an allowlist.** Pass only: the service name, the service path, the report path, and — when a work item exists — its Summary plus acceptance criteria. Nothing else, even when this session designed and implemented the change and you know exactly why every line is there. Explicitly do not pass: the feature decision record, task-file content, `fixes/*` diagnoses, your own implementation notes, or any "we decided X because Y". The reviewer must reach its own conclusions from the diff and the service on disk; handing it the rationale turns the review into a consistency check against the design instead of a check against the code.

**If multiple services are targeted, launch one code-reviewer subagent per service in parallel** (a single message with multiple Agent tool calls) — each service is an independent git repository, so the reviews cannot conflict.

Wait for the subagent(s) to complete and return their compact summaries.

## 5. Present the Report

- Provide a clickable link to the generated report file.
- Give a brief, high-level summary of the critical findings and functional alignment in chat. Keep it short and direct the user to the report for details — do not re-read the full report.
- State the review surface the reviewer actually used (comparison branch, and whether uncommitted/untracked changes were included). If it does not match what you established in step 1, that is the first thing to report, not a footnote — every finding below it is scoped to the wrong change.

## 6. Follow-up — depends on whose code it is

### Reviewing someone else's branch

**Do not offer to apply anything.** Fixing a colleague's branch locally is not a review outcome — it creates changes they did not ask for, on work they own, that will collide with their next commit.

Instead, reshape the findings for them to act on. For each finding, give a comment ready to paste onto the PR: the `file:line` it anchors to, one sentence on the problem, and the concrete suggestion. Group them by severity and keep each one short enough to read in a review thread — a reviewer's comment that runs three paragraphs does not get acted on.

Then stop. The report under `reviews/` is your record; posting is the user's call.

### Reviewing your own work — apply recommendations (optional)

If the review produced findings, ask the user (via AskUserQuestion) whether to apply them:

- **Critical only** (recommended)
- **Critical + Recommended**
- **Let me pick** — user supplies specific finding IDs
- **No, review only**

If the user opts in:

**Before dispatching, classify every selected finding.** A finding is
**behaviour-changing** when its fix alters what a caller can observe: the shape of a
response, an HTTP status, whether an error propagates or is swallowed, a persisted
value, or a published contract. Everything else is internal.

- **Internal findings** — apply them without asking.
- **Behaviour-changing findings** — state the current behaviour and the behaviour after
  the fix, in one line each, and get the user's confirmation first. Do this even when
  the finding text itself proposes the fix: a review finding names a problem, it does
  not authorise a contract change. If a finding offers more than one option, ask which
  one; do not pick for the user.

A review that quietly changes an API is worse than the defect it fixed, because the
defect was at least visible in the report.

1. Invoke the **developer** subagent in **review-fix mode**, one subagent per service (in parallel if several services are involved):
   ```
   Review-fix mode for service: "<service-name>" (path: "services/<service-name>").
   Apply the following findings from the review report at "<report-path>": <CR-1, CR-3, ...>.
   ```
   The prompt carries the parameters and nothing else. How the findings are applied — only the selected ones, following each Before/After snippet, build and tests afterwards, a `## Fix Log` appended to the report — is in `developer.agent.md` under "Review-Fix Mode", and that copy is in force. Restating it here only creates a second version to keep in step.
2. Do NOT paste the full report into the prompt — the developer subagent reads the report file itself; only the path and the selected finding IDs go in the prompt.
3. When the subagent(s) return, summarize in chat: which findings were applied, which were skipped and why, and the build/test result. If the build or tests fail after fixes, report the failure — do not silently retry with broader changes.
4. Suggest (but do not run automatically) a re-review of only the touched files if any Critical finding was applied.
