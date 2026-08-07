# AI Guidance — Service Boundaries & Immediate Facts for Agents

This repository is an AI agent workspace containing multiple cooperating services. This file is the canonical, discoverable summary agents should consult before planning or implementing changes.

## High-level service responsibilities

- `services/supply-network` — Owns network structure, views, and UI-facing network data (graph, flow parts, views). Does NOT own calculation history.
- `services/supply-optim` — Owns optimization execution, segmentation (sub-perimeters), report generation. Responsible for scalable execution (ActiveMQ queues, KEDA worker jobs) and S3 report storage.
- `services/supply-planning` — Owns calculation records and long-term history; dual persistence (JPA/PostgreSQL for transactional data, MongoDB for document-style data and sub-perimeter records). Exposes SSE for calculation status.
- `services/agent-builder` — Owns AI agent definition management (CRUD + publish/unpublish), persisting definitions in MongoDB and exposing MCP/OpenAI-oriented runtime configuration.
- `services/micro-service-ai-supply_shortage_rca` — Owns automated root cause analysis for supply chain shortages, combining deterministic upstream graph traversal with agent-assisted inspection to produce ranked RCA findings and stream workflow progress over SSE.
- `services/ui-bloom` — Owns the React monorepo frontend (`ui-bloom/packages/*`), shell (`packages/bloom`), and English locale edits (`packages/bloom/public/locales/en/`).
- `services/library-fm-auth` — Shared Java library (not a deployable service) providing Keycloak/JWT authentication, Spring Security config, WorkScope context propagation, and Feign/RSocket auth interceptors. Published to Azure DevOps `micro-service-utilities` feed; consumed by backend services as a Maven dependency.
- `services/library-calendar-util` — Shared Java library (not a deployable service) providing Bloom calendar/date domain primitives (`FMCalendar`, `FMDate`) and conversion/chronology logic for 12-month and 13-period year types with working-day-aware date operations.
- `services/library-timeseries-util` — Shared Java library (not a deployable service) owning time-series I/O against Apache Doris (JDBC + Apache Arrow ADBC/Flight SQL) and detailed-series persistence in PostgreSQL via MyBatis. Provides Spring facades for load/save/revise/delete/promote, chronology resolution, formula-based calculated series, scenario operations, and time-series notes. Published to Azure DevOps `micro-service-utilities` feed.
- `services/micro-service-time-series` — Owns time-series numeric values (load/save/delete/promote/revise/consolidate/sync), detailed series (Doris-backed), time-series definitions, cell-change notes, async task status, and import/export. Java 21, Spring Boot MVC + WebFlux, PostgreSQL (plain JDBC) for notes/definitions, Apache Doris (MySQL JDBC) for TS values, RSocket (TCP port 7000, WS port 7002) + REST (HTTP port 8096, base paths `/api/timeSeries`, `/api/detailedSeries`, `/api/notes`). Publishes a `time-series-client` artifact consumed by other services.
- `services/micro-service-demand-planning` — Owns demand-planning and risks-and-opportunities back-end capabilities in one Spring Boot application, including node/config APIs, ML and batch operations, GraphQL endpoints, and dedicated risk-and-opportunity APIs/settings backed by MongoDB.
- `services/micro-service-hypercube` — Owns multidimensional calculation engine: computes "layers" (from JSON config, time frames, perimeters, dimensions), persists results in MongoDB, exposes REST (`/hypercube`) and WebSocket (STOMP) for status push. Fetches raw data from fmlegacy-wrapper, time-series, and master-data services. Java 21, Spring Boot.
- `services/micro-service-dashboard_indicator` — Owns indicator definitions and UI-facing indicator formatting/filtering, persists indicator configurations in MongoDB, and translates indicator requests into Hypercube computations.
- `services/micro-service-iam` — Owns Identity and Access Management (IAM): user management, group management, role management, and Keycloak integration. Java 21, Spring Boot, PostgreSQL (transactional data), MongoDB (flexible document storage). REST base path `/api/iam`, port `8087`. Depends on `library-fm-auth` for Keycloak/JWT authentication.
- `services/micro-service-top-down-splitting` — Owns Top Down Splitting backend capabilities, including rules/settings management, operation launch and progress tracking, and import/export workflows, with domain persistence and orchestration in the service.
- `services/micro-service-BPM` — Owns process definitions (Camunda BPMN) and workflow runtime instances (user/service tasks). Runs Camunda BPM 7.21 on port `9001` with context path `/bpm`. Integrates custom service tasks that orchestrate operations in other services.
- `services/micro-service-collaboration` — Owns collaboration sessions (CRUD + lifecycle), messages, tasks, and real-time notifications (WebSocket). REST base path `/api/collaboration`, port `8100`, MongoDB collection `collaborationSession`. Key endpoint: `POST /collaborations` to create a collaboration with title, collaborators, description, and contextual links.
- `services/micro-service-enterprise-process` — Owns enterprise-wide business processes, milestone schedule rules, and phase/step validation constraints. Runs on port `8102` and persists template designs in MongoDB.
- `services/micro-service-master-data` — Stores and manages the referential supply chain master data (axes, items, nodes, selections, UOMs, calendars). Runs on HTTP port `8084` and RSocket port `7000`, persisting in PostgreSQL, with component tests running on H2.
- `services/micro-service-query-tool` — Manages query reports and runs domain-specific batch actions (Demand Planning, Master Data, TPM). Runs on port `8083` and persists report metadata/results in MongoDB.
- `services/micro-service-scenario` — Owns scenario lifecycle management (list/create/update/delete), scenario ancestry, scenario promotion, lifecycle SSE events for promotion/deletion awareness, and per-user current-scenario selection. Java 21 Spring Boot service on port `8095`, backed by MongoDB database `scenario`, with REST controllers rooted at `/scenarios` and `/users`.
- `services/dolap-bff` — Backend-for-Frontend proxy for the DOLAP/Analyzer module. Routes browser requests to the DOLAP OLAP engine (`${dolap-base-url}`). Port `8899`. Key endpoints: `POST /api/olap/getNodeList` (active nodes in an Analyzer view), `POST /api/olap/getTsList` (time series list), `POST /api/olap/getAnalyzerList`. Workspace context carried as `iid`/`rid`/`workScope` in every request body (`RequestBase`). `analyzerId` (long) identifies the Analyzer definition.
- `services/micro-service-reverse-proxy` — Owns Nginx reverse-proxy routing for Bloom stack services and Keycloak-only deployments, including mode-based location configuration, startup template evaluation, and TLS-related runtime inputs.
- `services/micro-service-documentation` — Owns FuturMaster end-user documentation delivery. Serves MadCap Flare HTML5 output via OpenResty (nginx + Lua) with Keycloak OIDC authentication (lua-resty-openidc). No backend logic; pure static-site container (`futurmastersolutions/micro-service-documentation`).

## Global rules

- **Shell is bash** (Linux/WSL). PowerShell syntax applies to Windows/VS Code sessions, not here.
- **Read `services/{service}/AGENTS.md` before touching a service.** It is authoritative over this file for that service's stack and conventions.
- **Stay inside the services in scope.** Never edit an unrelated service to make your own change easier; flag the cross-service impact instead.
- **No code comments in production code** unless the user explicitly asks. Comments in test files are fine.
- **`AGENTS.md` files must never reference Azure DevOps work items** (US/feature/story numbers). Record the durable fact, not the ticket.
- **ui-bloom locales:** edit only `packages/bloom/public/locales/en/`. Other languages are translated elsewhere.
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
- `.agents/skills/` — `design`, `implement`, `code-review`, `gather-workitem`, `pr-resolve-comments`. Committing, PRs, and releases are done by hand.
- `.agents/agents/` — `developer` (sonnet), `code-reviewer` (inherits), `design-adversary` (inherits), `workitem-gatherer` (haiku).
- `services/{service}/AGENTS.md` — authoritative per-service facts; wins over this file for that service.
- `features/feature-{ID}-*/` — the feature decision record, work item context, and per-service task files. `reviews/` — review reports.
- `README.md` — human onboarding: setup and how the workflow runs end to end. Not loaded into agent context.

## How agents should update this file

- Do not rewrite accurate sections; add short, verifiable bullets in the most logical existing section.
- Prefer concrete, discoverable examples (file paths, property names, queue names) over generic recommendations.
- When adding service-level facts, also update that service's `services/{service}/AGENTS.md`, then add the matching bullet here by hand.
- This file loads into every session. Keep it under 200 lines — facts and rules only, never procedure. A procedure belongs in a skill.
