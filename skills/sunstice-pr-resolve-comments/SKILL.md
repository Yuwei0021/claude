---
name: sunstice-pr-resolve-comments
description: Fetch unresolved (Active) comments on your open PR via Azure DevOps MCP and address each locally, without posting anything back to the PR.
disable-model-invocation: true
---

# `/sunstice-pr-resolve-comments` — Address unresolved PR comments

Fetch unresolved (Active) comments on your open PR via Azure DevOps MCP and address each one locally.

> **Read-only on the PR**
> This skill **never writes to the PR**. Do not reply to threads, do not change thread status (Fixed/Closed/WontFix), do not comment on the PR — no `repo_pull_request_thread_write`, `repo_pull_request_write`, or any other MCP write call. Azure DevOps MCP usage is read-only; all outcomes are reported in chat so the user posts the replies themselves.

> **Delegation & models**
> - **Steps 1–3** (verify MCP, identify PR, fetch threads) are plain Azure DevOps MCP calls. Delegate them to a subagent running on **Haiku** (`general-purpose` agent, `model: haiku`) so raw PR payloads stay out of the main context. The subagent returns only the structured list of Active threads. Do **not** use the `workitem-gatherer` agent — it gathers Azure DevOps *work items*, not PR comment threads.
> - **Step 4 and step 5 code changes** are applied by the **developer** agent, scoped to the service that owns the changed file.

## Steps

### 1–3. Fetch unresolved threads (Haiku subagent)

Invoke a `general-purpose` subagent with `model: haiku` to perform the following and return a structured result:

1. **Verify MCP**: call an Azure DevOps MCP tool. If unavailable, stop: *"Azure DevOps MCP server is unavailable."*
2. **Identify the PR**: if the user specifies a PR ID or repo, use it. Otherwise, list open PRs (`created_by_me: true`, `status: Active`) and match by branch name or work item ID from the branch. If multiple match, report them for the user to choose; if none found, fail.
3. **Fetch unresolved threads**: use `repo_pull_request_thread` with `action: "list"` and `status: "Active"`, passing the `repositoryId` and `pullRequestId` from step 2 (`project` is required too when `repositoryId` is a name rather than a GUID). If none, report *"No unresolved comments on this PR."*

The subagent's return value must be, for each Active thread: `threadId`, the **author** (`displayName` and `uniqueName`), `filePath`, `rightFileStartLine` (and other position fields), and the full comment text. It must not echo raw MCP payloads.

Then split the threads by author. This decides how each one is handled, so do it before touching any code:

- **`FMBUILD`** (`FMBUILD@futurmaster.com`) — Sonar static analysis. Its comments name a rule (`javascript:S1082`) and carry `[ISSUE_KEY]` and `[PROJECT_KEY]` markers. Step 4.
- **Everyone else** — a human reviewer. Step 5, one at a time.

### 4. FMBUILD threads — fix them without asking

Sonar findings are mechanical: a named rule, one location, a known fix. Group them by owning service (from each `filePath`) and invoke the **developer** agent once per service with the whole list, so one service is not visited three times.

```
Apply these Sonar findings in service "<service-name>" (path: "services/<service-name>").
Each is a rule violation at a fixed location — fix the cause, change nothing else.
<per finding: threadId, rule key, file:line, the rule text>
```

**Two exceptions come back to the user instead of being fixed.** Do not decide either one yourself:

- **The fix would change behaviour or needs a design choice.** `javascript:S6848` ("avoid non-native interactive elements") can mean adding `role` and a key handler, or restructuring the element into a real link — those are different products. Bring it to step 5 as a question with your recommendation.
- **You judge the rule wrong here.** Sonar has false positives. Say which finding, why, and what thread status you would suggest (`WontFix` / `ByDesign`), and let the user decide.

Report what was fixed as one block, not thread by thread — this half needs no decisions from the user.

### 5. Human threads — one at a time, user decides

**Analyse before you ask.** For each thread, open the file at the given line and read the code around it. A recommendation not grounded in the code is a guess, and the reviewer who wrote the comment can already read the diff — what you add is whether they are right.

Then ask the user about **one thread**, wait for the answer, act on it, and only then move to the next. Never present all threads at once and never batch the decisions: the point is that each one gets a real answer.

For each thread, give the user this, short:

1. **Who and where** — author, `file:line`, and the comment in one sentence of your own words.
2. **Is it right?** Your reading of the code, with the `file:line` you checked. Say plainly when the reviewer is correct, when they are correct but the case cannot be reached today, and when they are wrong.
3. **What the fix would be** — the change in one or two sentences, and whether it changes behaviour a caller can observe.
4. **Your recommendation**, and why.

Then use AskUserQuestion with these options:

- **Apply the fix** — invoke the **developer** agent scoped to the owning service.
- **Reply, no code change** — you draft the answer, the user posts it.
- **Decline** — draft the reasoning and the status you would suggest (`WontFix` / `ByDesign`).
- **Skip for now** — leave it open, record it as unresolved.

The user's answer decides. If you disagree with the choice, say so in one line and then do what they asked.

If the comment is unclear even after reading the code, say so and ask the user what the reviewer meant — do not guess an interpretation and act on it.

The developer agent only changes code inside its own service. Nothing is ever sent back to Azure DevOps.

### 6. Summary (chat only)

Every reply you draft is text a colleague will read on the pull request. Write for a reader whose first language is not English: short sentences, common words, active voice. No idioms and no metaphors — say the literal thing. Real technical terms stay (index, migration, race condition, optimistic lock, merge-base); rare general-purpose words do not.

Report in chat, per thread: `threadId`, file/line, the author, what was done (fixed in code / answered / declined / left open), and the **reply text and thread status** for the user to post by hand. Keep the FMBUILD threads as one group and the human threads listed separately — they need different follow-up.

End with the build and test result for every service that was touched, and say clearly that no reply and no status change was made on the PR.
