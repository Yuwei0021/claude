---
name: pr-create
description: Commit (scoped to changed services), push, and create an Azure DevOps PR linked to the work item; set work item to Under Review.
---

# `/pr-create` — Commit, push, and create Azure DevOps PR

Commit scoped changes, push the branch, and create a pull request linked to the work item. Each service under `services/{name}/` is its own Git repo — **all Git operations run from the service directory**, not the workspace root. **Never create or switch branches in the root project;** only create/use branches in changed service repos.

**Work item:** The user provides the work item ID (e.g. `/pr-create 52510`). That ID is used for branch name, commit message, and PR title/linking. If the user does not provide a number and the branch is already a feature branch, parse the ID from the branch name `workitem-{id}-{slug}`.

**Scope:** By default, all changed services. Optionally restrict: `/pr-create 52510 backend-a frontend`.

## Steps

### 1. Resolve work item ID

- **User provided a number:** Use that number as the work item ID for all steps (branch name when creating branch, commit, PR).
- **User did not provide a number:** Parse from current branch name `workitem-{id}-{slug}`. If unparseable or not on a feature branch, fail with a clear error asking for the work item ID (e.g. "Provide the work item ID: /pr-create 52510").

### 2. Create feature branch if needed (per service only)

- Only in **service repos** in scope: from each `services/{name}/`, if that repo is on `develop`, create branch `workitem-{workItemId}-{slug}` and switch to it. Do not create or change branch in the root repo.
- If a service repo is already on a feature branch, continue (work item ID from step 1).

### 3. Determine PR scope

- **User specified**: validate against known services (root AGENTS.md or `services/` dirs). Invalid names → fail listing valid options.
- **Default**: intersect feature-file services with `git status` changed services. If no changes, fail.

### 4. Stage and commit (per service repo)

- From `services/{name}/`, stage all modified files in that service.
- Commit: `#{workItemId} <descriptive message>` (use the work item ID from step 1).
- If nothing staged, fail.

### 5. Push (per service repo)

- From each service directory, push with `--set-upstream` if needed.

### 6. Create PR (per service repo)

Via Azure DevOps MCP, create PR in the **service's repo** (not the workspace root):

- **Title**: `#{workItemId} <title>` (use the work item ID from step 1)
- **Target**: `develop` (unless user specifies another)
- **Description**: service in scope, summary of changes, testing performed, link to work item
- Link the work item (from step 1) to the PR.

### 7. Update work item status

- Set the work item (from step 1) to **"Under Review"** via MCP.
- If status transition fails, report but keep the PR.

