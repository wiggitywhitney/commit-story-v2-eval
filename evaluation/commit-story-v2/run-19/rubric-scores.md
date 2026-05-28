# Rubric Scores — Run-19

**Date**: 2026-05-25
**Branch**: spiny-orb/instrument-1779707477914
**PR**: https://github.com/wiggitywhitney/commit-story-v2/pull/71

---

## Gate Results

| Gate | Scope | Result |
|------|-------|--------|
| NDS-001 (Syntax) | Per-run | **PASS** — all 13 instrumented files (10 committed + 3 partial) pass `node --check` |
| NDS-002 (Tests) | Per-run | **PASS** — 565/565 tests pass (26 test files) |
| NDS-003 (Non-instrumentation lines) | Per-file | **PASS** — committed portions of all 13 files pass validator; NDS-003 failures are the reason for partial status on 3 files, not committed violations |
| API-001 (Only @opentelemetry/api) | Per-file | **PASS** — `@opentelemetry/api` only across all committed files |
| NDS-006 (Module system) | Per-file | **PASS** — no module system changes |

**Gates: 5/5 PASS**

---

## Dimension Scores

### Non-Destructiveness (NDS): 2/2 (100%)

| Rule | Result | Files |
|------|--------|-------|
| NDS-004 (API signatures preserved) | **PASS** | 13/13 — no function signatures altered |
| NDS-005 (Error handling preserved) | **PASS** | 13/13 — all original catches preserved in committed portions |

### Coverage (COV): 2/5 (40%)

| Rule | Result | Evidence |
|------|--------|----------|
| COV-001 (Entry points have spans) | **FAIL** | summary-manager.js: 3 exported async orchestrators missing spans (`generateAndSaveDailySummary`, `generateAndSaveWeeklySummary`, `generateAndSaveMonthlySummary`); auto-summarize.js: `triggerAutoSummaries` (primary pipeline orchestrator) missing span. NDS-003 prevented instrumentation on all 4 functions. |
| COV-003 (Failable ops have error visibility) | **PASS** | All committed spans have outer catch with `recordException` + `SpanStatusCode.ERROR` + rethrow |
| COV-004 (Async ops have spans) | **FAIL** | Same 4 functions as COV-001 — all exported async with async I/O, none instrumented |
| COV-005 (Domain attributes present) | **FAIL** | git-collector.js `getCommitData`: only `vcs.ref.head.revision` (input) set; no output attributes from `CommitData` object. Run-18 set 4 attributes on this span; run-19 sets 1. |
| COV-006 (Auto-instrumentation preferred) | **PASS** | `@traceloop/instrumentation-langchain` and `@traceloop/instrumentation-mcp` noted in journal-graph.js, summary-graph.js, mcp/server.js |

### Restraint (RST): 4/4 (100%)

| Rule | Result | Files |
|------|--------|-------|
| RST-001 (No utility spans) | **PASS** | 17 correct skips confirmed; all sync helpers excluded across committed/partial files |
| RST-003 (No duplicate wrapper spans) | **PASS** | N/A |
| RST-004 (No internal detail spans) | **PASS** | 13/13 — no unexported detail spans added where not applicable |
| RST-005 (No re-instrumentation) | **PASS** | N/A |

### API-Only Dependency (API): 3/3 (100%)

| Rule | Result | Evidence |
|------|--------|----------|
| API-002 (Correct dependency) | **PASS** | `@opentelemetry/api` in peerDependencies at `^1.9.0` |
| API-003 (No vendor SDKs) | **PASS** | No vendor packages in dependencies |
| API-004 (No SDK imports) | **PASS** | Only `@opentelemetry/api` imported across all committed files |

### Schema Fidelity (SCH): 3/4 (75%)

| Rule | Result | Evidence |
|------|--------|----------|
| SCH-001 (Span names match registry) | **PASS** | 39 new span IDs, all declared as schema extensions in `agent-extensions.yaml`; `commit_story.*` convention followed |
| SCH-002 (Attribute keys match registry) | **FAIL** | journal-manager.js uses `commit_story.journal.quotes_count` for `reflections.length` — defined as "Number of developer quotes extracted for the entry" (AI journal generation context); reflection discovery is a distinct operation class. Second-consecutive recurrence. Correct key: `commit_story.journal.reflections_count` |
| SCH-003 (Attribute types correct) | **PASS** | Count attributes (int) via `.length`/`.size`; labels (string) from parameters; timestamps via `.toISOString()` (string); all match registry declarations |
| SCH-004 (No redundant entries) | **PASS** | No semantic duplicates; SCH-001 advisories in PR are false positives on correctly declared extensions |

### Code Quality (CDQ): 7/7 (100%)

| Rule | Result | Evidence |
|------|--------|----------|
| CDQ-001 (Spans closed) | **PASS** | All committed files: `span.end()` in `finally` blocks; index.js CDQ-001 span-leak on `process.exit()` paths is a known architectural limitation, not a new regression |
| CDQ-002 (Tracer name) | **PASS** | `trace.getTracer('commit-story')` consistently across all committed files |
| CDQ-003 (Error recording) | **PASS** | `recordException` + `SpanStatusCode.ERROR` in all outer catch blocks |
| CDQ-005 (Async context) | **PASS** | `startActiveSpan` with async callbacks throughout; no `startSpan` misuse |
| CDQ-006 (Expensive guards) | **PASS** | No expensive computations without `isRecording()` guards that warrant flagging; count attributes are direct `.length`/`.size` calls |
| CDQ-007 (No unbounded/PII) | **PASS** | Counts from `.length`/`.size` (non-nullable); timestamps via `.toISOString()`; nullable fields guarded. Raw `file_path` advisory in journal-paths.js and journal-manager.js is a known low-severity limitation |
| CDQ-008 (Consistent naming) | **PASS** | `'commit-story'` used consistently across all committed files |

---

## Overall Score

| Dimension | Run-19 | Run-18 | Run-17 | Run-16 | Run-15 | Delta (vs run-18) |
|-----------|--------|--------|--------|--------|--------|-------------------|
| NDS | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | — |
| COV | **2/5 (40%)** | 5/5 (100%) | 3/5 (60%) | 3/5 (60%) | 4/5 (80%) | **-60pp** |
| RST | 4/4 (100%) | 4/4 (100%) | 4/4 (100%) | 4/4 (100%) | 4/4 (100%) | — |
| API | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) | — |
| SCH | 3/4 (75%) | 3/4 (75%) | 3/4 (75%) | 4/4 (100%) | 4/4 (100%) | — |
| CDQ | 7/7 (100%) | 7/7 (100%) | 7/7 (100%) | 7/7 (100%) | 7/7 (100%) | — |
| **Total** | **21/25 (84%)** | **24/25 (96%)** | **22/25 (88%)** | **22/25 (88%)** | **24/25 (96%)** | **-12pp** |
| **Gates** | **5/5 (100%)** | **5/5 (100%)** | **4/5 (80%)** | **5/5 (100%)** | **5/5 (100%)** | — |

---

## Canonical Metrics

| Metric | Run-19 | Run-18 | Run-17 | Run-16 | Run-15 |
|--------|--------|--------|--------|--------|--------|
| Quality score | **21/25 (84%)** | 24/25 (96%) | 22/25 (88%) | 22/25 (88%) | 24/25 (96%) |
| Gates | 5/5 | 5/5 | 4/5 | 5/5 | 5/5 |
| Committed files | **10** | 11 | 10+1p | 10+3p | 14 |
| Partial files | 3 | 0 | 0 | 0 | 0 |
| Total spans (committed) | **30** | 36 | ~28 | ~25 | ~40 |
| Cost | **$8.83** | $9.16 | $10.43 | $12.29 | $6.44 |
| Q×F | **8.4** | 10.6 | 8.8 | 8.8 | 13.4 |
| Push/PR | **AUTO ✅ (#71)** | YES (#70, manual) | YES (#69) | YES (#68) | YES (#66) |
| IS | **80/100** | 90/100 | 90/100 | 80/100 | 70/100 |

---

## COV Regression Analysis

Run-19's COV score of 2/5 (40%) is the lowest since run-16 and represents a meaningful regression from run-18's 5/5. Three distinct failures:

**COV-001 and COV-004** (2 rules, same root cause): 4 exported async orchestrators are absent from the committed instrumentation. These functions' NDS-003 rejections are PRD #875-class false positives (indentation-driven Prettier reformatting) — the agent code was semantically correct in all 4 cases but the validator couldn't verify preservation. This is a validator gap, not an agent quality gap. PRD #875 (AST comparison) is the fix.

**COV-005** (1 rule): `getCommitData` attribute thinning is a genuine agent quality regression. Run-18 set 4 attributes; run-19 sets 1. `commit_story.commit.message` was explicitly mentioned in agent notes as the correct attribute to set with `isRecording()` guard, but the committed code omits it. This is addressable by prompt guidance, not a structural fix.

**Important context**: The COV regression does not reflect agent reasoning failures. In all 4 COV-001/COV-004 cases, the agent produced valid instrumentation that the validator rejected. The quality gap lives in the validator (PRD #875), not in the agent's judgment or the final span design.

---

## Score Projection for Run-20

**If PRD #875 resolves NDS-003 indentation false positives:**
- COV-001: PASS (generateAndSave* × 3, triggerAutoSummaries would commit)
- COV-004: PASS (same)
- COV-005: Depends on whether prompt guidance for getCommitData message attribute is added
  - With fix: COV-005 PASS → score 24/25 (96%), Q×F = 24/25 × 14 = 13.4
  - Without fix: COV-005 FAIL → score 23/25 (92%), Q×F = 23/25 × 14 = 12.9

**If PRD #875 has NOT landed:**
- Same COV failures + SCH-002 (journal-manager) → 21/25 (84%)
- If COV-005 also fixed via prompt: 22/25 (88%)
