# Evaluation Run 3: Rubric Scores

**Date:** 2026-03-13
**Tool:** SpinybackedOrbWeaver (stale build — see advisory)
**Branches:** `orb/instrument-1773434669510` (main run), `orb/instrument-1773438620295` (supplemental)
**Codebase:** commit-story-v2-eval (21 JavaScript files)
**Evaluator:** Human + LLM-assisted code review

> **Stale build advisory:** Run-3 evaluated an old `dist/` build. Fixes #61 (mega-bundle), #64 (tracer naming), #65 (span naming) were merged to source but `npm run prepare` was never run. API-003, CDQ-008, and SCH-001 failures are expected repeats. See PRD #3 decision log for details.

---

## Summary

| Metric | Value |
|--------|-------|
| **Gate checks** | 4/4 PASS |
| **Quality rules** | 19/26 PASS (73%) |
| **Per-dimension scores** | NDS 2/2, COV 6/6, RST 4/4 (+1 N/A), API 1/3, SCH 2/4, CDQ 4/7 |
| **Strongest dimensions** | Non-Destructiveness (100%), Coverage (100%), Restraint (100%) |
| **Weakest dimension** | API-Only Dependency (33%) |
| **Files instrumented** | 11/21 |
| **Files correctly skipped** | 6/21 |
| **Files failed** | 4/21 |
| **Manual patches required** | 0 |
| **Wall-clock time** | 2,140s (35.7 min) main + 1,003s (16.7 min) supplemental |
| **PR artifact** | Failed (git push auth) — branches exist locally |

---

## Gate Checks (4/4 PASS)

All gates pass. Quality scoring proceeds.

### NDS-001: Compilation / Syntax Validation Succeeds — PASS

**Scope:** Per-run | **Impact:** Gate | **Method:** `node --check` on all instrumented files

All 11 instrumented files pass `node --check` syntax validation on both orb branches.

### NDS-002: All Pre-Existing Tests Pass — PASS

**Scope:** Per-run | **Impact:** Gate | **Method:** `npm test`

All 320 tests pass (320/320, 100% passed, 0% skipped, 0% failed). No test modifications. The agent's instrumentation introduced no behavioral regressions.

### NDS-003: Non-Instrumentation Lines Unchanged — PASS

**Scope:** Per-file | **Impact:** Gate | **Method:** Diff analysis of all 11 instrumented files

All changes across 11 instrumented files are instrumentation-related:
- Import additions (`import { trace, SpanStatusCode } from '@opentelemetry/api'`)
- Tracer acquisition (`const tracer = trace.getTracer(...)`)
- `startActiveSpan` wrappers with try/catch/finally
- `span.setAttribute` / `span.recordException` / `span.setStatus` / `span.end` calls
- Re-indentation of existing code within span callbacks

No business logic was modified, removed, or reordered.

**Note:** 2 of the 4 failed files (context-integrator.js, journal-manager.js) were rejected by orb's NDS-003 validation — the agent attempted non-instrumentation changes. The gate correctly caught and rejected these, so they appear as failures rather than gate violations.

### API-001: Only `@opentelemetry/api` Imports — PASS

**Scope:** Per-file | **Impact:** Gate | **Method:** Grep all instrumented source files for `@opentelemetry` imports

All 11 instrumented source files import only `@opentelemetry/api`. No SDK, exporter, or instrumentation package imports in application source files.

**Important distinction:** This gate evaluates *source files* (the files the agent instruments). The `instrumentation.js` SDK setup file and `package.json` dependency declarations are evaluated under the API dimension quality rules (API-002, API-003, API-004), not this gate.

---

## Dimension 1: Non-Destructiveness (NDS) — 2/2 PASS (100%)

### NDS-004: Public API Signatures Preserved — PASS

**Scope:** Per-file | **Impact:** Important

All exported function signatures unchanged across 11 instrumented files. The agent wraps function bodies with `tracer.startActiveSpan()` callbacks but does not modify parameter lists, return types, or export declarations.

**Evidence:** `collectChatMessages(repoPath, commitTime, previousCommitTime)` in claude-collector.js, `getPreviousCommitTime(commitRef)` and `getCommitData(commitRef)` in git-collector.js, `getAllGuidelines()` in guidelines/index.js, `filterMessages(messages)` in message-filter.js, `truncateMessages(messages, maxTokens)` and `applyTokenBudget(context, options)` in token-filter.js, `registerContextCaptureTool(server)` and `registerReflectionTool(server)` in MCP tools, `ensureDirectory(filePath)` in journal-paths.js, `getChangedFiles(commitRef)` / `isMergeCommit(commitRef)` / `getCommitMetadata(commitRef)` in commit-analyzer.js — all unchanged.

### NDS-005: Error Handling Behavior Preserved — PASS

**Scope:** Per-file | **Impact:** Important | **Method:** Semi-automatable (structural + semantic review)

Pre-existing error handling in 4 files reviewed:
- **git-collector.js**: `runGit` try/catch preserved — same `error.code === 128` checks, same throws. Agent added `span.recordException` + `span.setStatus` at top of catch block, then existing logic runs unchanged.
- **context-capture-tool.js**: Handler try/catch preserved inside new span callback wrapper. Same error message in catch.
- **reflection-tool.js**: Same pattern as context-capture-tool.js.
- **commit-analyzer.js**: `getChangedFiles` and `isMergeCommit` catch-and-return-default preserved. `getCommitMetadata` catch-and-rethrow preserved.

No restructuring, reordering, or merging of error handling blocks.

---

## Dimension 2: Coverage (COV) — 6/6 PASS (100%)

### COV-001: Entry Points Have Spans — PASS

**Scope:** Per-instance | **Impact:** Critical

All 4 entry points instrumented:

| Entry Point | File | Span Name |
|-------------|------|-----------|
| CLI main() | src/index.js | `commit_story.generate_journal_entry` |
| MCP server main() | src/mcp/server.js | `mcp.server.main` |
| MCP context capture handler | src/mcp/tools/context-capture-tool.js | `journal_capture_context` |
| MCP reflection handler | src/mcp/tools/reflection-tool.js | `journal_add_reflection` |

### COV-002: Outbound Calls Have Spans — PASS

**Scope:** Per-instance | **Impact:** Important

All outbound calls in instrumented files are covered:

| Outbound Call | File | Enclosing Span |
|--------------|------|----------------|
| `execFileAsync('git', ...)` | git-collector.js | `git.runCommand` |
| `execFileSync('git', ...)` x3 | commit-analyzer.js | `commit_story.get_changed_files`, `is_merge_commit`, `get_commit_metadata` |
| `mkdir` + `appendFile` | context-capture-tool.js | `saveContext` |
| `mkdir` + `appendFile` | reflection-tool.js | `saveReflection` |
| `mkdir` | journal-paths.js | `ensureDirectory` |

**Note:** The most significant outbound call (LLM API via LangChain in journal-graph.js) is in a failed file — not evaluated here but a major coverage gap for the overall run.

### COV-003: Failable Operations Have Error Visibility — PASS

**Scope:** Per-instance | **Impact:** Important

All 18 spans have error recording:

| Pattern | Count | Files |
|---------|-------|-------|
| `recordException(error)` + `setStatus(ERROR)` | 16 | All except commit-analyzer.js catch-without-variable |
| `setStatus(ERROR)` only | 2 | commit-analyzer.js (getChangedFiles, isMergeCommit) — original code swallows errors without capturing error variable |

### COV-004: Long-Running / Async Operations Have Spans — PASS

**Scope:** Per-instance | **Impact:** Normal

All async functions performing I/O in instrumented files are covered. Internal async helpers (getCommitMetadata, getCommitDiff, getMergeInfo in git-collector.js) correctly not spanned — their I/O goes through `runGit` which has its own span, and adding spans would violate RST-004.

### COV-005: Domain-Specific Attributes Present — PASS

**Scope:** Per-instance | **Impact:** Normal

Registry attribute coverage per span:

| Span | Registry Attributes Set | Missing |
|------|------------------------|---------|
| `commit_story.collect_chat_messages` | context.source, time_window_start/end, sessions_count, messages_count | — |
| `git.runCommand` | — | Uses ad-hoc `commit_story.git.subcommand` (see SCH-002) |
| `git.getPreviousCommitTime` | vcs.ref.head.revision | — |
| `git.getCommitData` | vcs.ref.head.revision, context.source, commit.author/message/timestamp | — |
| `commit_story.generate_journal_entry` | vcs.ref.head.revision, context.messages_count, journal.file_path, commit.timestamp | journal.entry_date, journal.sections (not set) |
| `commit_story.filter_messages` | filter.type, filter.messages_before/after | — |
| `truncateMessages` | filter.type, messages_before/after, tokens_before/after | — |
| `applyTokenBudget` | filter.type, messages_before/after, tokens_before/after | — |
| `mcp.server.main` | context.source | — |
| `saveContext` / `journal_capture_context` | context.source, journal.file_path | — |
| `saveReflection` / `journal_add_reflection` | journal.file_path | — |
| `ensureDirectory` | journal.file_path | — |
| `commit_story.get_changed_files` | vcs.ref.head.revision | commit.files_changed (not set) |
| `commit_story.is_merge_commit` | vcs.ref.head.revision | Uses ad-hoc `commit_story.commit.parent_count` (see SCH-002) |
| `commit_story.get_commit_metadata` | vcs.ref.head.revision, commit.message/author/timestamp | — |

### COV-006: Auto-Instrumentation Preferred Over Manual Spans — PASS

**Scope:** Per-instance | **Impact:** Important

None of the 11 successfully instrumented files use libraries with available auto-instrumentation. The COV-006 concern (manual spans on LangChain/LangGraph operations) applies to journal-graph.js which failed instrumentation entirely.

**Note for run-4:** journal-graph.js uses `@langchain/langgraph` which has auto-instrumentation via `@traceloop/instrumentation-langchain`. If the agent adds manual spans instead, that's a COV-006 failure.

---

## Dimension 3: Restraint (RST) — 4/4 PASS (100%), 1 N/A

### RST-001: No Spans on Utility Functions — PASS

**Scope:** Per-instance | **Impact:** Important

No spans added to synchronous, short, unexported, no-I/O functions. All instrumented functions are either exported, async, or perform I/O.

### RST-002: No Spans on Trivial Accessors — PASS

**Scope:** Per-instance | **Impact:** Low

No get/set accessors or trivial property accessor methods exist in instrumented files.

### RST-003: No Duplicate Spans on Thin Wrappers — PASS

**Scope:** Per-instance | **Impact:** Important

No instrumented function is a thin wrapper (single return calling another function).

### RST-004: No Spans on Internal Implementation Details — PASS

**Scope:** Per-instance | **Impact:** Normal

Unexported functions with spans all have I/O exemption:
- `runGit` (git-collector.js) — `execFileAsync` I/O
- `saveContext` (context-capture-tool.js) — `mkdir` + `appendFile` I/O
- `saveReflection` (reflection-tool.js) — `mkdir` + `appendFile` I/O
- `main()` (index.js, mcp/server.js) — entry points with I/O

### RST-005: No Re-Instrumentation of Already-Instrumented Code — N/A

No prior instrumentation existed. This is the first instrumentation run on this codebase.

---

## Dimension 4: API-Only Dependency (API) — 1/3 PASS (33%)

### API-002: Correct Dependency Declaration — FAIL

**Scope:** Per-run | **Impact:** Important

The agent added to `peerDependenciesMeta`:
```json
"@opentelemetry/api": { "optional": true }
```
All 11 source files have unconditional `import { trace, SpanStatusCode } from '@opentelemetry/api'`. If the peer isn't installed, every instrumented file crashes on import. `@opentelemetry/api` was correctly a required peerDependency before the agent ran — the agent regressed this.

**This is a new regression** not present in run-2. Run-2's API-002 failure was about `@opentelemetry/sdk-node` in production deps; run-3 introduced a different API-002 failure.

### API-003: No Vendor-Specific SDKs — FAIL

**Scope:** Per-run | **Impact:** Important

The agent added:
```json
"@traceloop/node-server-sdk": "^0.22.8"  // in peerDependencies (optional)
```
This is the Traceloop mega-bundle (same issue as run-2, spinybacked-orbweaver #61). If auto-instrumentation is needed, individual `@opentelemetry/instrumentation-*` packages or `@traceloop/instrumentation-langchain` should be used instead.

**Stale build repeat** — fix #61 was merged to source but not compiled to `dist/`.

### API-004: No SDK-Internal Imports in Source Files — PASS

**Scope:** Per-file | **Impact:** Important

All 11 source files import only from `@opentelemetry/api`. The SDK init file (`src/instrumentation.js`) was not modified by the agent.

**Improvement over run-2:** Run-2 failed API-004 because `src/instrumentation.js` contained CJS `require()` imports of SDK packages. Run-3's pre-run preparation placed a correct ESM `instrumentation.js` on main before the agent ran, and the agent left it untouched.

---

## Dimension 5: Schema Fidelity (SCH) — 2/4 PASS (50%)

### SCH-001: Consistent Span Naming — FAIL

**Scope:** Per-instance | **Impact:** Critical

The Weaver schema does not define operation/span names, so this falls back to naming quality mode. 18 spans use at least 4 distinct naming patterns:

| Pattern | Count | Examples |
|---------|-------|---------|
| `commit_story.snake_case` | 6 | `commit_story.collect_chat_messages`, `commit_story.generate_journal_entry` |
| `git.camelCase` | 3 | `git.runCommand`, `git.getPreviousCommitTime` |
| Bare `camelCase` | 6 | `getAllGuidelines`, `truncateMessages`, `saveContext` |
| `journal_snake_case` | 2 | `journal_capture_context`, `journal_add_reflection` |
| `mcp.dotted` | 1 | `mcp.server.main` |

Inconsistent naming fragments trace analysis. A single convention should be used project-wide.

**Stale build repeat** — fix #65 (span names consult Weaver schema) was merged to source but not compiled to `dist/`.

### SCH-002: Attribute Keys Match Registry Names — FAIL

**Scope:** Per-instance | **Impact:** Important

2 of 17 attribute keys are not in the Weaver registry:

```text
SCH-002 | fail | src/collectors/git-collector.js:24 | Attribute key commit_story.git.subcommand not in registry
SCH-002 | fail | src/utils/commit-analyzer.js:94 | Attribute key commit_story.commit.parent_count not in registry
```

15/17 attribute keys match the registry (88%). The 2 ad-hoc attributes capture useful data but should be added to the schema if they're valuable.

### SCH-003: Attribute Values Conform to Registry Types — PASS

**Scope:** Per-instance | **Impact:** Important

All enum attributes use valid members:
- `commit_story.context.source`: 'claude_code', 'git', 'mcp' — all valid
- `commit_story.filter.type`: 'noise_removal', 'token_budget' — all valid

All string/int attributes use correct types per registry definitions.

### SCH-004: No Redundant Schema Entries — PASS

**Scope:** Per-instance | **Impact:** Important

The 2 ad-hoc attributes (`commit_story.git.subcommand`, `commit_story.commit.parent_count`) capture genuinely new concepts not covered by existing registry entries. No string/token similarity matches to existing registry attributes.

---

## Dimension 6: Code Quality (CDQ) — 4/7 PASS (57%)

### CDQ-001: Spans Closed in All Code Paths — PASS

**Scope:** Per-instance | **Impact:** Critical

All 18 spans use `startActiveSpan` callback pattern with `finally { span.end(); }`. No span leaks possible.

### CDQ-002: Tracer Acquired Correctly — PASS

**Scope:** Per-file | **Impact:** Normal

All 11 files use `trace.getTracer('...')` with a library name string argument. Every file has exactly one tracer acquisition at module scope.

### CDQ-003: Standard Error Recording Pattern — FAIL

**Scope:** Per-instance | **Impact:** Important

2 of 18 spans are missing `recordException`:

```text
CDQ-003 | fail | src/utils/commit-analyzer.js:42 | getChangedFiles catch block uses only setStatus(ERROR), missing recordException — error object not captured
CDQ-003 | fail | src/utils/commit-analyzer.js:92 | isMergeCommit catch block uses only setStatus(ERROR), missing recordException — error object not captured
```

16/18 spans use the full pattern (`recordException` + `setStatus`). The 2 failures preserve the original catch-without-error-variable pattern, which is correct for NDS-005 but means the agent couldn't record the exception object. The agent could have changed `catch {` to `catch (error) {` to enable `recordException` without breaking behavior — a missed opportunity.

### CDQ-005: Async Context Maintained — PASS

**Scope:** Per-instance | **Impact:** Important

All 18 spans use `startActiveSpan` which automatically manages async context via the callback pattern. No manual `context.with()` needed.

### CDQ-006: Expensive Attribute Computation Guarded — PASS

**Scope:** Per-instance | **Impact:** Low

All `setAttribute` calls use simple property access or lightweight type conversions (`.toISOString()`, `String()`). No `JSON.stringify`, `.map`/`.reduce` chains, or other expensive computations.

### CDQ-007: No Unbounded or PII Attributes — FAIL

**Scope:** Per-instance | **Impact:** Important

2 instances of PII in telemetry attributes:

```text
CDQ-007 | fail | src/collectors/git-collector.js:166 | setAttribute('commit_story.commit.author', metadata.author) records person name as telemetry attribute
CDQ-007 | fail | src/utils/commit-analyzer.js:159 | setAttribute('commit_story.commit.author', author) records person name as telemetry attribute
```

`commit_story.commit.author` is defined in the Weaver registry — this is a schema design decision, not an agent invention. The CDQ-007 rule flags PII regardless of source. The agent correctly followed the schema but the schema itself has a PII concern.

### CDQ-008: Consistent Tracer Naming Convention — FAIL

**Scope:** Per-run | **Impact:** Normal

Two tracer naming conventions across 11 files:

| Convention | Files (7) | Files (4) |
|-----------|-----------|-----------|
| `commit_story` (underscore) | claude-collector, guidelines/index, index, message-filter, token-filter, reflection-tool, commit-analyzer | — |
| `commit-story` (hyphen) | — | git-collector, mcp/server, context-capture-tool, journal-paths |

Same finding as run-2 (spinybacked-orbweaver #64). The agent uses inconsistent tracer names across files.

**Stale build repeat** — fix #64 (consistent tracer naming) was merged to source but not compiled to `dist/`.

---

## Overall Score Summary

### Gate Check Results

| Rule | Result | Evidence |
|------|--------|----------|
| NDS-001 | **PASS** | All 11 files pass `node --check` |
| NDS-002 | **PASS** | 320/320 tests pass |
| NDS-003 | **PASS** | All diffs are instrumentation-only |
| API-001 | **PASS** | Only `@opentelemetry/api` in source files |

### Quality Rules by Dimension

| Dimension | Pass | Fail | N/A | Score |
|-----------|------|------|-----|-------|
| Non-Destructiveness (NDS) | 2 | 0 | 0 | 2/2 (100%) |
| Coverage (COV) | 6 | 0 | 0 | 6/6 (100%) |
| Restraint (RST) | 4 | 0 | 1 | 4/4 (100%) |
| API-Only Dependency (API) | 1 | 2 | 0 | 1/3 (33%) |
| Schema Fidelity (SCH) | 2 | 2 | 0 | 2/4 (50%) |
| Code Quality (CDQ) | 4 | 3 | 0 | 4/7 (57%) |
| **Total** | **19** | **7** | **1** | **19/26 (73%)** |

### Failure Summary

| Rule | Severity | Root Cause | Stale Build? |
|------|----------|-----------|--------------|
| API-002 | Important | Agent made `@opentelemetry/api` optional — new regression | No (new issue) |
| API-003 | Important | Mega-bundle `@traceloop/node-server-sdk` added | Yes — fix #61 not compiled |
| SCH-001 | Critical | 4+ inconsistent span naming patterns | Yes — fix #65 not compiled |
| SCH-002 | Important | 2 ad-hoc attribute keys not in registry | No (new finding) |
| CDQ-003 | Important | 2 spans missing `recordException` in commit-analyzer.js | No (new finding) |
| CDQ-007 | Important | PII (person name) in `commit_story.commit.author` — schema-defined | No (schema design issue) |
| CDQ-008 | Normal | Two tracer naming conventions across files | Yes — fix #64 not compiled |

### Failure Classification

- **Stale build repeats (3):** API-003, SCH-001, CDQ-008 — fixes existed in source but `dist/` was never rebuilt
- **New regression (1):** API-002 — agent marked `@opentelemetry/api` as optional (worse than run-2)
- **Genuine new findings (2):** SCH-002 (ad-hoc attributes), CDQ-003 (incomplete error recording)
- **Schema design issue (1):** CDQ-007 — PII attribute defined in Weaver registry

---

## Key Findings

### What Works Well
1. **Non-destructiveness is perfect** — zero business logic changes, all 320 tests pass, all signatures preserved
2. **Coverage improved to 100%** — all 6 COV rules pass cleanly (run-2 had 2 partials)
3. **Restraint is perfect** — no over-instrumentation, utilities correctly skipped
4. **More files instrumented** — 11 (run-3) vs 10 (run-2), with 1 additional file from supplemental run
5. **API-004 improved** — SDK setup file was correct before the agent ran; agent didn't break it

### What Needs Fixing
1. **API-002 regression** — agent made a required peerDependency optional (new issue)
2. **3 stale build repeats** — API-003, SCH-001, CDQ-008 will resolve with a fresh build in run-4
3. **Ad-hoc attributes** — 2 attribute keys invented outside the registry (schema gap or agent oversight)
4. **Incomplete error recording** — 2 spans could capture error objects but agent didn't modify catch blocks
5. **PII in schema** — `commit_story.commit.author` is a registry-defined PII attribute
6. **4 files still failing** — journal-graph (oscillation), sensitive-filter (null output), context-integrator and journal-manager (NDS-003 blocks refactors)
