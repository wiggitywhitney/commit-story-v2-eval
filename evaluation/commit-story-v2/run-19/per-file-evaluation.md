# Per-File Evaluation — Run-19

**Date**: 2026-05-25
**Branch**: spiny-orb/instrument-1779707477914
**Rubric**: 32 rules (5 gates + 27 quality)
**Files evaluated**: 30 (10 committed + 3 partial + 17 correct skips)
**Methodology**: D-2 — one agent per committed/partial file, one batch agent for correct skips

---

## Gate Checks (Per-Run)

| Gate | Result | Evidence |
|------|--------|----------|
| NDS-001 (Syntax) | **PASS** | `node --check` exits 0 on all 13 instrumented files (10 committed + 3 partial) |
| NDS-002 (Tests) | **PASS** | 565 tests pass (26 test files; verified during push-hook run before auto-push) |

---

## Per-Run Rules

| Rule | Result | Evidence |
|------|--------|----------|
| API-002 | **PASS** | `@opentelemetry/api` in peerDependencies at `^1.9.0` (unchanged from prior runs) |
| API-003 | **PASS** | No vendor-specific SDKs in dependencies |
| API-004 | **PASS** | No SDK-internal imports in src/ (all OTel usage via `@opentelemetry/api`; devDependencies only for SDK) |
| CDQ-008 | **PASS** | All committed files use `trace.getTracer('commit-story')` consistently |

---

## Committed Files (10)

### 2. collectors/git-collector.js (2 spans, 3 attempts)

Both exported async functions (`getPreviousCommitTime`, `getCommitData`) are instrumented with `startActiveSpan` — consistent with run-18, which first resolved the long-standing RUN17-3 gap. The four unexported helpers (`runGit`, `getCommitMetadata`, `getCommitDiff`, `getMergeInfo`) are correctly excluded per RST-001/RST-004. Structural fidelity is clean: all JSDoc blocks preserved, no signatures altered, `runGit`'s existing error branches untouched inside the new span wrappers. The key regression from run-18 is attribute thinning in `getCommitData`: where run-18 set `vcs.ref.head.revision`, `commit_story.commit.timestamp`, `commit_story.commit.author`, and `commit_story.commit.message`, run-19 sets only `vcs.ref.head.revision`. The PII rationale for dropping `author`/`authorEmail` is sound (CDQ-007), but omitting `commit_story.commit.message` entirely — rather than guarding it with `isRecording()` as the agent notes describe — weakens COV-005 for `getCommitData`. The `getPreviousCommitTime` span correctly captures `vcs.ref.head.revision` and `commit_story.commit.timestamp` (ISO string) with a null early-return guard on the timestamp path.

| Rule | Result |
|------|--------|
| NDS-003 | PASS — only span wrappers added; no business logic restructured |
| NDS-004 | PASS — no function signatures altered |
| NDS-005 | PASS — `runGit`'s original error handling preserved; new catch blocks record exception and rethrow |
| NDS-006 | PASS — all JSDoc blocks and inline comments intact |
| API-001 | PASS — `@opentelemetry/api` only |
| COV-001 | PASS — both exported async functions have entry-point spans |
| COV-003 | PASS — `execFile` is a local subprocess call handled by `runGit` (unexported); no outbound HTTP |
| COV-004 | PASS — both exported async functions have spans; 4 unexported helpers excluded per RST-004 |
| COV-005 | **FAIL** — `getCommitData` sets only `vcs.ref.head.revision`; `commit_story.commit.message`, merge status, parent count absent; run-18 passed by setting author, message, timestamp |
| COV-006 | N/A |
| RST-001 | PASS |
| RST-004 | PASS |
| SCH-001 | PASS — span names follow `commit_story.<category>.<operation>` convention |
| SCH-002 | PASS — only registered keys used |
| SCH-003 | PASS — `commit_story.commit.timestamp` via `.toISOString()` |
| SCH-004 | N/A — 3 candidate extensions noted but not used |
| CDQ-001 | PASS — both spans closed in `finally` |
| CDQ-002 | PASS |
| CDQ-003 | PASS |
| CDQ-005 | PASS |
| CDQ-006 | PASS |
| CDQ-007 | PASS — author/email correctly omitted (PII); timestamp guarded by early-return |

**Failures**: **COV-005** — `getCommitData` span sets only the input parameter; no output attributes from the returned `CommitData` object. Even excluding PII, `commit_story.commit.message` guarded with `isRecording()` would satisfy COV-005 without CDQ-007 risk.

---

### 3. generators/journal-graph.js (4 spans, 2 attempts)

**RUN18 HELD**: 4 spans, 2 attempts — same outcome as run-18. Third consecutive run success (run-18, run-19, and this is the third). Four exported async functions (`summaryNode`, `technicalNode`, `dialogueNode`, `generateJournalSections`) each receive one span. Thirteen sync helpers correctly skipped. The three node functions retain their original graceful-degradation catches inside `startActiveSpan` callbacks (NDS-007 pattern A). The orchestrator's catch records exception, sets ERROR status, and rethrows. LangChain calls auto-instrumented via `@traceloop/instrumentation-langchain` (COV-006).

The agent correctly removed `if (result.response_metadata?.model != null)` guard blocks — these would have triggered NDS-003. The `gen_ai.usage.input_tokens/output_tokens` pair is guarded by `result.usage_metadata != null`. Optional chaining on `NODE_TEMPERATURES?.summary` is safe — NODE_TEMPERATURES is a module-level const.

| Rule | Result |
|------|--------|
| NDS-003 | PASS — all function bodies intact; no business logic removed |
| NDS-004 | PASS — all 4 async function signatures unchanged |
| NDS-005 | PASS — original graceful-degradation catches in node functions preserved inside `startActiveSpan` callbacks |
| NDS-006 | PASS — all JSDoc blocks and inline comments preserved |
| API-001 | PASS |
| COV-001 | PASS — all 4 exported async functions have entry-point spans |
| COV-003 | PASS — `generateJournalSections` catch records exception + ERROR + rethrows |
| COV-004 | PASS — all 4 exported async functions instrumented; 13 sync helpers skipped |
| COV-005 | PASS — `commit_story.ai.section_type`, `gen_ai.operation.name`, `gen_ai.request.model`, `gen_ai.request.temperature`, `gen_ai.request.max_tokens`, `commit_story.journal.sections`, `commit_story.commit.message`, `vcs.ref.head.revision` |
| COV-006 | PASS — manual spans wrap application logic above auto-instrumented LangChain calls |
| RST-001 | PASS — 13 sync helpers skipped |
| RST-004 | PASS |
| SCH-001 | PASS |
| SCH-002 | PASS — all attributes registered schema keys or OTel GenAI/VCS refs |
| SCH-003 | PASS — section_type enum correct; temperature numeric; sections string array |
| SCH-004 | PASS — gen_ai.* are proper OTel GenAI refs |
| CDQ-001 | PASS — `span.end()` in `finally` on all 4 spans |
| CDQ-002 | PASS |
| CDQ-003 | PASS |
| CDQ-005 | PASS |
| CDQ-006 | PASS |
| CDQ-007 | PASS — usage_metadata guarded; NODE_TEMPERATURES optional chaining on module const |
| CDQ-009 | N/A — usage_metadata guard uses `!= null` form |
| CDQ-010 | N/A |

**Failures**: None.

---

### 4. generators/summary-graph.js (6 spans, 1 attempt)

**P1 RUN18-1 RESOLVED** — this file FAILED in run-18 (NDS-003 reconciler offset gap; 6 span wrappers inflated line offsets). Run-19 PRD #845 fix confirmed: committed cleanly on the first attempt.

Six spans across three parallel LangGraph pipelines (daily/weekly/monthly): `daily_node`, `generate_daily`, `weekly_node`, `generate_weekly`, `monthly_node`, `generate_monthly`. Three new schema extensions: `commit_story.summary.entries_count`, `week_label`, `month_label`. Inner graceful-degradation catches preserved per NDS-007; outer catches handle unexpected errors per COV-003. LangChain auto-instrumented via `@traceloop/instrumentation-langchain`.

| Rule | Result |
|------|--------|
| NDS-003 | PASS — 1-attempt success confirms reconciler gap resolved |
| NDS-004 | PASS |
| NDS-005 | PASS — inner graceful-degradation catches preserved |
| NDS-006 | PASS |
| API-001 | PASS |
| COV-001 | PASS — all 6 exported async functions have spans |
| COV-003 | PASS — all 6 spans have outer catch with recordException + ERROR + rethrow |
| COV-004 | PASS — all 6 exported async functions instrumented |
| COV-005 | PASS — entry_date, entries_count, week_label, month_label |
| COV-006 | PASS — model.invoke() and graph.invoke() via `@traceloop/instrumentation-langchain` |
| RST-001 | PASS — sync helpers skipped |
| RST-004 | PASS |
| SCH-001 | PASS — all 6 span names in agent-extensions.yaml |
| SCH-002 | PASS — all 3 new attributes in agent-extensions.yaml; no semantic collisions |
| SCH-003 | PASS — entries_count from `.length` (int); labels from string parameters |
| CDQ-001 | PASS |
| CDQ-002 | PASS |
| CDQ-003 | PASS |
| CDQ-005 | PASS |
| CDQ-006 | PASS |
| CDQ-007 | PASS — `entries != null` guards; labels are required string parameters |

**Failures**: None. **P1 RUN18-1 status: RESOLVED.**

---

### 5. integrators/context-integrator.js (1 span, 1 attempt)

Single span on `gatherContextForCommit` (sole exported async). `formatContextForPrompt` and `getContextSummary` (both sync) correctly skipped per RST-001. Seven attributes, all registered: `vcs.ref.head.revision`, `commit_story.filter.messages_before/after`, `commit_story.context.messages_count/sessions_count`, `commit_story.context.time_window_start/end`. Date values converted via `.toISOString()`. No duplicate spans on downstream calls (those modules already instrumented).

| Rule | Result |
|------|--------|
| NDS-003 | PASS |
| NDS-004 | PASS |
| NDS-005 | PASS |
| NDS-006 | PASS |
| API-001 | PASS |
| COV-001 | PASS |
| COV-003 | PASS |
| COV-004 | PASS — gatherContextForCommit is the only exported async function |
| COV-005 | PASS — 7 registered attributes set |
| RST-001 | PASS |
| RST-004 | PASS |
| SCH-001 | PASS — extension span for orchestration layer |
| SCH-002 | PASS — all attributes registered |
| SCH-003 | PASS — Date objects via `.toISOString()` |
| CDQ-001 | PASS |
| CDQ-002 | PASS |
| CDQ-003 | PASS |
| CDQ-005 | PASS |
| CDQ-007 | PASS — commitRef has default `'HEAD'`; remaining set from resolved computed values |

**Failures**: None.

---

### 6. mcp/server.js (1 span, 1 attempt)

Single span on `main()`. `createServer` (sync, unexported) skipped per RST-001. Attributes: `commit_story.mcp.server_start` (span), `commit_story.mcp.transport_type='stdio'`. Minor naming drift from run-18 (`server_start` vs `server.start`, `transport_type` vs `transport`) — both are extensions, so both pass. MCPInstrumentation detected via `@traceloop/instrumentation-mcp`. The `.catch(process.exit)` handler at the call site does not trigger RST-006 — it is outside `main()`'s instrumented body.

| Rule | Result |
|------|--------|
| NDS-003 | PASS |
| NDS-004 | PASS |
| NDS-005 | PASS |
| NDS-006 | PASS |
| API-001 | PASS |
| COV-001 | PASS — `main()` is the async process entry point |
| COV-003 | PASS — recordException + ERROR + rethrow; span.end() in finally |
| COV-004 | PASS — `main()` is the only async function; `createServer` is sync |
| COV-005 | PASS — `commit_story.mcp.transport_type` captures transport identity |
| RST-001 | PASS — `createServer` is sync |
| RST-004 | PASS |
| SCH-001 | PASS — extension span name |
| SCH-002 | PASS — extension attribute |
| SCH-003 | PASS — `'stdio'` is a string constant |
| CDQ-001 | PASS |
| CDQ-002 | PASS |
| CDQ-005 | PASS |
| CDQ-007 | PASS — hardcoded string literal; no nullable access |

**Failures**: None.

---

### 7. utils/journal-paths.js (1 span, 1 attempt)

Single span on `ensureDirectory` (sole exported async). Eleven sync helpers correctly skipped per RST-001. 1-attempt success, stable benchmark across runs 16–19. Span name `commit_story.journal.ensure_directory` is a new schema extension; `commit_story.journal.file_path` is a registered attribute. CDQ-007 advisory (raw full path, not basename) carries forward unchanged from runs 16–18.

| Rule | Result |
|------|--------|
| NDS-003 | PASS |
| NDS-004 | PASS |
| NDS-005 | PASS |
| NDS-006 | PASS |
| API-001 | PASS |
| COV-001 | PASS |
| COV-003 | PASS |
| COV-004 | PASS |
| COV-005 | PASS — `commit_story.journal.file_path` |
| RST-001 | PASS — 11 sync helpers skipped |
| RST-004 | PASS |
| SCH-001 | PASS |
| SCH-002 | PASS — registered attribute |
| SCH-003 | PASS — string type |
| CDQ-001 | PASS |
| CDQ-007 | ADVISORY — raw full path; `path.basename` not imported; known limitation |

**Failures**: None.

---

### 8. managers/journal-manager.js (2 spans, 1 attempt)

Spans on both exported async functions: `saveJournalEntry` and `discoverReflections`. 1-attempt success (improvement over run-18's 2 attempts). `formatJournalEntry` (exported, sync) correctly skipped per RST-001. Graceful-degradation catches in both functions preserved per NDS-005. **SCH-002 FAIL second-consecutive recurrence** — `commit_story.journal.quotes_count` used for `reflections.length` (filesystem-discovered reflection files). The attribute is defined as "Number of developer quotes extracted for the entry" (AI journal generation context) — a different operation class. Same file, same attribute, same failure as run-18. Correct attribute: `commit_story.journal.reflections_count`.

| Rule | Result |
|------|--------|
| NDS-003 | PASS |
| NDS-004 | PASS |
| NDS-005 | PASS — ENOENT catch and two inner empty catches preserved |
| NDS-006 | PASS |
| API-001 | PASS |
| COV-001 | PASS — both exported async functions have spans |
| COV-003 | PASS |
| COV-004 | PASS — formatJournalEntry (exported, sync) excluded per RST-001 |
| COV-005 | PASS — 4 attributes on saveJournalEntry; 3 on discoverReflections |
| RST-001 | PASS — formatJournalEntry and 10 sync helpers skipped |
| RST-004 | PASS |
| SCH-001 | PASS |
| SCH-002 | **FAIL** — `commit_story.journal.quotes_count` mismatched for reflection discovery (second-consecutive recurrence); defined as AI-extracted quote count; used here for filesystem-discovered reflection file count; correct attribute: `commit_story.journal.reflections_count` |
| SCH-003 | PASS — time_window via `.toISOString()`; quotes_count is `.length` (int) |
| CDQ-001 | PASS |
| CDQ-002 | PASS |
| CDQ-003 | PASS |
| CDQ-005 | PASS |
| CDQ-007 | ADVISORY — `commit.hash` and `commit.filesChanged` set unconditionally; JSDoc marks as required |

**Failures**: **SCH-002** — second-consecutive recurrence on this file.

---

### 9. commands/summarize.js (3 spans, 3 attempts)

Three exported async functions: `runSummarize`, `runWeeklySummarize`, `runMonthlySummarize`. Four sync utilities (`isValidWeekString`, `isValidMonthString`, `expandDateRange`, `parseSummarizeArgs`) and `showSummarizeHelp` correctly skipped per RST-001. Span names use `commit_story.summary.*` category distinct from summary-manager.js's CRUD spans — deliberate disambiguation. Inner per-item graceful-degradation catches preserved per NDS-005. Minor gap: `runSummarize` sets `entries_count` but not `generated_count`/`failed_count` at close (weekly/monthly both set all three). Not a rubric failure but reduces observability on the daily path.

| Rule | Result |
|------|--------|
| NDS-003 | PASS |
| NDS-004 | PASS |
| NDS-005 | PASS — inner per-item catches and silent access() catch preserved |
| NDS-006 | PASS |
| API-001 | PASS |
| COV-001 | PASS — all 3 exported async functions have spans |
| COV-003 | PASS |
| COV-004 | PASS — 4 exported sync utilities and 1 unexported sync helper excluded |
| COV-005 | PASS — batch-size and outcome counts on spans |
| RST-001 | PASS |
| RST-004 | PASS |
| SCH-001 | PASS — all 3 span names in agent-extensions.yaml |
| SCH-002 | PASS — 4 attributes registered as int extensions |
| SCH-003 | PASS — all counts from `.length` |
| CDQ-001 | PASS |
| CDQ-005 | PASS |
| CDQ-007 | PASS — all attributes from initialized arrays |

**Failures**: None.

---

### 10. utils/summary-detector.js (9 spans, 1 attempt)

All 9 async functions instrumented: 5 exported and 4 unexported helpers. Highest single-file span count in run-19. 1-attempt success, consistent with run-18. The 4 unexported helpers (`getSummarizedDays`, `getSummarizedWeeks`, `getSummarizedMonths`, `getWeeksWithWeeklySummaries`) each own the sole `readdir` call for a distinct data class and are each called from exactly one exported function — RST-004 permissive reading applies correctly. Return-value capture pattern correctly applied in `findUnsummarizedDays`. Seven new attribute keys; SCH-002 advisory pending confirmation all are in agent-extensions.yaml.

| Rule | Result |
|------|--------|
| NDS-003 | PASS |
| NDS-004 | PASS |
| NDS-005 | PASS — all inner readdir graceful-degradation catches preserved |
| NDS-006 | PASS |
| API-001 | PASS |
| COV-001 | PASS — all 5 exported async functions have spans |
| COV-003 | PASS — all 9 spans have outer catch with recordException + ERROR + rethrow |
| COV-004 | PASS — all 9 async functions instrumented; 2 sync utilities skipped |
| COV-005 | PASS — count attributes on every span |
| RST-001 | PASS — `getTodayString`, `getNowDate` excluded |
| RST-004 | PASS — 4 unexported helpers qualify per standalone-I/O reading |
| SCH-001 | PASS — all 9 span names follow convention |
| SCH-002 | ADVISORY — 7 new attribute keys absent from attributes.yaml; advisory pending extension declaration confirmation |
| SCH-003 | PASS — all counts from `.length`/`.size` |
| CDQ-001 | PASS |
| CDQ-002 | PASS |
| CDQ-003 | PASS |
| CDQ-005 | PASS |
| CDQ-007 | PASS — all from locally constructed collections |

**Failures**: None. SCH-002 is advisory.

---

### 11. src/index.js (1 span, 1 attempt)

**P1 RUN18-1 RESOLVED** — failed NDS-003 in runs 17 and 18 due to reconciler offset gap. PRD #845 fix confirmed: 1-attempt success. Single span on `main()` with `vcs.ref.head.revision` (default `'HEAD'`) and `commit_story.cli.subcommand` (guarded with `!= null`). All sync helpers excluded per RST-001. `handleSummarize` (unexported async, called only from `main()`) excluded per RST-004. Inner auto-summarize `try/catch` (graceful-degradation) preserved per NDS-005. CDQ-001 known limitation: 6 `process.exit()` calls on validation paths execute before `finally`, causing span leaks — consistent with runs 12–18 for this file.

| Rule | Result |
|------|--------|
| NDS-003 | PASS — PRD #845 fix confirmed; multi-line imports preserved |
| NDS-004 | PASS |
| NDS-005 | PASS — inner auto-summarize catch preserved |
| NDS-006 | PASS |
| API-001 | PASS |
| COV-001 | PASS — `main()` is the process entry point |
| COV-003 | PASS — no outbound calls |
| COV-004 | PASS — sole async function requiring span; `handleSummarize` covered by RST-004 |
| COV-005 | PASS — `vcs.ref.head.revision`, `commit_story.cli.subcommand` |
| RST-001 | PASS — 7 sync helpers excluded |
| RST-004 | PASS — `handleSummarize` is unexported |
| SCH-001 | PASS — extension span name follows convention |
| SCH-002 | PASS — `vcs.ref.head.revision` registered; `commit_story.cli.subcommand` is a new extension |
| SCH-003 | PASS — both string type |
| CDQ-001 | KNOWN LIMITATION — `process.exit()` on 6 validation-failure paths execute before `finally`; span leaks on those branches; consistent across runs 12–18 |
| CDQ-002 | PASS |
| CDQ-003 | PASS |
| CDQ-005 | PASS |
| CDQ-006 | PASS |
| CDQ-007 | PASS — `commitRef` has default `'HEAD'`; `subcommand` guarded with `!= null` |

**Failures**: None. **P1 RUN18-1 status: RESOLVED.**

---

## Partial Files (3)

### 12. collectors/claude-collector.js (1 span, 3 attempts — PARTIAL)

Committed via function-level fallback after NDS-003 failure at reassembly. `allMessages.sort()` at original line 228 was split across lines inside the `startActiveSpan` callback at deeper indentation. The committed single-span output (on `collectChatMessages`, the sole exported async function) passes syntax validation and preserves all original logic. No canonical failures on the committed output.

| Rule | Result |
|------|--------|
| NDS-003 | PARTIAL — committed function-level output is clean; failure was at reassembly (sort() split at deeper indentation inside span callback) |
| NDS-004 | PASS |
| NDS-005 | PASS — original had no try/catch; new catch rethrows |
| NDS-006 | PASS |
| API-001 | PASS |
| COV-001 | PASS — `collectChatMessages` has span |
| COV-003 | PASS — recordException + ERROR + rethrow |
| COV-004 | PASS — sole exported async; 7 sync helpers excluded |
| COV-005 | PASS — source, time_window_start/end, sessions_count, messages_count |
| RST-001 | PASS — 7 sync helpers excluded |
| RST-004 | PASS |
| SCH-001 | PASS |
| SCH-002 | PASS — all 5 attributes registered |
| SCH-003 | PASS — counts int; timestamps ISO strings; source is registered enum |
| CDQ-001 | PASS — `finally` covers both early null-return and error paths |
| CDQ-007 | PASS — counts from `Map.size`/`Array.length`; early-return sets both to `0` |

**Failures**: None on committed output. NDS-003 PARTIAL at reassembly level only.

---

### 13. managers/summary-manager.js (6 spans, 2 attempts — PARTIAL)

**Regression from run-18** (9 spans → 6 spans). All 3 `generateAndSave*` orchestrators skipped: NDS-003 fired on multi-line expressions (return object literal, function call arguments) reformatted at deeper indentation inside `startActiveSpan`. Run-18 succeeded via file-level instrumentation; run-19's function-level fallback could not handle the body complexity of the orchestrators. The 6 committed read/save helper spans are well-constructed with correct attributes and error handling.

| Rule | Result |
|------|--------|
| NDS-003 | PASS for 6 committed spans |
| NDS-004 | PASS |
| NDS-005 | PASS — ENOENT/access catches in committed functions preserved |
| NDS-006 | PASS |
| API-001 | PASS |
| COV-001 | **PARTIAL** — 3 of 6 exported async orchestrators missing spans (`generateAndSave*`) |
| COV-003 | PASS for 6 committed spans |
| COV-004 | **PARTIAL** — 6 of 9 exported async functions covered; 3 skipped due to NDS-003 |
| COV-005 | PASS for committed spans — date/path/count attributes on read and save functions |
| RST-001 | PASS — 5 sync functions excluded |
| RST-004 | PASS |
| SCH-001 | PASS |
| SCH-002 | PASS — all attributes correctly typed per schema |
| SCH-003 | PASS |
| CDQ-001 | PASS |
| CDQ-007 | PASS |

**Failures**: **COV-001 PARTIAL, COV-004 PARTIAL** — 3 of 9 exported async functions missing spans due to NDS-003 on function-level fallback. Regression from run-18's complete 9-span coverage. Trajectory: 3→6→9→6 spans.

---

### 14. managers/auto-summarize.js (2 spans, 3 attempts — PARTIAL)

`triggerAutoSummaries` skipped after 3 attempts: NDS-003 on spread-array return expression `failed: [...result.failed, ...]` reformatted at deeper indentation. The two committed spans (`triggerAutoWeeklySummaries`, `triggerAutoMonthlySummaries`) are structurally clean — correct attributes, inner per-item catches preserved, error handling pattern correct.

`triggerAutoSummaries` is the primary top-level orchestrator that sequences daily→weekly→monthly pipeline. Its absence leaves the daily pipeline, early-return failure-skip path, and combined result assembly unobservable. The two committed sub-spans appear as artificial root spans rather than children of an orchestrator span.

| Rule | Result |
|------|--------|
| NDS-003 | PASS for 2 committed spans |
| NDS-004 | PASS |
| NDS-005 | PASS — inner for-loop graceful-degradation catches preserved |
| NDS-006 | PASS |
| API-001 | PASS |
| COV-001 | **PARTIAL** — `triggerAutoSummaries` (primary orchestrator) missing span due to NDS-003 skip |
| COV-003 | PASS |
| COV-004 | PASS for 2 instrumented functions — `getErrorMessage` (unexported, sync) excluded |
| COV-005 | PASS — unsummarized count at entry; generated/failed counts at exit |
| RST-001 | PASS — `getErrorMessage` excluded |
| RST-004 | PASS |
| SCH-001 | PASS — both span names in agent-extensions.yaml |
| SCH-002 | PASS — all 5 attributes registered |
| SCH-003 | PASS — all counts from `.length` |
| CDQ-001 | PASS |
| CDQ-007 | PASS |

**Failures**: **COV-001 PARTIAL** — `triggerAutoSummaries` missing; daily pipeline, early-return path, and combined result unobservable.

---

## Correct Skips (17)

All 17 files correctly skipped — same set as runs 9–18. No spans committed, no LLM calls made.

| File | Exported symbols | Async I/O? | Skip verdict |
|------|-----------------|-----------|--------------|
| generators/prompts/guidelines/accessibility.js | const | No | RST-001 ✅ |
| generators/prompts/guidelines/anti-hallucination.js | const | No | RST-001 ✅ |
| generators/prompts/guidelines/index.js | `getAllGuidelines` (sync) + re-exports | No | RST-001 ✅ |
| generators/prompts/sections/daily-summary-prompt.js | sync fn | No | RST-001 ✅ |
| generators/prompts/sections/dialogue-prompt.js | const | No | RST-001 ✅ |
| generators/prompts/sections/monthly-summary-prompt.js | sync fn | No | RST-001 ✅ |
| generators/prompts/sections/summary-prompt.js | sync fn | No | RST-001 ✅ |
| generators/prompts/sections/technical-decisions-prompt.js | const | No | RST-001 ✅ |
| generators/prompts/sections/weekly-summary-prompt.js | sync fn | No | RST-001 ✅ |
| integrators/filters/message-filter.js | sync fns | No | RST-001 ✅ |
| integrators/filters/sensitive-filter.js | sync fns | No | RST-001 ✅ |
| integrators/filters/token-filter.js | sync fns | No | RST-001 ✅ |
| mcp/tools/context-capture-tool.js | `registerContextCaptureTool` (sync) | No (exported fn is sync) | RST-001 ✅ (with note) |
| mcp/tools/reflection-tool.js | `registerReflectionTool` (sync) | No (exported fn is sync) | RST-001 ✅ (with note) |
| traceloop-init.js | None (top-level init block) | No | RST-001 ✅ |
| utils/commit-analyzer.js | sync fns (uses `execFileSync`) | No | RST-001 ✅ |
| utils/config.js | frozen const | No | RST-001 ✅ |

**Note on context-capture-tool.js and reflection-tool.js**: The exported function (`registerContextCaptureTool`/`registerReflectionTool`) is synchronous — it calls `server.tool()` and returns immediately. The inner async callback passed to `server.tool()` is not an exported function and does not trigger COV-001 or COV-004 under the current rubric. The async MCP handler performs real I/O (`mkdir`, `appendFile`) and is the logical tool entry point from the MCP runtime's perspective — a structural observation for future rubric consideration, not a current failure.

---

## Canonical Failures Summary

| File | Rule | Severity | Finding |
|------|------|----------|---------|
| git-collector.js | COV-005 | Fail | `getCommitData` sets only input parameter; output attributes absent |
| journal-manager.js | SCH-002 | Fail | `quotes_count` mismatched for reflection discovery — second-consecutive run |
| summary-manager.js | COV-001 | Partial | `generateAndSave*` orchestrators missing spans (NDS-003 regression) |
| summary-manager.js | COV-004 | Partial | 6 of 9 exported async functions covered |
| auto-summarize.js | COV-001 | Partial | `triggerAutoSummaries` missing span (NDS-003 skip) |
| claude-collector.js | NDS-003 | Partial | Reassembly failure; committed output is clean |
