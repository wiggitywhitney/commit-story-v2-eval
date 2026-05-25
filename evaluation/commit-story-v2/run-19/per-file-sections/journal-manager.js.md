### 8. managers/journal-manager.js (2 spans, 1 attempt)

The agent placed spans on both exported async functions: `saveJournalEntry` (span name `commit_story.journal.save_entry`) and `discoverReflections` (span name `commit_story.journal.discover_reflections`). Both span names are registered schema extensions. `formatJournalEntry` (exported, sync) was correctly left uninstrumented per RST-001. Ten unexported sync helpers — `extractFilesFromDiff`, `countDiffLines`, `formatReflectionsSection`, `parseReflectionEntry`, `parseTimeString`, `parseReflectionsFile`, `isInTimeWindow`, `getYearMonthRange`, `formatTimestamp`, `parseDateFromFilename` — were correctly skipped per RST-001 and RST-004. Single-attempt success: the committed code passed the validator without retries, a meaningful improvement over run-18's two attempts.

`saveJournalEntry` receives four attributes: `commit_story.journal.file_path` (the computed entry path), `commit_story.journal.entry_date` (the commit timestamp rendered as a YYYY-MM-DD ISO string), `vcs.ref.head.revision` (from `commit.hash`), and `commit_story.commit.files_changed` (from `commit.filesChanged`). All four are set before the first I/O call. The schema references are all registered: `commit_story.journal.file_path` and `commit_story.journal.entry_date` are defined in the journal attribute group; `vcs.ref.head.revision` is a standard OTel VCS attribute; `commit_story.commit.files_changed` is a custom commit attribute. The four setAttributes appear unconditionally. `commit.hash` and `commit.filesChanged` are not null-guarded, but the run context indicates the agent elected to set these unconditionally — consistent with how run-18's attempt 2 resolved the NDS-003/CDQ-007 tension for these same fields. CDQ-007 risk is real but narrow: the JSDoc marks `commit.hash` (`commit.hash` is the full hash used for `vcs.ref.head.revision`) and `commit.filesChanged` as required fields in the commit object. The risk is documented rather than eliminated.

Error handling in `saveJournalEntry` follows the established pattern: the outer `try` covers all I/O, `catch` calls `span.recordException(error)` and `span.setStatus({ code: SpanStatusCode.ERROR })`, and `finally` calls `span.end()`. The inner ENOENT catch block (the file-not-found path inside the duplicate-check `readFile` call) is preserved and still empty — this is intentional graceful degradation, not swallowed error suppression. NDS-005 is satisfied: the original catch block exists and is preserved; the span's outer catch is additive. `startActiveSpan` with `async (span)` is correct.

`discoverReflections` receives three attributes: `commit_story.context.time_window_start` and `commit_story.context.time_window_end` (both set at span entry as `.toISOString()` strings from the `startTime`/`endTime` parameters), and `commit_story.journal.quotes_count` set at the end of the function body to `reflections.length`. The time window attributes are correctly placed, correctly typed (string, matching ISO 8601 format), and registered in the schema. The two inner empty `catch` blocks in the discovery loop — one for missing directories (`readdir` fail) and one for unreadable files (`readFile` fail) — are preserved verbatim. These are deliberate graceful-degradation paths: the function must continue scanning remaining directories even when one is absent or unreadable. NDS-005 is satisfied.

The `commit_story.journal.quotes_count` attribute assignment is a **SCH-002 failure** that recurs from run-18. The schema definition for `commit_story.journal.quotes_count` reads: "Number of developer quotes extracted for the entry" (see `semconv/attributes.yaml`, `registry.commit_story.journal` group). That definition is in the journal generation context — quotes are AI-extracted developer dialogue, not filesystem-discovered reflection files. `discoverReflections` performs directory traversal and markdown parsing to find reflection entries written by the developer as standalone files; the count of those discovered files is semantically distinct from a count of AI-extracted quotes. The agent's stated reasoning — "aligns with reflections being developer-written content" — confuses the type of content (developer-written) with the operation class (AI extraction vs. filesystem discovery). The correct attribute is `commit_story.journal.reflections_count`, which was used in run-17 via agent-extensions.yaml and was still present in the schema at that time. This is a second-consecutive recurrence: the same file, the same attribute, the same misidentification, two runs in a row.

| Rule | Result |
|------|--------|
| NDS-003 | PASS |
| API-001 | PASS |
| NDS-006 | PASS |
| NDS-004 | PASS |
| NDS-005 | PASS — outer ENOENT catch in saveJournalEntry and two inner empty catches in discoverReflections loop all preserved; all are intentional graceful-degradation paths |
| COV-001 | PASS — both exported async functions have entry-point spans |
| COV-003 | PASS — both spans: try/catch with recordException + SpanStatusCode.ERROR + rethrow, finally with span.end() |
| COV-004 | PASS — saveJournalEntry and discoverReflections are the only exported async functions; formatJournalEntry is exported and sync, correctly skipped per RST-001 |
| COV-005 | PASS — saveJournalEntry: file_path, entry_date, vcs.ref.head.revision, commit.files_changed; discoverReflections: time_window_start, time_window_end, quotes_count |
| RST-001 | PASS — formatJournalEntry (exported sync) and all 10 unexported sync helpers correctly skipped |
| RST-004 | PASS |
| SCH-001 | PASS — commit_story.journal.save_entry and commit_story.journal.discover_reflections are registered schema extensions |
| SCH-002 | **FAIL** — `commit_story.journal.quotes_count` is defined as "Number of developer quotes extracted for the entry" (AI journal generation context). `discoverReflections` counts filesystem-discovered reflection markdown files — a different operation class. Semantic mismatch is identical to run-18 failure. Correct attribute: `commit_story.journal.reflections_count`. Second-consecutive recurrence on this file. |
| SCH-003 | PASS — time_window_start/end rendered via .toISOString() (string); quotes_count is reflections.length (int matching type: int) |
| CDQ-001 | PASS |
| CDQ-002 | PASS |
| CDQ-003 | PASS |
| CDQ-005 | PASS |
| CDQ-007 | ADVISORY — vcs.ref.head.revision and commit_story.commit.files_changed set unconditionally from commit.hash and commit.filesChanged; JSDoc marks these as required fields, so practical risk is low, but no explicit null guard is present |

**Failures**: **SCH-002** (second-consecutive recurrence) — `commit_story.journal.quotes_count` semantically mismatched for reflection discovery. Defined as AI-extracted quote count; used here for filesystem-discovered reflection file count. Correct attribute: `commit_story.journal.reflections_count`.
