Service: ui-bloom
Model: opus
Complexity: high

# US 56138 — version-aware Process/Element selectors, broken-binding recovery, panel-list markers

Read `features/feature-56138-link-panel-edited-process-template/feature-56138-link-panel-edited-process-template.md`
first — the **Cross-service contracts** section is frozen and the backend is built in parallel. If a shape
looks wrong, **stop and report**; do not adapt this side.

**UI states mockup (authoritative for layout and wording):**
https://claude.ai/code/artifact/3807230b-b0a9-46b4-b3b5-bd90f5509df3

`opus` because the blast radius is wide and non-obvious: the panel↔process key changes under **six**
consumers, one of which silently removes two widgets from the catalog when missed, and the collapsed-parent
requirement needs a change in `packages/bloom` that the obvious reading of the AC does not reveal.

## Already verified — do not re-derive

| Fact | Where |
|---|---|
| One `TreeSelect` today, `name="enterpriseProcess"`, value `{ processTemplateId, elementId }` | `packages/dashboard/lib/components/Panels/PanelConfiguration/components/PanelForm/PanelForm.jsx:193-221` |
| Tree built by `buildEnterpriseProcessTree`; the **process node's `value` is `template.id`** — a version id | `packages/dashboard/lib/utils/enterpriseProcessTree.js:15-23` |
| `usedElementIds` keys on `elementId` **alone**, from `usePanelConfiguration().panels` | `PanelForm.jsx:53,60-73` |
| That `panels` is the modal's **own** unfiltered `getPanels()` list, reloaded on every open — **not** the rights-filtered redux copy. Do not switch it to `originalPanels` | `PanelConfiguration.jsx:79-81,107` |
| Process list comes from `getDeployedProcessTemplatesSummary()` → `/templates/summaries?status=ACTIVE`, and its failure is **swallowed** into an empty array + `console.log` | `PanelConfiguration.jsx:52-59`, `lib/business/configuration/api.js:62-77` |
| `PanelsOrder` computes `expandedKeys` as "every parent, always" and passes **no** `onExpand` | `.../components/PanelsOrder/PanelsOrder.jsx:37-41,215-221` |
| `FMTree` copies `expandedKeys` into internal state once and **never publishes** its own `onExpand` | `packages/bloom/sources/front-end/components/FMTree/FMTree.jsx:66,96,180,248-249` |
| Six readers of `enterpriseProcess.processTemplateId` | `hooks/usePanelActiveCycle.js:8,12,19`; `widgets/EnterpriseProcess/hooks/useActiveCyclePhases.js:10,17,29`; `.../useActiveCycleTimeline.js:8,14,25`; `widgets/EnterpriseProcess/utils.js:21` (`isPanelLinkedToEnterpriseProcess`) and `:32` (`scopeCycleToElement`); `hooks/useFilterWidgets.js:35` |
| `isPanelLinkedToEnterpriseProcess` gates the whole Enterprise Process widget catalog (`enterpriseProcessLinkedPanelOnly`) and `EnterpriseProcessConfig.jsx:64`'s "linked / not linked" alert | `useFilterWidgets.js:35` |
| Locale keys `panel.enterpriseProcess.*` and `panel.activeCycle.*` | `packages/bloom/public/locales/en/fm-dashboard.json:307-389` |
| Existing disabled-option and inline-alert patterns: `TreeSelect` node `disabled`, antd `<Alert type=… showIcon>` | `enterpriseProcessTree.js`, `widgets/EnterpriseProcess/config/EnterpriseProcessConfig.jsx:60-68` |
| Never hardcode a date format — use `useDateFormat` from `@libs/utils/DateUtils` | `services/ui-bloom/AGENTS.md` |

## Work items, in order

### 1. The stored shape

`panel.enterpriseProcess` becomes `{ templateGroupId, elementId, elementLabel }`.
**The process node's `elementId` is the `templateGroupId` itself** — the template `_id` used today belongs to
one version and is archived away by the next deploy.

`elementLabel` is captured when the user picks an element and **refreshed on every save whenever the element
still resolves**, so a rename propagates. It is displayed only as a fallback when the element resolves nowhere.

### 2. API client — `lib/business/configuration/api.js`

- `getProcessGroupSummaries()` → `GET /api/enterprise-process/template-groups/summaries`
- `getProcessGroupElements(templateGroupId)` → `GET …/template-groups/{id}/elements`
- `getProcessGroupElementRemoval(templateGroupId, elementId)` → `GET …/template-groups/{id}/elements/{elementId}/removal`
- `getActiveCycle(templateGroupId)` → `GET …/template-groups/{id}/active-cycle` (**replaces** the
  `/templates/{id}/active-cycle` call; delete the old one)
- Remove `getDeployedProcessTemplatesSummary`.

### 3. `PanelConfiguration` — data and the error state

- Load groups with `getProcessGroupSummaries()`. **Surface the failure** instead of swallowing it into an
  empty array: today "no processes exist" and "the request failed" render identically.
- Load `getProcessGroupElements` **once per distinct `templateGroupId` held by the modal's panels**, on open,
  for the broken-set computation (item 6). One call per group, never per panel.
- Hold the broken set (`Set<panelId>`) in `PanelConfiguration` state so it survives tree re-renders.
- A group whose elements call fails contributes **no** markers — never a false one.

### 4. `PanelForm` — two dependent selectors

Replace the single `TreeSelect` with a `Select` (Process) + `TreeSelect` (Element), per mockup S1–S5.

- Element is **disabled** until a Process is chosen, with its own placeholder (S1).
- Changing the Process **clears the stored element before the new list arrives**, or the old element flashes
  as selected against a foreign list.
- Element options come from contract 2's **nested `root`** — `{ id, name, level, state, effectiveDate, children[] }`
  maps onto `TreeSelect` `treeData` directly, in array order. There is no `parentId` and no `order` to re-assemble.
  `root: null` means the process has no live version: keep the Element selector **disabled** and show the warning
  described in item 5b.
  Render chips straight from `state` + `effectiveDate`; **do not diff two versions client-side**.
  `ARRIVING` → "Scheduled from {date}", `LEAVING` → "Deleted from {date}" and **still selectable**.
- `scheduledStartDate != null` → no per-row chips at all; one info line above the list carrying the date (S4).
- `usedElementIds` becomes a set of **`${templateGroupId}::${elementId}`**, still built from the modal's own
  `panels`, excluding the panel being edited. Disabled options name the holding panel (S3).
- Dates render through `useDateFormat`.

### 5. `PanelForm` — the broken binding (S6, S7)

- The stored element is broken when it is absent from contract 2's tree (walk `root`; a `null` root means every
  linked element of that process is unresolvable). Only then call `getProcessGroupElementRemoval` — it returns
  `{ removedOn }`, which may be `null`. There is no `state` in that response: reaching it *is* the removed case.
- Render `elementLabel` + "(no longer exists)" and the recovery block beneath, per S6:
  1. `removedOn` set → "This element was removed from {process} on {date}." · `removedOn` null → the **same
     sentence without the date clause**: "This element was removed from {process}." There is no other variant.
  2. "The panel is still here and keeps its content — it just isn't attached to a step of the process
     anymore, so it shows no cycle dates."
  3. A single **"Choose another element"** button, which reopens the Element list on the same process.
- **Save must stay enabled.** Style the field as a warning; it carries no `required`/validator rule that
  fails on a broken link. An antd error state disables Save and contradicts the AC.
- No apology, no error code, and never the word "orphaned" — in any key you add.

### 6. `PanelsOrder` — markers and the roll-up (S8, S9)

Markers live in the **configuration modal's** list, beside the form where the recovery happens — not in the
navigation tree (`PanelHierarchyTree`), which has three instances, filters rows away in search, and gives a
childless root panel no row at all.

- A row shows the marker when its own panel is in the broken set.
- A **collapsed** row shows a lighter marker when any descendant is broken. Derive it from the current
  expansion — never store it.
- This requires **`FMTree` to publish expansion**: add an optional `onExpand` prop
  (`packages/bloom/sources/front-end/components/FMTree/FMTree.jsx`) called from its existing internal
  `onExpand` (line 180), and have `PanelsOrder` hold `expandedKeys` in state seeded by today's
  "every parent" default. Keep `FMTree` backward compatible — the prop is optional and every other caller
  is untouched.

### 7. The six consumers of `processTemplateId`

Rekey every one; several fail **silently** (a falsy id makes the hook no-op and the widget render empty):

- `hooks/usePanelActiveCycle.js` → `getActiveCycle(templateGroupId)`; update `PanelActiveCycle.jsx` propTypes.
- `widgets/EnterpriseProcess/hooks/useActiveCyclePhases.js`, `useActiveCycleTimeline.js`.
- `widgets/EnterpriseProcess/utils.js` — `isPanelLinkedToEnterpriseProcess` tests `templateGroupId`
  (**miss this and both Enterprise Process widgets vanish from the catalog** via `useFilterWidgets.js:35`,
  and `EnterpriseProcessConfig` flips to "panel not linked"); `scopeCycleToElement(cycle, elementId,
  templateGroupId)` gains the group id and returns `PROCESS` scope when `elementId === templateGroupId` —
  `cycle.processTemplateId` is a version id and no longer matches.

### 8. Locales — `packages/bloom/public/locales/en/fm-dashboard.json`, English only

Under `panel.enterpriseProcess.*`: `processLabel`, `processPlaceholder`, `elementLabel`,
`elementPlaceholder`, `elementPlaceholderNoProcess`, `chipScheduledFrom`, `chipDeletedFrom`, `chipTakenBy`,
`scheduledOnlyNotice`, `noLongerExists`, `removed`, `removedOn`, `stillAvailable`, `chooseAnother`,
`loadError`, and `panels.broken.marker` / `panels.broken.markerParent` for the tree tooltips.

## Files

**Modify** — `packages/dashboard/lib/business/configuration/api.js`;
`.../components/Panels/PanelConfiguration/PanelConfiguration.jsx`;
`.../PanelConfiguration/components/PanelForm/PanelForm.jsx`;
`.../PanelConfiguration/components/PanelsOrder/PanelsOrder.jsx`;
`packages/dashboard/lib/utils/enterpriseProcessTree.js` (rebuild from the flat contract shape, with chips and
the group-id process node); `packages/dashboard/lib/hooks/usePanelActiveCycle.js`;
`packages/dashboard/lib/widgets/EnterpriseProcess/utils.js`, `.../hooks/useActiveCyclePhases.js`,
`.../hooks/useActiveCycleTimeline.js`, `.../components/PanelActiveCycle/PanelActiveCycle.jsx`;
`packages/bloom/sources/front-end/components/FMTree/FMTree.jsx`;
`packages/bloom/public/locales/en/fm-dashboard.json`; and the specs beside each
(`PanelForm.spec.js`, `PanelsOrder.spec.js` / `.ispec.js`, `utils.spec.js`, `index.spec.js`).

## Tests

- **S1/S2** — Element disabled with no Process; enabled after one is chosen; changing the Process clears the
  element **before** the new options render.
- **Union + chips** — an `ARRIVING` option carries "Scheduled from", a `LEAVING` one carries "Deleted from"
  **and is selectable**, a `PRESENT` one carries neither. Assert the chip text comes from the response, not
  from a client-side comparison.
- **Scheduled-only** (`scheduledStartDate` set) — zero chips rendered, one notice line.
- **Taken** — an element used by a panel of the **same** group is disabled; the same `elementId` under a
  different `templateGroupId` is not. The panel being edited never disables its own element.
- **Broken** — element absent from `elements[]` → `getProcessGroupElement` is called **once**, the label
  falls back to `elementLabel`, the recovery block renders, and **Save is enabled**. Assert the rendered text
  contains no apology, no error code, and not "orphaned".
- **Broken, no date** — `removedOn: null` → the sentence renders without a date and without an empty
  placeholder such as "on undefined".
- **Markers** — a broken panel's row is marked; collapsing its parent moves the marker up and expanding
  moves it back (this test fails without item 6's `FMTree` change); a group whose elements call rejects
  produces **no** markers.
- **Consumers** — `isPanelLinkedToEnterpriseProcess` is true for `{ templateGroupId, elementId }`;
  `scopeCycleToElement` returns `PROCESS` scope when `elementId === templateGroupId`; a linked panel still
  offers both Enterprise Process widgets through `useFilterWidgets`.

## Definition of done

- `npm run test:unit` and `npm run test:integration` green in `packages/dashboard`; the `packages/bloom`
  `FMTree` specs still pass.
- `grep -rn "processTemplateId" packages/dashboard/lib packages/bloom/sources` returns nothing outside
  cycle-DTO field reads that legitimately belong to the backend contract.
- `getDeployedProcessTemplatesSummary` and the `/templates/{id}/active-cycle` call are gone.
- English locale only — no other language touched.

---

## Implementation notes (2026-08-11)

- **New component instead of inlining in `PanelForm`**: the two dependent selectors, the chips, the taken set and
  the recovery block live in
  `packages/dashboard/lib/components/Panels/PanelConfiguration/components/PanelForm/components/EnterpriseProcessSelect/`
  (mirroring the existing `WorkspaceRights` sibling). `PanelForm` keeps **one** `Form.Item name="enterpriseProcess"`
  wrapping it, so the field value stays a single object and `PanelForm.spec.js`'s form-item count/order is unchanged.
- **No local "selected process" state.** The half-picked state lives in the form value as
  `{ templateGroupId, elementId: null, elementLabel: null }`, which is what makes "changing the Process clears the
  element before the new list arrives" a single `onChange`. Contract 5 requires `elementId`, so the half-state is
  stripped to `null` at the one write choke point — `updatePanels` in `PanelConfiguration.jsx` (the only caller of
  `savePanels`).
- **`brokenPanelIds` is a `useMemo` over `elementsByGroup` + `panels`, not `useState`.** The provider does not unmount
  on a tree re-render, so the requirement's intent (not in tree node state) holds with less code. Failed group loads
  are stored as an explicit `null` so "failed" is distinguishable from "not yet fetched" and never retried per render.
- **`FMTree` publishes expansion but keeps owning it**: `internExpandedKeys` is seeded from the prop once and never
  resyncs, so `PanelsOrder` mirrors the published keys into state purely for the marker roll-up. A parent created
  *after* mount is auto-expanded by `autoExpandParent` without publishing, so newly appearing parent keys are unioned
  into `PanelsOrder`' state to avoid a **false** parent marker.
- **Tests**: `lib/**/*.ispec.js` (PanelConfiguration, PanelsOrder) run under neither `test:unit` (spec only) nor
  `test:integration` (`integration-tests/` only) — they are covered by `npx jest -c jest.config.js`, which was run.

### Deltas from the task file

1. **`PanelActiveCycle.jsx` path** — `lib/components/Panels/PanelActiveCycle/`, as flagged in the invocation.
2. **Two more consumers of `enterpriseProcess.processTemplateId` than the six listed** —
   `widgets/EnterpriseProcess/Timeline/ui/EnterpriseProcessTimelineUI.jsx:25` and
   `widgets/EnterpriseProcess/List/ui/EnterpriseProcessListUI.jsx:25` declare it in their **panel** propTypes (not the
   cycle DTO). Both rekeyed.
3. **"Load elements once per distinct group *on open*"** — the provider mounts with the dashboard and loads panels
   there, not only on modal open. The implemented trigger is "when the distinct set of panel group ids changes",
   which is the same guarantee (one call per group, never per panel) without depending on modal lifecycle.
4. **`panel.enterpriseProcess.placeholder` removed** (superseded by `processPlaceholder` /
   `elementPlaceholder` / `elementPlaceholderNoProcess`); `panel.enterpriseProcess.label` kept as the group label.
5. **Test-harness gaps the task file could not know about**: `PanelForm.spec.js` and `PanelConfiguration.ispec.js`
   had no `userProfile` store slice (`useDateFormat` reads it) and `PanelConfiguration.ispec.js` automocks the api
   module, so the four new/changed api functions had to be stubbed there.

## 5b. `PanelForm` — a process with no live version (S10, added 2026-08-11)

Contract 2 answers `root: null` for a process whose versions are **all archived**, or archived alongside a draft.
Per the PO (BR-29): the process is still listed and still selectable — it is `INACTIVE`, not absent — but it has
no elements to offer.

- Render a warning **under the Process selector**, not on the Element field, and leave the Element selector
  **disabled**: there is nothing to pick, so the user cannot change the element of such a panel.
- If the panel already carries an element on that process, keep rendering `elementLabel` as a disabled option so
  the field still names what it points at. **Do not** call `getProcessGroupElementRemoval` here: the element was
  not removed, the whole process went inactive, and a second warning under the field would say so twice.
- **Save must succeed with nothing changed** (BR-30). The link is unchanged, so `micro-service-ui` skips the
  existence check entirely; the form must carry no failing validation rule that would block Save on this state.
- Same wording contract as BR-9: what happened → what still works → no apology, no code, never "orphaned".

## Implementation notes (2026-08-11)

- `buildEnterpriseProcessTree(root, decorate)` now mirrors the nested `root`; the sibling `flattenEnterpriseProcessTree(root)`
  gives the by-id lookups (`linkedElement`, the picked node's label, `PanelConfiguration`'s broken set).
- `getProcessGroupElement` → `getProcessGroupElementRemoval`, hitting `…/elements/{elementId}/removal`.
- New locale keys `panel.enterpriseProcess.noLiveVersion` / `noLiveVersionDetail`.
- Verified: `npm test` in `packages/dashboard` — 2198 tests, 153 suites, green.
