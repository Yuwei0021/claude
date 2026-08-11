Service: micro-service-enterprise-process
Model: sonnet
Complexity: normal

# US 56138 — group-level process reads for panel linking

Read `features/feature-56138-link-panel-edited-process-template/feature-56138-link-panel-edited-process-template.md`
first — the **Cross-service contracts** section is frozen. If a shape below looks wrong, **stop and report**;
do not adapt it.

Three read endpoints and nothing else. **No entity field, no new collection, no migration, no change to how a
version's status is computed.** Everything is derived from documents that already exist.

## Already verified — do not re-derive

| Fact | Where |
|---|---|
| `TemplateGroupController` exists, base path `/template-groups`, one method (`/{templateGroupId}/versions`) | `service/.../controller/TemplateGroupController.java` |
| `TemplateGroupService.findVersions(groupId)` loads `findByTemplateGroupId` + one batch `getState` | `service/.../service/TemplateGroupService.java:30-39` |
| **`TemplateGroupService.findCurrentVersion(versions, statusById)` already exists** and ranks ACTIVE > SCHEDULED > DRAFT > ARCHIVED, then highest `versionNumber` | `TemplateGroupService.java:41-59` |
| `TemplateStatusService.getState(Collection)` returns `TemplateState(status, effectiveStartDate, effectiveEndDate)` per template — **one** aggregation for the whole collection | `service/.../service/TemplateStatusService.java:55-89` |
| `effectiveStartDate` = first cycle start (UTC day), `effectiveEndDate` = last cycle end, already the inclusive last day | `TemplateStatusService.TemplateState.of` |
| Status is DRAFT when `deploymentConfig == null` even if cycles exist — `deploy()` writes the config **last**, on purpose | `TemplateStatusService.compute`, service `AGENTS.md` |
| `ProcessTemplateRepository.findByTemplateGroupId(String)` exists | `service/.../repository/ProcessTemplateRepository.java:25` |
| Element ids: `Phase.id`, `Step.id` are UUIDs preserved across versions by `ProcessTemplateService.requireIdsFromSource` (phases, steps, milestones only — **never the process node**) | `ProcessTemplateService.java:216-233` |
| `ProcessTemplateController.getActiveCycle(processTemplateId)` → `CycleService`, returns 200 / 204 / 404 | `service/.../controller/ProcessTemplateController.java:46-51` |
| Cucumber features live in `component-test/src/test/resources/features/templates/` | `versioning.feature`, `redeployment.feature`, `summaries.feature` |

**The process node has no stable id.** That is why the `PROCESS` element's id in every response below is the
**`templateGroupId`**. Do not invent or persist a process-node id.

## Work items, in order

### 1. `GET /template-groups/summaries`

New method on `TemplateGroupController` → new `TemplateGroupService.findGroupSummaries()`.

- Load every `ProcessTemplate`, group by `templateGroupId`.
- One batch `templateStatusService.getState(all)`.
- **Keep a group only if some version has a non-null `deploymentConfig` and a non-null `effectiveStartDate`**
  (i.e. it owns cycles). This excludes never-deployed groups *and* a half-finished deploy — the same guard
  `findTemplateByStatus`'s ACTIVE branch already applies.
- `status` = `ACTIVE` when any version of the group derives `TemplateStatus.ACTIVE`, else `INACTIVE`.
- `name` = the current version's name (immutable across a group, 55615 §4.6, but read it from the current
  version rather than an arbitrary one).
- Sort by `name`.

New DTO in the `model` module — `ProcessGroupSummaryDto(String templateGroupId, String name, ProcessGroupStatus status)`
and enum `ProcessGroupStatus { ACTIVE, INACTIVE }`. **Do not add values to `TemplateStatus`** — that enum
describes a version, this one describes a logical process.

### 2. `GET /template-groups/{templateGroupId}/elements`

New controller method → new `TemplateGroupService.findElements(groupId)`.

1. `findByTemplateGroupId(groupId)` → `404` when empty.
2. One `getState(versions)` → statuses + effective dates.
3. `current = findCurrentVersion(versions, statusById)` — **reuse it, do not write a second rule**.
4. `scheduled` = the version deriving `SCHEDULED` **when it is not `current`** (`Optional.empty()` otherwise).
5. Build the element list from `current`: one entry for the process node (`id = templateGroupId`,
   `type = PROCESS`, `parentId = null`), one per phase (`parentId = templateGroupId`), one per step
   (`parentId = phase.id`). `order` = position in its list. **Milestones are excluded.**
6. Union with `scheduled`'s elements the same way, keyed on element id:
   - in both → `PRESENT`, `effectiveDate = null`
   - only in `scheduled` → `ARRIVING`
   - only in `current` → `LEAVING`
   - `effectiveDate` for `ARRIVING`/`LEAVING` = `scheduled`'s `TemplateState.effectiveStartDate`
   - the process node is always `PRESENT` — its id is the group id, which both versions share
   - an `ARRIVING` step whose parent phase is itself `ARRIVING` keeps that parent's id as `parentId`; the
     client needs a connected tree, so **every `parentId` must resolve inside the returned list**
   - a child keeps the `parentId` its own version gave it and inherits its parent's fate visually — a
     `PRESENT` step under a `LEAVING` phase renders under that phase, which is marked for deletion. **Do not
     invent a re-parenting rule**; the parent is in the list, so the tree still resolves
7. `scheduledStartDate` = `current`'s `effectiveStartDate` **only when no version of the group derives
   ACTIVE**, else `null`.

New DTOs in `model`: `ProcessGroupElementsDto`, `ProcessGroupElementDto`, enum `ElementState { PRESENT, ARRIVING, LEAVING }`.

### 3. `GET /template-groups/{templateGroupId}/elements/{elementId}`

New controller method → `TemplateGroupService.findElement(groupId, elementId)`.

- Reuses items 2.1–2.6. If the id is in that list, return its `state` and `removedOn: null`.
- Otherwise `state = REMOVED` and `removedOn` = `effectiveEndDate + 1 day` of the **greatest-`versionNumber`
  version whose phase/step id set contains `elementId`**; `null` when no version contains it, and `null` when
  that version has no cycles (`effectiveEndDate == null`).
- `404` on an unknown group. **Never 404 on an unknown element** — a removed element is the answer, not an error.

`ElementState` gains `REMOVED` for this response only; it never appears in item 2's list.

### 4. Replace `GET /templates/{id}/active-cycle`

Move it to `GET /template-groups/{templateGroupId}/active-cycle` on `TemplateGroupController`:
resolve the group's versions, take the one deriving `ACTIVE`, delegate to the existing `CycleService` call
that `ProcessTemplateController.getActiveCycle` uses today. `204` when no version is ACTIVE, `404` on an
unknown group. **Delete the old endpoint** — no production data, and its only consumer moves in the same
wave. Leaving both is a trap.

### 5. Performance

Every endpoint above is **one `findByTemplateGroupId` plus one `getState`**. `getState` issues a single
bounds aggregation for the whole collection — never call `getStatus(template)` in a loop.
Item 1 is one `findAll` plus one `getState`; if `findAll` ever needs projecting, say so rather than fanning out.

## Files

**Create** — `model/.../model/dto/ProcessGroupSummaryDto.java`, `ProcessGroupElementsDto.java`,
`ProcessGroupElementDto.java`, `ProcessGroupElementDetailDto.java`;
`model/.../model/enums/ProcessGroupStatus.java`, `ElementState.java`;
`component-test/src/test/resources/features/templates/panel-linking.feature` + its step class beside the
existing ones.

**Modify** — `service/.../controller/TemplateGroupController.java`,
`service/.../service/TemplateGroupService.java`,
`service/.../controller/ProcessTemplateController.java` (remove `getActiveCycle`),
`service/src/test/java/.../service/TemplateGroupServiceTest.java` (or create),
any existing test touching `/templates/{id}/active-cycle` — including
`component-test/.../features/templates/active-cycle*.feature`, which must be re-pointed at the group path.

## Tests

**Unit** (`TemplateGroupServiceTest`, Mockito + fixed `Clock`):

- Union: element in both versions → one entry, `PRESENT`, no date. Only in scheduled → `ARRIVING` + the
  scheduled version's start date. Only in current → `LEAVING` + the same date.
- The process node is `PRESENT` and its id is the **`templateGroupId`**, not any template `_id`. Assert this
  explicitly — it is the finding that would otherwise ship silently.
- Scheduled-only group (no ACTIVE version): every element `PRESENT`, **no** `effectiveDate` on any of them,
  and `scheduledStartDate` set. This is BR-26 and it fails if `findCurrentVersion` is bypassed.
- Group summaries: a group whose only version has cycles but a null `deploymentConfig` is **absent** from the
  list. A group with a SCHEDULED version and no ACTIVE one is present, with status `INACTIVE`.
- `findElement`: present id → its state, `removedOn` null. Removed id last held by an archived version →
  that version's `effectiveEndDate + 1 day`. Removed id held by **no** version → `REMOVED`, `removedOn` null
  (BR-21/R3 — this is the scheduled-version-edited-in-place case).
- `getState` invoked **once** per request (`verify(templateStatusService, times(1)).getState(any())`).

**Component** (`panel-linking.feature`, seeding through the API the way `redeployment.feature` does — deploy
v1, create v2 via `sourceTemplateId`, deploy it with a future start date; place cycles relative to `now`):

- v1 ACTIVE + v2 SCHEDULED dropping a phase and adding another → `/elements` returns the union with one
  `LEAVING` and one `ARRIVING`, both carrying v2's start date.
- After the clock passes the handover (seed the dates so it has), the dropped phase is absent from `/elements`
  and `/elements/{id}` answers `REMOVED` with the handover date.
- `/summaries` lists the group once, `ACTIVE`, while a never-deployed group is absent.
- `/template-groups/{g}/active-cycle` returns the running cycle; `/templates/{id}/active-cycle` is gone.

## Definition of done

- `mvn clean install` at the service root is green (unit + Cucumber + coverage).
- No reference to `/templates/{id}/active-cycle` remains anywhere in the service.
- `TemplateStatus`, `TemplateStatusService.compute`, `ProcessTemplate` and `CycleData` are **unchanged**.
- `services/micro-service-enterprise-process/AGENTS.md` gains a short bullet for the three group-level reads.

## Implementation notes (2026-08-11)

- `ElementType { PROCESS, PHASE, STEP }` was created in `model/.../model/enums/` — required by contract 2's
  `type` field, but not named in the Files list above.
- The group active-cycle endpoint does **not** delegate to `CycleService` from `TemplateGroupService`: that
  wiring is a circular bean (`CycleService` → `ProcessTemplateService` → `TemplateGroupService` →
  `CycleService`). `TemplateGroupService.findActiveVersion(groupId)` returns the `ProcessTemplate` and
  `TemplateGroupController` holds both beans. No contract or service boundary changed.
- All four new service methods share one `loadGroupContext` — one `findByTemplateGroupId` plus one `getState`
  per request, as item 5 requires.
- Verified: `mvn clean install` green, 171/171 Cucumber scenarios, all 6 modules.

## Review revisions (2026-08-11) — applied, supersede the items above

- **Contract 1** — the filter is `some version is not DRAFT`, not `deploymentConfig != null && effectiveStartDate != null`:
  `TemplateStatusService.compute` already returns DRAFT for both of those cases, so the pair was a restatement.
  `findProcessSummaries` therefore uses the cheaper `getStatus(Collection)` and never touches `TemplateState`.
  `name` is read off any version — it is invariant across a group — so no `findCurrentVersion` call. Mapping moved
  onto the entity as `ProcessTemplate.toProcessSummaryDto(ProcessStatus)`, beside `toDto`/`toListItemDto`/`toVersionDto`.
  The name sort stays (contract 1 promises it; the client does not sort).
- **Contract 2** — the payload is a **nested** `ProcessStructureDto { templateGroupId, name, scheduledStartDate, root }`
  with `ProcessNodeDto { id, name, level, state, effectiveDate, children[] }`. `parentId` and `order` are gone.
  The union is **ACTIVE ∪ SCHEDULED only** — `findCurrentVersion` is not used, because its ranking falls through to
  DRAFT and then ARCHIVED and would publish a draft's or a retired version's elements as live. When neither exists,
  `root` is `null` (BR-29).
- **Contract 3** — now `GET /template-groups/{g}/elements/{elementId}/removal` → `ProcessNodeRemovalDto { removedOn }`.
  The branch that resolved a *present* element was unreachable from the only caller and is deleted, along with
  `ProcessGroupElementDetailDto` and the `REMOVED` enum value.
- **Renames** — `GroupContext`→`ProcessContext`, `loadGroupContext`→`loadProcessContext`,
  `findGroupSummaries`→`findProcessSummaries`, `getGroupSummaries`→`getProcessSummaries`,
  `ProcessGroupSummaryDto`→`ProcessSummaryDto`, `ProcessGroupElementsDto`→`ProcessStructureDto`,
  `ProcessGroupElementDto`→`ProcessNodeDto`, `ElementType`→`ProcessLevel`, `ElementState`→`ProcessNodeState`,
  `ProcessGroupStatus`→`ProcessStatus`. The controller, its base path `/template-groups` and the `/elements`
  path segment are unchanged — the group is still the persistence-level notion.
- **Extraction** — tree assembly and the removal lookup live in `ProcessStructureService`; `TemplateGroupService`
  keeps version/status lookup and the repository access. The local `nullSafe` is gone in favour of
  `TemplateCollectionUtils.nullSafe`. The `groupKey` null-fallback is gone: `templateGroupId` is set on every
  create path (`resolveVersionContext`), so it was dead defensiveness. (`ProcessTemplateService.groupKey` still
  carries the same dead fallback — left alone, out of scope.)
- **Dead endpoints removed** — `GET /templates/summaries?status=` and `GET /templates/summaries/{id}` had no
  consumer left in `micro-service-ui` or `ui-bloom` once this feature moved panel linking onto the group-level
  reads. Deleted with their whole chain: `ProcessTemplateService.getTemplatesSummary`/`getTemplateSummary`,
  `TemplateStatusService.findTemplateByStatus` (its only caller) and the repository queries only it used
  (`findByDeploymentConfigIsNull`, `findProcessTemplateIds{Archived,Scheduled,Active}`),
  `ProcessTemplate/Phase/Step.toSummaryDto`, `ProcessTemplateSummaryDto`/`PhaseSummaryDto`/`StepSummaryDto`,
  `summaries.feature` + `TemplateSummarySteps`. `TemplateStatusService` no longer depends on
  `ProcessTemplateRepository`.
- Verified: `mvn test` green — 522 unit tests, 161 Cucumber scenarios.
