# Work Item 56138: Link a panel with an edited and deployed process template version

## Summary

User Story 56138 extends the panel↔Enterprise Process element association to support version-aware linking and deployment cycles. When a panel links to an Enterprise Process element, users must be able to select from Active, Scheduled, and Inactive process templates with clear indicators when elements are arriving (scheduled) or leaving (removed). The union of Active and Scheduled versions' elements is shown; elements removed in the Scheduled version remain selectable but carry a "Deleted from {date}" chip. When a Scheduled version deploys and becomes Active, if the linked element no longer exists, the panel link is preserved (never auto-unlinked) and surfaces a broken-binding warning in both the panel list (with propagation to collapsed parents) and the panel form. Recovery messaging follows a strict wording pattern: state what happened, explain the panel still exists with content intact, describe the loss of cycle date attachment, then offer "Choose another element" as the sole action. No apologies, error codes, or the word "orphaned." This completes the versioned process lifecycle (Feature 54451) by making panel configurations deployment-aware.

## Metadata

| Field | Value |
|-------|-------|
| **Work Item ID** | 56138 |
| **Type** | User Story |
| **Title** | Link a panel with an edited and deployed process template version |
| **State** | In Progress |
| **Assigned To** | Yuwei Luo (yuwei.luo@sunstice.com) |
| **Created By** | Walid Dellali (walid.dellali@sunstice.com) |
| **Created Date** | 2026-07-23T12:43:44.9Z |
| **Changed Date** | 2026-08-11T08:40:50.55Z |
| **Effort** | 8 points |
| **Area Path** | FuturMaster\Nexus\Enterprise Process |
| **Iteration Path** | FuturMaster\Nexus\Release 2026.R5\Sprint 2026.R5.4 |
| **Parent Feature** | 54451 — Edit a deployed Enterprise process |
| **Priority** | 1: Required to meet the need of at least one customer (pilot) |
| **aHaID** | PROD-4650-7 |
| **Release** | FM_2026.R5 |

## Description

**As a** Project Consultant or Process Owner (configuring a dashboard panel)

**I want**, when linking a panel to an Enterprise Process element, to pick from a process that has an edited version scheduled for a future deployment — with elements that are arriving or leaving clearly marked — and, if a new version later removes the element my panel points to, to be told plainly and given one way to recover

**So that** I can prepare panel configuration ahead of a deployment, and a panel never silently becomes blank when the process changes

This story extends the panel↔element association (US 55537 / 55538) and active-cycle display (US 55539 / 55540) to be version-aware and broadens the current Active-only selection rule (US 55537 R°4).

### Business Rules

**R°1:** The "Enterprise process element" input is split into two dependent selectors — **Process** and **Element**. Element stays empty until a Process is selected.

**R°2:** The Process selector lists templates that are **Active**, **Scheduled**, or **Inactive**; never-deployed Draft-only templates are not listed.

**R°3:** For the selected process, the Element selector shows the process node plus its phases and steps. When the process has a **Scheduled** version alongside its **Active** one, the list shows the **union** of both versions' elements. An element present in both versions shows plainly.

**R°4:** An element existing **only in the Scheduled** version (arriving) carries a chip **"Scheduled from {scheduled version's deployment start date}"**.

**R°5:** An element in the **Active** version but **removed by the Scheduled** version (leaving) carries a chip **"Deleted from {scheduled version's deployment start date}"** and stays selectable.

**R°6:** An element already linked to another panel stays greyed / disabled in the union list (one-panel-per-element, US 55537 R°5).

**R°7:** A panel links to a process element and keeps that link across redeployments.

**R°8:** When a Scheduled version activates and the panel's linked element no longer exists in the now-active version, the link is **kept** and the broken binding surfaces in **two places at once**:
- **(a) Panel list** — the element row shows a warning marker; when its branch is collapsed, the marker **rides up to the parent**, so a broken binding is findable without expanding every branch.
- **(b) Panel form** — the Element selector shows the linked element name followed by **"(no longer exists)"**, with an inline recovery block beneath it.

**R°9:** The recovery block and every message for this state follow one wording rule — **state what happened, then what still works, then the one action**; no apology, no error code, never the word "orphaned". Reference wording: *"This element was removed from {process} on {date}."* → *"The panel is still here and keeps its content — it just isn't attached to a step of the process anymore, so it shows no cycle dates. Pick another element, or leave it unattached."* → **[Choose another element]**. The panel is never auto-unlinked.

### Status Notes — Two Distinct Statuses

- **Inactive** (template-level): a deployed template whose **end date has been reached** as expected; its run has ended.
- **Archived** (version-level): when a template is edited into a **new version that is deployed and whose activation date is reached**, the **previous** version is archived (superseded), retained for traceability.

## Acceptance Criteria

```
Scenario: Display an empty Enterprise Process association
  Given the panel is not associated with an Enterprise Process element
  When the panel configuration form is displayed
  Then the Process selector is empty
  And the Element selector is empty

Scenario: Select an Enterprise Process before selecting an element
  Given the panel is not associated with an Enterprise Process element
  And no Enterprise Process is selected
  When the user selects an Enterprise Process
  Then the Element selector becomes available
  And the user can select an element belonging to the selected Enterprise Process

Scenario: Display the existing Enterprise Process association
  Given the panel is associated with an Enterprise Process element
  When the panel configuration form is displayed
  Then the Process selector displays the linked Enterprise Process
  And the Element selector displays the linked element

Scenario: Clear the element selection when changing the Enterprise Process
  Given an Enterprise Process is selected
  And an element of this Enterprise Process is selected
  When the user selects another Enterprise Process
  Then the Element selector is cleared
  And the Element selector contains only elements from the newly selected Enterprise Process

Scenario: Display Active, Scheduled and Inactive Enterprise Processes
  Given the panel configuration form is displayed
  And Enterprise Process templates exist with Active, Scheduled and Inactive statuses
  When the user opens the Process selector
  Then Active Enterprise Process templates are listed
  And Scheduled Enterprise Process templates are listed
  And Inactive Enterprise Process templates are listed

Scenario: Do not display Draft-only Enterprise Processes
  Given the panel configuration form is displayed
  And an Enterprise Process template has never been deployed and is in Draft status
  When the user opens the Process selector
  Then the Draft-only Enterprise Process template is not listed

Scenario: Do not display Archived Enterprise Process versions
  Given the panel configuration form is displayed
  And an Enterprise Process version is Archived
  When the user opens the Process selector
  Then the Archived Enterprise Process version is not listed

Scenario: Display the elements of the selected Active Enterprise Process
  Given an Active Enterprise Process is selected
  And the Enterprise Process contains a process node
  And the Enterprise Process contains phases and steps
  When the user opens the Element selector
  Then the process node is displayed
  And the phases are displayed
  And the steps are displayed

Scenario: Display the union of Active and Scheduled Enterprise Process elements
  Given an Active Enterprise Process is selected
  And the Enterprise Process has a Scheduled version
  And an element exists in the Active version
  And another element exists only in the Scheduled version
  When the user opens the Element selector
  Then the elements from both versions are displayed
  And each element present in both versions is displayed only once

Scenario: Display an element present in both Active and Scheduled versions without a status indicator
  Given an Active Enterprise Process is selected
  And the Enterprise Process has a Scheduled version
  And an element exists in both versions
  When the user opens the Element selector
  Then the element is displayed once
  And the element has no Scheduled or Deleted status indicator

Scenario: Mark an element arriving in the Scheduled version
  Given an Active Enterprise Process is selected
  And the Enterprise Process has a Scheduled version
  And an element exists in the Scheduled version
  And the element does not exist in the Active version
  When the user opens the Element selector
  Then the element is displayed
  And the element has a "Scheduled from {scheduled version's deployment start date}" chip

Scenario: Mark an element removed by the Scheduled version
  Given an Active Enterprise Process is selected
  And the Enterprise Process has a Scheduled version
  And an element exists in the Active version
  And the element does not exist in the Scheduled version
  When the user opens the Element selector
  Then the element is displayed
  And the element has a "Deleted from {scheduled version's deployment start date}" chip
  And the element remains selectable

Scenario: Disable an element already linked to another panel
  Given an Enterprise Process element is displayed in the Element selector
  And the element is already linked to another panel
  When the user opens the Element selector
  Then the element is displayed as disabled
  And the user cannot select the element

Scenario: Preserve the panel association when the linked element still exists after redeployment
  Given a panel is linked to an Enterprise Process element
  And a Scheduled version of the Enterprise Process contains the same element
  When the Scheduled version is deployed and becomes Active
  Then the panel remains linked to the same Enterprise Process element

Scenario: Keep the panel association when the linked element is removed after redeployment
  Given a panel is linked to an Enterprise Process element
  And a Scheduled version of the Enterprise Process does not contain the linked element
  When the Scheduled version is deployed and becomes Active
  Then the panel remains linked to the removed Enterprise Process element
  And the panel is not automatically unlinked

Scenario: Display a warning for a broken panel binding in the panel list
  Given a panel is linked to an Enterprise Process element
  And the linked element has been removed from the newly active Enterprise Process version
  When the panel list is displayed
  Then the panel row displays a warning marker

Scenario: Propagate the warning marker to a collapsed parent
  Given a panel is linked to an Enterprise Process element
  And the linked element has been removed from the newly active Enterprise Process version
  And the panel belongs to a branch that is collapsed
  When the panel list is displayed
  Then the parent row displays the warning marker

Scenario: Display a broken binding in the panel form
  Given a panel is linked to an Enterprise Process element
  And the linked element has been removed from the newly active Enterprise Process version
  When the panel configuration form is displayed
  Then the Element selector displays the linked element name followed by "(no longer exists)"
  And the recovery block is displayed below the Element selector

Scenario: Inform the user about a removed element and provide recovery
  Given a panel is linked to an Enterprise Process element
  And the linked element has been removed from the newly active Enterprise Process version
  When the panel configuration form is displayed
  Then the recovery message states what happened
  And the recovery message states that the panel and its content are still available
  And the recovery message states that the panel is no longer attached to a process element
  And the recovery message states that no cycle dates are displayed
  And the "Choose another element" action is available

Scenario: Use the required wording for a broken binding message
  Given a panel is linked to an Enterprise Process element
  And the linked element has been removed from the newly active Enterprise Process version
  When the recovery message is displayed
  Then the message contains "This element was removed from {process} on {date}."
  And the message explains that the panel is still available and keeps its content
  And the message explains that the panel is no longer attached to a process element
  And the message explains that no cycle dates are displayed
  And the message provides "Choose another element" as the recovery action
  And the message does not contain an apology
  And the message does not contain an error code
  And the message does not contain the word "orphaned"

Scenario: Keep the panel content when its linked element is removed
  Given a panel is linked to an Enterprise Process element
  And the linked element has been removed from the newly active Enterprise Process version
  When the new Enterprise Process version becomes Active
  Then the panel remains available
  And the panel content is preserved
  And the panel remains linked to the removed element
```

## Comments

No comments on this work item.

## Links and Relations

| Type | Target | ID | Title |
|------|--------|----|----|
| Parent | Feature | 54451 | Edit a deployed Enterprise process |

### Related User Stories (referenced in description)

- **US 55537** — Panel ↔ Element association (baseline)
- **US 55538** — Panel ↔ Element association (continuation)
- **US 55539** — Active-cycle display (part 1)
- **US 55540** — Active-cycle display (part 2)

## Implementation Scope

### Affected Services

- **ui-bloom** (React) — Panel configuration form UI, Process and Element selectors, broken-binding warning display, recovery messaging
- **micro-service-enterprise-process** (Java) — API endpoints for template status queries (Active/Scheduled/Inactive), element union computation for versioned processes, validation that linked elements exist in active versions

### Key Constraints

1. **Panel links persist across redeployments** — even if the linked element is removed, the link is preserved and never auto-unlinked.
2. **Strict recovery wording** — follow the reference pattern exactly; no apologies, error codes, or "orphaned" terminology.
3. **Broken-binding visibility** — warnings must propagate to collapsed parent rows in the panel tree; not just inline in the form.
4. **Union-based element list** — when both Active and Scheduled versions exist, show all unique elements with status chips indicating arrival/removal.
5. **One-panel-per-element constraint** — elements linked to other panels are disabled in the selector (inherited from US 55537 R°5).
