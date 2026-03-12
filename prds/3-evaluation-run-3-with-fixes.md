# PRD #3: Evaluation Run-3 — SpinybackedOrbWeaver with Fixes Applied

**Status:** Draft
**Created:** 2026-03-12
**GitHub Issue:** [#3](https://github.com/wiggitywhitney/commit-story-v2-eval/issues/3)
**Depends on:** PRD #2 (run-2 complete, findings documented)

---

## Problem Statement

Run-2 of the SpinybackedOrbWeaver evaluation (PRD #2) achieved 81% success (17/21 files) but revealed several issues that need fixing before the tool can be considered release-ready:

1. **Transient LLM failures aren't retried** — Elision detection and null parsed_output failures happen inside `instrumentFile`, bypassing the retry loop that only catches validation-chain failures. 2 of 4 failures were likely recoverable with a retry.
2. **Mega-bundle dependency** — The agent added `@traceloop/node-server-sdk` (a mega-bundle) instead of the individual `@traceloop/instrumentation-langchain` package, contradicting spec v3.8's explicit guidance.
3. **Tracer naming inconsistency** — 5 files use `'commit-story'`, 5 use `'commit_story'` as the tracer name.
4. **Token budget exceeded on largest file** — `journal-graph.js` (93,966 tokens) exceeds the 80,000 budget. May need configurable budget or chunked processing.
5. **NDS-003 false positive or real issue** — The agent added `if (commit.hash) {` business logic to `journal-manager.js`. Validation caught it, but all 3 retry attempts failed — suggesting the agent consistently misunderstands this file.

Run-2 also had process issues: `--no-pr` was used (losing the PR artifact), output ran in background (losing real-time visibility), and wall-clock time wasn't tracked.

## Solution Overview

Two-phase approach:
1. **File fixes on spinybacked-orbweaver** — Create issues with actionable instructions for each bug found in run-2.
2. **Re-run evaluation** — Execute `orb instrument` with improved process, full rubric scoring, and baseline comparison.

### Key Inputs

- **Run-2 results**: `evaluation/run-2/` in this repo (log, diffs, summary)
- **Evaluation rubric**: `spinybacked-orbweaver/research/evaluation-rubric.md` (31 rules)
- **Codebase mapping**: `spinybacked-orbweaver/research/rubric-codebase-mapping.md`
- **Run-2 orb branch**: `orb/instrument-1773326732807` (instrumented code for comparison)

## Success Criteria

1. All run-2 bugs filed as issues on spinybacked-orbweaver with clear fix instructions
2. Fixes applied and verified in spinybacked-orbweaver before re-running
3. `orb instrument` creates a PR (no `--no-pr`)
4. Every file result evaluated — instrumented, skipped, or failed — with per-file assessment
5. Full 31-rule rubric scored with per-rule evidence
6. Wall-clock time recorded for full instrumentation run
7. Clear baseline comparison: run-3 vs run-2 vs run-1
8. Gap analysis with any new rubric gaps or spec gaps

## Milestones

- [ ] **File run-2 bugs on spinybacked-orbweaver** — Create issues for each finding from run-2. Each issue should describe what's wrong, evidence from the run, and what fix is needed (not how to implement it). Issues to file: (1) retry loop doesn't cover instrumentFile-level failures (elision, null output), (2) mega-bundle `@traceloop/node-server-sdk` used instead of individual packages, (3) tracer naming inconsistency across files, (4) NDS-003 retry exhaustion on journal-manager.js — agent consistently adds business logic.
- [ ] **Pre-run preparation** — Verify fixes are applied in spinybacked-orbweaver. Reset codebase to pre-instrumentation state (clean `src/` from run-2 changes). Verify `.env`, `orb.yaml`, `semconv/` symlink, `src/instrumentation.js` are in place. Review orb internals: understand retry behavior (maxFixAttempts), validation chain (tier 1 + tier 2), dependency strategy, and PR creation flow.
- [ ] **Evaluation run-3** — Execute `orb instrument src/ --verbose -y` (with PR creation enabled). Run in foreground for real-time status. Record wall-clock start and end time. Capture all output to `evaluation/run-3/orb-output.log`. Do NOT do a full dry-run first (single-file dry-run during pre-flight is sufficient).
- [ ] **Per-file evaluation** — Evaluate every single file result. For each instrumented file: verify span names, attribute usage against Weaver schema, tracer naming consistency, import correctness. For each skipped file (0 spans): verify the skip was correct. For each failure: determine if the failure was justified (legitimate limitation) or a bug (should have succeeded). Document in `evaluation/run-3/per-file-evaluation.md`.
- [ ] **Rubric scoring** — Apply full 31-rule rubric: 4 gate checks first (NDS-001, NDS-002, NDS-003, API-001), then 27 quality rules across 6 dimensions. Per-rule pass/fail with specific code evidence. Calculate overall pass rate and per-dimension scores.
- [ ] **Baseline comparison and synthesis** — Compare run-3 against run-2 and run-1. Key metrics: overall pass rate, per-dimension scores, files instrumented vs skipped, failures and failure modes, retry utilization, wall-clock time, total cost. Document improvements and regressions.
- [ ] **Actionable fix output** — Produce a single document addressed to the AI coding agent / spinybacked-orbweaver maintainer. List each remaining issue found in run-3 with: what's wrong, evidence (specific file, line, span), and what fix is needed. Keep it directive but not prescriptive — state the problem and desired outcome, not the implementation steps.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Fixes not applied before run-3 | Pre-run milestone explicitly verifies fixes are in place |
| Run-3 has new failure modes not in rubric | Gap analysis milestone looks for new rubric gaps |
| Orb PR creation fails (Phase 7 incomplete) | If PR creation fails, document the failure and capture output manually as in run-2 |
| Cost exceeds budget | Single-file dry-run provides cost ceiling estimate; run-2 was within budget |
| Datadog proxy intercepts API calls | Same workaround as run-2: `env -u ANTHROPIC_BASE_URL -u ANTHROPIC_CUSTOM_HEADERS` |

## Lessons Learned from Run-2 (Process)

These are encoded in the milestones but listed explicitly for reference:

1. **Use `--pr`** — The PR is a valuable evaluation artifact showing how the tool presents changes. Don't skip it.
2. **Run in foreground** — Stream output for real-time visibility. Don't run in background.
3. **Track wall-clock time** — Record start/end timestamps for the full instrumentation run.
4. **No full dry-run** — Single-file dry-run confirms the tool works; full dry-run wastes money with no additional signal.
5. **Understand orb internals first** — Before evaluating results, understand retry behavior, validation chain tiers, dependency strategy, and how failures propagate. This prevents misattributing failures.
6. **Evaluate every file** — Don't just check instrumented files. Verify correct skips and assess whether failures were justified.
7. **Source `.env` directly** — Don't use `vals exec` for running orb; source `.env` and use `env -u` to strip proxy vars.

## Prior Art

- **PRD #2**: Run-2 evaluation (this repo)
- **evaluation/run-2/**: Run-2 artifacts (log, diffs, summary)
- **spinybacked-orbweaver/research/evaluation-rubric.md**: 31-rule rubric
- **spinybacked-orbweaver/research/rubric-codebase-mapping.md**: Rule-to-code mapping

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-12 | Fix bugs before re-running | Re-running without fixes would produce similar results; fix-then-verify is more valuable |
| 2026-03-12 | Output format is fix instructions, not report | The evaluation should produce actionable work, not just documentation |
| 2026-03-12 | Individual instrumentation packages, not mega-bundles | Spec v3.8 explicitly says not to use mega-bundles; agent contradicted its own spec |
