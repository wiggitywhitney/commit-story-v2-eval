# PRD #3: Evaluation Run-3 — SpinybackedOrbWeaver with Fixes Applied

**Status:** In Progress (Compromised — see stale build note below)
**Created:** 2026-03-12
**GitHub Issue:** [#3](https://github.com/wiggitywhitney/commit-story-v2-eval/issues/3)
**Depends on:** PRD #2 (run-2 complete, findings documented)

---

## Stale Build Advisory

**Run-3 evaluated an old version of the orb agent.** The globally-installed `orb` binary is symlinked to the local spinybacked-orbweaver repo and runs from `dist/` (compiled TypeScript). Issues #61, #64, #65 were verified closed and merged to source (`src/agent/prompt.ts` updated Mar 13 07:08), but `npm run prepare` was never run — `dist/agent/prompt.js` was last built Mar 12 09:21, before the fixes were merged. Run-3 effectively re-evaluated the same agent as run-2.

**Impact:** Failures for API-003 (mega-bundle), CDQ-008 (tracer naming), and SCH-001 (span naming) are expected repeats — these fixes existed in source but were never compiled. The evaluation process, rubric application, and newly-discovered issues (API-002, CDQ-003, CDQ-007, token budget, null diagnostics, NDS-003 refactors, etc.) are still valid. The run produced 11 actionable orb issues and significant process improvements for PRD #4.

**PRD #4 must add a pre-run step:** `cd spinybacked-orbweaver && npm run prepare` — verify the build timestamp is after the latest fix merge.

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
- [x] **Evaluation run-3** — Executed `orb instrument src/ --verbose -y` in foreground. Main run: 16/21 succeeded, 5 failed (wall-clock 2,140s / 35.7 min). Supplemental re-runs with `maxTokensPerFile: 150000`: commit-analyzer.js succeeded (3 spans, 195s), journal-graph.js failed (oscillation, 469s), sensitive-filter.js failed again (null parsed_output, 339s). Final tally: **17 succeeded, 4 failed, 0 skipped**. PR creation failed (git push auth in vals environment) — branches exist locally (`orb/instrument-1773434669510`, `orb/instrument-1773438620295`). All output captured to `evaluation/run-3/orb-output.log`. 11 orb issues identified and documented in `evaluation/run-3/orb-issues-to-file.md`, each with acceptance criteria tied to specific commit-story-v2-eval files as practice targets.
- [x] **Per-file evaluation** — Full 31-rule rubric applied to all 21 files. Gates: 4/4 pass (NDS-001/002/003, API-001). Quality: 19/26 applicable pass (73%). NDS 100%, COV 100%, RST 100%, API 33%, SCH 50%, CDQ 57%. 7 failures: API-002 (agent made @opentelemetry/api optional — new regression), API-003 (mega-bundle — stale build repeat), SCH-001 (4+ span naming patterns — stale build repeat), SCH-002 (2 ad-hoc attributes not in registry), CDQ-003 (2 spans missing recordException), CDQ-007 (PII in commit_story.commit.author — schema-defined), CDQ-008 (2 tracer naming conventions — stale build repeat). Zero-span: 6/6 correctly skipped. Failed: 4 files with root causes in orb-issues-to-file.md. PR artifact: git push auth failure assessed, prevention in orb issues #12/#13. **Critical discovery: run used stale orb build** — fixes #61/#64/#65 were in source but dist/ was not rebuilt. Issues doc consolidated to 11 issues. Documented in `evaluation/run-3/per-file-evaluation.md` and `evaluation/run-3/lessons-for-prd4.md`.
- [x] **Rubric scoring** — Full 31-rule rubric synthesized into `evaluation/run-3/rubric-scores.md` (run-2-compatible format). Gates: 4/4 pass. Quality: 19/26 applicable pass (73%). Per-dimension: NDS 2/2 (100%), COV 6/6 (100%), RST 4/4 (100%), API 1/3 (33%), SCH 2/4 (50%), CDQ 4/7 (57%). 7 failures classified: 3 stale build repeats (API-003, SCH-001, CDQ-008), 1 new regression (API-002), 2 genuine new findings (SCH-002, CDQ-003), 1 schema design issue (CDQ-007). Files: 11 instrumented, 6 correctly skipped, 4 failed. Wall-clock: 35.7 min main + 16.7 min supplemental.
- [ ] **Baseline comparison and synthesis** — Compare run-3 against run-2 and run-1. Run-2 baseline: 74% quality (20/27), 4/4 gates, NDS 100%, COV 67-100%, RST 100%, API 0%, SCH 75%, CDQ 86%, 10 files instrumented, 7 skipped, 4 failed, 0 patches, first-try success. Key metrics: overall pass rate, per-dimension scores, files instrumented vs skipped, failures and failure modes, retry utilization, wall-clock time, total cost. Document improvements and regressions.
- [ ] **Actionable fix output** — Produce a single document addressed to the AI coding agent / spinybacked-orbweaver maintainer. List each remaining issue found in run-3 with: what's wrong, evidence (specific file, line, span), and what fix is needed. Keep it directive but not prescriptive — state the problem and desired outcome, not the implementation steps. Also assess the 3 rubric gaps from run-2 (API-004 SDK setup carve-out, coverage partial scoring, module system correctness rule) and propose rubric updates if confirmed.
- [ ] **Draft PRD #4 for next evaluation run** — Create a PRD for evaluation run-4 following the structure of this PRD. Primary input: `evaluation/run-3/lessons-for-prd4.md` (rubric gaps, process improvements, evaluation methodology changes collected during run-3). Also incorporate run-3 scores as baselines, carry forward unresolved bugs/spec gaps/rubric gaps, and encode process lessons. The goal is a self-improving evaluation chain where each run's PRD encodes the lessons of previous runs.

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
| 2026-03-13 | Increase maxTokensPerFile to 150000 for supplemental runs | Default 80K was too low for commit-analyzer.js (88K) and journal-graph.js (94K in run-2). 150K gives 1.5x headroom |
| 2026-03-13 | Use `vals exec -i` instead of `source .env` for API keys | `source .env` doesn't export to subshells created by pipes; `vals exec -i` properly injects secrets while inheriting PATH |
| 2026-03-13 | Add practice files as acceptance criteria for orb issues | Each orb issue should have specific commit-story-v2-eval files that must succeed. Ties fixes to measurable outcomes in run-4 |
| 2026-03-13 | Group orb issues by code touched when filing | Prevents merge conflicts when multiple issues affect the same orb source files |
| 2026-03-13 | commit-story-v2 is a library, not an application — `@opentelemetry/api` correctly in `peerDependencies` | commit-story-v2 is a distributable npm package. OTel API uses a global singleton; multiple copies cause silent no-op fallbacks. The rubric-codebase-mapping incorrectly classifies it as "a CLI tool (application)" at line 600 — this is a mapping error, not a rubric error. The rubric definition (API-002) and global CLAUDE.md "OpenTelemetry Packaging" rules are consistent and correct. |
| 2026-03-13 | Per-file evaluation must use full 31-rule rubric, not an improvised subset | An initial evaluation framework only covered ~13/31 rules, missing COV-006 (auto-instrumentation preference), all gate checks, most NDS/API rules. The rubric exists for a reason — use it systematically. Rules not applicable to this codebase should be marked N/A with rationale, not silently dropped. |
| 2026-03-13 | COV-006 applies to LangChain/LangGraph — OpenLLMetry provides auto-instrumentation | The rubric-codebase-mapping incorrectly says "No OTel auto-instrumentation package" for `@langchain/anthropic` and `@langchain/langgraph`. OpenLLMetry (`@traceloop/instrumentation-langchain`) exists. The agent should prefer auto-instrumentation libraries over manual spans for LLM operations. Needs research to confirm exact coverage before scoring. |
| 2026-03-13 | Create `evaluation/run-3/lessons-for-prd4.md` to collect forward-looking improvements | Lessons, rubric gaps, process improvements, and evaluation methodology changes discovered during run-3 evaluation should be captured in a dedicated document that feeds directly into PRD #4 drafting. |
| 2026-03-13 | PR artifact evaluation is part of per-file milestone | Run-3's PR creation failed (git push auth). The evaluation should assess: why it was lost, what artifacts were lost, how to prevent in run-4. If reconstructable from local branches, evaluate PR content quality (sections, accuracy, completeness). |
| 2026-03-13 | Evaluation output should follow rubric's structured format | The rubric specifies: `{rule_id} \| {pass\|fail} \| {file_path}:{line_number} \| {actionable_message}`. Per-file evaluation should use this format for machine-readability and potential future use in orb's fix loop. |
| 2026-03-13 | RST-005 is N/A for this codebase (no prior instrumentation) | Only code-level rule that doesn't apply. All other 30 rules apply, including CDQ-007 (PII) because `commit_story.commit.author` is a person's name. |
| 2026-03-13 | Run-3 used stale orb build — effectively re-evaluated run-2 agent | `dist/agent/prompt.js` (Mar 12 09:21) was compiled before fixes #61/#64/#65 merged to source (Mar 13 07:08). `npm run prepare` was never run. API-003, CDQ-008, SCH-001 "repeat failures" are expected. Process, rubric, and newly-discovered issues remain valid. PRD #4 must add explicit rebuild step. |
| 2026-03-13 | Per-file evaluation complete: 4/4 gates pass, 19/26 quality rules pass (73%) | Full 31-rule rubric applied to all 21 files. 11 instrumented with spans, 6 correctly skipped, 4 failed. 7 quality rule failures: API-002 (new regression), API-003/CDQ-008/SCH-001 (stale build repeats), SCH-002, CDQ-003, CDQ-007. Issues doc consolidated from 13 to 11 issues (folded #10→#1, #11→#2). |
