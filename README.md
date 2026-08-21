# Agent Workspace

An **AI agent workspace** where each team adds the services they manage. It is the specification and planning hub for multi-service systems: feature designs, service boundaries, and AI-guided workflows, so work is planned and implemented consistently across teams, agents, and services.

> **Where things live** — `AGENTS.md` at the repository root is the canonical map: service ownership, global rules, conventions, and the workspace layout. It is loaded into every agent session. This README is for humans and is not.

Agent configuration lives in **`.agents/`** (skills, agents, settings). **`.claude` is a symlink to it** and **`CLAUDE.md` is a one-line import of `AGENTS.md`**, so Claude Code, Copilot, and anything else read the same files — there are no per-tool copies to keep in sync.

---

## The workflow

| Step | Command | What happens |
|---|---|---|
| 1 | **`/sunstice-gather-workitem`** | Identifies the in-progress work item (or one you name by ID) and fetches it with its parent, relations, comments and attachments into `features/feature-{ID}-*/workitem-{ID}-context.md`. Runs on the **workitem-gatherer** agent (Haiku) so raw ADO payloads stay out of the main context. |
| 2 | **`/sunstice-design`** | Explores the touched services, then **restates the business rules in its own words — Stated, Implied, and Silent — for you to validate** before any design exists. Produces a short decision-record feature file. After your confirmation, the **design-adversary** agent attacks it, and only then are the per-service task files written. |
| 3 | **`/sunstice-implement`** | Verifies every path the task files name still exists, then runs the **developer** agent per service in parallel at the model each task file asks for (`Model:` line, Sonnet by default). Each must pass a four-point definition of done: build, tests, every acceptance criterion walked end-to-end, and existing data verified on an *upgraded* environment. A developer that hits a false premise stops and reports the delta instead of re-planning. |
| 4 | **`/sunstice-code-review`** | Runs the **code-reviewer** agent per service against `origin/develop`, writes a report under `reviews/`, and can apply the findings you accept via the developer agent. **Also usable on its own** — see below. |
| 5 | *(open the PR by hand)* | |
| 6 | **`/sunstice-pr-resolve-comments`** | Fetches unresolved PR comments (read-only — it never writes to the PR) and fixes each locally, drafting the replies for you to post. |

Committing, opening PRs, and releasing are deliberately manual — there are no skills for them.

**The pipeline is not the only way in.** `/sunstice-code-review` and `/sunstice-gather-workitem` stand alone and are used that way regularly:

- **Reviewing a colleague's branch** — fetch and check out their branch in `services/<service>`, then `/sunstice-code-review <service>`. The reviewer diffs whatever is checked out. It will *not* offer to apply fixes to someone else's work; it produces comments ready to paste onto the PR instead.
- **Reviewing anything with no work item at all** — functional alignment is marked Not Applicable, the technical review is unaffected.
- **Adding functional context to any review** — run `/sunstice-gather-workitem <ID>` first, including for a work item that is not yours, then `/sunstice-code-review`.

- **Fixing something broken** — `/sunstice-bug-fix`. Different shape, not a lighter `/sunstice-design`: reproduce → root cause with `file:line` evidence → check which other callers share the bug → **you confirm the diagnosis** → smallest fix plus a regression test proven red-then-green. It refuses to let a bug fix turn into a refactor, and routes you to `/sunstice-design` if the root cause turns out to be architectural.

`/sunstice-design` and `/sunstice-implement` are for multi-service feature work. Reaching for them on a single-service change with no schema change, no new interface, and no UI states is ceremony — go straight to the code.

**Requirements**

- **Azure DevOps MCP** — needed by `/sunstice-gather-workitem` and `/sunstice-pr-resolve-comments`; they stop with a clear error without it.
- **Shell** — bash on Linux/WSL. PowerShell syntax applies to Windows / VS Code sessions.

### Azure DevOps MCP setup (VS Code)

Follow the [VS Code MCP server flow](https://code.visualstudio.com/docs/copilot/customization/mcp-servers): open Chat, search `@mcp azure-devops`, select the server and follow the prompts. Confirm it is enabled in your MCP servers list and that `AZURE_DEVOPS_PAT` is set in your environment.

---

## Getting started

1. **Set up the Azure DevOps MCP server** (above).
2. **Add your services** — clone or symlink each service you own under `services/`, give it a `services/{service}/AGENTS.md`, and add a one-line bullet to root `AGENTS.md` describing what it owns. Agents rely on that bullet to route work to the right service.
3. **Run the workflow** — `/sunstice-gather-workitem` → `/sunstice-design` → confirm → `/sunstice-implement` → `/sunstice-code-review` → PR → `/sunstice-pr-resolve-comments`.

---

## Design principles

These explain why the workspace looks sparse. Both are cost levers that matter on every session.

### A skill earns its place by being a workflow, not by being useful

Every installed skill's `description` loads into context at the start of **every** session, used or not — and an *activated* skill pulls in its whole body and reference documents. This workspace once installed two upstream packs wholesale: 67 skills, 25 KB of descriptions per session, and a single code review could pull ~175 KB of generic best-practice prose into context — routinely 20× the size of the diff it was meant to read line by line.

Generic Java, Spring, and React best-practice skills are therefore **not** installed. That knowledge is already in the model; the part worth keeping — the *taxonomy* of what to check — lives in `.agents/agents/code-reviewer.agent.md` §3 as review dimensions. Before adding a skill, ask whether a command will invoke it by name. If not, it costs every session and pays back in none.

### Model routing

Mechanical work runs on Haiku (`workitem-gatherer`), implementation on Sonnet (`developer`), and only design, review, and orchestration stay on the session model. Keep it that way when adding agents.

The split works because the strong model does the thinking once, at design time, and writes it down. That only pays off if the task file is genuinely sufficient — an under-specified task file makes Sonnet *more* expensive than Opus would have been, because it re-explores the service and re-derives conclusions with less capability. So the leverage is in the handoff, not the tier: frozen cross-service contracts, paths checked before dispatch, and a per-service `Model:` line the designer sets after exploring.

The same logic shapes the skills themselves: `/sunstice-design` delegates code exploration to Haiku `Explore` subagents and keeps only their conclusions, and `/sunstice-code-review` passes report *paths* between agents rather than report contents.

---

## Documents a feature produces

- `features/feature-{ID}-*/workitem-{ID}-context.md` — the gathered work item.
- `features/feature-{ID}-*/feature-{ID}-*.md` — the **decision record**, capped at ~120 lines. Decisions, the cross-service flow, migration impact on existing data, and an end-to-end walk of each acceptance criterion. Written for you to approve or reject.
- `features/feature-{ID}-*/tasks/{service}.md` — the **implementation spec**, one per service. Written for the developer agent; you are not meant to read these.
- `reviews/review-*/…` — review reports, with stable finding IDs (`CR-1`, `CR-2`, …) that `/sunstice-code-review` can hand back to the developer agent to fix.

Keeping the decision record and the implementation spec in separate files is deliberate: fusing them is what made earlier feature documents run to 800 lines.
