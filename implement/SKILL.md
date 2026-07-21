---
name: implement
description: Resolve the current feature and run implementation per service in parallel via the developer agent.
---

# `/implement` — Run implementation per service in parallel

Resolve the current feature, find per-service task files, and invoke the developer agent in parallel for each service.

## Steps

### 1. Resolve feature

- If the user provides an ID, use it.
- Else, parse from the Git branch name (`workitem-{id}-{slug}` or `feature-{id}-{slug}`).
- Else, scan `features/feature-*/` folders; if exactly one exists, use it. If multiple, ask the user.
- Feature file: `features/feature-{ID}-{title}/feature-{ID}-{title}.md`.
- If not found, fail: _"No feature file found; run `/design` first or specify a feature ID."_

### 2. Discover task files

- Look in `features/feature-{ID}-{title}/tasks/*.md`.
- Service name = filename without `.md` (e.g. `ui-bloom.md` → `ui-bloom`).
- If none exist, fail: _"No task files found for this feature."_

### 3. Map services to subagents

- For each service, use scope `@services/{service}` and the **developer** agent.
- The developer agent reads that service's AGENTS.md for tech and conventions.
- **Model**: invoke every developer agent with `model: sonnet` by default.

### 4. Run in parallel

For each service with a task file, invoke the developer agent (`model: sonnet`) in background mode:

```
Implement the coding plan in {taskFilePath} for feature {ID}.
Use only code under services/{service}.
Follow the feature design in {featureFilePath}.
```

The developer agent uses the advisor tool automatically (mandatory on the `sonnet` model).

All invocations run concurrently.
