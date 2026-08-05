# Claude Code instructions — agent-workspace

Repo-wide guidance shared with other tools lives in `AGENTS.md`.
This file is the only one Claude Code auto-loads, so it imports it.

@AGENTS.md

## Global rules

- **Shell is bash** (Linux/WSL). The PowerShell rule in `README.md` applies to Windows/VS Code sessions, not here.
- **Read `services/{service}/AGENTS.md` before touching a service.** It is authoritative over root `AGENTS.md` for that service's stack and conventions.
- **Stay inside the services in scope.** Never edit an unrelated service to make your own change easier; flag the cross-service impact instead.
- **No code comments in production code** unless the user explicitly asks. Comments in test files are fine.
- **`AGENTS.md` files must never reference Azure DevOps work items** (US/feature/story numbers). Record the durable fact, not the ticket.
- **ui-bloom locales:** edit only `packages/bloom/public/locales/en/`. Other languages are translated elsewhere.
- **Naming new Java types:** name them in the owning micro-service's own domain vocabulary, at that service's abstraction level. Don't borrow another service's concepts, and don't drop to over-generic names (`Data`, `Info`, `Manager`, `Helper`) or up to over-abstract framework-speak.
