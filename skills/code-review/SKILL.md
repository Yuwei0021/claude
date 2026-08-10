---
name: code-review
description: Review changes in a service (Java or React) against origin/develop via the code-reviewer agent, and write a report under reviews/. Works standalone — your own work, or someone else's branch you have checked out — with or without an Azure DevOps work item for functional alignment.
---

# `/code-review` — Service-Scoped Code Review

Use this skill to orchestrate a comprehensive code review of changes in one or more services under `services/`. The **code-reviewer** subagent does the actual review; this skill only resolves scope, computes the report path, invokes the subagent, and handles the follow-up.

**This skill stands alone.** It is not a stage of the feature pipeline and does not require a design, a task file, or a work item. Three entry points are all normal:

| Situation | How to run it |
|---|---|
| Reviewing **your own** work before opening a PR | `/code-review <service>` — the usual case |
| Reviewing **someone else's** branch or PR | Fetch and check out their branch in `services/<service>` **first**, then `/code-review <service>`. The reviewer diffs `<comparison-branch>...HEAD`, so it reviews whatever is checked out. |
| Reviewing with **functional context** | Run `/gather-workitem <ID>` first — even for a work item that is not yours — then `/code-review`. The reviewer will check the changes against the acceptance criteria. |

A work item is **optional in every case**. Without one, functional alignment is simply marked Not Applicable and the technical review is unaffected.

Establish which of the three you are in before step 1 — it changes the follow-up in step 6.

## 1. Resolve Local Service(s) to Review

- Identify the target service(s) from the user input (e.g., `services/micro-service-master-data` or `micro-service-master-data`, `services/ui-bloom` or `ui-bloom`).
- Map any service name that does not start with `services/` to `services/<service-name>`.
- Verify the directory exists under `services/`. If it is invalid, stop and ask the user for clarification.

## 2. Locate Work Item Context File (Optional)

Only perform this step if the user provides or references an Azure DevOps work item:
- Find the work item context file at `features/feature-{ID}-{short-title}/workitem-{ID}-context.md` (or scan `features/` for a subdirectory named `feature-{ID}-*` containing a `workitem-{ID}-context.md` file).
- If a work item ID/reference was provided but the file is not found, advise the user to run the `gather-workitem` skill first.
- If found, extract only what the reviewer needs for functional alignment: the **Summary** section plus the **acceptance criteria**. Do not forward full comment threads or attachment contents to the subagent. Update the chat session name to match the work item/feature title.

## 3. Compute the Report Path

Compute the path here so the subagent does not have to re-derive it by scanning `features/`:
- **With a work item**: `reviews/review-{ID}-{short-title}/review-{ID}-{short-title}.md`, where `{ID}` is the resolved work item ID and `{short-title}` is a kebab-case slug of its title (e.g. `upgrade-springboot` for "Upgrade Spring Boot").
- **Without a work item**: `reviews/review-{service-name}/review-{timestamp}.md`, with `{timestamp}` from `date +%Y%m%d` (e.g. `reviews/review-micro-service-master-data/review-20260703.md`).

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

1. Invoke the **developer** subagent in **review-fix mode**, one subagent per service (in parallel if several services are involved):
   ```
   Review-fix mode for service: "<service-name>" (path: "services/<service-name>").
   Apply the following findings from the review report at "<report-path>": <CR-1, CR-3, ...>.
   Apply only these findings, following each finding's Before/After snippet. Run the service's
   build and tests afterwards, and append a "## Fix Log" section to the report recording each
   finding as Applied or Skipped (with reason).
   ```
2. Do NOT paste the full report into the prompt — the developer subagent reads the report file itself; only the path and the selected finding IDs go in the prompt.
3. When the subagent(s) return, summarize in chat: which findings were applied, which were skipped and why, and the build/test result. If the build or tests fail after fixes, report the failure — do not silently retry with broader changes.
4. Suggest (but do not run automatically) a re-review of only the touched files if any Critical finding was applied.
