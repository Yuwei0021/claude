---
name: pr-resolve-comments
description: Fetch unresolved (Active) comments on your open PR via Azure DevOps MCP, address each, mark threads Fixed/Closed.
disable-model-invocation: true
---

# `/pr-resolve-comments` — Address unresolved PR comments

Fetch unresolved (Active) comments on your open PR via Azure DevOps MCP, address each one, and mark threads Fixed/Closed.

## Steps

### 1. Verify MCP

- Call an Azure DevOps MCP tool. If unavailable, stop: *"Azure DevOps MCP server is unavailable."*

### 2. Identify the PR

- If the user specifies a PR ID or repo, use it.
- Otherwise, list open PRs (`created_by_me: true`, `status: Active`) and match by branch name or work item ID from the branch.
- If multiple match, ask the user. If none found, fail.

### 3. Fetch unresolved threads

- Use `list_pull_request_threads` with `status: Active`.
- If none, report: *"No unresolved comments on this PR."*
- For each thread, get full comment content and note `filePath`, `rightFileStartLine`, etc.

### 4. Address each thread

| Comment type | Action |
|---|---|
| **Code change requested** (e.g. "use camelCase", "fix this logic") | Apply the fix, reply briefly ("Fixed."), mark thread as Fixed |
| **Question or clarification** | Reply with a clear answer, mark Fixed/Closed |
| **Informational or disagreement** | Reply with reasoning; mark WontFix/ByDesign if applicable |

For ambiguous feedback, ask for clarification before marking Fixed. If a fix cannot be applied, reply explaining why and mark WontFix or leave Active.

### 5. Summary

Report: how many threads addressed, which were fixed in code vs answered, and any that could not be fully resolved.

