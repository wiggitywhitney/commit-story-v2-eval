# Progress Log

Development progress log for commit-story-v2-eval. Tracks implementation milestones across PRD work.

Entry format: `- (YYYY-MM-DD) Description of feature-level change (PRD #X, milestone)`

## [Unreleased]

### Added
- (2026-03-13) Moved Weaver schema to canonical `semconv/` location on main (PRD #3, pre-run preparation)
- (2026-03-13) Added `orb.yaml`, `src/instrumentation.js`, and OTel peerDependencies as permanent eval config on main (PRD #3, pre-run preparation)
- (2026-03-13) Added graceful shutdown handling to OTel SDK init file (PRD #3, pre-run preparation)
- (2026-03-13) Added "Draft PRD #4" milestone to create self-improving evaluation chain (PRD #3)
- (2026-03-13) Completed evaluation run-3: 17/21 files succeeded, 4 failed. Documented 11 orb issues with acceptance criteria tied to practice files (PRD #3, evaluation run-3)
- (2026-03-13) Increased maxTokensPerFile to 150000 in orb.yaml — rescued commit-analyzer.js from token budget failure (PRD #3, evaluation run-3)
- (2026-03-13) Completed per-file evaluation: full 31-rule rubric on all 21 files — 4/4 gates pass, 19/26 quality (73%). Discovered stale orb build invalidates run-3 as a test of fixes #61/#64/#65 (PRD #3, per-file evaluation)
- (2026-03-13) Consolidated orb issues doc from 13 to 11 issues — folded token budget disable into #1, sensitive-filter.js into #2 (PRD #3, per-file evaluation)
- (2026-03-13) Completed rubric scoring: synthesized per-file evaluation into run-2-compatible rubric-scores.md with failure classification — 3 stale build repeats, 1 new regression, 2 new findings, 1 schema issue (PRD #3, rubric scoring)
- (2026-03-13) Completed baseline comparison: full 3-run comparison across all dimensions, file outcomes, failure modes, timing, and cross-run trends. Run-3 73% vs run-2 74% — core instrumentation quality (NDS/COV/RST) at 100%, remaining failures in dependency/naming (PRD #3, baseline comparison)
- (2026-03-13) Completed actionable fix output: directive document for orb maintainer with 7 quality failures prioritized by type, 4 failed files with root causes, 3 process issues, and run-2 rubric gap assessment including NDS-006 proposal (PRD #3, actionable fix output)
