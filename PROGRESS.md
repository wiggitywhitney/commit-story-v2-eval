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
