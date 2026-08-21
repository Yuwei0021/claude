# AI Guidance — Service Boundaries & Immediate Facts for Agents

This repository is an AI agent workspace containing multiple cooperating services. This file is the canonical, discoverable summary agents should consult before planning or implementing changes.

## Service index — who owns what

One line per service, enough to route a change. Ports, base paths, datastores and tech stack
live in `.agents/service-map.md` — read it when you need them.
`services/{service}/AGENTS.md` is authoritative for that service; read it before touching it.

| Service | Owns |
| --- | --- |
| `supply-network` | Network structure, views, UI-facing network data. **Not** calculation history. |
| `supply-optim` | Optimization execution, segmentation (sub-perimeters), report generation. |
| `supply-planning` | Calculation records and long-term history. |
| `agent-builder` | AI agent definitions (CRUD, publish/unpublish). |
| `micro-service-ai-supply_shortage_rca` | Root cause analysis for supply shortages. |
| `ui-bloom` | React monorepo frontend. English locales only (`packages/bloom/public/locales/en/`). |
| `library-fm-auth` | Shared library: Keycloak/JWT auth, Spring Security, WorkScope propagation. |
| `library-calendar-util` | Shared library: calendar/date primitives (`FMCalendar`, `FMDate`), 12-month and 13-period years. |
| `library-timeseries-util` | Shared library: time-series I/O against Doris, detailed series in PostgreSQL. |
| `micro-service-time-series` | Time-series values, detailed series, definitions, cell-change notes, import/export. |
| `micro-service-demand-planning` | Demand planning, plus risks and opportunities. |
| `micro-service-hypercube` | Multidimensional calculation engine — computes layers, pushes status. |
| `micro-service-dashboard_indicator` | Indicator definitions and UI-facing indicator formatting/filtering. |
| `micro-service-iam` | Users, groups, roles, Keycloak integration. |
| `micro-service-top-down-splitting` | Top Down Splitting rules/settings, operation launch and progress, import/export. |
| `micro-service-BPM` | Camunda process definitions and workflow runtime instances. |
| `micro-service-collaboration` | Collaboration sessions, messages, tasks, real-time notifications. |
| `micro-service-enterprise-process` | Enterprise processes, milestone schedule rules, phase/step validation. |
| `micro-service-master-data` | Referential master data: axes, items, nodes, selections, UOMs, calendars. |
| `micro-service-query-tool` | Query reports and domain batch actions (Demand Planning, Master Data, TPM). |
| `micro-service-scenario` | Scenario lifecycle, ancestry, promotion, per-user current scenario. |
| `dolap-bff` | Backend-for-Frontend proxy for the DOLAP/Analyzer OLAP engine. |
| `micro-service-reverse-proxy` | Nginx reverse-proxy routing for the Bloom stack. |
| `micro-service-documentation` | End-user documentation static site (MadCap Flare output, OpenResty + Keycloak). |

## Global rules

- **Shell is bash** (Linux/WSL). PowerShell syntax applies to Windows/VS Code sessions, not here.
- **Read `services/{service}/AGENTS.md` before touching a service.** It is authoritative over this file for that service's stack and conventions.
- **Stay inside the services in scope.** Never edit an unrelated service to make your own change easier; flag the cross-service impact instead.
- **No code comments in production code** unless the user explicitly asks. Comments in test files are fine.
- **`AGENTS.md` files must never reference Azure DevOps work items** (US/feature/story numbers). Record the durable fact, not the ticket.
- **ui-bloom locales:** edit only `packages/bloom/public/locales/en/`. Other languages are translated elsewhere.
- **Write for readers whose first language is not English.** This applies to everything a human reads — chat replies, feature files, review reports, PR descriptions, commit messages. Short sentences, common words, active voice. No idioms, metaphors, or figures of speech ("blast radius", "hand-waving", "last writer wins", "the heart of the document") — say the literal thing instead. Technical terms (idempotent, index, migration, race condition) stay; they are precise and shared. Rare general-purpose words do not — use *is missing* over *is absent*, *make sure* over *ensure*, *break* over *undermine*. Keep this rule out of source code and identifiers.
- **Naming new Java types:** name them in the owning micro-service's own domain vocabulary, at that service's abstraction level. Don't borrow another service's concepts, and don't drop to over-generic names (`Data`, `Info`, `Manager`, `Helper`) or up to over-abstract framework-speak.

## Planning rules

- Map features to the owning service before assigning implementation tasks. Consult `services/{service}/AGENTS.md` for authoritative, service-specific facts.
- If you discover incorrect ownership or conventions, add a short factual bullet here and update the relevant `services/{service}/AGENTS.md`.

## API & naming conventions

- Use camelCase for REST path segments (e.g. `/calculationRecords/{id}/subPerimeters`).
- Gateway/BFF API context paths: `/api/supply-planning`, `/api/supply-optim`, `/api/supply-network`.

## Key repository-level facts (add concise bullets when discovered)

- Build & language: Maven multi-module (parent POM `fm-starter-parent`); backend services are Java 21 except `services/agent-builder`, `services/micro-service-collaboration`, and `services/micro-service-query-tool` (`java.version` 25).
- Mapping: ModelMapper is used for entity→DTO mapping across backend services.
- supply-optim: CPLEX solver, ActiveMQ for queue-based execution, S3 for reports, KEDA-managed worker queues (queue names like `supply-5`..`supply-100`); worker mode controlled via `futurmaster.supplyoptim.scaling.queue`.
- supply-planning: JPA + PostgreSQL (transactional), MongoDB (document/sub-perimeter collections such as `calculationSubPerimeterRecord`), reactive flows use R2DBC and RSocket, SSE endpoints for status (`/calculationRecords/subscribe`).
- supply-network: MongoDB (Spring Data), controllers and models under `services/supply-network/service/src/main/java/com/futurmaster/supplynetwork/`.
- agent-builder: Spring Boot app on port `8090`, REST base path `/api/agent-builder/agents`, MongoDB collection `agentDefinitions`, Spring AI OpenAI starter + MCP server starter (`services/agent-builder/src/main/resources/application.yml`, `services/agent-builder/src/main/java/com/futurmaster/agentbuilder/controller/AgentController.java`).
- ui-bloom: Monorepo `ui-bloom/packages/*` (core `packages/bloom`), Redux + Redux-Saga, Axios, Keycloak. Edit only English locales under `packages/bloom/public/locales/en/`.

## Workspace layout

- `.agents/` — the single source for skills, agents, and settings; no per-tool copies. `.claude` is a symlink to it, and `CLAUDE.md` imports this file, so Claude Code reads exactly what other tools read.
- `.agents/service-map.md` — per-service ports, base paths, datastores and tech stack. Read on demand; not loaded every session.
- `.agents/skills/` — `sunstice-design`, `sunstice-implement`, `sunstice-code-review`, `sunstice-bug-fix`, `sunstice-gather-workitem`, `sunstice-pr-description`, `sunstice-pr-resolve-comments`. Committing, PR creation, and releases are done by hand.
- Something **broken** goes to `/sunstice-bug-fix` (diagnose → confirm → smallest fix + regression test), not through `/sunstice-design`. Something **missing** goes through `/sunstice-design` → `/sunstice-implement`.
- `.agents/agents/` — `developer` (sonnet), `code-reviewer` (inherits), `design-adversary` (inherits), `workitem-gatherer` (haiku).
- `services/{service}/AGENTS.md` — authoritative per-service facts; wins over this file for that service.
- `features/feature-{ID}-*/` — the feature decision record, work item context, and per-service task files. `fixes/fix-{ID}-*/` — bug diagnoses. `reviews/` — review reports.
- `README.md` — human onboarding: setup and how the workflow runs end to end. Not loaded into agent context.

## How agents should update this file

- Do not rewrite accurate sections; add short, verifiable bullets in the most logical existing section.
- Prefer concrete, discoverable examples (file paths, property names, queue names) over generic recommendations.
- When adding service-level facts, also update that service's `services/{service}/AGENTS.md`, then add the matching bullet here by hand.
- This file loads into every session. Keep it under 200 lines — facts and rules only, never procedure. A procedure belongs in a skill.
