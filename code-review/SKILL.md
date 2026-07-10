---
name: code-review
description: Perform a comprehensive code review of local services (Java or React) by analyzing Git diffs against origin/develop, optionally comparing them against Azure DevOps work items for functional alignment, and applying quality, design, and testing skills based on service type. Can optionally apply accepted findings via the developer subagent in review-fix mode.
---

# `/code-review` — Service-Scoped Code Review

Use this skill to orchestrate and perform a comprehensive code review of local changes in one or more services under `services/` by comparing them against the `origin/develop` branch, validating against functional requirements in an Azure DevOps work item, and using the specialized `code-reviewer` subagent to generate a detailed report.

## Orchestrator Steps

### 1. Resolve Local Service(s) to Review

- Identify the target service(s) from the user input (e.g., `services/micro-service-master-data` or `micro-service-master-data`, `services/ui-bloom` or `ui-bloom`).
- Map any service name that does not start with `services/` to `services/<service-name>`.
- Verify the directory exists under `services/`. If it is invalid, stop and ask the user for clarification.

### 2. Locate Work Item Context File (Optional)

This step is optional and should only be performed if the user provides or references an Azure DevOps work item:
- Find the work item context file at `features/feature-{ID}-{short-title}/workitem-{ID}-context.md` (or scan the `features/` directory for a subdirectory named `feature-{ID}-*` containing a `workitem-{ID}-context.md` file).
- If a work item ID/reference was provided but the file is not found, advise the user to run the `gather-workitem` skill first to gather the work item details.
- If no work item was provided or referenced, skip this step.
- If found, parse the work item details (ID, title, description, acceptance criteria, parent, related items, comments) from the file and update the chat session name to match the work item/feature title. Extract only what the reviewer needs for functional alignment: the Summary section plus the acceptance criteria. Do not forward full comment threads or attachment contents to the subagent.

### 3. Invoke Code Reviewer Subagent

First compute the report path (see step 7 rules) so the subagent does not have to re-derive it by scanning `features/`.

Invoke the **code-reviewer** subagent with a clear prompt directing it to analyze the resolved service:
```
Perform a code review for service: "<service-name>" (path: "services/<service-name>").
Save the report at: "<computed-report-path>".
```
If work item details are available, also append the instruction to verify functional alignment:
```
Verify functional alignment with the provided work item details.

Context:
<Insert the work item Summary and acceptance criteria here (not the full context file)>
```

**If multiple services are targeted, launch one code-reviewer subagent per service in parallel** (a single message with multiple Agent tool calls) — each service is an independent git repository, so the reviews cannot conflict.

Wait for the subagent(s) to complete execution and return their report(s).

---

## Code Reviewer Subagent Steps

When invoked, the **code-reviewer** agent performs the following tasks:

### 4. Retrieve Changes via Git

Since services under `services/` are separate git repositories, **you must execute all git commands inside the target service directory** (`services/<service-name>`).

1. **Change Directory**: Navigate to the directory `services/<service-name>`.
2. **Fetch Remote Branch**: Run `git fetch origin` to ensure you have the latest remote references.
3. **Identify Comparison Branch**:
   - Check if `origin/develop` exists on remote: `git branch -r | grep origin/develop`.
   - If it exists, use `origin/develop` as the comparison branch.
   - If it does not exist (e.g. for repositories where the main development branch is different), fall back to checking `origin/master` (or the local `develop`/`master` branch).
4. **Get Diff**:
   - **For Java Services**:
     Run the diff command against the identified branch:
     ```bash
     git diff <comparison-branch>
     ```
   - **For ui-bloom Service**:
     1. List modified files:
        ```bash
        git diff --name-only <comparison-branch>
        ```
     2. Identify which specific package directories under `packages/<package-name>/` contain modifications.
     3. For each changed package, retrieve its specific diff:
        ```bash
        git diff <comparison-branch> -- packages/<package-name>
        ```
     4. Exclusively focus on these package-specific diffs during the review.

### 5. Identify and Activate Review Skills

Analyze the type of each service and the changes introduced to select and apply the most relevant skills.

**Token discipline**: each activated skill loads its full instructions into context, so activate only skills whose trigger condition is actually met by the diff, and cap activation at the **5 most relevant** skills per service. The catalogs below map change types to skills — treat the conditions ("if X is modified") as strict gates, not suggestions. The two always-on baselines for Java are `121-java-object-oriented-design` and `123-java-exception-handling`; everything else must be justified by the diff content.

#### Java Services (indicated by `pom.xml` files)
- **Maven Configuration & Build**: `110-java-maven-best-practices` if `pom.xml` is modified.
- **Design & Hierarchy**: `121-java-object-oriented-design` and `122-java-type-design`.
- **Error & Exception Handling**: `123-java-exception-handling` if try/catch/throw blocks are added or modified.
- **Security & Validation**: `124-java-secure-coding` if input validation, SQL/JPQL queries, or authentication mechanisms are involved.
- **Concurrency**: `125-java-concurrency` if threading, executors, or CompletableFuture/Virtual Threads are used.
- **Generics**: `128-java-generics` if collection types or generic signatures are changed.
- **Modern Features**: `141-java-refactoring-with-modern-features` and `142-java-functional-programming` (e.g., Streams, Optionals, Records).
- **Functional Exception Handling**: `143-java-functional-exception-handling` (e.g., Either pattern).
- **Data-Oriented Programming**: `144-java-data-oriented-programming` for records and pure functions.
- **Observability & Logging**: `180-java-observability-logging` for logger usage.
- **Spring Boot & REST**: `301-frameworks-spring-boot-core` and `302-frameworks-spring-boot-rest` for annotations, REST controllers, DTO mapping.
- **Database & Persistence**: `311-frameworks-spring-jdbc`, `312-frameworks-spring-data-jdbc`, and `313-frameworks-spring-db-migrations-flyway` if JDBC queries, records mapping, or Flyway migrations are modified.
- **APIs & Testing**: `701-technologies-openapi`, `702-technologies-wiremock`, `component-test-cucumber`, or `service-components-tests` if mock configurations or tests are modified.

#### ui-bloom / React Services (indicated by `package.json` in `ui-bloom/packages/*`)
- **React Patterns & Performance**: `vercel-react-best-practices` (hooks, hydration, React performance).
- **UI Styling & Aesthetics**: `web-design-guidelines` (visual design, CSS, responsiveness, accessibility).
- **Component & Integration Testing**: `ui-bloom-component-tests` for Jest, RTL, or Enzyme test suites.

### 6. Perform Code Analysis & Generate Report

- Review the diff line by line. Do not rely on high-level summaries.
- Apply rules and best practices from the activated skills to pinpoint issues.
- **Functional Alignment**:
  - If a work item is provided, compare the code changes against the retrieved work item's description and acceptance criteria. Verify that the implementation addresses all requirements and handles necessary edge cases or business logic, calling out any discrepancies, missing requirements, or gaps.
  - If no work item is provided, skip this comparison.
- Create a single detailed review report (saved in the workspace per step 7 — no duplicate copy elsewhere).
- **Every finding must be self-contained and actionable**: assign a stable ID (`CR-1`, `CR-2`, … numbered across the whole report), and include severity (`Critical` / `Recommended` / `Minor`), the affected `file:line`, a one-sentence rationale, and an inline Before/After code block showing the fix. Do not repeat findings in a separate recommendations section — the finding IS the recommendation. These IDs are consumed by the apply-recommendations workflow (step 9).
- Organize the report using the following structure:
  - **Summary Table**: Service(s) reviewed, changed packages, related Azure DevOps work item (specify ID, or "None"), activated review skills, and finding counts per severity.
  - **Functional Alignment**: Specific assessment of whether the code changes fulfill each acceptance criterion, along with any functional gaps found. (Skip or mark as "Not Applicable" if no work item was provided).
  - **Critical Findings (Must Fix)**: Bugs, resource/memory leaks, security vulnerabilities, or major architectural design violations.
  - **Recommended Improvements**: Performance gains, functional programming patterns, and OOP design refactorings.
  - **Minor — Style, Logging & Clean Code**: Logging levels, naming conventions, and readability.
  - **Test Coverage**: Assessment of modified or missing unit/component/integration tests (missing tests are findings too — give them IDs).

### 7. Save Report in Workspace

- Save the final report at the path provided by the orchestrator in the invocation prompt. Path rules (used by the orchestrator in step 3):
  - **If a work item is provided**: `reviews/review-{ID}-{short-title}/review-{ID}-{short-title}.md`. `{ID}` must be the resolved Azure DevOps work item ID, and `{short-title}` must be a kebab-case slugified version of the work item title (e.g., `upgrade-springboot` for "Upgrade Spring Boot").
  - **If no work item is provided**: `reviews/review-{service-name}/review-{timestamp}.md` (e.g., `reviews/review-micro-service-master-data/review-20260703.md`).
- Ensure the parent directory is created automatically.
- Return a compact summary as your final message: report path, finding IDs grouped by severity (e.g., `Critical: CR-1, CR-3 | Recommended: CR-2, CR-4`), and one line per Critical finding. The orchestrator uses this without re-reading the full report.

---

## Orchestrator Follow-up Steps

### 8. Present the Report

- Once the subagent finishes, provide a clickable link to the generated workspace report file.
- Give a brief, high-level summary of the critical findings and functional alignment (if applicable) in the chat response. Keep the chat response short and direct the user to the report for detailed recommendations.

### 9. Apply Recommendations (Optional — Developer Subagent)

If the review produced findings, ask the user (via AskUserQuestion) whether to apply them:
- **Critical only** (recommended)
- **Critical + Recommended**
- **Let me pick** — user supplies specific finding IDs
- **No, review only**

If the user opts in:

1. Invoke the **developer** subagent in **review-fix mode**, one subagent per service (in parallel if several services are involved), with a prompt of this shape:
   ```
   Review-fix mode for service: "<service-name>" (path: "services/<service-name>").
   Apply the following findings from the review report at "<report-path>": <CR-1, CR-3, ...>.
   Apply only these findings, following each finding's Before/After snippet. Run the service's
   build and tests afterwards, and append a "## Fix Log" section to the report recording each
   finding as Applied or Skipped (with reason).
   ```
2. Do NOT paste the full report into the prompt — the developer subagent reads the report file itself; only the path and the selected finding IDs go in the prompt.
3. When the subagent(s) return, summarize in chat: which findings were applied, which were skipped and why, and the build/test result. If the build or tests fail after fixes, report the failure — do not silently retry with broader changes.
4. Suggest (but do not run automatically) a re-review of only the touched files if any Critical finding was applied.
