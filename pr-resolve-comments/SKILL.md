---
name: pr-resolve-comments
description: Fetch unresolved (Active) comments on your open PR via Azure DevOps MCP, address each, mark threads Fixed/Closed.
disable-model-invocation: true
---

# `/pr-resolve-comments` — Address unresolved PR comments

Fetch unresolved (Active) comments on your open PR via Azure DevOps MCP, address each one, and mark threads Fixed/Closed.

> **Delegation & models**
> - **Steps 1–3** (verify MCP, identify PR, fetch threads) are mechanical Azure DevOps MCP fetching. Delegate them to a subagent running on **Haiku** (`general-purpose` agent, `model: haiku`) so raw PR payloads stay out of the main context. The subagent returns only the structured list of Active threads. Do **not** use the `workitem-gatherer` agent — it gathers Azure DevOps *work items*, not PR comment threads.
> - **Step 4 code changes** are applied by the **developer** agent, scoped to the service that owns the changed file. Thread replies and status updates (MCP writes) stay in the orchestrator, not the developer agent.

## Steps

### 1–3. Fetch unresolved threads (Haiku subagent)

Invoke a `general-purpose` subagent with `model: haiku` to perform the following and return a structured result:

1. **Verify MCP**: call an Azure DevOps MCP tool. If unavailable, stop: *"Azure DevOps MCP server is unavailable."*
2. **Identify the PR**: if the user specifies a PR ID or repo, use it. Otherwise, list open PRs (`created_by_me: true`, `status: Active`) and match by branch name or work item ID from the branch. If multiple match, report them for the user to choose; if none found, fail.
3. **Fetch unresolved threads**: use `list_pull_request_threads` with `status: Active`. If none, report *"No unresolved comments on this PR."*

The subagent's return value must be, for each Active thread: `threadId`, `filePath`, `rightFileStartLine` (and other position fields), the full comment text, and a classification — **code-change**, **question**, or **informational**. It must not echo raw MCP payloads.

### 4. Address each thread

| Comment type | Action |
|---|---|
| **Code change requested** (e.g. "use camelCase", "fix this logic") | Determine the owning service from the thread's `filePath` and invoke the **developer** agent scoped to `@services/{service}` to apply the fix. After it returns, reply briefly ("Fixed.") and mark the thread as Fixed. |
| **Question or clarification** | Reply with a clear answer, mark Fixed/Closed. |
| **Informational or disagreement** | Reply with reasoning; mark WontFix/ByDesign if applicable. |

For ambiguous feedback, ask for clarification before marking Fixed. If a fix cannot be applied, reply explaining why and mark WontFix or leave Active.

The developer agent only applies code changes inside its service; the orchestrator performs all thread replies and status updates via MCP.

### 5. Summary

Report: how many threads addressed, which were fixed in code vs answered, and any that could not be fully resolved.
