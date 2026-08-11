Service: micro-service-ui
Model: sonnet
Complexity: normal

# US 56138 — a panel links to a logical process, not to one version

Read `features/feature-56138-link-panel-edited-process-template/feature-56138-link-panel-edited-process-template.md`
first — the **Cross-service contracts** section is frozen. If a shape looks wrong, **stop and report**.

**No new endpoint.** Schema rekey, duplicate query rekey, and a rewrite of the enterprise-process validation
that currently makes the feature impossible.

## Already verified — do not re-derive

| Fact | Where |
|---|---|
| Panel holds `enterpriseProcess: { processTemplateId (required), elementId (required) }`, default `null` | `sources/models/Panel.js:81-87` |
| Duplicate check queries the pair | `sources/services/panel/panel-repository.js:19-26` |
| `validateEnterpriseProcess` runs on `createPanel` and `updatePanel` | `sources/services/panel/panel-service.js:187,205` |
| **The configuration modal saves through the batch path**, `PUT /panels` → `updatePanels` → `assertBatchEnterpriseProcess` | `panel-service.js:243`, `sources/routes/panel-route.js:8` |
| `updatePanels` already loads `existingPanels = await getPanels()` before validating — the stored link is in hand for free | `panel-service.js:227` |
| `importPanels` → `createNewPanels` / `editOldPanels` is a **third** caller of `validateEnterpriseProcess` | `panel-service.js:305,318` |
| `assertEnterpriseProcessDeployed` throws unless `template?.status === 'ACTIVE'`, and matches the element against `template.id` / phase / step ids | `sources/services/panel/enterpriseProcess-service.js:23-43` |
| `assertEnterpriseProcessElement` throws "module is not enabled" **before** any other check | `enterpriseProcess-service.js:52-61` |
| A validation throw becomes a 400 for the **whole** request | `sources/controllers/panel/panel-controller.js:53` |
| `findByIdAndUpdate` runs with `runValidators: true` | `panel-repository.js:29-37` |
| `getPanels()` is `Panel.model.find()` — every panel, no rights filter | `panel-repository.js:3-5` |

## Work items, in order

### 1. Schema

`sources/models/Panel.js` — `enterpriseProcess` becomes:

```
{ templateGroupId: required String, elementId: required String, elementLabel: String }
```

`elementLabel` is **not required**. A third required key would make the next write of any pre-existing
document fail validation; the label is a display fallback, not an identity.

There is no production data and no migration: dev panels carrying the old shape are deleted and recreated
by hand. Do not write a backfill script.

### 2. Duplicate query

`panel-repository.findByEnterpriseProcess(templateGroupId, elementId)` — same shape, new field name.

### 3. The validation rewrite — `sources/services/panel/enterpriseProcess-service.js`

This is the whole point of the task. Three rules, applied identically on **all three** write paths.

- **Delete the `status !== 'ACTIVE'` guard.** BR-2 lists inactive processes too; the status of a version is
  no longer the panel's business.
- **Existence is checked only when the link changes.** Compare the incoming `(templateGroupId, elementId)`
  with the panel's stored pair; equal → skip existence entirely. This is what lets a user save a panel whose
  element was removed by a deployment **without** applying the recovery — the AC "the panel is not
  automatically unlinked" is false if any save path rejects a broken link.
- **The "module is not enabled" guard fires only on a changed link too.** It currently throws first, so with
  `FUTURMASTER_ENTERPRISE_PROCESS_SERVICE_URL` unset an already-linked panel becomes permanently unsaveable.

Existence, when it does run, is checked against the frozen contract:
`GET {ENTERPRISE_PROCESS_URL}/template-groups/{templateGroupId}/elements` → the element must appear in
`elements[]`. **Not** `/templates/summaries/{id}` — that returns one version and cannot answer the union.
`404` from that call → "The associated enterprise process element does not exist."

**`fetchEnterpriseProcessTemplate` (`enterpriseProcess-service.js:8-21`) is rewritten to call the new
endpoint, not kept alongside it.** Nothing in this service should still request `/templates/...`.

The `elementId === template.id` process-node check disappears: the process node's id **is** the
`templateGroupId`, so it is simply one entry of `elements[]`.

The duplicate check (`assertEnterpriseProcessNotTaken`) still runs on **every** save, rekeyed.

### 4. `assertBatchEnterpriseProcess` — the path the product actually uses

Same three rules. It needs the stored links to compare against; `updatePanels` already has `existingPanels`,
so pass a `Map<panelId, storedEnterpriseProcess>` into it rather than re-querying.

- Its in-request dedup key becomes `${templateGroupId}::${elementId}`.
- Its `templateCache` keys on `templateGroupId` and caches the `/elements` promise.
- Keep it all-or-nothing. With existence checked only on a *changed* link, and links only ever chosen from
  the contract's own list, a rejection means a client bug — not one stale panel blocking a dashboard save.

### 5. Import path

`createNewPanels` / `editOldPanels` call `validateEnterpriseProcess` per panel. They get item 3's behaviour
for free — verify it, and make sure an imported panel with no stored counterpart is treated as a **changed**
link (so a bogus import is still rejected).

## Files

**Modify** — `sources/models/Panel.js`, `sources/services/panel/panel-repository.js`,
`sources/services/panel/enterpriseProcess-service.js`, `sources/services/panel/panel-service.js`
(pass the stored links into the batch assert), `sources/services/panel/panel-service.spec.js`,
and any fixture using `processTemplateId` (`grep -rn processTemplateId sources/`).

**Create** — none.

## Tests (jest, alongside `panel-service.spec.js:1001` "enterpriseProcess association")

- Save a panel whose stored element **no longer exists in the union** and whose link is **unchanged** →
  succeeds, no call to `/elements`. This is the AC that fails today and it must be asserted on **both**
  `updatePanel` and the batch `updatePanels`.
- Same panel, link **changed** to an element absent from the union → rejected.
- A process whose group status is `INACTIVE` → link accepted (the old `ACTIVE` guard is gone).
- Process-node link: `elementId === templateGroupId` → accepted, matched from `elements[]`.
- Module URL unset + unchanged link → save succeeds; module URL unset + new link → rejected with the
  "not enabled" message.
- Duplicate: two panels, same `(templateGroupId, elementId)` → rejected; same `elementId` under **different**
  groups → accepted.
- Batch: one panel with an unchanged broken link and one with a valid new link → both persist.

## Implementation notes

Implemented as specified, with one clarification not spelled out in the plan: `validateEnterpriseProcess`
(the single-panel path used by `createPanel`/`updatePanel` and the import path) determines "changed" by
loading the panel's current stored document via `panelRepository.findById(currentPanelId)` when an id is
given (no lookup, i.e. always "changed", when there is none — covers `createPanel` and a brand-new import
row). The batch path (`assertBatchEnterpriseProcess`) instead takes a `Map<panelId, storedEnterpriseProcess>`
built by `updatePanels` from the `existingPanels` it already loads, per the task file's item 4. Field
validation (`templateGroupId`/`elementId` present) and the duplicate check always run, regardless of whether
the link changed; only the module-enabled guard and the existence check are gated on "changed".

`fetchEnterpriseProcessTemplate` was renamed to `fetchEnterpriseProcessElements` (it now returns the
`/elements` union payload, not a template) rather than kept under its old name — same rewrite the task
mandated, just with a name matching what it now does.

Eslint could not be run (`npm run eslint` fails in this environment with "ESLint couldn't find an
eslint.config.(js|mjs|cjs) file" — the repo has no flat config and no `.eslintrc.*`, ESLint is v9). This is
a pre-existing environment gap, unrelated to this change; `npm run ci-test` (205/205 passing) was used to
verify instead.

## Definition of done

- `npm run ci-test` green, `npm run eslint` clean.
- `grep -rn "processTemplateId" sources/` returns nothing outside comments.
- No new route in `sources/routes/`.
- `services/micro-service-ui/AGENTS.md` gains a bullet: the panel↔process link is
  `{ templateGroupId, elementId, elementLabel }`, validated against enterprise-process only when it changes.

## Review revision (2026-08-11) — contract 2 changed shape

`GET /template-groups/{g}/elements` no longer returns a flat `elements[]`. It returns
`{ templateGroupId, name, scheduledStartDate, root }` where `root` is a **nested** node tree
(`{ id, name, level, state, effectiveDate, children[] }`) and is **`null`** when the group has neither an ACTIVE
nor a SCHEDULED version.

- `assertEnterpriseProcessDeployed` (`sources/services/panel/enterpriseProcess-service.js`) must walk the tree
  instead of reading `template.elements` — today `elements.some(...)` over `undefined` would reject every link.
- A `null` root means no element resolves. That is the correct answer for a **changed** link: an inactive process
  offers no elements, so a newly-picked one cannot be valid. It must never reject an **unchanged** link — the
  existing `isEnterpriseProcessLinkChanged` guard already ensures that, and BR-30 depends on it.
- The removal sub-resource moved to `…/elements/{elementId}/removal`, but `micro-service-ui` does not call it —
  only `ui-bloom` does. No change needed there.
