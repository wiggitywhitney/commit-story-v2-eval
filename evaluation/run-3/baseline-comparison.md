# Baseline Comparison: Run-3 vs Run-2 vs Run-1

**Date:** 2026-03-13
**Run-1:** telemetry-agent-spec-v3 (old implementation), 2026-02-24
**Run-2:** SpinybackedOrbWeaver v1.0.0, 2026-03-12
**Run-3:** SpinybackedOrbWeaver (stale build — see advisory), 2026-03-13

---

## Stale Build Advisory

Run-3 evaluated an old `dist/` build. Fixes #61 (mega-bundle), #64 (tracer naming), and #65 (span naming) were merged to source but `npm run prepare` was never run. Three "repeat failures" (API-003, CDQ-008, SCH-001) are expected consequences. The evaluation process, rubric application, and newly-discovered issues are still valid. See PRD #3 decision log for full details.

---

## Executive Summary

Run-3 holds steady at 73% quality (vs 74% in run-2) while improving coverage to 100% (from 67-100%) and instrumenting one additional file. The overall score is nearly unchanged because three stale-build repeat failures cancel out the coverage gains, and a new API-002 regression (making `@opentelemetry/api` optional) replaces run-2's different API-002 failure. The real signal: non-destructiveness, coverage, and restraint are all at 100% — the agent's core instrumentation quality is solid. The remaining failures are concentrated in dependency management (API dimension) and naming consistency (SCH/CDQ), which are prompt-level fixes in the orb agent.

---

## Key Metrics Comparison

| Metric | Run-1 | Run-2 | Run-3 | Run-2→3 Change |
|--------|-------|-------|-------|----------------|
| **Overall quality pass rate** | 79%* | 74% (20/27) | 73% (19/26) | -1pp |
| **Gate checks** | 4/4 pass | 4/4 pass | 4/4 pass | Same |
| **Files in scope** | 7 | 21 | 21 | Same |
| **Files instrumented** | 4 | 10 | 11 | +1 |
| **Files correctly skipped** | 3 | 7 | 6 | -1 (config.js reclassified) |
| **Files failed** | 0 (after 3 patches) | 4 | 4 | Same |
| **Total spans** | ~7 | ~21 | 18 | -3 (more precise count) |
| **Manual patches required** | 3 | 0 | 0 | Same (none needed) |
| **Total attempts** | 8 | 1 | 1 + 3 supplemental | Same first-try success |
| **Wall-clock time** | Unknown | Unknown | 35.7 min + 16.7 min supplemental | New metric |
| **PR artifact** | N/A (--no-pr used) | Created (--no-pr used) | Failed (git push auth) | Regressed (process) |
| **Test suite** | Unknown | 320/320 pass | 320/320 pass | Same |

*Run-1's 79% was scored against 4 TypeScript files copied from another project — not comparable to run-2/3 which scored against the real 21-file JavaScript codebase.

---

## Dimension-Level Comparison

| Dimension | Run-1 (est.) | Run-2 | Run-3 | Run-2→3 Trend |
|-----------|-------------|-------|-------|---------------|
| Non-Destructiveness (NDS) | 100% (2/2) | 100% (2/2) | 100% (2/2) | Maintained |
| Coverage (COV) | ~67% | 67-100% (4/6 + 2 partial) | 100% (6/6) | Improved |
| Restraint (RST) | ~80% | 100% (5/5) | 100% (4/4 + 1 N/A) | Maintained |
| API-Only Dependency (API) | ~33% | 0% (0/3) | 33% (1/3) | Improved |
| Schema Fidelity (SCH) | ~33% | 75% (3/4) | 50% (2/4) | Regressed |
| Code Quality (CDQ) | ~86% | 86% (6/7) | 57% (4/7) | Regressed |

### Dimension Analysis

**Coverage (67-100% → 100%):** The clearest improvement. Run-2 had two "partial" scores (COV-002, COV-004) because 4 files failed instrumentation entirely. Run-3 applied the same rubric more rigorously — COV rules are evaluated only against instrumented files, and all instrumented files have complete coverage. The additional file (commit-analyzer.js, rescued via supplemental run with 150K token budget) adds 3 outbound-call spans.

**API-Only Dependency (0% → 33%):** Improved from zero to one pass. Run-2 failed all three API rules (API-002: SDK in production deps, API-003: mega-bundle, API-004: CJS require in ESM). Run-3 passes API-004 because the pre-run preparation placed a correct ESM instrumentation.js on main before the agent ran. However, run-3 introduced a *different* API-002 failure (making @opentelemetry/api optional) and repeated API-003 (mega-bundle, stale build).

**Schema Fidelity (75% → 50%):** Regressed. Run-2 passed SCH-002 (all attribute keys matched registry); run-3 found 2 ad-hoc attributes (`commit_story.git.subcommand`, `commit_story.commit.parent_count`) not in the Weaver registry. This may be a more thorough evaluation rather than a true regression — run-2 may have missed these. SCH-001 (span naming) remains a failure in both runs (stale build repeat for run-3).

**Code Quality (86% → 57%):** The largest regression. Three new failures:
- **CDQ-003** (new): 2 spans missing `recordException` in commit-analyzer.js — this file wasn't instrumented in run-2 so the issue is newly visible
- **CDQ-007** (new): PII in `commit_story.commit.author` — present in run-2 but not caught (evaluator gap, not agent regression)
- **CDQ-008** (repeat): Tracer naming inconsistency — stale build

The CDQ regression is largely an artifact of more thorough evaluation (catching CDQ-007 and evaluating the new commit-analyzer.js file) rather than the agent performing worse.

---

## Failure Comparison

### Run-2 Failures (5 quality + 2 partial)

| Rule | Category | Description |
|------|----------|-------------|
| API-002 | Dependency | SDK in production deps for distributable package |
| API-003 | Dependency | Mega-bundle `@traceloop/node-server-sdk` |
| API-004 | Dependency | CJS `require()` in ESM project |
| SCH-001 | Naming | Span names not matching registry operations |
| CDQ-008 | Naming | Tracer name inconsistency (hyphen vs underscore) |
| COV-002 | Coverage (partial) | 4 failed files reduced outbound call coverage |
| COV-004 | Coverage (partial) | 4 failed files reduced async operation coverage |

### Run-3 Failures (7 quality)

| Rule | Category | Description | New/Repeat/Stale? |
|------|----------|-------------|-------------------|
| API-002 | Dependency | Made `@opentelemetry/api` optional (different bug) | New regression |
| API-003 | Dependency | Mega-bundle `@traceloop/node-server-sdk` | Stale build repeat |
| SCH-001 | Naming | 4+ inconsistent span naming patterns | Stale build repeat |
| SCH-002 | Schema | 2 ad-hoc attribute keys not in registry | New finding |
| CDQ-003 | Error recording | 2 spans missing `recordException` | New (new file) |
| CDQ-007 | PII | Person name in `commit_story.commit.author` | New (evaluator caught) |
| CDQ-008 | Naming | Tracer name inconsistency | Stale build repeat |

### Failure Classification

| Category | Count | Details |
|----------|-------|---------|
| Stale build repeats | 3 | API-003, SCH-001, CDQ-008 — fixes in source, not compiled |
| New regression | 1 | API-002 — agent made required peerDep optional |
| Newly visible (more files) | 1 | CDQ-003 — commit-analyzer.js wasn't instrumented in run-2 |
| Newly caught (better eval) | 1 | CDQ-007 — PII was present in run-2 but evaluator missed it |
| Genuine new finding | 1 | SCH-002 — 2 ad-hoc attribute keys |

### Resolved from Run-2

| Rule | Run-2 Status | Run-3 Status | How Resolved |
|------|-------------|-------------|--------------|
| API-004 | FAIL (CJS require in ESM) | PASS | Pre-run: correct ESM instrumentation.js placed on main |
| COV-002 | PARTIAL | PASS | More rigorous scoping: evaluate instrumented files only |
| COV-004 | PARTIAL | PASS | More rigorous scoping: evaluate instrumented files only |

---

## File Outcome Comparison

| File | Run-2 | Run-3 | Change |
|------|-------|-------|--------|
| claude-collector.js | Instrumented (1 span) | Instrumented (1 span) | Same |
| git-collector.js | Instrumented (2 spans) | Instrumented (3 spans) | +1 span |
| journal-graph.js | Failed (token budget) | Failed (oscillation) | Different failure mode |
| guidelines/index.js | Instrumented (1 span) | Instrumented (1 span) | Same |
| index.js | Instrumented (1 span) | Instrumented (1 span) | Same |
| context-integrator.js | Failed (NDS-003) | Failed (NDS-003) | Same failure |
| message-filter.js | Instrumented (1 span) | Instrumented (1 span) | Same |
| sensitive-filter.js | Failed (null output) | Failed (null output) | Same failure |
| token-filter.js | Instrumented (2 spans) | Instrumented (2 spans) | Same |
| journal-manager.js | Failed (NDS-003) | Failed (NDS-003 x5) | Same failure, more violations |
| mcp/server.js | Instrumented (1 span) | Instrumented (1 span) | Same |
| context-capture-tool.js | Instrumented (2 spans) | Instrumented (2 spans) | Same |
| reflection-tool.js | Instrumented (2 spans) | Instrumented (2 spans) | Same |
| journal-paths.js | Instrumented (1 span) | Instrumented (1 span) | Same |
| **commit-analyzer.js** | **Failed (token budget)** | **Instrumented (3 spans)** | **Rescued via 150K budget** |
| config.js | Skipped (0 spans) | Skipped (0 spans) | Same |
| 5 prompt files | Skipped (0 spans each) | Skipped (0 spans each) | Same |

### File Outcome Summary

| Outcome | Run-1 | Run-2 | Run-3 |
|---------|-------|-------|-------|
| Instrumented | 4 | 10 | 11 |
| Correctly skipped | 3 | 7 | 6 |
| Failed | 0* | 4 | 4 |
| **Total** | **7** | **21** | **21** |

*Run-1 had 0 failures after 3 manual patches and 8 attempts.

### Failed Files Across Runs

| File | Run-2 Failure | Run-3 Failure | Persistent? |
|------|--------------|--------------|-------------|
| journal-graph.js | Token budget exceeded (~94K) | Oscillation (with 150K budget) | Yes — different mode |
| sensitive-filter.js | Null parsed output | Null parsed output | Yes — same bug |
| context-integrator.js | NDS-003 (variable extraction) | NDS-003 (variable extraction) | Yes — same refactor attempt |
| journal-manager.js | NDS-003 (business logic added) | NDS-003 x5 + COV-003 x3 | Yes — worse (more violations) |
| commit-analyzer.js | Token budget exceeded (~88K) | **Succeeded** (150K budget) | **Resolved** |

Three persistent failures remain identical across runs. journal-graph.js failed differently (oscillation vs budget) suggesting the higher token budget surfaced a deeper issue.

---

## Retry and Recovery Analysis

| Metric | Run-1 | Run-2 | Run-3 |
|--------|-------|-------|-------|
| First-try success | No | Yes | Yes |
| Manual patches | 3 | 0 | 0 |
| Supplemental runs | N/A | 0 | 3 (1 succeeded) |
| Files rescued by config change | N/A | 0 | 1 (commit-analyzer.js) |
| Retry utilization | Unknown | Unknown | Main run: 2 retries used (context-integrator, journal-manager) |

Run-3 introduced supplemental runs as a process innovation: after the main run, individual files that failed due to token budget were re-run with `maxTokensPerFile: 150000`. This rescued commit-analyzer.js (3 new spans) but didn't help journal-graph.js (oscillation) or sensitive-filter.js (null output — unrelated to budget).

---

## Timing and Cost

| Metric | Run-1 | Run-2 | Run-3 |
|--------|-------|-------|-------|
| Wall-clock (main) | Unknown (8 attempts) | Unknown (single run) | 2,140s (35.7 min) |
| Wall-clock (supplemental) | N/A | N/A | 1,003s (16.7 min) |
| Wall-clock (total) | Unknown | Unknown | 3,143s (52.4 min) |
| Total cost | ~$5.50-6.50 | Single run (est. lower) | Not recorded |
| Per-file average | ~$1.38/file | Unknown | ~102s/file (main run) |

Wall-clock time was first tracked in run-3. The 35.7-minute main run processed 21 files (avg ~102s/file). Supplemental runs added 16.7 minutes for 3 individual file attempts.

---

## Cross-Run Trend Analysis

### Consistently Strong (3 runs)

- **Non-Destructiveness (100% across all runs):** The agent never modifies business logic in successfully instrumented files. All tests pass. All signatures preserved.
- **Gate checks (4/4 across all runs):** No gate failures have ever occurred on instrumented output.
- **First-try success (runs 2-3):** The SpinybackedOrbWeaver rewrite eliminated run-1's catastrophic system failures.

### Improving

- **Coverage:** ~67% → 67-100% → 100%. Steady improvement as more files get instrumented and evaluation methodology matures.
- **Restraint:** ~80% → 100% → 100%. Perfect since run-2, maintained.
- **File success rate:** 57% (4/7) → 48% (10/21) → 52% (11/21). Modest improvement, complicated by different file counts.

### Persistent Problems

- **API dependency model:** ~33% → 0% → 33%. Each run has different API failures. Run-1: partial. Run-2: SDK in prod deps, mega-bundle, CJS in ESM. Run-3: optional peerDep, mega-bundle (stale). The agent consistently struggles with package.json dependency declarations.
- **Naming consistency:** SCH-001 and CDQ-008 have failed in both run-2 and run-3. The fixes exist in source but weren't tested in run-3 (stale build). Run-4 with a fresh build will determine if these are truly fixed.
- **Same 3 files fail:** journal-graph.js, sensitive-filter.js, and journal-manager.js have failed in both run-2 and run-3. context-integrator.js also fails consistently. These represent the hardest instrumentation challenges for the agent.

### Evaluation Methodology Improvements

The run-2→3 comparison is partially confounded by evaluation improvements:
- **CDQ-007 (PII)** was present in run-2 but the evaluator didn't catch it
- **SCH-002 (ad-hoc attributes)** may have been present in run-2 but wasn't flagged
- **COV partials** were eliminated by more rigorous scoping (evaluating instrumented files only)
- **Full 31-rule rubric** was applied more systematically in run-3

This means some apparent "regressions" are actually better evaluation catching issues that were always there.

---

## Verdict

Run-3 confirms the SpinybackedOrbWeaver's stability — same agent, same codebase, consistent results. The core instrumentation quality (NDS, COV, RST all at 100%) is excellent. The remaining failures are concentrated in two areas:

1. **Dependency/naming (API, SCH, CDQ):** Prompt-level fixes in the orb agent. Three of seven failures are stale-build repeats that should resolve with a fresh build.

2. **Persistent file failures (4 files):** Three files (journal-graph, sensitive-filter, journal-manager) have failed in every run since run-2. These represent fundamental challenges: large file oscillation, null LLM output, and NDS-003 blocking necessary refactors.

The stale build makes run-3 less informative than it should be for the three repeat failures. Run-4's primary value will be testing whether the fixes for #61, #64, and #65 actually resolve API-003, CDQ-008, and SCH-001. If they do, the quality pass rate should jump from 73% to ~85% (eliminating 3 of 7 failures).

The new API-002 regression (optional peerDep) is concerning — it's a different bug from run-2's API-002, suggesting the agent has a systemic issue with peerDependency declarations rather than a single fixable bug.
