---
name: sunstice-gather-workitem
description: Verify Azure DevOps MCP, then delegate to the workitem-gatherer agent to retrieve full work item details (comments, links, parent, relations, attachments) and save them to a work item context markdown file; finally update the chat session name and present the summary.
---

# `/sunstice-gather-workitem` — Gather Azure DevOps Work Item Context

Verify Azure DevOps MCP, then delegate the gathering to the **workitem-gatherer** subagent so raw ADO payloads stay out of the main conversation. The subagent writes the structured context file; the orchestrator only handles session naming and the user-facing summary.

> [!IMPORTANT]
> This skill only gathers information. Do not read source code, give recommendations, run code, run tests, or change any file outside the feature folder.

## Orchestrator Steps

### 1. Verify MCP

- Call an Azure DevOps MCP tool (e.g. `core_list_projects`).
- If unavailable, stop: *"Azure DevOps MCP server is unavailable. Please make sure the MCP server is running and configured, then try again."*

### 2. Invoke the workitem-gatherer agent

- Invoke the **workitem-gatherer** agent (synchronously) with the work item ID if the user provided one, otherwise instruct it to find the current in-progress work item via `wit_work_item` with `action: "my"`.
- The agent retrieves full details (work item, parent, related items, comments, attachments), saves attachments under `features/feature-{ID}-{short-title}/`, and writes the context file at `features/feature-{ID}-{short-title}/workitem-{ID}-context.md`, with a **Summary** section first that stands on its own.
- The agent returns only: the context file path, the feature title, and the Summary section. Do not re-read the full context file in the main conversation.

### 3. Update chat session name

- Update the chat session name to the feature title returned by the agent.

### 4. Present the result

- Output the Summary and the context file path to the user. Later skills (`design`, `code-review`) read the Summary section first and open the full sections only when they need more.
