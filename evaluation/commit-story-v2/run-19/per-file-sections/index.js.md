### 11. src/index.js (1 span, 1 attempt)

This file is the P1 priority target for run-19: it failed NDS-003 in both runs 17 and 18 due to the reconciler offset gap collapsing multi-line import statements. PRD #845 addressed the gap, and the fix is confirmed here — 1-attempt success, no validator rejection. The committed instrumentation wraps `main()` in a single `startActiveSpan('commit_story.cli.main')` call with two attributes: `vcs.ref.head.revision` set unconditionally from `commitRef` (which has a default value of `'HEAD'` and is never null), and `commit_story.cli.subcommand` set conditionally when `subcommand != null`. The conditional guard for `subcommand` is correct CDQ-007 practice — the field is null in the default invocation path.

All sync helpers (`debug`, `parseArgs`, `showHelp`, `isGitRepository`, `isValidCommitRef`, `validateEnvironment`, `getPreviousCommitTime`) are correctly excluded per RST-001. `handleSummarize` is an unexported async function but is invoked only from within `main()` and has no independent entry-point status — RST-004 applies, and COV-001's override for process entry points does not extend to it. Coverage through `main()`'s span is sufficient.

The span structure uses `try/catch/finally`: the `catch` block calls `span.recordException(error)`, `span.setStatus({ code: SpanStatusCode.ERROR })`, and rethrows; `finally` calls `span.end()`. This correctly handles the error propagation path. However, `main()` contains multiple `process.exit()` calls on validation-failure paths (not-a-git-repo, invalid commit ref, invalid environment, journal-only commit, empty merge) that execute before the `finally` block can run, causing span leaks on those paths. This is a known CDQ-001 limitation acknowledged in agent notes — explicit `span.end()` before each `process.exit()` would be required to fully close the span on those branches, which the instrumentation does not do. The `process.exit(EXIT_SUCCESS)` at the end of the happy path is the primary case; the early-exit validation paths are the leak surface. Flagged as CDQ-001 known limitation rather than a blocking failure, consistent with run-18 methodology for this file.

The inner `try/catch` in the auto-summarize block (`if (config.autoSummarize)`) is original graceful-degradation code that swallows errors to prevent auto-summarize failures from blocking the main flow. It is preserved intact inside the `startActiveSpan` callback — NDS-005 passes. The span name `commit_story.cli.main` and extension attribute `commit_story.cli.subcommand` are new in run-19; both follow the `commit_story.<category>.<operation>` naming convention.

| Rule | Result |
|------|--------|
| NDS-003 | PASS — PRD #845 fix confirmed; multi-line import statements preserved verbatim; all closing punctuation intact; 1-attempt success where runs 17–18 failed |
| NDS-004 | PASS — no function signatures altered; `main()` signature unchanged |
| NDS-005 | PASS — inner auto-summarize `try/catch` (graceful-degradation; swallows errors intentionally) preserved inside `startActiveSpan` callback; NDS-005 advisory is a false positive here, same as run-12 |
| NDS-006 | PASS — all JSDoc blocks, `/** Exit codes */` comment, and inline comments preserved |
| API-001 | PASS — `@opentelemetry/api` only; `{ trace, SpanStatusCode }` imported correctly |
| COV-001 | PASS — `main()` is the process entry point and has a span; COV-001 override for entry points applies |
| COV-003 | PASS — no outbound HTTP or database calls in this file |
| COV-004 | PASS — `main()` is the sole async function requiring a span; `handleSummarize` (unexported, called only from `main()`) is covered by RST-004; all sync helpers correctly excluded per RST-001 |
| COV-005 | PASS — `vcs.ref.head.revision` captures the active commit reference; `commit_story.cli.subcommand` captures the routing decision when a subcommand is present; attribute selection is appropriate for the CLI dispatch role of this function |
| COV-006 | N/A — no auto-instrumented library calls in this file |
| RST-001 | PASS — `debug`, `parseArgs`, `showHelp`, `isGitRepository`, `isValidCommitRef`, `validateEnvironment`, `getPreviousCommitTime` are all sync and correctly excluded |
| RST-004 | PASS — `handleSummarize` is unexported; RST-004 exemption applies; no span needed |
| SCH-001 | PASS — `commit_story.cli.main` follows the `commit_story.<category>.<operation>` convention; `commit_story.cli.subcommand` is a coherent extension |
| SCH-002 | PASS — `vcs.ref.head.revision` is a registered OTel VCS ref in `semconv/attributes.yaml`; `commit_story.cli.subcommand` is a new extension (not in conflict with any registered key) |
| SCH-003 | PASS — `vcs.ref.head.revision` is always a string (default `'HEAD'`); `commit_story.cli.subcommand` is a string when set |
| SCH-004 | N/A — no additional extension attributes that might duplicate standard keys |
| CDQ-001 | KNOWN LIMITATION — `span.end()` is in `finally` and covers the normal return path, but multiple `process.exit()` calls on validation-failure paths (not-a-git-repo, invalid ref, invalid env, journal-only skip, empty merge skip) execute before `finally` runs, causing span leaks on those branches; consistent with runs 12–17 for this file; explicit `span.end()` before each `process.exit()` would fully close the span |
| CDQ-002 | PASS — `startActiveSpan` callback pattern; no manual context propagation |
| CDQ-003 | PASS — no redundant `span.end()` outside `finally` |
| CDQ-005 | PASS — `startActiveSpan` with async callback |
| CDQ-006 | PASS — `SpanStatusCode.ERROR` set only in catch block; no status set on success path |
| CDQ-007 | PASS — `commitRef` has a default of `'HEAD'` and is never null; `commit_story.cli.subcommand` guarded with `subcommand != null` before setAttribute |
| CDQ-009 | N/A — span name is a literal string |
| CDQ-010 | N/A — no array attributes set |

**Failures**: None. **P1 RUN18-1 status: RESOLVED** — PRD #845 fix confirmed; NDS-003 reconciler offset gap no longer triggers on multi-line import collapse; 1-attempt success after 2 failed attempts in run-17 and 2 failed attempts in run-18. CDQ-001 `process.exit()` span-leak paths are a known architectural limitation of this file's design, not a new regression.
