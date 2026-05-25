# Lessons for PRD #20

Run-19 observations to carry forward into the next evaluation run PRD.

## Process Observations

<!-- Add process-level notes as the run unfolds -->

## Pre-run Verification Findings

**spiny-orb version**: 1.0.0 (SHA 36201a5, main branch)

**Commits since run-18 (1c53ffd)**: 18 commits across 3 meaningful PRs:

- **PRD #845 (NDS-003 normalize-both-sides)** — MERGED ✅ P1 fix for RUN18-1:
  - `src/languages/javascript/rules/nds003.ts` rewritten to normalize both sides before comparison
  - `reconcileObjectLiteralExpansion` removed (made redundant by normalize-both-sides, M3)
  - Regression fixtures added for saveContext (`server.tool()` callback) and saveReflection patterns
  - summary-graph.js multi-span pattern now has acceptance gate coverage
  - index.js intentionally not in acceptance gate: "same CLI-entry-point + schema-extension pattern as summarize.js, which covers it" (M4 decision)
  - Acceptance gate test for summary-graph.js added explicitly

- **Issue #867 (push retry)** — MERGED ✅ P2 fix for RUN18-3:
  - `pushWithHookRetry()` wraps push in spiny-orb; detects "push again" pattern in hook output and retries once
  - Should resolve auto-push failure from run-18 (PROGRESS.md commit mid-push)

- **Issue #9f1fddb (run-18 findings capture)** — docs only

**RUN18-1 fix status** (P1 — critical): ✅ FIXED
- NDS-003 normalize-both-sides replaces offset tracking entirely
- Regression fixtures exist for saveContext and saveReflection (server.tool() callback)
- Expected: context-capture-tool.js, reflection-tool.js, index.js, summary-graph.js all commit in run-19

**RUN18-2 fix status** (P2): ❌ NOT FIXED
- No `commit_story.journal.reflections_count` attribute added to commit-story-v2 semconv/attributes.yaml
- No agent directive added to spiny-orb preventing `quotes_count` reuse for reflection discovery
- journal-manager.js `discoverReflections` likely uses `quotes_count` again in run-19
- SCH-002 expected to recur

**RUN18-3 fix status** (P2): ✅ FIXED
- pushWithHookRetry() detects "push again" in pre-push hook output and retries
- Auto-push expected to succeed in run-19

**Score projection for run-19**:
- Conservative: 24/25, 15 files (4 newly-unblocked + 11 from run-18), Q×F ≈ 14.4
- SCH-002 on journal-manager.js likely recurs (RUN18-2 not fixed) → 24/25 more realistic than 25/25
- journal-graph.js: second consecutive expected; 2 data points would confirm structural fix vs one-off

**Push auth**: Verified ✅ (dry-run to `spiny-orb/auth-test-run19` succeeded)
**Test suite**: 26 files, 565 tests — ALL PASSED ✅ (pre-push hook verified during auth check)
**Test command**: `npm test` (default — spiny-orb.yaml has no explicit `testCommand`)
**Target repo**: commit-story-v2 on main, clean working tree (journal entries only untracked), 30 JS files in src/
**semconv/**: attributes.yaml, agent-extensions.yaml, registry_manifest.yaml — all present ✅
**spiny-orb.yaml**: present ✅
**Staged .instrumentation.md files**: present from run-18 (normal; spiny-orb will overwrite them)
**README check**: Verified — run history table includes rows through run-18 ✅
**Rebuild**: spiny-orb 1.0.0 built clean from main ✅

## Evaluation Run Observations

<!-- Observations made as the run progresses — cost ceiling, file counts, etc. -->

## Scoring Observations

<!-- Patterns noticed during per-file evaluation and rubric scoring -->

## IS Scoring Notes

<!-- IS run observations; remember SPA-001 always fails (>10 INTERNAL spans structural mismatch) -->

## Advisory Pass Rollback Verification

<!-- Was the advisory pass rollback path triggered? Was it correct? -->

## What to Watch in Run-20

<!-- Primary goals and watch items for the next run -->
