# PRD #3: Evaluation Run-3 — SpinybackedOrbWeaver with Fixes Applied

**Status:** In Progress
**Created:** 2026-03-12
**GitHub Issue:** [#3](https://github.com/wiggitywhitney/commit-story-v2-eval/issues/3)
**Depends on:** PRD #2 (run-2 complete, findings documented)

---

## Problem Statement

Run-2 of the SpinybackedOrbWeaver evaluation (PRD #2) scored 74% on quality rules (20/27 pass, 4/4 gates pass) with 17/21 files succeeding. The evaluation found 5 bugs, 4 spec gaps, and 3 rubric gaps that need addressing before the tool can be considered release-ready.

### Bugs Filed (spinybacked-orbweaver issues #61-#69)

| Issue | Finding | Priority |
|-------|---------|----------|
| [#61](https://github.com/wiggitywhitney/spinybacked-orbweaver/issues/61) | Mega-bundle `@traceloop/node-server-sdk` instead of individual packages | High |
| [#62](https://github.com/wiggitywhitney/spinybacked-orbweaver/issues/62) | CJS `require()` in ESM projects — no `package.json` type detection | High |
| [#63](https://github.com/wiggitywhitney/spinybacked-orbweaver/issues/63) | Elision and null parsed output bypass retry loop | High |
| [#64](https://github.com/wiggitywhitney/spinybacked-orbweaver/issues/64) | Tracer name inconsistent across files | Medium |
| [#65](https://github.com/wiggitywhitney/spinybacked-orbweaver/issues/65) | Span names don't consult Weaver schema `spans[].name` | Medium |
| [#66](https://github.com/wiggitywhitney/spinybacked-orbweaver/issues/66) | Spec: define module system detection strategy | Medium |
| [#67](https://github.com/wiggitywhitney/spinybacked-orbweaver/issues/67) | Spec: clarify SDK dependency placement for libraries | Medium |
| [#68](https://github.com/wiggitywhitney/spinybacked-orbweaver/issues/68) | Spec: classify retryable vs terminal failure types | Medium |
| [#69](https://github.com/wiggitywhitney/spinybacked-orbweaver/issues/69) | Spec: define strategy for files exceeding token budget | Low |

### Run-2 Scores (baseline for run-3 comparison)

| Dimension | Score |
|-----------|-------|
| Non-Destructiveness | 2/2 (100%) |
| Coverage | 4/6 + 2 partial (67-100%) |
| Restraint | 5/5 (100%) |
| API-Only Dependency | 0/3 (0%) |
| Schema Fidelity | 3/4 (75%) |
| Code Quality | 6/7 (86%) |
| **Overall quality** | **20/27 (74%)** |

### Rubric Gaps Found in Run-2

These affect how we score, not how orb behaves:
1. **API-004 needs SDK setup file carve-out** — the SDK init file is *supposed* to import SDK packages; the rule should exclude the configured `sdkInitFile`
2. **Coverage partials need clearer scoring** — COV-002/COV-004 scored "partial" because files failed entirely; rubric should define how to score partially-failed runs
3. **No rule for module system correctness** — CJS `require()` in an ESM project passes `node --check` but fails at runtime; need a new rule (e.g., NDS-006)

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

1. ~~All run-2 bugs filed as issues on spinybacked-orbweaver with clear fix instructions~~ Done: #61-#69
2. Fixes applied and verified in spinybacked-orbweaver before re-running
3. `orb instrument` creates a PR (no `--no-pr`)
4. Every file result evaluated — instrumented, skipped, or failed — with per-file assessment
5. Full 31-rule rubric scored with per-rule evidence
6. Wall-clock time recorded for full instrumentation run
7. Clear baseline comparison: run-3 vs run-2 vs run-1
8. Gap analysis with any new rubric gaps or spec gaps

## Milestones

- [x] **File run-2 findings on spinybacked-orbweaver** — 9 issues filed (#61-#69): 5 bugs (mega-bundle, CJS in ESM, retry loop gap, tracer naming, span naming) + 4 spec gaps (module system detection, SDK placement, retry classification, token budget strategy). Each issue references `commit-story-v2-eval/evaluation/run-2/` documentation (gap-analysis.md, rubric-scores.md, relevant diffs). See `evaluation/run-2/gap-analysis.md` for the full analysis.
- [x] **Pre-run preparation** — All 5 bug fixes (#61-#65) verified closed as COMPLETED. Codebase clean on main (no run-2 artifacts). Moved Weaver schema to canonical `semconv/` location on main (PR #5). Added `orb.yaml`, `src/instrumentation.js` (ESM, graceful shutdown), and OTel peerDependencies to main permanently — future eval runs start from this clean state. Reviewed orb internals: retry behavior (1 + maxFixAttempts attempts, retryable = null/elision only), validation chain (tier 1 short-circuits, tier 2 blocking + advisory), dependency strategy, and PR creation flow.
- [ ] **Evaluation run-3** — Execute `orb instrument src/ --verbose -y` (with PR creation enabled). Run in foreground for real-time status. Record wall-clock start and end time. Capture all output to `evaluation/run-3/orb-output.log`. Do NOT do a full dry-run first (single-file dry-run during pre-flight is sufficient).
- [ ] **Per-file evaluation** — Evaluate every single file result. For each instrumented file: verify span names, attribute usage against Weaver schema, tracer naming consistency, import correctness, and semantic convention usage (the registry declares OTel semconv v1.37.0 as a dependency — verify the agent uses standard semconv attribute names like `db.system`, `http.method` where applicable instead of inventing custom names for concepts semconv already covers). For each skipped file (0 spans): verify the skip was correct. For each failure: determine if the failure was justified (legitimate limitation) or a bug (should have succeeded). Document in `evaluation/run-3/per-file-evaluation.md`.
- [ ] **Rubric scoring** — Apply full 31-rule rubric: 4 gate checks first (NDS-001, NDS-002, NDS-003, API-001), then 27 quality rules across 6 dimensions. Per-rule pass/fail with specific code evidence. Calculate overall pass rate and per-dimension scores.
- [ ] **Baseline comparison and synthesis** — Compare run-3 against run-2 and run-1. Run-2 baseline: 74% quality (20/27), 4/4 gates, NDS 100%, COV 67-100%, RST 100%, API 0%, SCH 75%, CDQ 86%, 10 files instrumented, 7 skipped, 4 failed, 0 patches, first-try success. Key metrics: overall pass rate, per-dimension scores, files instrumented vs skipped, failures and failure modes, retry utilization, wall-clock time, total cost. Document improvements and regressions.
- [ ] **Actionable fix output** — Produce a single document addressed to the AI coding agent / spinybacked-orbweaver maintainer. List each remaining issue found in run-3 with: what's wrong, evidence (specific file, line, span), and what fix is needed. Keep it directive but not prescriptive — state the problem and desired outcome, not the implementation steps. Also assess the 3 rubric gaps from run-2 (API-004 SDK setup carve-out, coverage partial scoring, module system correctness rule) and propose rubric updates if confirmed.
- [ ] **Draft PRD #4 for next evaluation run** — Create a PRD for evaluation run-4 following the structure of this PRD. Incorporate process improvements discovered during run-3 (what worked, what didn't, what to change). Update baselines with run-3 scores. Carry forward any unresolved bugs, spec gaps, or rubric gaps. The goal is a self-improving evaluation chain where each run's PRD encodes the lessons of previous runs.

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
- **evaluation/run-2/run-summary.md**: Run execution results (17/21 succeeded, 4 failed, failure analysis)
- **evaluation/run-2/rubric-scores.md**: Full 31-rule scoring with per-rule evidence
- **evaluation/run-2/baseline-comparison.md**: Run-2 vs run-1 comparison
- **evaluation/run-2/gap-analysis.md**: Bug analysis, spec gaps, rubric gaps, and filed issues
- **evaluation/run-2/instrumentation.diff**: Full diff of all instrumented source files
- **evaluation/run-2/sdk-setup.diff**: SDK init file and dependency changes
- **spinybacked-orbweaver issues #61-#69**: Filed findings with fix instructions
- **spinybacked-orbweaver/research/evaluation-rubric.md**: 31-rule rubric
- **spinybacked-orbweaver/research/rubric-codebase-mapping.md**: Rule-to-code mapping

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-12 | Fix bugs before re-running | Re-running without fixes would produce similar results; fix-then-verify is more valuable |
| 2026-03-12 | Output format is fix instructions, not report | The evaluation should produce actionable work, not just documentation |
| 2026-03-12 | Individual instrumentation packages, not mega-bundles | Spec v3.8 explicitly says not to use mega-bundles; agent contradicted its own spec |
| 2026-03-13 | Move Weaver schema to `semconv/` on main permanently | Evaluation config (orb.yaml, instrumentation.js, schema) should live on main so every eval run starts from a clean state instead of recreating config each time |
| 2026-03-13 | OTel SDK as required peerDependency, not optional | instrumentation.js unconditionally imports sdk-node; marking it optional contradicts the import. Libraries declare peers, deployers provide the SDK |
| 2026-03-13 | Add "Draft PRD #4" as final milestone | Each eval PRD should end by drafting the next one, creating a self-improving chain that encodes process lessons while fresh |
