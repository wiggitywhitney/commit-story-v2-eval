### 7. utils/journal-paths.js (1 span, 1 attempt)

Single span on `ensureDirectory` (sole exported async). Eleven pure sync utilities correctly skipped per RST-001. 1-attempt success, identical to runs 16–18 — this file is a stable benchmark for clean single-function instrumentation.

The agent correctly identified `ensureDirectory` as the only candidate: the twelve remaining exports (`getYearMonth`, `getDateString`, `getJournalEntryPath`, `getReflectionPath`, `getContextPath`, `getReflectionsDirectory`, `parseDateFromFilename`, `getJournalRoot`, `getISOWeekString`, `getSummaryPath`, `getSummariesDirectory`) are all synchronous path-building utilities with no I/O, and RST-001 exempts them. The span name `commit_story.journal.ensure_directory` is declared as a new schema extension (SCH-001 pass). The `commit_story.journal.file_path` attribute is registered in `semconv/attributes.yaml` under `registry.commit_story.journal` with `type: string`, matching the string `filePath` parameter (SCH-002 and SCH-003 pass). The try/catch/finally pattern is correct: `recordException` + `ERROR` status on failure, `span.end()` in `finally`, error rethrow preserved. No original control flow was altered.

CDQ-007 advisory from runs 16–17 (raw full path rather than `path.basename`) carries forward unchanged — `filePath` is a full path string, and `path.basename` is not imported. This is a known, documented limitation rather than a failure: the attribute value is non-null, has correct type, and the schema definition does not constrain path format. CDQ-002 and CDQ-003 are not applicable (single span, no parallel spans or sequential chaining). CDQ-006 is not applicable (no span links or baggage).

| Rule | Result |
|------|--------|
| NDS-003 | PASS |
| NDS-004 | PASS |
| NDS-005 | PASS — new catch rethrows; original had no catch |
| NDS-006 | PASS |
| API-001 | PASS |
| COV-001 | PASS — `ensureDirectory` has span |
| COV-003 | PASS — recordException + ERROR + rethrow in catch; span.end() in finally |
| COV-004 | PASS — sole exported async; 11 sync utilities skipped |
| COV-005 | PASS — `commit_story.journal.file_path` captures the filePath argument |
| RST-001 | PASS — 11 sync path-building helpers correctly skipped |
| RST-004 | PASS |
| SCH-001 | PASS — `commit_story.journal.ensure_directory` declared as extension |
| SCH-002 | PASS — `commit_story.journal.file_path` is registered in attributes.yaml |
| SCH-003 | PASS — `filePath` is string, matches `type: string` |
| CDQ-001 | PASS |
| CDQ-002 | SKIP — single span, no parallel span coordination |
| CDQ-003 | SKIP — single span, no sequential chaining |
| CDQ-005 | PASS |
| CDQ-006 | SKIP — no span links or baggage |
| CDQ-007 | ADVISORY — raw full path set unconditionally; `path.basename` not imported; known limitation from runs 16–17, same behavior as run-18 |

**Failures**: None.
