---
name: pr-resolve-comments
description: Fetch unresolved (Active) comments on your open PR via Azure DevOps MCP and address each locally, without posting anything back to the PR.
disable-model-invocation: true
---

# `/pr-resolve-comments` — Address unresolved PR comments

Fetch unresolved (Active) comments on your open PR via Azure DevOps MCP and address each one locally.

> **Read-only on the PR**
> This skill **never writes to the PR**. Do not reply to threads, do not change thread status (Fixed/Closed/WontFix), do not comment on the PR — no `repo_pull_request_thread_write`, `repo_pull_request_write`, or any other MCP write call. Azure DevOps MCP usage is read-only; all outcomes are reported in chat so the user posts the replies themselves.

> **Delegation & models**
> - **Steps 1–3** (verify MCP, identify PR, fetch threads) are mechanical Azure DevOps MCP fetching. Delegate them to a subagent running on **Haiku** (`general-purpose` agent, `model: haiku`) so raw PR payloads stay out of the main context. The subagent returns only the structured list of Active threads. Do **not** use the `workitem-gatherer` agent — it gathers Azure DevOps *work items*, not PR comment threads.
> - **Step 4 code changes** are applied by the **developer** agent, scoped to the service that owns the changed file.

## Steps

### 1–3. Fetch unresolved threads (Haiku subagent)

Invoke a `general-purpose` subagent with `model: haiku` to perform the following and return a structured result:

1. **Verify MCP**: call an Azure DevOps MCP tool. If unavailable, stop: *"Azure DevOps MCP server is unavailable."*
2. **Identify the PR**: if the user specifies a PR ID or repo, use it. Otherwise, list open PRs (`created_by_me: true`, `status: Active`) and match by branch name or work item ID from the branch. If multiple match, report them for the user to choose; if none found, fail.
3. **Fetch unresolved threads**: use `repo_pull_request_thread` with `action: "list"` and `status: "Active"`, passing the `repositoryId` and `pullRequestId` from step 2 (`project` is required too when `repositoryId` is a name rather than a GUID). If none, report *"No unresolved comments on this PR."*

The subagent's return value must be, for each Active thread: `threadId`, `filePath`, `rightFileStartLine` (and other position fields), the full comment text, and a classification — **code-change**, **question**, or **informational**. It must not echo raw MCP payloads.

### 4. Address each thread

| Comment type | Action |
|---|---|
| **Code change requested** (e.g. "use camelCase", "fix this logic") | Determine the owning service from the thread's `filePath` and invoke the **developer** agent scoped to `@services/{service}` to apply the fix locally. |
| **Question or clarification** | Draft an answer in chat — do not post it. |
| **Informational or disagreement** | Draft the reasoning in chat (and the status you'd suggest, e.g. WontFix/ByDesign) — do not post it. |

For ambiguous feedback, ask the user for clarification. If a fix cannot be applied, say so with the reason.

The developer agent only applies code changes inside its service. Nothing is sent back to Azure DevOps.

### 5. Summary (chat only)

Report in chat, per thread: `threadId`, file/line, what was done (fixed in code / answered / not resolved), and the **suggested reply text and thread status** for the user to post manually. Explicitly state that no replies or status changes were made on the PR.
