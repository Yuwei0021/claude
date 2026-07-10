---
name: gather-workitem
description: Verify Azure DevOps MCP, then delegate to the workitem-gatherer agent to retrieve full work item details (comments, links, parent, relations, attachments) and save them to a work item context markdown file; finally update the chat session name and present the summary.
---

# `/gather-workitem` — Gather Azure DevOps Work Item Context

Verify Azure DevOps MCP, then delegate the gathering to the **workitem-gatherer** subagent so raw ADO payloads stay out of the main conversation. The subagent writes the structured context file; the orchestrator only handles session naming and the user-facing summary.

> [!IMPORTANT]
> The scope of this skill is strictly limited to gathering all related information. It is not necessary to perform any source code analysis, provide recommendations, run any code, execute tests, or modify source code during this task.

## Orchestrator Steps

### 1. Verify MCP

- Call an Azure DevOps MCP tool (e.g. `core_list_projects`).
- If unavailable, stop: *"Azure DevOps MCP server is unavailable. Please ensure the MCP server is running and configured, then try again."*

### 2. Invoke the workitem-gatherer agent

- Invoke the **workitem-gatherer** agent (synchronously) with the work item ID if the user provided one, otherwise instruct it to find the current in-progress work item via `wit_my_work_items`.
- The agent retrieves full details (work item, parent, related items, comments, attachments), saves attachments under `features/feature-{ID}-{short-title}/`, and writes the structured context file at `features/feature-{ID}-{short-title}/workitem-{ID}-context.md` with a self-contained **Summary** section first.
- The agent returns only: the context file path, the feature title, and the Summary section. Do not re-read the full context file in the main conversation.

### 3. Update chat session name

- Update the chat session name to the feature title returned by the agent.

### 4. Present the result

- Output the Summary and the context file path to the user. Downstream skills (`design`, `code-review`) read the Summary section of the context file first and fall back to the full sections only when needed.
